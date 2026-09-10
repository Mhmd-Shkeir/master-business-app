import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { AppError } from "../projects/projects.service";
import { buildDailyBrief, draftFollowUpEmail, recordNote, runQuery } from "./ai.service";

export const aiRouter = Router();
aiRouter.use(authenticate);

async function currentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404);
  return user;
}

aiRouter.post("/daily-brief", async (req, res) => {
  try {
    const user = await currentUser(req.user!.id);
    const result = await buildDailyBrief(user);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
    throw err;
  }
});

const querySchema = z.object({ question: z.string().min(1) }).strict();

aiRouter.post("/query", async (req, res) => {
  const parsed = querySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  try {
    const user = await currentUser(req.user!.id);
    const result = await runQuery(parsed.data.question, user);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
    throw err;
  }
});

const draftSchema = z.object({ instructions: z.string().optional() }).strict();

aiRouter.post("/projects/:id/draft-email", async (req, res) => {
  const parsed = draftSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  try {
    const user = await currentUser(req.user!.id);
    const result = await draftFollowUpEmail(req.params.id, parsed.data.instructions, user);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
    throw err;
  }
});

const confirmSchema = z.object({ message: z.string().min(1) }).strict();

aiRouter.post("/projects/:id/confirm-note", async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  try {
    const updated = await recordNote(req.params.id, parsed.data.message, req.user!);
    res.json(updated);
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
    throw err;
  }
});
