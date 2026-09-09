import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, requireRole } from "../../middleware/auth";

export const usersRouter = Router();
usersRouter.use(authenticate);

const USER_SELECT = { id: true, name: true, email: true, role: true, createdAt: true } as const;

usersRouter.get("/", requireRole("ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({ select: USER_SELECT, orderBy: { name: "asc" } });
  res.json(users);
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "SALES", "PROCUREMENT"]),
});

usersRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const { name, email, password, role } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: USER_SELECT,
    });
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "A user with this email already exists" });
    }
    throw err;
  }
});
