import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRole } from "../../middleware/auth";

export const customersRouter = Router();
customersRouter.use(authenticate);

customersRouter.get("/", requireRole("ADMIN", "SALES"), async (_req, res) => {
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  res.json(customers);
});

const createCustomerSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  country: z.string().optional(),
  paymentTerms: z.string().optional(),
});

// RFQ intake is a Sales-owned process; Admin can also add customers directly.
customersRouter.post("/", requireRole("ADMIN", "SALES"), async (req, res) => {
  const parsed = createCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const customer = await prisma.customer.create({ data: parsed.data });
  res.status(201).json(customer);
});

customersRouter.get("/:id", requireRole("ADMIN", "SALES"), async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  res.json(customer);
});

const updateCustomerSchema = z
  .object({
    name: z.string().min(1).optional(),
    contactName: z.string().nullable().optional(),
    contactEmail: z.string().email().nullable().optional(),
    country: z.string().nullable().optional(),
    paymentTerms: z.string().nullable().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: "No fields provided" });

customersRouter.patch("/:id", requireRole("ADMIN", "SALES"), async (req, res) => {
  const parsed = updateCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Customer not found" });
  const updated = await prisma.customer.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(updated);
});

customersRouter.delete("/:id", requireRole("ADMIN", "SALES"), async (req, res) => {
  const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Customer not found" });
  const projectCount = await prisma.project.count({ where: { customerId: req.params.id } });
  if (projectCount > 0) {
    return res.status(409).json({ error: `Cannot delete: ${projectCount} project(s) still reference this customer` });
  }
  await prisma.customer.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
