import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRole } from "../../middleware/auth";

export const customersRouter = Router();
customersRouter.use(authenticate);

customersRouter.get("/", async (_req, res) => {
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
