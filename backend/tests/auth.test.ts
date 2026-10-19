import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

vi.mock("../src/lib/env", () => ({ env: { JWT_SECRET: "test-only-secret-with-at-least-32-characters" } }));
vi.mock("../src/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

import { prisma } from "../src/lib/prisma";
import { authenticate, requireRole, signToken } from "../src/middleware/auth";

const userLookup = vi.mocked(prisma.user.findUnique);

function request(token?: string): Request {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as Request;
}

function response() {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

describe("authentication and session revocation", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects unauthenticated requests", async () => {
    const { res, status } = response();
    const next = vi.fn();
    await authenticate(request(), res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("uses the current database role rather than trusting JWT claims", async () => {
    userLookup.mockResolvedValue({
      id: "user-1",
      role: "SALES",
      sessionVersion: 2,
    } as never);
    const token = signToken({ id: "user-1", sessionVersion: 2 });
    const req = request(token);
    const { res } = response();
    const next = vi.fn();
    await authenticate(req, res, next);
    expect(req.user).toEqual({ id: "user-1", role: "SALES" });
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects an older token after the session version changes", async () => {
    userLookup.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
      sessionVersion: 3,
    } as never);
    const { res, status } = response();
    const next = vi.fn();
    await authenticate(request(signToken({ id: "user-1", sessionVersion: 2 })), res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects tokens for deleted users", async () => {
    userLookup.mockResolvedValue(null);
    const { res, status } = response();
    await authenticate(request(signToken({ id: "deleted-user", sessionVersion: 0 })), res, vi.fn());
    expect(status).toHaveBeenCalledWith(401);
  });

  it("rejects JWTs with no session version", async () => {
    const token = jwt.sign({ id: "user-1", role: "ADMIN" }, "test-only-secret-with-at-least-32-characters");
    const { res, status } = response();
    await authenticate(request(token), res, vi.fn());
    expect(status).toHaveBeenCalledWith(401);
    expect(userLookup).not.toHaveBeenCalled();
  });

  it("passes database failures to the global error handler", async () => {
    userLookup.mockRejectedValue(new Error("Database offline"));
    const { res, status } = response();
    const next = vi.fn();
    await authenticate(request(signToken({ id: "user-1", sessionVersion: 1 })), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(status).not.toHaveBeenCalledWith(401);
  });

  it("denies unauthorized roles after authentication", () => {
    const req = { user: { id: "user-1", role: "SALES" } } as Request;
    const { res, status } = response();
    const next = vi.fn();
    requireRole("ADMIN")(req, res, next);
    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
