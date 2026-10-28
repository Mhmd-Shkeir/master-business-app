import { NextFunction, Request, Response } from "express";

type Counter = { count: number; expires: number };

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  key?: (req: Request) => string;
}) {
  const counters = new Map<string, Counter>();
  const keyFor = options.key ?? ((req) => req.ip || req.socket.remoteAddress || "unknown");

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = keyFor(req).slice(0, 256);
    const prior = counters.get(key);
    const counter = prior && prior.expires > now
      ? prior
      : { count: 0, expires: now + options.windowMs };

    if (!prior || prior.expires <= now) {
      for (const [storedKey, stored] of counters) {
        if (stored.expires <= now) counters.delete(storedKey);
      }
    }
    counter.count++;
    counters.set(key, counter);

    if (counter.count > options.max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((counter.expires - now) / 1000))));
      return res.status(429).json({ error: options.message });
    }
    return next();
  };
}

export const passwordRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password-change attempts. Try again later.",
  key: (req) => req.user?.id || req.ip || "unknown",
});

export const aiRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many AI requests. Try again later.",
  key: (req) => req.user?.id || req.ip || "unknown",
});
