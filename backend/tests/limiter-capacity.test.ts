import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit";

function attempt(limiter: ReturnType<typeof createLoginRateLimiter>, ip: string, email: string) {
  const req = { ip, body: { email } } as Request;
  const next = vi.fn() as NextFunction;
  const status = vi.fn().mockReturnThis();
  const res = { status, setHeader: vi.fn(), json: vi.fn() } as unknown as Response;
  limiter(req, res, next);
  return { accepted: next.mock.calls.length > 0, status };
}

describe("login counter admission under capacity pressure", () => {
  it("does not evict active IP budgets for rotating email keys", () => {
    const limiter = createLoginRateLimiter({ maxKeys: 3, maxPerIp: 2, maxPerEmail: 20 });
    expect(attempt(limiter, "192.0.2.42", "a@b.test").accepted).toBe(true);
    expect(attempt(limiter, "192.0.2.42", "b@b.test").accepted).toBe(true);
    expect(attempt(limiter, "192.0.2.42", "c@b.test").status).toHaveBeenCalledWith(429);
    expect(attempt(limiter, "192.0.2.42", "a@b.test").status).toHaveBeenCalledWith(429);
  });

  it("fails closed when the counter store is full of active keys", () => {
    const limiter = createLoginRateLimiter({ maxKeys: 2, maxPerIp: 30, maxPerEmail: 5 });
    expect(attempt(limiter, "192.0.2.5", "one@b.test").accepted).toBe(true);
    expect(attempt(limiter, "192.0.2.6", "two@b.test").status).toHaveBeenCalledWith(429);
    expect(attempt(limiter, "192.0.2.5", "one@b.test").accepted).toBe(true);
  });
});
