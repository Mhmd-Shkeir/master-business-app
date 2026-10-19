import { ProjectStatus } from "@prisma/client";
import { canSeeCost, canSeeRevenue, computeFinancials } from "../../lib/rbac";
import { withSerializableTransaction } from "../../lib/transaction";
import type { AuthUser } from "../../middleware/auth";

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const WORKFLOW_ORDER: ProjectStatus[] = ["RFQ", "QUOTED", "ORDERED", "SHIPPING", "CLOSED"];

function validMoneyAmount(amount: number) {
  return Number.isFinite(amount) && amount > 0 && amount <= 999_999_999_999.99 &&
    Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7;
}

/**
 * Normal status transition. Two independent rules:
 *  1. Stage-skip permission: Sales/Procurement move one stage forward at a time;
 *     Admin may jump forward to any later stage. No role may move backward.
 *  2. Shipment hold: reaching CLOSED while an outstanding customer balance exists
 *     is always blocked here, Admin included — the only way past it is the
 *     explicit overrideShipmentHold() action below, which is separately audited.
 */
export async function transitionProjectStatus(
  projectId: string,
  targetStatus: ProjectStatus,
  user: AuthUser,
) {
  // Always authorize CLOSED before any balance-dependent decision or response.
  if (targetStatus === "CLOSED" && !canSeeRevenue(user.role)) {
    throw new AppError("Insufficient permissions", 403);
  }
  return withSerializableTransaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: { financial: true },
    });
    if (!project) throw new AppError("Project not found", 404);

    const currentIndex = WORKFLOW_ORDER.indexOf(project.status);
    const targetIndex = WORKFLOW_ORDER.indexOf(targetStatus);

    if (targetIndex === currentIndex) {
      throw new AppError(`Project is already in ${targetStatus}`, 400);
    }
    if (targetIndex < currentIndex) {
      throw new AppError("Backward status transitions are not allowed", 400);
    }
    if (user.role !== "ADMIN" && targetIndex !== currentIndex + 1) {
      throw new AppError("Only Admin may skip workflow stages; move one stage at a time", 403);
    }

    // Validate every intervening stage against the same transaction snapshot.
    for (let i = currentIndex + 1; i <= targetIndex; i++) {
      const stage = WORKFLOW_ORDER[i];
      if (stage === "QUOTED") {
        const revenue = Math.max(
          Number(project.financial?.actualRevenue ?? 0),
          Number(project.financial?.estimatedRevenue ?? 0),
        );
        if (revenue <= 0) {
          throw new AppError(
            `Cannot move to ${targetStatus}: a quote requires an estimated (or actual) revenue greater than 0`,
            400,
          );
        }
      }
      if (stage === "ORDERED") {
        if (!project.supplierId) {
          throw new AppError(`Cannot move to ${targetStatus}: an order requires a supplier to be assigned`, 400);
        }
        const cost = Math.max(
          Number(project.financial?.actualCost ?? 0),
          Number(project.financial?.estimatedCost ?? 0),
        );
        if (cost <= 0) {
          throw new AppError(
            `Cannot move to ${targetStatus}: an order requires an estimated (or actual) cost greater than 0`,
            400,
          );
        }
      }
    }

    if (targetStatus === "CLOSED") {
      const financials = computeFinancials(project.financial);
      const balance = financials?.customerBalance ?? 0;
      if (balance > 0) {
        throw new AppError(`Cannot close: outstanding customer balance of ${balance.toFixed(2)}. Admin must use the override action.`, 409);
      }
    }

    const result = await tx.project.update({
      where: { id: projectId },
      data: { status: targetStatus },
    });
    await tx.activity.create({
      data: {
        projectId,
        userId: user.id,
        type: "SYSTEM",
        message: `Status changed from ${project.status} to ${targetStatus}.`,
      },
    });
    return result;
  });
}

/**
 * Admin-only escape hatch for the shipment hold. Only valid when the project
 * is actually being held (SHIPPING with an outstanding customer balance).
 * Logs admin name, timestamp, and reason to the Activity Timeline per spec.
 */
export async function overrideShipmentHold(projectId: string, user: AuthUser, reason: string) {
  if (user.role !== "ADMIN") {
    throw new AppError("Only Admin can override the shipment hold", 403);
  }
  if (!reason || reason.trim().length === 0) {
    throw new AppError("A reason is required to override the shipment hold", 400);
  }

  return withSerializableTransaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: { financial: true },
    });
    if (!project) throw new AppError("Project not found", 404);

    if (project.status !== "SHIPPING") {
      throw new AppError("Shipment hold override only applies to projects in Shipping", 400);
    }
    const financials = computeFinancials(project.financial);
    const balance = financials?.customerBalance ?? 0;
    if (balance <= 0) {
      throw new AppError("This project has no outstanding balance — no hold to override", 400);
    }

    const admin = await tx.user.findUnique({ where: { id: user.id } });
    const result = await tx.project.update({
      where: { id: projectId },
      data: { status: "CLOSED", shipmentHoldOverridden: true },
    });
    await tx.activity.create({
      data: {
        projectId,
        userId: user.id,
        type: "OVERRIDE",
        message: `Shipment hold overridden by ${admin?.name ?? user.id} at ${new Date().toISOString()}. Reason: ${reason}`,
      },
    });
    return result;
  });
}

export interface ProjectUpdateInput {
  projectName?: string;
  nextAction?: string | null;
  dueDate?: Date | null;
  description?: string | null;
  supplierId?: string | null;
  estimatedRevenue?: number;
  actualRevenue?: number;
  customerPaid?: number;
  estimatedCost?: number;
  actualCost?: number;
  supplierPaid?: number;
  currency?: "USD" | "EUR" | "LBP";
}

const REVENUE_FIELDS = ["estimatedRevenue", "actualRevenue", "customerPaid"] as const;
const COST_FIELDS = ["estimatedCost", "actualCost", "supplierPaid"] as const;
const FIELD_LABELS: Record<string, string> = {
  estimatedRevenue: "Estimated revenue",
  actualRevenue: "Actual revenue",
  customerPaid: "Customer paid",
  estimatedCost: "Estimated cost",
  actualCost: "Actual cost",
  supplierPaid: "Supplier paid",
};

/**
 * CLOSED is a finalized record: Sales/Procurement become read-only on it so a
 * settled deal can't be quietly altered after the fact. Admin keeps edit access
 * for exceptional corrections (e.g. a late invoice) — every such edit is still
 * written to the Activity Timeline like any other change, so it stays audited.
 */
function assertEditableStatus(project: { status: ProjectStatus }, user: AuthUser) {
  if (project.status === "CLOSED" && user.role !== "ADMIN") {
    throw new AppError("This project is closed — only Admin can make further changes", 403);
  }
}

/**
 * Edit permission mirrors field visibility: if a role can see a figure
 * (lib/rbac.ts), it can edit it — Sales owns the customer side, Procurement
 * owns the supplier side. Fields the caller can't touch are silently dropped
 * rather than rejected; a body with nothing the caller was allowed to touch
 * is a genuine 403. A no-op patch (nothing actually changed) skips the
 * Activity write — nothing to audit.
 */
export async function updateProject(projectId: string, patch: ProjectUpdateInput, user: AuthUser) {
  return withSerializableTransaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, include: { financial: true } });
    if (!project) throw new AppError("Project not found", 404);
    assertEditableStatus(project, user);

    const projectData: Record<string, unknown> = {};
    const financialData: Record<string, unknown> = {};
    const changes: string[] = [];
    let anyPermittedFieldProvided = false;

    if (patch.projectName !== undefined) {
      anyPermittedFieldProvided = true;
      if (patch.projectName !== project.projectName) {
        changes.push(`Project name changed from "${project.projectName}" to "${patch.projectName}".`);
        projectData.projectName = patch.projectName;
      }
    }
    if (patch.nextAction !== undefined) {
      anyPermittedFieldProvided = true;
      if (patch.nextAction !== project.nextAction) {
        changes.push(`Next action updated to "${patch.nextAction ?? "—"}".`);
        projectData.nextAction = patch.nextAction;
      }
    }
    if (patch.dueDate !== undefined) {
      anyPermittedFieldProvided = true;
      const changed = (patch.dueDate?.getTime() ?? null) !== (project.dueDate?.getTime() ?? null);
      if (changed) {
        changes.push(`Due date updated to ${patch.dueDate ? patch.dueDate.toISOString().slice(0, 10) : "—"}.`);
        projectData.dueDate = patch.dueDate;
      }
    }
    if (patch.description !== undefined) {
      anyPermittedFieldProvided = true;
      if (patch.description !== project.description) {
        changes.push("Description updated.");
        projectData.description = patch.description;
      }
    }
    // Supplier assignment is a Procurement-owned action — gate with canSeeCost
    // (ADMIN + PROCUREMENT), the same rule already used for cost-side visibility.
    if (patch.supplierId !== undefined && canSeeCost(user.role)) {
      anyPermittedFieldProvided = true;
      if (patch.supplierId !== project.supplierId) {
        // First-time assignment (not a reassignment of an existing supplier) must come with
        // a real cost — otherwise a supplier can sit "assigned" indefinitely with $0 cost,
        // which reads as "free" rather than "not sourced yet."
        if (patch.supplierId && !project.supplierId) {
          const resultingEstCost = patch.estimatedCost ?? Number(project.financial?.estimatedCost ?? 0);
          const resultingActCost = patch.actualCost ?? Number(project.financial?.actualCost ?? 0);
          if (resultingEstCost <= 0 && resultingActCost <= 0) {
            throw new AppError("Assigning a supplier requires an estimated (or actual) cost greater than 0", 400);
          }
        }
        changes.push(project.supplierId ? "Supplier reassigned." : "Supplier assigned.");
        projectData.supplierId = patch.supplierId;
      }
    }

    for (const field of REVENUE_FIELDS) {
      if (patch[field] === undefined || !canSeeRevenue(user.role)) continue;
      anyPermittedFieldProvided = true;
      const current = Number(project.financial?.[field] ?? 0);
      if (patch[field] !== current) {
        changes.push(`${FIELD_LABELS[field]} updated to ${patch[field]!.toFixed(2)}.`);
        financialData[field] = patch[field];
      }
    }
    for (const field of COST_FIELDS) {
      if (patch[field] === undefined || !canSeeCost(user.role)) continue;
      anyPermittedFieldProvided = true;
      const current = Number(project.financial?.[field] ?? 0);
      if (patch[field] !== current) {
        changes.push(`${FIELD_LABELS[field]} updated to ${patch[field]!.toFixed(2)}.`);
        financialData[field] = patch[field];
      }
    }

    // Currency is metadata, not a sensitive amount — open to every role,
    // deliberately not folded into REVENUE_FIELDS/COST_FIELDS above since
    // those are gated by canSeeRevenue/canSeeCost and this must not be.
    if (patch.currency !== undefined) {
      anyPermittedFieldProvided = true;
      if (patch.currency !== project.financial?.currency) {
        changes.push(`Currency changed to ${patch.currency}.`);
        financialData.currency = patch.currency;
      }
    }

    if (!anyPermittedFieldProvided) {
      throw new AppError("None of the submitted fields are editable by your role", 403);
    }
    if (changes.length === 0) {
      return tx.project.findUnique({
        where: { id: projectId },
        include: { financial: true, customer: true, supplier: true, owner: true, expenses: true },
      });
    }

    if (Object.keys(projectData).length > 0) {
      await tx.project.update({ where: { id: projectId }, data: projectData });
    }
    if (Object.keys(financialData).length > 0) {
      await tx.financial.update({ where: { projectId }, data: financialData });
    }
    await tx.activity.create({
      data: { projectId, userId: user.id, type: "UPDATE", message: changes.join(" ") },
    });

    return tx.project.findUnique({
      where: { id: projectId },
      include: { financial: true, customer: true, supplier: true, owner: true, expenses: true },
    });
  });
}

/**
 * Deliberately a separate endpoint from updateProject — recording a payment
 * has its own real business rule (can't exceed the outstanding balance) that
 * a free-form correction edit to customerPaid/supplierPaid should NOT be
 * bound by. Currency is never accepted here; it always uses whatever the
 * project's Financial row already has.
 */
export async function recordPayment(
  projectId: string,
  side: "customer" | "supplier",
  amount: number,
  note: string | undefined,
  user: AuthUser,
) {
  if (!validMoneyAmount(amount)) {
    throw new AppError("Payment must be a positive amount with at most two decimal places", 400);
  }
  if (side === "customer" && !canSeeRevenue(user.role)) {
    throw new AppError("Insufficient permissions", 403);
  }
  if (side === "supplier" && !canSeeCost(user.role)) {
    throw new AppError("Insufficient permissions", 403);
  }

  return withSerializableTransaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: { financial: true },
    });
    if (!project) throw new AppError("Project not found", 404);
    if (project.status === "CLOSED" && user.role !== "ADMIN") {
      throw new AppError("This project is closed — only Admin can make further changes", 403);
    }
    if (!project.financial) {
      throw new AppError("Project financial record is missing", 409);
    }

    const financials = computeFinancials(project.financial);
    const balance = side === "customer" ? financials!.customerBalance : financials!.supplierBalance;
    if (amount > balance) {
      throw new AppError(
        `Payment of ${amount.toFixed(2)} exceeds the outstanding balance of ${balance.toFixed(2)}`,
        400,
      );
    }

    await tx.financial.update({
      where: { projectId },
      data: side === "customer"
        ? { customerPaid: { increment: amount } }
        : { supplierPaid: { increment: amount } },
    });
    await tx.activity.create({
      data: {
        projectId,
        userId: user.id,
        type: "UPDATE",
        message: `${side === "customer" ? "Customer" : "Supplier"} payment of ${amount.toFixed(2)} ${project.financial.currency} recorded.${note ? ` Note: ${note}` : ""}`,
      },
    });

    return tx.project.findUnique({
      where: { id: projectId },
      include: { financial: true, customer: true, supplier: true, owner: true, expenses: true },
    });
  });
}

/**
 * Itemized operational costs (shipping, inspection, etc.) — a separate,
 * cost-side tracked category from the brief's own Financials list. Gated by
 * canSeeCost, same as Supplier/Cost. Deliberately NOT folded into actualCost
 * or the margin formula (computeFinancials) — that formula is already tested
 * and unrelated to this itemized log; the brief lists Expenses as its own
 * sibling category, not a stated input to margin.
 */
export async function addExpense(
  projectId: string,
  category: string,
  amount: number,
  note: string | undefined,
  user: AuthUser,
) {
  if (!canSeeCost(user.role)) {
    throw new AppError("Insufficient permissions", 403);
  }
  if (!validMoneyAmount(amount)) {
    throw new AppError("Expense must be positive with at most two decimal places", 400);
  }

  return withSerializableTransaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: { financial: true },
    });
    if (!project) throw new AppError("Project not found", 404);
    assertEditableStatus(project, user);
    await tx.expense.create({ data: { projectId, category, amount, note } });
    await tx.activity.create({
      data: {
        projectId,
        userId: user.id,
        type: "UPDATE",
        message: `Expense recorded: ${category} — ${amount.toFixed(2)} ${project.financial?.currency ?? "USD"}.${note ? ` Note: ${note}` : ""}`,
      },
    });
  });
}
