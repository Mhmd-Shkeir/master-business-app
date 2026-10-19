import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { loginRateLimit } from "../src/middleware/login-rate-limit";

function send(ip: string, email: string) {
  const req = { ip, body: { email } } as unknown as Request;
  const next = vi.fn() as NextFunction;
  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  const setHeader = vi.fn();
  const res = { status, json, setHeader } as unknown as Response;
  loginRateLimit(req, res, next);
  return { next, status, json, setHeader };
}

describe("login brute-force defenses", () => {
  it("blocks the sixth attempt to the same normalized email identity", () => {
    for (let i = 0; i < 5; i++) {
      expect(send("192.0.2.10", i % 2 ? " USER@Example.com " : "user@example.com").next).toHaveBeenCalledOnce();
    }
    const blocked = send("192.0.2.10", "user@example.com");
    expect(blocked.status).toHaveBeenCalledWith(429);
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
  });

  it("blocks IP attempts even when the attacker rotates email identities", () => {
    for (let i = 0; i < 30; i++) {
      const current = send("192.0.2.11", "unique-" + i + "@example.com");
      expect(current.next).toHaveBeenCalledOnce();
    }
    const blocked = send("192.0.2.11", "different@example.com");
    expect(blocked.status).toHaveBeenCalledWith(429);
    expect(blocked.next).not.toHaveBeenCalled();
  });
});
