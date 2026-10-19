import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";

const userUpdate = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/prisma", () => ({
  prisma: { user: { update: userUpdate, findUnique: vi.fn() } },
}));
vi.mock("../src/middleware/auth", () => ({
  authenticate: (req: { user?: { id: string; role: string } }, _res: unknown, next: () => void) => {
    req.user = { id: "user-1", role: "SALES" };
    next();
  },
  signToken: vi.fn(),
}));

import { authRouter } from "../src/modules/auth/auth.routes";

describe("server-side logout", () => {
  it("invalidates previously issued JWTs by incrementing sessionVersion", async () => {
    userUpdate.mockResolvedValue({ id: "user-1", sessionVersion: 2 });
    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    const response = await request(app).post("/api/auth/logout");
    expect(response.status).toBe(204);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { sessionVersion: { increment: 1 } },
    });
  });
});
