import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate, signToken } from "../../middleware/auth";
import { loginRateLimit } from "../../middleware/login-rate-limit";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

authRouter.post("/login", loginRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Perform a password hash comparison even for missing accounts to reduce
  // observable response-time differences from user enumeration.
  const dummyHash = bcrypt.hashSync("invalid-user-placeholder", 10);
  const passwordValid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !passwordValid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ id: user.id, sessionVersion: user.sessionVersion });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});


// Incrementing sessionVersion invalidates this and all other issued tokens.
authRouter.post("/logout", authenticate, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { sessionVersion: { increment: 1 } },
  });
  res.status(204).end();
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.patch("/password", authenticate, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const currentValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!currentValid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, sessionVersion: { increment: 1 } },
    select: { id: true, sessionVersion: true },
  });

  // Invalidate all older sessions, but keep this browser signed in using a new JWT.
  res.json({ success: true, token: signToken(updated) });
});

const updateProfileSchema = z.object({ name: z.string().min(1) }).strict();

authRouter.patch("/profile", authenticate, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, email: true, role: true },
  });

  res.json({ user });
});
