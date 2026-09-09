import type { ProjectSummary } from "./types";

/** Sums a role-visible balance/amount field grouped by currency. No FX conversion — mixing currencies into one number would be meaningless. */
export function groupByCurrency(
  projects: ProjectSummary[],
  field: "customerBalance" | "supplierBalance" | "actualRevenue" | "actualCost",
): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of projects) {
    const value = p.financial?.[field];
    if (value == null) continue;
    const currency = p.financial?.currency ?? "USD";
    map.set(currency, (map.get(currency) ?? 0) + value);
  }
  return map;
}
