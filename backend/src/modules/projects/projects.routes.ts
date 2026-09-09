import { ProjectStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { computeFinancials, filterFinancialsForRole } from "../../lib/rbac";
import { authenticate, requireRole, type AuthUser } from "../../middleware/auth";
import { AppError, overrideShipmentHold, recordPayment, transitionProjectStatus, updateProject } from "./projects.service";

export const projectsRouter = Router();
projectsRouter.use(authenticate);

const MARGIN_ALERT_THRESHOLD = 20;

function needsAttention(project: {
  status: ProjectStatus;
  dueDate: Date | null;
  nextAction: string | null;
}, financials: ReturnType<typeof computeFinancials>) {
  const overdue = Boolean(
    project.dueDate && project.dueDate < new Date() && project.status !== "CLOSED",
  );
  const missingNextAction = !project.nextAction && project.status !== "CLOSED";
  const lowMargin = financials?.marginPercent != null && financials.marginPercent < MARGIN_ALERT_THRESHOLD;
  const blockedShipment = Boolean(
    project.status === "SHIPPING" && financials && financials.customerBalance > 0,
  );

  return {
    overdue,
    missingNextAction,
    lowMargin,
    blockedShipment,
    any: overdue || missingNextAction || lowMargin || blockedShipment,
  };
}

function serializeProject(
  project: Awaited<ReturnType<typeof loadProjectById>>,
  role: AuthUser["role"],
) {
  if (!project) return null;
  const financials = computeFinancials(project.financial);

  return {
    id: project.id,
    projectName: project.projectName,
    status: project.status,
    nextAction: project.nextAction,
    dueDate: project.dueDate,
    description: project.description,
    lastUpdate: project.lastUpdate,
    createdAt: project.createdAt,
    owner: project.owner ? { id: project.owner.id, name: project.owner.name } : null,
    customer: project.customer
      ? { id: project.customer.id, name: project.customer.name, country: project.customer.country }
      : null,
    supplier: project.supplier
      ? { id: project.supplier.id, name: project.supplier.name, country: project.supplier.country }
      : null,
    financial: filterFinancialsForRole(financials, role),
    needsAttention: needsAttention(project, financials),
    shipmentHoldOverridden: project.shipmentHoldOverridden,
  };
}

function loadProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: { financial: true, customer: true, supplier: true, owner: true },
  });
}

projectsRouter.get("/", async (req, res) => {
  const projects = await prisma.project.findMany({
    include: { financial: true, customer: true, supplier: true, owner: true },
    orderBy: { lastUpdate: "desc" },
  });
  res.json(projects.map((p) => serializeProject(p, req.user!.role)));
});

projectsRouter.get("/:id", async (req, res) => {
  const project = await loadProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  const activities = await prisma.activity.findMany({
    where: { projectId: req.params.id },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    ...serializeProject(project, req.user!.role),
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt,
      user: a.user ? { id: a.user.id, name: a.user.name } : null,
    })),
  });
});

const createProjectSchema = z.object({
  projectName: z.string().min(1),
  customerId: z.string().min(1),
  nextAction: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  description: z.string().optional(),
  estimatedRevenue: z.coerce.number().nonnegative().default(0),
  currency: z.enum(["USD", "EUR", "LBP"]).default("USD"),
}).strict();

// RFQ intake — Sales owns creation; Admin can also create directly.
projectsRouter.post("/", requireRole("ADMIN", "SALES"), async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const data = parsed.data;

  const project = await prisma.project.create({
    data: {
      projectName: data.projectName,
      customerId: data.customerId,
      ownerId: req.user!.id,
      nextAction: data.nextAction,
      dueDate: data.dueDate,
      description: data.description,
      financial: { create: { estimatedRevenue: data.estimatedRevenue, currency: data.currency } },
      activities: { create: { type: "SYSTEM", message: "Project created.", userId: req.user!.id } },
    },
    include: { financial: true, customer: true, supplier: true, owner: true },
  });

  res.status(201).json(serializeProject(project, req.user!.role));
});

const editProjectSchema = z
  .object({
    projectName: z.string().min(1).optional(),
    nextAction: z.string().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    description: z.string().nullable().optional(),
    supplierId: z.string().min(1).nullable().optional(),
    estimatedRevenue: z.coerce.number().nonnegative().optional(),
    actualRevenue: z.coerce.number().nonnegative().optional(),
    customerPaid: z.coerce.number().nonnegative().optional(),
    estimatedCost: z.coerce.number().nonnegative().optional(),
    actualCost: z.coerce.number().nonnegative().optional(),
    supplierPaid: z.coerce.number().nonnegative().optional(),
    currency: z.enum(["USD", "EUR", "LBP"]).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: "No fields provided" });

projectsRouter.patch("/:id", async (req, res) => {
  const parsed = editProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  try {
    const updated = await updateProject(req.params.id, parsed.data, req.user!);
    res.json(serializeProject(updated, req.user!.role));
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
});

const statusSchema = z.object({
  status: z.enum(["RFQ", "QUOTED", "ORDERED", "SHIPPING", "CLOSED"]),
});

projectsRouter.patch("/:id/status", async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  try {
    const updated = await transitionProjectStatus(req.params.id, parsed.data.status, req.user!);
    res.json(updated);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
});

const overrideSchema = z.object({
  reason: z.string().min(1),
});

projectsRouter.post("/:id/override-hold", requireRole("ADMIN"), async (req, res) => {
  const parsed = overrideSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  try {
    const updated = await overrideShipmentHold(req.params.id, req.user!, parsed.data.reason);
    res.json(updated);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
});

const recordPaymentSchema = z
  .object({
    side: z.enum(["customer", "supplier"]),
    amount: z.coerce.number().positive(),
    note: z.string().optional(),
  })
  .strict();

projectsRouter.post("/:id/payment", async (req, res) => {
  const parsed = recordPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  try {
    const updated = await recordPayment(
      req.params.id,
      parsed.data.side,
      parsed.data.amount,
      parsed.data.note,
      req.user!,
    );
    res.json(serializeProject(updated, req.user!.role));
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
});
