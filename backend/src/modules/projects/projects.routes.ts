import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import {
  canSeeCost,
  computeFinancials,
  filterFinancialsForRole,
  needsAttention,
  sanitizeActivitiesForRole,
  sumExpenses,
} from "../../lib/rbac";
import { authenticate, requireRole, type AuthUser } from "../../middleware/auth";
import { AppError, addExpense, overrideShipmentHold, recordPayment, transitionProjectStatus, updateProject } from "./projects.service";

export const projectsRouter = Router();
projectsRouter.use(authenticate);

function serializeProject(
  project: Awaited<ReturnType<typeof loadProjectById>>,
  role: AuthUser["role"],
) {
  if (!project) return null;
  // Expenses are always summed into the margin calculation regardless of who's
  // asking, so it stays correct even though needsAttention() below gates the
  // resulting lowMargin/blockedShipment booleans to what `role` is allowed to see.
  const financials = computeFinancials(project.financial, sumExpenses(project.expenses));

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
    needsAttention: needsAttention(project, financials, role),
    shipmentHoldOverridden: project.shipmentHoldOverridden,
  };
}

function loadProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      financial: true,
      customer: true,
      supplier: true,
      owner: true,
      expenses: { orderBy: { createdAt: "desc" } },
    },
  });
}

projectsRouter.get("/", async (req, res) => {
  const projects = await prisma.project.findMany({
    include: { financial: true, customer: true, supplier: true, owner: true, expenses: true },
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
  // Activity messages are free text and were never field-gated the way the
  // structured Financial data is — a message like "Expense recorded:
  // Shipping — 120.00 USD" or "Customer payment of 5000.00 USD recorded"
  // states a real dollar figure in plain text. Sanitized the same way the AI
  // context already is, so a role that can't see cost/revenue/margin can't
  // read it here either.
  const visibleActivities = sanitizeActivitiesForRole(activities, req.user!.role);

  // Expenses are cost-side data (shipping, inspection, etc.) — same visibility
  // rule as Supplier/Cost. The key is genuinely absent from the response for a
  // role that can't see it, not just hidden client-side. (Already fetched via
  // loadProjectById's include — used above for the margin calc regardless of
  // role, only gated here for what actually goes in the response.)
  const canViewExpenses = canSeeCost(req.user!.role);

  res.json({
    ...serializeProject(project, req.user!.role),
    activities: visibleActivities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt,
      user: a.user ? { id: a.user.id, name: a.user.name } : null,
    })),
    ...(canViewExpenses
      ? {
          expenses: project.expenses.map((e) => ({
            id: e.id,
            category: e.category,
            amount: e.amount,
            note: e.note,
            createdAt: e.createdAt,
          })),
        }
      : {}),
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
    include: { financial: true, customer: true, supplier: true, owner: true, expenses: true },
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

const addExpenseSchema = z
  .object({
    category: z.string().min(1),
    amount: z.coerce.number().positive(),
    note: z.string().optional(),
  })
  .strict();

projectsRouter.post("/:id/expenses", async (req, res) => {
  const parsed = addExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  try {
    await addExpense(req.params.id, parsed.data.category, parsed.data.amount, parsed.data.note, req.user!);
    const updated = await loadProjectById(req.params.id);
    res.status(201).json(serializeProject(updated, req.user!.role));
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
});
