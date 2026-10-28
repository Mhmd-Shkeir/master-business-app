import "express-async-errors";
import cors from "cors";
import { Prisma } from "@prisma/client";
import { env } from "./lib/env";
import express, { NextFunction, Request, Response } from "express";
import { prisma } from "./lib/prisma";
import { aiRouter } from "./modules/ai/ai.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { customersRouter } from "./modules/customers/customers.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { suppliersRouter } from "./modules/suppliers/suppliers.routes";
import { projectsRouter } from "./modules/projects/projects.routes";
import { usersRouter } from "./modules/users/users.routes";

export const app = express();

const allowedOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.disable("etag");
app.disable("x-powered-by");
// Authenticated business data and AI responses should not be stored in
// browser/proxy caches (nor indexed through accidental shared caches).
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(express.json({ limit: "32kb" }));

// Basic liveness + DB connectivity check.
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/customers", customersRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/users", usersRouter);
app.use("/api/ai", aiRouter);
app.use("/api/notifications", notificationsRouter);

// Catch-all error handler. express-async-errors forwards thrown/rejected
// errors from async route handlers here instead of crashing the process.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
    return res.status(409).json({ error: "Concurrent update in progress. Please retry." });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
