import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  activity: { create: vi.fn() },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/transaction", () => ({
  withSerializableTransaction: vi.fn((operation: (tx: unknown) => Promise<unknown>) =>
    operation({ project: prismaMock.project, activity: prismaMock.activity })),
}));

vi.mock("../src/lib/env", () => ({
  env: { AI_BASE_URL: undefined, AI_MODEL_ID: undefined, AI_API_KEY: undefined },
  aiConfigured: false,
}));

import { prisma } from "../src/lib/prisma";
import { recordNote } from "../src/modules/ai/ai.service";
import { sanitizeActivitiesForRole } from "../src/lib/rbac";

describe("role-based data disclosure", () => {
  beforeEach(() => vi.resetAllMocks());

  it("does not return an unfiltered Prisma financial record after confirming a note", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "project-1",
      status: "RFQ",
      financial: { actualCost: 123456, actualRevenue: 789456 },
      expenses: [{ amount: 987654 }],
    } as never);
    vi.mocked(prisma.activity.create).mockResolvedValue({} as never);

    const response = await recordNote(
      "project-1",
      "Followed up with customer",
      { id: "sales-1", role: "SALES" },
    );
    expect(response).toEqual({ success: true, projectId: "project-1" });
    expect(JSON.stringify(response)).not.toContain("123456");
    expect(JSON.stringify(response)).not.toContain("789456");
    expect(JSON.stringify(response)).not.toContain("987654");
  });

  const activities = [
    { type: "SYSTEM", userId: "admin", message: "Project created." },
    { type: "SYSTEM", userId: "admin", message: "Status changed from RFQ to QUOTED." },
    { type: "UPDATE", userId: "admin", message: "Private price is 90000." },
    { type: "COMMENT", userId: "admin", message: "We expect the secret margin to be low." },
    { type: "COMMENT", userId: "sales-1", message: "My follow-up note" },
    { type: "SYSTEM", userId: "admin", message: "Project created. Secret is 90000" },
  ];

  it("fails closed on free-text sensitive activity for Sales", () => {
    const visible = sanitizeActivitiesForRole(activities, "SALES", "sales-1");
    expect(visible.map((a) => a.message)).toEqual([
      "Project created.",
      "Status changed from RFQ to QUOTED.",
      "My follow-up note",
    ]);
  });

  it("fails closed on unrestricted activity for Procurement too", () => {
    const visible = sanitizeActivitiesForRole(activities, "PROCUREMENT", "procurement-1");
    expect(visible).toHaveLength(2);
  });

  it("preserves complete activity for Admin", () => {
    expect(sanitizeActivitiesForRole(activities, "ADMIN", "admin")).toEqual(activities);
  });
});
