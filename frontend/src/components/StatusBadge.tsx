import type { ProjectStatus } from "../lib/types";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  RFQ: "bg-slate-100 text-slate-700",
  QUOTED: "bg-blue-50 text-blue-700",
  ORDERED: "bg-violet-50 text-violet-700",
  SHIPPING: "bg-amber-50 text-amber-700",
  CLOSED: "bg-emerald-50 text-emerald-700",
};

const DOT_STYLES: Record<ProjectStatus, string> = {
  RFQ: "bg-slate-400",
  QUOTED: "bg-blue-500",
  ORDERED: "bg-violet-500",
  SHIPPING: "bg-amber-500",
  CLOSED: "bg-emerald-500",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[status]}`} />
      {status}
    </span>
  );
}
