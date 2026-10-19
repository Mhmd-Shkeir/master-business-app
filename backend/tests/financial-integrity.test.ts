import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const project = { findUnique: vi.fn(), update: vi.fn() };
  const financial = { update: vi.fn() };
  const activity = { create: vi.fn() };
  const expense = { create: vi.fn() };
  const user = { findUnique: vi.fn() };
  return { tx: { project, financial, activity, expense, user } };
});

vi.mock("../src/lib/transaction", () => ({
  withSerializableTransaction: vi.fn((operation: (tx: unknown) => Promise<unknown>) => operation(mocks.tx)),
}));

import {
  AppError,
  addExpense,
  overrideShipmentHold,
  recordPayment,
  transitionProjectStatus,
  updateProject,
} from "../src/modules/projects/projects.service";

const admin = { id: "admin", role: "ADMIN" } as const;
const sales = { id: "sales", role: "SALES" } as const;
const procurement = { id: "procurement", role: "PROCUREMENT" } as const;

function sampleProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    projectName: "Test Project",
    status: "SHIPPING",
    supplierId: "supplier-1",
    nextAction: "Ship",
    dueDate: null,
    description: null,
    financial: {
      estimatedRevenue: 100,
      actualRevenue: 100,
      estimatedCost: 70,
      actualCost: 70,
      customerPaid: 0,
      supplierPaid: 0,
      currency: "USD",
    },
    ...overrides,
  };
}

describe("financial and status transaction behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.project.findUnique.mockResolvedValue(sampleProject());
    mocks.tx.project.update.mockResolvedValue(sampleProject({ status: "CLOSED" }));
    mocks.tx.financial.update.mockResolvedValue({});
    mocks.tx.activity.create.mockResolvedValue({});
    mocks.tx.expense.create.mockResolvedValue({});
    mocks.tx.user.findUnique.mockResolvedValue({ id: admin.id, name: "Admin" });
  });

  it("increments the customer balance atomically rather than overwriting a stale value", async () => {
    await recordPayment("project-1", "customer", 40, "Deposit", sales);

    expect(mocks.tx.financial.update).toHaveBeenCalledWith({
      where: { projectId: "project-1" },
      data: { customerPaid: { increment: 40 } },
    });
    expect(mocks.tx.activity.create).toHaveBeenCalledOnce();
  });

  it("rejects payment amounts with fractional cents before the database call", async () => {
    await expect(recordPayment("project-1", "customer", 0.001, undefined, sales))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.tx.financial.update).not.toHaveBeenCalled();
  });

  it("rejects a payment greater than the outstanding balance in the transaction", async () => {
    mocks.tx.project.findUnique.mockResolvedValue(sampleProject({
      financial: { ...sampleProject().financial, customerPaid: 80 },
    }));
    await expect(recordPayment("project-1", "customer", 30, undefined, sales))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.tx.financial.update).not.toHaveBeenCalled();
    expect(mocks.tx.activity.create).not.toHaveBeenCalled();
  });

  it("never reveals the customer's exact debt to Procurement in a close error", async () => {
    mocks.tx.project.findUnique.mockResolvedValue(sampleProject({
      financial: { ...sampleProject().financial, customerPaid: 50 },
    }));
    await expect(transitionProjectStatus("project-1", "CLOSED", procurement))
      .rejects.toMatchObject({
        statusCode: 403,
        message: "Insufficient permissions",
      });
    expect(mocks.tx.project.update).not.toHaveBeenCalled();
  });

  it("rejects Procurement closure before reading any customer balance", async () => {
    mocks.tx.project.findUnique.mockResolvedValue(sampleProject({
      financial: { ...sampleProject().financial, customerPaid: 100 },
    }));
    await expect(transitionProjectStatus("project-1", "CLOSED", procurement))
      .rejects.toMatchObject({ statusCode: 403, message: "Insufficient permissions" });
    expect(mocks.tx.project.findUnique).not.toHaveBeenCalled();
    expect(mocks.tx.project.update).not.toHaveBeenCalled();
  });

  it("checks status and logs the change inside the same transaction", async () => {
    mocks.tx.project.findUnique.mockResolvedValue(sampleProject({ status: "RFQ" }));
    await transitionProjectStatus("project-1", "QUOTED", sales);
    expect(mocks.tx.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "QUOTED" },
    });
    expect(mocks.tx.activity.create).toHaveBeenCalledOnce();
  });

  it("rejects an override without an audit reason", async () => {
    await expect(overrideShipmentHold("project-1", admin, "   "))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.tx.project.update).not.toHaveBeenCalled();
  });

  it("rejects expenses using more than two decimal places", async () => {
    await expect(addExpense("project-1", "Freight", 1.001, undefined, procurement))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.tx.expense.create).not.toHaveBeenCalled();
  });

  it("checks CLOSED edit permissions from the transaction snapshot", async () => {
    mocks.tx.project.findUnique.mockResolvedValue(sampleProject({ status: "CLOSED" }));
    await expect(updateProject("project-1", { nextAction: "Change terms" }, sales))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.tx.project.update).not.toHaveBeenCalled();
  });
});
