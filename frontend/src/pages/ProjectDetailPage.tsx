import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOverrideHold, useProject, useTransitionStatus } from "../hooks/useProjects";
import { useAuth } from "../lib/auth-context";
import { formatCurrency, formatDate, formatPercent } from "../lib/format";
import type { ProjectStatus } from "../lib/types";

const WORKFLOW_ORDER: ProjectStatus[] = ["RFQ", "QUOTED", "ORDERED", "SHIPPING", "CLOSED"];

export function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: project, isLoading, error } = useProject(id);
  const transition = useTransitionStatus(id ?? "");
  const override = useOverrideHold(id ?? "");
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  if (isLoading) return <div className="p-6 text-sm text-neutral-400">Loading...</div>;
  if (error || !project) return <div className="p-6 text-sm text-red-600">Project not found.</div>;

  const currentIndex = WORKFLOW_ORDER.indexOf(project.status);
  const isAdmin = user?.role === "ADMIN";
  const forwardStages = WORKFLOW_ORDER.slice(currentIndex + 1);
  const nextStage = forwardStages[0];

  async function attemptTransition(status: ProjectStatus) {
    setTransitionError(null);
    try {
      await transition.mutateAsync(status);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Transition failed";
      setTransitionError(message);
    }
  }

  async function submitOverride() {
    setTransitionError(null);
    try {
      await override.mutateAsync(reason);
      setShowOverrideForm(false);
      setReason("");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Override failed";
      setTransitionError(message);
    }
  }

  const f = project.financial ?? {};

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        &larr; Back to dashboard
      </Link>

      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{project.projectName}</h1>
            <p className="text-sm text-neutral-500">
              {project.customer?.name}
              {project.supplier ? ` · Supplier: ${project.supplier.name}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold">{project.status}</span>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-neutral-400">Owner</p>
            <p className="text-neutral-800">{project.owner?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-neutral-400">Next Action</p>
            <p className="text-neutral-800">{project.nextAction ?? "—"}</p>
          </div>
          <div>
            <p className="text-neutral-400">Due Date</p>
            <p className="text-neutral-800">{formatDate(project.dueDate)}</p>
          </div>
          <div>
            <p className="text-neutral-400">Last Update</p>
            <p className="text-neutral-800">{formatDate(project.lastUpdate)}</p>
          </div>
        </div>

        {/* Financial tab — server already strips fields the current role can't see */}
        <div className="mb-6 rounded-lg border border-neutral-100 bg-neutral-50 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Financial</h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {f.estimatedRevenue != null && (
              <div>
                <p className="text-neutral-400">Est. Revenue</p>
                <p className="text-neutral-800">{formatCurrency(f.estimatedRevenue)}</p>
              </div>
            )}
            {f.actualRevenue != null && (
              <div>
                <p className="text-neutral-400">Actual Revenue</p>
                <p className="text-neutral-800">{formatCurrency(f.actualRevenue)}</p>
              </div>
            )}
            {f.customerBalance != null && (
              <div>
                <p className="text-neutral-400">Customer Balance</p>
                <p className={f.customerBalance > 0 ? "font-medium text-red-600" : "text-neutral-800"}>
                  {formatCurrency(f.customerBalance)}
                </p>
              </div>
            )}
            {f.estimatedCost != null && (
              <div>
                <p className="text-neutral-400">Est. Cost</p>
                <p className="text-neutral-800">{formatCurrency(f.estimatedCost)}</p>
              </div>
            )}
            {f.actualCost != null && (
              <div>
                <p className="text-neutral-400">Actual Cost</p>
                <p className="text-neutral-800">{formatCurrency(f.actualCost)}</p>
              </div>
            )}
            {f.supplierBalance != null && (
              <div>
                <p className="text-neutral-400">Supplier Balance</p>
                <p className="text-neutral-800">{formatCurrency(f.supplierBalance)}</p>
              </div>
            )}
            {f.marginPercent !== undefined && (
              <div>
                <p className="text-neutral-400">Profit Margin</p>
                <p className={(f.marginPercent ?? 0) < 20 ? "font-medium text-amber-600" : "text-neutral-800"}>
                  {formatPercent(f.marginPercent)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Shipment hold */}
        {project.needsAttention.blockedShipment && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">
              Cannot close — outstanding customer balance{f.customerBalance != null ? `: ${formatCurrency(f.customerBalance)}` : ""}.
            </p>
            {isAdmin && !showOverrideForm && (
              <button
                type="button"
                onClick={() => setShowOverrideForm(true)}
                className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Admin Override
              </button>
            )}
            {isAdmin && showOverrideForm && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for overriding the hold (required, logged to Activity Timeline)"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitOverride}
                    disabled={!reason.trim() || override.isPending}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm Override
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOverrideForm(false)}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Workflow transition controls */}
        {project.status !== "CLOSED" && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {nextStage && (
              <button
                type="button"
                onClick={() => attemptTransition(nextStage)}
                disabled={transition.isPending}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                Move to {nextStage}
              </button>
            )}
            {isAdmin &&
              forwardStages.slice(1).map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => attemptTransition(stage)}
                  disabled={transition.isPending}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                >
                  Skip to {stage} (Admin)
                </button>
              ))}
          </div>
        )}
        {transitionError && <p className="mb-4 text-sm text-red-600">{transitionError}</p>}

        {/* Activity timeline */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Activity</h2>
          <div className="space-y-3">
            {project.activities.map((a) => (
              <div key={a.id} className="border-l-2 border-neutral-200 pl-3 text-sm">
                <p className="text-neutral-800">{a.message}</p>
                <p className="text-xs text-neutral-400">
                  {a.user?.name ?? "System"} · {formatDate(a.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
