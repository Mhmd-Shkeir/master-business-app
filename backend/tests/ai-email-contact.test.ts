import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  create: vi.fn(),
  project: { findUnique: vi.fn() },
  activity: { findMany: vi.fn() },
}));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: state.create } };
  },
}));
vi.mock("../src/lib/env", () => ({
  aiConfigured: true,
  env: { AI_BASE_URL: "https://example.invalid", AI_MODEL_ID: "test-model", AI_API_KEY: "test-key" },
}));
vi.mock("../src/lib/prisma", () => ({ prisma: state }));
import { draftFollowUpEmail } from "../src/modules/ai/ai.service";

const project = {
  id: "p1", projectName: "Solar Equipment", status: "ORDERED",
  customer: { name: "Private Customer", contactName: "Private Customer Contact" },
  supplier: { name: "Supplier Ltd", contactName: "Supplier Contact" },
  owner: { id: "u1", name: "Owner" },
  financial: { estimatedRevenue: 120, actualRevenue: 120, estimatedCost: 70,
    actualCost: 70, customerPaid: 0, supplierPaid: 0, currency: "USD" },
  expenses: [], nextAction: "Shipment", dueDate: null,
};

describe("role-filtered AI drafting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.project.findUnique.mockResolvedValue(project);
    state.activity.findMany.mockResolvedValue([]);
    state.create.mockResolvedValue({ choices: [{ message: { content: '{"subject":"Update","body":"Please confirm shipment."}' } }] });
  });

  it("excludes customer identity from Procurement model context", async () => {
    await draftFollowUpEmail("p1", undefined, { id: "u1", name: "Buyer", role: "PROCUREMENT" });
    const payload = JSON.stringify(state.create.mock.calls[0][0].messages);
    expect(payload).not.toContain("Private Customer Contact");
    expect(payload).not.toContain("Private Customer");
    expect(payload).toContain("Supplier Contact");
    expect(payload).toContain("supplier-facing");
  });

  it("allows Sales to draft with authorized customer contact data", async () => {
    await draftFollowUpEmail("p1", undefined, { id: "u2", name: "Seller", role: "SALES" });
    const payload = JSON.stringify(state.create.mock.calls[0][0].messages);
    expect(payload).toContain("Private Customer Contact");
  });
});
