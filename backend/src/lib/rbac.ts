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
  };
}

export function filterFinancialsForRole(
  financials: ReturnType<typeof computeFinancials>,
  role: AuthUser["role"],
) {
  if (!financials) return null;

  const result: Record<string, unknown> = {};

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
