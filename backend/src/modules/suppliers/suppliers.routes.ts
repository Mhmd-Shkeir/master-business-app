import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRole } from "../../middleware/auth";

export const suppliersRouter = Router();
suppliersRouter.use(authenticate);

suppliersRouter.get("/", async (_req, res) => {
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
