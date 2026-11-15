import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

// Project ids this user has permanently dismissed from their overdue-notification
// bell (by following the notification's link) — see NotificationDismissal in the
// Prisma schema for why this is scoped per (user, project) rather than a field.
notificationsRouter.get("/dismissed-overdue", async (req, res) => {
  const dismissals = await prisma.notificationDismissal.findMany({
    where: { userId: req.user!.id },
    select: { projectId: true },
  });
  res.json(dismissals.map((d) => d.projectId));
});

const dismissSchema = z.object({ projectId: z.string().min(1) }).strict();

notificationsRouter.post("/dismiss-overdue", async (req, res) => {
  const parsed = dismissSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }
  const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId }, select: { id: true } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  await prisma.notificationDismissal.upsert({
    where: { userId_projectId: { userId: req.user!.id, projectId: parsed.data.projectId } },
    create: { userId: req.user!.id, projectId: parsed.data.projectId },
    update: {},
  });
  res.status(204).end();
});
