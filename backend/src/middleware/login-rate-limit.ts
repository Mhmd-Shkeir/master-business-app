import { createHash } from "node:crypto";
import { NextFunction, Request, Response } from "express";

// Single-process limiter. Use a shared atomic store for multi-instance deployments.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 30;
const MAX_PER_EMAIL = 5;
const MAX_KEYS = 10_000;
type Counter = { count: number; expires: number };

export function createLoginRateLimiter(options: {
  maxKeys?: number;
  maxPerIp?: number;
  maxPerEmail?: number;
  windowMs?: number;
} = {}) {
  const limitKeys = options.maxKeys ?? MAX_KEYS;
  const perIp = options.maxPerIp ?? MAX_PER_IP;
  const perEmail = options.maxPerEmail ?? MAX_PER_EMAIL;
  const windowMs = options.windowMs ?? WINDOW_MS;
  const attempts = new Map<string, Counter>();

  // Never evict an active counter to admit attacker-selected keys.
  function increment(key: string, now: number): Counter | null {
    const prior = attempts.get(key);
    if (prior && prior.expires > now) {
      if (prior.count < Number.MAX_SAFE_INTEGER) prior.count++;
      return prior;
    }
    if (attempts.size >= limitKeys) {
      for (const [oldKey, oldValue] of attempts) {
        if (oldValue.expires <= now) attempts.delete(oldKey);
      }
    }
    if (!attempts.has(key) && attempts.size >= limitKeys) return null;
    const counter = { count: 1, expires: now + windowMs };
    attempts.set(key, counter);
    return counter;
  }

  return function loginRateLimit(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const email = typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase().slice(0, 254)
      : "";
    const account = createHash("sha256").update(email).digest("hex");
    const now = Date.now();
    const deny = (counter: Counter | null) => {
      const seconds = counter ? Math.ceil((counter.expires - now) / 1000) : Math.ceil(windowMs / 1000);
      res.setHeader("Retry-After", String(Math.max(1, seconds)));
      return res.status(429).json({ error: "Too many sign-in attempts. Try again later." });
    };
    // Reject already-blocked IPs BEFORE allocating another account counter.
    const ipCounter = increment("ip:" + ip, now);
    if (!ipCounter || ipCounter.count > perIp) return deny(ipCounter);
    const accountCounter = increment("account:" + account, now);
    if (!accountCounter || accountCounter.count > perEmail) return deny(accountCounter);
    return next();
  };
}

export const loginRateLimit = createLoginRateLimiter();
