import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorState } from "../components/ErrorState";
import { RecordPaymentForm } from "../components/RecordPaymentForm";
import { StatusBadge } from "../components/StatusBadge";
import { useOverrideHold, useProject, useSuppliers, useTransitionStatus, useUpdateProject } from "../hooks/useProjects";
import { useAuth } from "../lib/auth-context";
import { formatCurrency, formatDate, formatPercent } from "../lib/format";
import type { Activity, ProjectStatus } from "../lib/types";

const ACTIVITY_STYLES: Record<Activity["type"], string> = {
  SYSTEM: "border-blue-300",
  UPDATE: "border-neutral-300",
  COMMENT: "border-neutral-300",
  OVERRIDE: "border-red-400",
};

const WORKFLOW_ORDER: ProjectStatus[] = ["RFQ", "QUOTED", "ORDERED", "SHIPPING", "CLOSED"];

const REVENUE_FIELDS = [
  { key: "estimatedRevenue", label: "Est. Revenue" },
  { key: "actualRevenue", label: "Actual Revenue" },
  { key: "customerPaid", label: "Customer Paid" },
] as const;

const COST_FIELDS = [
  { key: "estimatedCost", label: "Est. Cost" },
  { key: "actualCost", label: "Actual Cost" },
  { key: "supplierPaid", label: "Supplier Paid" },
] as const;

const FINANCIAL_INPUT_FIELDS = [...REVENUE_FIELDS, ...COST_FIELDS] as const;

function extractError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: project, isLoading, error, refetch } = useProject(id);
  const { data: suppliers } = useSuppliers(user?.role === "ADMIN" || user?.role === "PROCUREMENT");
  const transition = useTransitionStatus(id ?? "");
  const override = useOverrideHold(id ?? "");
  const updateProject = useUpdateProject(id ?? "");
  const [actionError, setActionError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [paymentFor, setPaymentFor] = useState<"customer" | "supplier" | null>(null);

  if (isLoading) return <div className="p-6 text-sm text-neutral-400">Loading...</div>;
  if (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return <div className="p-6 text-sm text-red-600">Project not found.</div>;
    }
    return (
      <div className="p-6">
        <ErrorState message="Failed to load this project." onRetry={() => refetch()} />
      </div>
    );
  }
  if (!project) return <div className="p-6 text-sm text-red-600">Project not found.</div>;

  const currentIndex = WORKFLOW_ORDER.indexOf(project.status);
  const isAdmin = user?.role === "ADMIN";
  const canEditSupplier = user?.role === "ADMIN" || user?.role === "PROCUREMENT";
  const forwardStages = WORKFLOW_ORDER.slice(currentIndex + 1);
  const nextStage = forwardStages[0];
  const f = project.financial ?? {};

  async function attemptTransition(status: ProjectStatus) {
    setActionError(null);
    try {
      await transition.mutateAsync(status);
    } catch (err: unknown) {
      setActionError(extractError(err, "Transition failed"));
    }
  }

  async function submitOverride() {
    setActionError(null);
    try {
      await override.mutateAsync(reason);
      setShowOverrideForm(false);
      setReason("");
    } catch (err: unknown) {
      setActionError(extractError(err, "Override failed"));
    }
  }

  function startEditing() {
    setActionError(null);
    setForm({
      projectName: project!.projectName,
      nextAction: project!.nextAction ?? "",
      dueDate: project!.dueDate ? project!.dueDate.slice(0, 10) : "",
      description: project!.description ?? "",
      currency: f.currency ?? "USD",
      supplierId: project!.supplier?.id ?? "",
      estimatedRevenue: f.estimatedRevenue?.toString() ?? "",
      actualRevenue: f.actualRevenue?.toString() ?? "",
      customerPaid: f.customerPaid?.toString() ?? "",
      estimatedCost: f.estimatedCost?.toString() ?? "",
      actualCost: f.actualCost?.toString() ?? "",
      supplierPaid: f.supplierPaid?.toString() ?? "",
    });
    setEditing(true);
  }

  async function handleSave() {
    setActionError(null);
    const patch: Record<string, unknown> = {
      projectName: form.projectName,
      nextAction: form.nextAction || null,
      dueDate: form.dueDate || null,
      description: form.description || null,
    };
    if ("currency" in f) patch.currency = form.currency;
    if (canEditSupplier) patch.supplierId = form.supplierId || null;
    for (const { key } of FINANCIAL_INPUT_FIELDS) {
      if (key in f) patch[key] = Number(form[key] || 0);
    }
    try {
      await updateProject.mutateAsync(patch);
      setEditing(false);
    } catch (err: unknown) {
      setActionError(extractError(err, "Update failed"));
    }
  }

  return (
    <div className="animate-fade-in mx-auto max-w-3xl p-6">
      <Link to="/" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        &larr; Back to dashboard
      </Link>

      <div className="rounded-xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            {editing ? (
              <input
                value={form.projectName}
                onChange={(e) => setForm((s) => ({ ...s, projectName: e.target.value }))}
                className="mb-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-lg font-semibold outline-none focus:border-neutral-500"
              />
            ) : (
              <h1 className="text-lg font-semibold text-neutral-900">{project.projectName}</h1>
            )}
            <p className="text-sm text-neutral-500">
              {project.customer?.name}
              {!editing && project.supplier ? ` · Supplier: ${project.supplier.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={project.status} />
            {!editing && (
              <button
                type="button"
                onClick={startEditing}
                className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-neutral-400">Owner</p>
            <p className="text-neutral-800">{project.owner?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-neutral-400">Next Action</p>
            {editing ? (
              <input
                value={form.nextAction}
                onChange={(e) => setForm((s) => ({ ...s, nextAction: e.target.value }))}
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-500"
              />
            ) : (
              <p className="text-neutral-800">{project.nextAction ?? "—"}</p>
            )}
          </div>
          <div>
            <p className="text-neutral-400">Due Date</p>
            {editing ? (
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))}
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-500"
              />
            ) : (
              <p className="text-neutral-800">{formatDate(project.dueDate)}</p>
            )}
          </div>
          <div>
            <p className="text-neutral-400">Last Update</p>
            <p className="text-neutral-800">{formatDate(project.lastUpdate)}</p>
          </div>
          {editing && canEditSupplier && (
            <div>
              <p className="text-neutral-400">Supplier</p>
              <select
                value={form.supplierId}
                onChange={(e) => setForm((s) => ({ ...s, supplierId: e.target.value }))}
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-500"
              >
                <option value="">None</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mb-6">
          <p className="text-sm text-neutral-400">Description</p>
          {editing ? (
            <textarea
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-500"
            />
          ) : (
            <p className="text-sm text-neutral-800">{project.description ?? "—"}</p>
          )}
        </div>

        {/* Financial — server already strips fields the current role can't see */}
        <div className="mb-6 space-y-4">
          {editing && "currency" in f && (
            <div className="flex items-center justify-end gap-2 text-xs">
              <span className="text-neutral-500">Currency</span>
              <select
                value={form.currency}
                onChange={(e) => setForm((s) => ({ ...s, currency: e.target.value }))}
                className="rounded-md border border-neutral-300 px-2 py-0.5 outline-none focus:border-neutral-500"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="LBP">LBP</option>
              </select>
            </div>
          )}

          {"estimatedRevenue" in f && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-700">Customer / Revenue</h2>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {REVENUE_FIELDS.map(({ key, label }) => {
                  const value = (f as Record<string, number | undefined>)[key];
                  return (
                    <div key={key}>
                      <p className="text-neutral-400">{label}</p>
                      {editing ? (
                        <input
                          type="number"
                          min="0"
                          value={form[key]}
                          onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
                          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-500"
                        />
                      ) : (
                        <p className="text-neutral-800">{formatCurrency(value, f.currency)}</p>
                      )}
                      {key === "customerPaid" && f.customerBalance != null && !editing && (
                        <p className={`mt-0.5 text-xs ${f.customerBalance > 0 ? "text-red-600" : "text-neutral-400"}`}>
                          Balance: {formatCurrency(f.customerBalance, f.currency)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {!editing && f.customerBalance != null && f.customerBalance > 0 && paymentFor !== "customer" && (
                <button
                  type="button"
                  onClick={() => setPaymentFor("customer")}
                  className="mt-3 rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-neutral-800"
                >
                  Record Payment
                </button>
              )}
              {paymentFor === "customer" && (
                <div className="mt-3">
                  <RecordPaymentForm project={project} side="customer" onDone={() => setPaymentFor(null)} />
                </div>
              )}
            </div>
          )}

          {"estimatedCost" in f && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-700">Supplier / Cost</h2>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {COST_FIELDS.map(({ key, label }) => {
                  const value = (f as Record<string, number | undefined>)[key];
                  return (
                    <div key={key}>
                      <p className="text-neutral-400">{label}</p>
                      {editing ? (
                        <input
                          type="number"
                          min="0"
                          value={form[key]}
                          onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
                          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-500"
                        />
                      ) : (
                        <p className="text-neutral-800">{formatCurrency(value, f.currency)}</p>
                      )}
                      {key === "supplierPaid" && f.supplierBalance != null && !editing && (
                        <p className="mt-0.5 text-xs text-neutral-400">Balance: {formatCurrency(f.supplierBalance, f.currency)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {!editing && f.supplierBalance != null && f.supplierBalance > 0 && paymentFor !== "supplier" && (
                <button
                  type="button"
                  onClick={() => setPaymentFor("supplier")}
                  className="mt-3 rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-neutral-800"
                >
                  Record Payment
                </button>
              )}
              {paymentFor === "supplier" && (
                <div className="mt-3">
                  <RecordPaymentForm project={project} side="supplier" onDone={() => setPaymentFor(null)} />
                </div>
              )}
            </div>
          )}

          {f.marginPercent !== undefined && (
            <div className="text-sm">
              <p className="text-neutral-400">Profit Margin</p>
              <p className={(f.marginPercent ?? 0) < 20 ? "font-medium text-amber-600" : "text-neutral-800"}>
                {formatPercent(f.marginPercent)}
              </p>
            </div>
          )}
        </div>

        {editing && (
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={updateProject.isPending}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50"
            >
              {updateProject.isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setActionError(null);
              }}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Shipment hold */}
        {!editing && project.needsAttention.blockedShipment && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">
              Cannot close — outstanding customer balance{f.customerBalance != null ? `: ${formatCurrency(f.customerBalance, f.currency)}` : ""}.
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

        {/* Workflow strip — presentational only */}
        {!editing && (
          <div className="mb-6 flex items-center rounded-xl border border-neutral-200/70 bg-neutral-50/60 px-4 py-3">
            {WORKFLOW_ORDER.map((stage, i) => (
              <div key={stage} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      i === currentIndex
                        ? "bg-neutral-900 ring-4 ring-neutral-900/15"
                        : i < currentIndex
                          ? "bg-neutral-900"
                          : "bg-neutral-300"
                    }`}
                  />
                  <p
                    className={`mt-1.5 text-[10px] font-medium uppercase tracking-wide ${i <= currentIndex ? "text-neutral-700" : "text-neutral-400"}`}
                  >
                    {stage}
                  </p>
                </div>
                {i < WORKFLOW_ORDER.length - 1 && (
                  <div className={`mx-1 h-px flex-1 ${i < currentIndex ? "bg-neutral-900" : "bg-neutral-200"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Workflow transition controls */}
        {!editing && project.status !== "CLOSED" && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {nextStage && (
              <button
                type="button"
                onClick={() => attemptTransition(nextStage)}
                disabled={transition.isPending}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50"
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
        {actionError && <p className="mb-4 text-sm text-red-600">{actionError}</p>}

        {/* Activity timeline */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Activity</h2>
          <div className="space-y-3">
            {project.activities.map((a) => (
              <div key={a.id} className={`border-l-2 pl-3 text-sm ${ACTIVITY_STYLES[a.type]}`}>
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
