import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  project: { findUnique: vi.fn() },
  activity: { create: vi.fn(), findMany: vi.fn() },
  notificationDismissal: { findMany: vi.fn() },
  supplier: { delete: vi.fn() },
}));

vi.mock("../src/lib/env", () => ({
  env: {
    JWT_SECRET: "tests-only-secret-of-at-least-32-characters",
    CORS_ORIGINS: "http://localhost:5173",
    NODE_ENV: "test",
    AI_BASE_URL: undefined,
    AI_MODEL_ID: undefined,
    AI_API_KEY: undefined,
  },
  aiConfigured: false,
}));
vi.mock("../src/lib/prisma", () => ({ prisma: mocks }));
vi.mock("../src/lib/transaction", () => ({
  withSerializableTransaction: vi.fn((operation: (tx: unknown) => Promise<unknown>) => operation(mocks)),
}));

import { app } from "../src/app";
import { signToken } from "../src/middleware/auth";

const sensitiveProject = {
  id: "p1",
  projectName: "Important client project",
  status: "ORDERED",
  customerId: "c1",
  supplierId: "s1",
  ownerId: "u1",
  nextAction: null,
  dueDate: null,
  description: null,
  lastUpdate: new Date("2026-10-01T12:00:00Z"),
  createdAt: new Date("2026-10-01T12:00:00Z"),
  shipmentHoldOverridden: true,
  financial: {
    estimatedRevenue: 100_000,
    actualRevenue: 100_000,
    estimatedCost: 24_000,
    actualCost: 24_000,
    customerPaid: 5_000,
    supplierPaid: 2_000,
    currency: "USD",
  },
  customer: { id: "c1", name: "Customer", country: null },
  supplier: { id: "s1", name: "Supplier", country: null },
  owner: { id: "u1", name: "Owner" },
  expenses: [],
};

const jwt = signToken({ id: "u1", sessionVersion: 0 });

describe("role-based response security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.findUnique.mockResolvedValue({ id: "u1", role: "SALES", sessionVersion: 0 });
    mocks.project.findUnique.mockResolvedValue(sensitiveProject);
    mocks.activity.create.mockResolvedValue({ id: "a1" });
    mocks.activity.findMany.mockResolvedValue([]);
  });

  it("never returns a raw project or financial records after an AI note is confirmed", async () => {
    const response = await request(app)
      .post("/api/ai/projects/p1/confirm-note")
      .set("Authorization", `Bearer ${jwt}`)
      .send({ message: "Follow up tomorrow" });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true });
    expect(JSON.stringify(response.body)).not.toContain("estimatedCost");
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(mocks.activity.create).toHaveBeenCalledOnce();
  });

  it("returns 409 instead of deleting an assigned supplier", async () => {
    mocks.user.findUnique.mockResolvedValue({ id: "u1", role: "PROCUREMENT", sessionVersion: 0 });
    mocks.supplier.delete.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      "Foreign key violation", { code: "P2003", clientVersion: "6.16.3" },
    ));
    const response = await request(app)
      .delete("/api/suppliers/s1")
      .set("Authorization", `Bearer ${jwt}`);
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("Cannot delete a supplier");
  });

  it("rejects unauthenticated attempts to add notes", async () => {
    const response = await request(app)
      .post("/api/ai/projects/p1/confirm-note")
      .send({ message: "Do not allow me" });
    expect(response.status).toBe(401);
    expect(mocks.activity.create).not.toHaveBeenCalled();
  });

  it("does not expose cost, margin or expenses in the Sales project detail response", async () => {
    const response = await request(app)
      .get("/api/projects/p1")
      .set("Authorization", `Bearer ${jwt}`);
    expect(response.status).toBe(200);
    expect(response.body.financial).toHaveProperty("estimatedRevenue");
    expect(response.body.financial).not.toHaveProperty("estimatedCost");
    expect(response.body.financial).not.toHaveProperty("actualCost");
    expect(response.body.financial).not.toHaveProperty("marginPercent");
    expect(response.body).not.toHaveProperty("expenses");
    expect(response.body.shipmentHoldOverridden).toBe(true);
  });

  it("does not disclose revenue fields to Procurement", async () => {
    mocks.user.findUnique.mockResolvedValue({ id: "u1", role: "PROCUREMENT", sessionVersion: 0 });
    const response = await request(app)
      .get("/api/projects/p1")
      .set("Authorization", `Bearer ${jwt}`);
    expect(response.status).toBe(200);
    expect(response.body.financial).not.toHaveProperty("estimatedRevenue");
    expect(response.body.financial).not.toHaveProperty("customerBalance");
    expect(response.body.financial).toHaveProperty("actualCost");
    expect(response.body).not.toHaveProperty("shipmentHoldOverridden");
  });
});
