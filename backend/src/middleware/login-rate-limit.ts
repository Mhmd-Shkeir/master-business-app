import { createHash } from "node:crypto";
import { NextFunction, Request, Response } from "express";

// A single-process defense for the current Express deployment. Production
// horizontal scaling should replace this with a shared Redis-backed limiter.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 30;
const MAX_PER_EMAIL = 5;
const MAX_KEYS = 10_000;
const attempts = new Map<string, { count: number; expires: number }>();

function increment(key: string, now: number): number {
  const prior = attempts.get(key);
  if (!prior || prior.expires <= now) {
    // Evict expired entries and bound memory use.
    if (attempts.size >= MAX_KEYS) {
      for (const [entryKey, item] of attempts) {
        if (item.expires <= now) attempts.delete(entryKey);
      }
    }
    if (attempts.size >= MAX_KEYS) attempts.delete(attempts.keys().next().value!);
    attempts.set(key, { count: 1, expires: now + WINDOW_MS });
    return 1;
  }
  prior.count += 1;
  return prior.count;
}

export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const email = typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase().slice(0, 254)
    : "";
  const hashedEmail = createHash("sha256").update(email).digest("hex");
  const now = Date.now();

  // Both counters increment even if one is already at its limit, so
  // changing the target account won't bypass the originating IP budget.
  const ipCount = increment("ip:" + ip, now);
  const emailCount = increment("account:" + hashedEmail, now);
  if (ipCount > MAX_PER_IP || emailCount > MAX_PER_EMAIL) {
    res.setHeader("Retry-After", String(Math.ceil(WINDOW_MS / 1000)));
    return res.status(429).json({ error: "Too many sign-in attempts. Try again later." });
  }
  next();
}
