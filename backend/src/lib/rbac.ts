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

/** Computed, role-independent business figures. Callers filter visibility after. */
export function computeFinancials(f: FinancialLike | null | undefined) {
  if (!f) return null;

  const revenue = Number(f.actualRevenue) > 0 ? Number(f.actualRevenue) : Number(f.estimatedRevenue);
  const cost = Number(f.actualCost) > 0 ? Number(f.actualCost) : Number(f.estimatedCost);
  const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : null;
  const customerBalance = revenue - Number(f.customerPaid);
  const supplierBalance = cost - Number(f.supplierPaid);

  return {
    estimatedRevenue: Number(f.estimatedRevenue),
    actualRevenue: Number(f.actualRevenue),
    estimatedCost: Number(f.estimatedCost),
    actualCost: Number(f.actualCost),
    customerPaid: Number(f.customerPaid),
    supplierPaid: Number(f.supplierPaid),
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
  }

  if (canSeeMargin(role)) {
    result.marginPercent = financials.marginPercent;
  }

  return result;
}

const MARGIN_ALERT_THRESHOLD = 20;

/** Shared "what needs attention today" computation — used by the Dashboard/Projects
 * serialization and by the AI Daily Brief, so the two can never disagree. */
export function needsAttention(
  project: { status: ProjectStatus; dueDate: Date | null; nextAction: string | null },
  financials: ReturnType<typeof computeFinancials>,
) {
  const overdue = Boolean(project.dueDate && project.dueDate < new Date() && project.status !== "CLOSED");
  const missingNextAction = !project.nextAction && project.status !== "CLOSED";
  const lowMargin = financials?.marginPercent != null && financials.marginPercent < MARGIN_ALERT_THRESHOLD;
  const blockedShipment = Boolean(project.status === "SHIPPING" && financials && financials.customerBalance > 0);

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

// Activity messages are NOT all system-generated from a fixed template set —
// seed/demo data and free-text notes (e.g. a payment "note" field) can contain
// arbitrary natural language. Word-boundary, case-insensitive pattern matching
// (not exact-phrase matching) is used deliberately so a message like "Supplier
// increased cost by 3% due to steel prices" is caught the same as the app's
// own generated "Actual cost updated to X." — matching on the word "cost" or
// "revenue" appearing anywhere, not just inside a known template shape.
const MARGIN_PATTERN = /\b(margin|profit(?:ability)?)\b/i;
const COST_SIDE_PATTERN =
  /\b(cost|expense|supplier[\s-]?(paid|payment|invoice)|sourcing cost|procurement cost|purchase price)\b/i;
const REVENUE_SIDE_PATTERN = /\b(revenue|customer[\s-]?(paid|payment|invoice)|sale price)\b/i;

/**
 * Filters Activity messages for the AI's context (not the UI — the real
 * Activity Timeline stays project-level access, no per-field RBAC, since a
 * human reading it already has full project access). A message mentioning
 * margin/profit requires Admin; cost-side content requires canSeeCost;
 * revenue-side content requires canSeeRevenue. Anything that doesn't match
 * a recognized pattern is treated as neutral and kept — this is a targeted
 * filter for known-sensitive financial language, not a full redaction system.
 */
export function sanitizeActivitiesForRole<T extends { message: string }>(
  activities: T[],
  role: AuthUser["role"],
): T[] {
  return activities.filter((a) => {
    if (MARGIN_PATTERN.test(a.message) && !canSeeMargin(role)) return false;
    if (COST_SIDE_PATTERN.test(a.message) && !canSeeCost(role)) return false;
    if (REVENUE_SIDE_PATTERN.test(a.message) && !canSeeRevenue(role)) return false;
    return true;
  });
}
