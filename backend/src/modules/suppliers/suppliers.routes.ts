import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRole } from "../../middleware/auth";

export const suppliersRouter = Router();
suppliersRouter.use(authenticate);

suppliersRouter.get("/", requireRole("ADMIN", "PROCUREMENT"), async (_req, res) => {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  res.json(suppliers);
});

const createSupplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  country: z.string().optional(),
  paymentTerms: z.string().optional(),
});

// Sourcing is a Procurement-owned process; Admin can also add suppliers directly.
suppliersRouter.post("/", requireRole("ADMIN", "PROCUREMENT"), async (req, res) => {
  const parsed = createSupplierSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const supplier = await prisma.supplier.create({ data: parsed.data });
  res.status(201).json(supplier);
});

suppliersRouter.get("/:id", requireRole("ADMIN", "PROCUREMENT"), async (req, res) => {
  const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!supplier) return res.status(404).json({ error: "Supplier not found" });
  res.json(supplier);
});

const updateSupplierSchema = z
  .object({
    name: z.string().min(1).optional(),
    contactName: z.string().nullable().optional(),
    contactEmail: z.string().email().nullable().optional(),
    country: z.string().nullable().optional(),
    paymentTerms: z.string().nullable().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: "No fields provided" });

suppliersRouter.patch("/:id", requireRole("ADMIN", "PROCUREMENT"), async (req, res) => {
  const parsed = updateSupplierSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Supplier not found" });
  const updated = await prisma.supplier.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(updated);
});

suppliersRouter.delete("/:id", requireRole("ADMIN", "PROCUREMENT"), async (req, res) => {
  const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Supplier not found" });
  const projectCount = await prisma.project.count({ where: { supplierId: req.params.id } });
  if (projectCount > 0) {
    return res.status(409).json({ error: `Cannot delete: ${projectCount} project(s) still reference this supplier` });
  }
  await prisma.supplier.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
