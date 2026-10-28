import { beforeEach, describe, expect, it, vi } from "vitest";

// Verify Figma screens are functional when no AI API key is installed.
// This fallback does NOT call a language model or invent business data.
const state = vi.hoisted(() => ({
  project: { findMany: vi.fn(), findUnique: vi.fn() },
  activity: { findMany: vi.fn() },
}));
vi.mock("../src/lib/env", () => ({
  aiConfigured: false,
  env: { AI_BASE_URL: undefined, AI_MODEL_ID: undefined, AI_API_KEY: undefined },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: state }));
import { buildDailyBrief, draftFollowUpEmail, runQuery } from "../src/modules/ai/ai.service";

const project = {
  id: "project-1",
  projectName: "Office Furniture",
  status: "SHIPPING" as const,
  customer: { name: "Private Customer", contactName: "Customer Contact" },
  supplier: { name: "Public Supplier", contactName: "Supplier Contact" },
  owner: { id: "user-1", name: "Owner" },
  financial: {
    estimatedRevenue: 200, actualRevenue: 200, customerPaid: 0,
    estimatedCost: 80, actualCost: 80, supplierPaid: 0,
    currency: "USD",
  },
  expenses: [],
  dueDate: new Date(Date.now() - 86400000),
  nextAction: "confirm delivery",
};

describe("Figma AI panels without a provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.project.findMany.mockResolvedValue([project]);
    state.project.findUnique.mockResolvedValue(project);
    state.activity.findMany.mockResolvedValue([]);
  });

  it("generates a real project-grounded Daily Brief", async () => {
    const response = await buildDailyBrief({ id: "admin", name: "Admin", role: "ADMIN" });
    expect(response.brief).toContain("Office Furniture");
    expect(response.brief).toContain("overdue");
    expect(response.brief).toContain("no AI provider configured");
  });

  it("answers overdue queries and links to actual projects", async () => {
    const response = await runQuery("Show me all overdue projects", { id: "admin", name: "Admin", role: "ADMIN" });
    expect(response.answer).toContain("Office Furniture");
    expect(response.groundedOn).toEqual([{ id: "project-1", name: "Office Furniture" }]);
  });

  it("does not disclose cost or margin to Sales", async () => {
    const response = await runQuery("Show me supplier cost", { id: "sales", name: "Seller", role: "SALES" });
    expect(response.answer).toContain("not available to your role");
    expect(response.groundedOn).toEqual([]);
  });

  it("does not disclose revenue or margin to Procurement", async () => {
    const response = await runQuery("What is our revenue?", { id: "buy", name: "Buyer", role: "PROCUREMENT" });
    expect(response.answer).toContain("not available to your role");
  });

  it("uses supplier contact instead of private customer details in Procurement drafts", async () => {
    const draft = await draftFollowUpEmail("project-1", undefined, { id: "buy", name: "Buyer", role: "PROCUREMENT" });
    expect(draft.body).toContain("Supplier Contact");
    expect(draft.body).not.toContain("Private Customer");
    expect(draft.body).not.toContain("Customer Contact");
  });

  it("uses customer contact for Sales drafts", async () => {
    const draft = await draftFollowUpEmail("project-1", undefined, { id: "sales", name: "Seller", role: "SALES" });
    expect(draft.body).toContain("Customer Contact");
    expect(draft.body).not.toContain("Supplier Contact");
  });
});
