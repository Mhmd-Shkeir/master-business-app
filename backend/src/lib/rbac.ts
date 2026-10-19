import type { ProjectStatus } from "@prisma/client";
import type { AuthUser } from "../middleware/auth";

/**
 * Field visibility per the brief's Permissions & Security section:
 * Sales   -> customer data, revenue, project status. NOT supplier costs or profit margin.
 * Procure -> supplier data, costs. NOT customer revenue (and therefore not margin, which needs revenue).
 * Admin   -> everything.
 */
export function canSeeRevenue(role: AuthUser["role"]): boolean {
  return role === "ADMIN" || role === "SALES";
}

export function canSeeCost(role: AuthUser["role"]): boolean {
  return role === "ADMIN" || role === "PROCUREMENT";
}

export function canSeeMargin(role: AuthUser["role"]): boolean {
  return role === "ADMIN";
}

interface FinancialLike {
  estimatedRevenue: unknown;
  actualRevenue: unknown;
  estimatedCost: unknown;
  actualCost: unknown;
  customerPaid: unknown;
  supplierPaid: unknown;
  currency: unknown;
}

/** Sums a project's Expense rows (Decimal → number) for margin purposes. */
export function sumExpenses(expenses: { amount: unknown }[] | null | undefined): number {
  if (!expenses) return 0;
  return expenses.reduce((sum, e) => sum + Number(e.amount), 0);
}

/**
 * Computed, role-independent business figures. Callers filter visibility after.
 *
 * `totalExpenses` (itemized shipping/inspection/etc. costs) is folded into
 * `totalCost` and therefore into margin — real money spent on the deal
 * should reduce profitability. It's deliberately NOT folded into
 * `supplierBalance`: expenses may be paid to a shipper/inspector, not
 * necessarily the assigned Supplier, so "what we still owe the supplier"
 * stays based on the supplier's own actualCost/estimatedCost only.
 */
export function computeFinancials(f: FinancialLike | null | undefined, totalExpenses: number = 0) {
  if (!f) return null;

  const revenue = Number(f.actualRevenue) > 0 ? Number(f.actualRevenue) : Number(f.estimatedRevenue);
  const supplierCost = Number(f.actualCost) > 0 ? Number(f.actualCost) : Number(f.estimatedCost);
  const totalCost = supplierCost + totalExpenses;
  // Margin is meaningless before a cost figure actually exists (fresh RFQs default
  // to 0 cost) — showing e.g. "100% margin" for a deal nobody has costed out yet
  // reads as wildly profitable rather than "not started". Suppress until sourced.
  const margin = revenue > 0 && supplierCost > 0 ? ((revenue - totalCost) / revenue) * 100 : null;
  const customerBalance = revenue - Number(f.customerPaid);
  const supplierBalance = supplierCost - Number(f.supplierPaid);

  return {
    estimatedRevenue: Number(f.estimatedRevenue),
    actualRevenue: Number(f.actualRevenue),
    estimatedCost: Number(f.estimatedCost),
    actualCost: Number(f.actualCost),
    customerPaid: Number(f.customerPaid),
    supplierPaid: Number(f.supplierPaid),
    totalExpenses,
    totalCost,
    marginPercent: margin,
    customerBalance,
    supplierBalance,
    currency: f.currency,
  };
}

export function filterFinancialsForRole(
  financials: ReturnType<typeof computeFinancials>,
  role: AuthUser["role"],
) {
  if (!financials) return null;

  const result: Record<string, unknown> = {};

  // Currency is metadata about the amounts, not a sensitive amount itself —
  // visible to every role regardless of revenue/cost gating.
  result.currency = financials.currency;

  if (canSeeRevenue(role)) {
    result.estimatedRevenue = financials.estimatedRevenue;
    result.actualRevenue = financials.actualRevenue;
    result.customerPaid = financials.customerPaid;
    result.customerBalance = financials.customerBalance;
  }

  if (canSeeCost(role)) {
    result.estimatedCost = financials.estimatedCost;
    result.actualCost = financials.actualCost;
    result.supplierPaid = financials.supplierPaid;
    result.supplierBalance = financials.supplierBalance;
    result.totalExpenses = financials.totalExpenses;
    result.totalCost = financials.totalCost;
  }

  if (canSeeMargin(role)) {
    result.marginPercent = financials.marginPercent;
  }

  return result;
}

const MARGIN_ALERT_THRESHOLD = 20;

/**
 * Shared "what needs attention today" computation — used by the Dashboard/Projects
 * serialization and by the AI Daily Brief, so the two can never disagree.
 *
 * `lowMargin` and `blockedShipment` are gated by role, not just the raw figures
 * they're derived from. A bare true/false is itself a leak of hidden financial
 * data — telling a Sales user "this project has low margin" reveals something
 * about a supplier cost they're not authorized to see, the same way telling a
 * Procurement user "shipment is blocked on an unpaid balance" reveals something
 * about customer revenue they're not authorized to see. Both are computed from
 * the full (role-independent) financials so the underlying numbers stay correct
 * — they're just forced to `false` before being handed back to a role that
 * can't see the data they'd be revealing.
 */
export function needsAttention(
  project: { status: ProjectStatus; dueDate: Date | null; nextAction: string | null },
  financials: ReturnType<typeof computeFinancials>,
  role: AuthUser["role"],
) {
  const overdue = Boolean(project.dueDate && project.dueDate < new Date() && project.status !== "CLOSED");
  const missingNextAction = !project.nextAction && project.status !== "CLOSED";
  const lowMargin =
    canSeeMargin(role) && financials?.marginPercent != null && financials.marginPercent < MARGIN_ALERT_THRESHOLD;
  const blockedShipment =
    canSeeRevenue(role) && Boolean(project.status === "SHIPPING" && financials && financials.customerBalance > 0);

  return {
    overdue,
    missingNextAction,
    lowMargin,
    blockedShipment,
    any: overdue || missingNextAction || lowMargin || blockedShipment,
  };
}

/**
 * Groups a list of {value, currency} items into per-currency subtotals.
 * Never sums across currencies — this app performs no FX conversion anywhere,
 * so a cross-currency total would be actively misleading.
 */
export function groupByCurrency<T>(
  items: T[],
  getValue: (item: T) => number | null | undefined,
  getCurrency: (item: T) => string | null | undefined,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of items) {
    const value = getValue(item);
    const currency = getCurrency(item) ?? "USD";
    if (value == null) continue;
    totals[currency] = (totals[currency] ?? 0) + value;
  }
  return totals;
}

/**
 * Free-text activities cannot safely be classified by searching for keywords.
 * For restricted roles, show only exact known public system templates or the
 * viewer's own comment; otherwise fail closed until sensitivity is structured.
 */
const SAFE_STATUS_EVENT = /^Status changed from (RFQ|QUOTED|ORDERED|SHIPPING|CLOSED) to (RFQ|QUOTED|ORDERED|SHIPPING|CLOSED)\.$/;
const SAFE_SYSTEM_MESSAGES = new Set([
  "Project created.", "Project created from RFQ.", "RFQ received from customer.",
  "Project closed.", "Order confirmed with supplier.", "Shipment created.",
]);

export function sanitizeActivitiesForRole<T extends { message: string; type?: string | null; userId?: string | null }>(
  activities: T[], role: AuthUser["role"], viewerId?: string,
): T[] {
  if (role === "ADMIN") return activities;
  return activities.filter((activity) => {
    if (activity.type === "COMMENT" && viewerId && activity.userId === viewerId) return true;
    if (activity.type === "SYSTEM") return SAFE_SYSTEM_MESSAGES.has(activity.message) || SAFE_STATUS_EVENT.test(activity.message);
    if (activity.type === "UPDATE") return activity.message === "Description updated.";
    return false;
  });
}
