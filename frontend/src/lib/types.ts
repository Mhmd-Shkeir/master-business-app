export type Role = "ADMIN" | "SALES" | "PROCUREMENT";

export type ProjectStatus = "RFQ" | "QUOTED" | "ORDERED" | "SHIPPING" | "CLOSED";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Financial {
  estimatedRevenue?: number;
  actualRevenue?: number;
  customerPaid?: number;
  customerBalance?: number;
  estimatedCost?: number;
  actualCost?: number;
  supplierPaid?: number;
  supplierBalance?: number;
  marginPercent?: number | null;
  currency?: string;
}

export interface NeedsAttention {
  overdue: boolean;
  missingNextAction: boolean;
  lowMargin: boolean;
  blockedShipment: boolean;
  any: boolean;
}

export interface ProjectSummary {
  id: string;
  projectName: string;
  status: ProjectStatus;
  nextAction: string | null;
  dueDate: string | null;
  description: string | null;
  lastUpdate: string;
  createdAt: string;
  owner: { id: string; name: string } | null;
  customer: { id: string; name: string; country: string | null } | null;
  supplier: { id: string; name: string; country: string | null } | null;
  financial: Financial | null;
  needsAttention: NeedsAttention;
  shipmentHoldOverridden: boolean;
}

export interface Activity {
  id: string;
  type: "COMMENT" | "UPDATE" | "SYSTEM" | "OVERRIDE";
  message: string;
  createdAt: string;
  user: { id: string; name: string } | null;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  activities: Activity[];
  expenses?: Expense[];
}

export interface Customer {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  country: string | null;
  paymentTerms: string | null;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  country: string | null;
  paymentTerms: string | null;
  createdAt: string;
}
