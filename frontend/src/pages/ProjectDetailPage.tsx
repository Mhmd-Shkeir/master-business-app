import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { DueDate } from "../components/DueDate";
import { ErrorState } from "../components/ErrorState";
import { SparkleIcon } from "../components/icons";
import { RecordPaymentForm } from "../components/RecordPaymentForm";
import { StatusBadge } from "../components/StatusBadge";
import { useAIQuery, useConfirmNote, useDraftEmail } from "../hooks/useAI";
import {
  useAddExpense,
  useOverrideHold,
  useProject,
  useSuppliers,
  useTransitionStatus,
  useUpdateProject,
} from "../hooks/useProjects";
import { useAuth } from "../lib/auth-context";
import { formatCurrency, formatDate, formatPercent } from "../lib/format";
import type { Activity, ProjectDetail, ProjectStatus } from "../lib/types";

const ACTIVITY_STYLES: Record<Activity["type"], string> = {
  SYSTEM: "border-blue-300",
  UPDATE: "border-neutral-300",
  COMMENT: "border-neutral-300",
  OVERRIDE: "border-red-400",
};

const WORKFLOW_ORDER: ProjectStatus[] = ["RFQ", "QUOTED", "ORDERED", "SHIPPING", "CLOSED"];

function extractError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

function AIAssistantPanel({ projectId, projectName }: { projectId: string; projectName: string }) {
  const draftEmail = useDraftEmail(projectId);
  const confirmNote = useConfirmNote(projectId);
  const projectQuery = useAIQuery();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [drafted, setDrafted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || projectQuery.isPending) return;
    setQueryError(null);
    setAnswer(null);
    try {
      const result = await projectQuery.mutateAsync(
        `Regarding the project "${projectName}" (ID: ${projectId}): ${question}`,
      );
      setAnswer(result.answer);
    } catch (err) {
      setQueryError(extractError(err, "Couldn't answer that right now."));
    }
  }

  async function handleDraft() {
    setError(null);
    setConfirmed(false);
    try {
      const result = await draftEmail.mutateAsync(undefined);
      setSubject(result.subject);
      setBody(result.body);
      setDrafted(true);
    } catch (err) {
      setError(extractError(err, "Couldn't draft an email right now."));
    }
  }

  async function handleConfirm() {
    setError(null);
    try {
      await confirmNote.mutateAsync(`AI-drafted follow-up (edited and confirmed):\n\nSubject: ${subject}\n\n${body}`);
      setConfirmed(true);
      setDrafted(false);
    } catch (err) {
      setError(extractError(err, "Couldn't record this note."));
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
        <SparkleIcon className="h-3.5 w-3.5" />
        AI Assistant
      </h2>

      {!drafted && (
        <button
          type="button"
          onClick={handleDraft}
          disabled={draftEmail.isPending}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {draftEmail.isPending ? "Drafting..." : "Draft Follow-up Email"}
        </button>
      )}

      {drafted && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">Review and edit before confirming — nothing is recorded until you confirm.</p>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirmNote.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {confirmNote.isPending ? "Recording..." : "Edit and Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setDrafted(false)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-white"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {confirmed && <p className="mt-2 text-xs text-emerald-600">Recorded to the Activity Timeline below.</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-4 border-t border-indigo-100 pt-4">
        <p className="mb-2 text-xs font-medium text-indigo-700">Ask about this project</p>
        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What's the outstanding balance?"
            className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={projectQuery.isPending || !question.trim()}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {projectQuery.isPending ? "Asking..." : "Ask"}
          </button>
        </form>
        {answer && (
          <p className="mt-2 whitespace-pre-wrap rounded-md bg-white p-2 text-sm text-neutral-800 shadow-sm">{answer}</p>
        )}
        {queryError && <p className="mt-2 text-xs text-red-600">{queryError}</p>}
      </div>
    </div>
  );
}

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

const EXPENSE_CATEGORIES = ["Shipping", "Inspection", "Customs", "Storage", "Other"];

function ExpensesSection({ project }: { project: ProjectDetail }) {
  const addExpense = useAddExpense(project.id);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("Shipping");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const expenses = project.expenses ?? [];
  const currency = project.financial?.currency;
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const numericAmount = Number(amount);
    if (!(numericAmount > 0)) {
      setError("Amount must be greater than 0.");
      return;
    }
    try {
      await addExpense.mutateAsync({ category, amount: numericAmount, note: note || undefined });
      setAmount("");
      setNote("");
      setShowForm(false);
    } catch (err) {
      setError(extractError(err, "Failed to add expense"));
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Expenses</h2>
        {expenses.length > 0 && (
          <span className="text-xs text-neutral-500">Total: {formatCurrency(total, currency)}</span>
        )}
      </div>

      {expenses.length === 0 ? (
        <p className="text-sm text-neutral-400">No expenses recorded yet.</p>
      ) : (
        <div className="mb-3 space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-neutral-800">{e.category}</span>
                {e.note && <span className="text-neutral-400"> · {e.note}</span>}
                <p className="text-xs text-neutral-400">{formatDate(e.createdAt)}</p>
              </div>
              <span className="font-medium text-neutral-800">{formatCurrency(Number(e.amount), currency)}</span>
            </div>
          ))}
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
        >
          + Add Expense
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-md border border-neutral-200 bg-white p-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={`Amount (${currency ?? "USD"})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addExpense.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {addExpense.isPending ? "Adding..." : "Add Expense"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
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
    <div className="animate-fade-in mx-auto max-w-4xl px-8 py-6">
      <Link to="/" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        &larr; Back to dashboard
      </Link>

      <header className="mb-6 rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {editing ? (
              <input
                value={form.projectName}
                onChange={(e) => setForm((s) => ({ ...s, projectName: e.target.value }))}
                className="mb-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-lg font-semibold outline-none focus:border-indigo-500"
              />
            ) : (
              <h1 className="text-lg font-semibold text-neutral-900">{project.projectName}</h1>
            )}
            <p className="text-sm text-neutral-500">
              {project.customer?.name}
              {!editing && project.supplier ? ` · Supplier: ${project.supplier.name}` : ""}
              {!editing && (
                <span className="ml-1 font-mono text-xs text-neutral-400">
                  · ID: {project.id.slice(-8).toUpperCase()}
                </span>
              )}
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
      </header>

      <div className="rounded-xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Project Overview</h2>
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
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
              />
            ) : project.nextAction ? (
              <p className="font-medium text-neutral-900">{project.nextAction}</p>
            ) : (
              <span className="inline-block rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                Not set
              </span>
            )}
          </div>
          <div>
            <p className="text-neutral-400">Due Date</p>
            {editing ? (
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))}
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
              />
            ) : (
              <p className="text-neutral-800">
                <DueDate date={project.dueDate} overdue={project.needsAttention.overdue} />
              </p>
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
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
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
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
            />
          ) : (
            <p className="text-sm text-neutral-800">{project.description ?? "—"}</p>
          )}
        </div>

        {/* Financial — server already strips fields the current role can't see */}
        {("estimatedRevenue" in f || "estimatedCost" in f) && (
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Financial Overview</h2>
        )}
        <div className="mb-6 space-y-4">
          {editing && "currency" in f && (
            <div className="flex items-center justify-end gap-2 text-xs">
              <span className="text-neutral-500">Currency</span>
              <select
                value={form.currency}
                onChange={(e) => setForm((s) => ({ ...s, currency: e.target.value }))}
                className="rounded-md border border-neutral-300 px-2 py-0.5 outline-none focus:border-indigo-500"
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
                          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
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
                  className="mt-3 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
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
                          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
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
              {!editing && f.totalCost != null && f.totalExpenses != null && f.totalExpenses > 0 && (
                <div className="mt-3 border-t border-violet-100 pt-3 text-sm">
                  <p className="text-neutral-400">Total Cost (incl. {formatCurrency(f.totalExpenses, f.currency)} expenses)</p>
                  <p className="text-neutral-800">{formatCurrency(f.totalCost, f.currency)}</p>
                </div>
              )}
              {!editing && f.supplierBalance != null && f.supplierBalance > 0 && paymentFor !== "supplier" && (
                <button
                  type="button"
                  onClick={() => setPaymentFor("supplier")}
                  className="mt-3 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
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

          {!editing && project.expenses !== undefined && <ExpensesSection project={project} />}

          {f.marginPercent !== undefined && (
            <div className="text-sm">
              <p className="text-neutral-400">Profit Margin</p>
              <p className={(f.marginPercent ?? 0) < 20 ? "font-medium text-amber-600" : "text-neutral-800"}>
                {formatPercent(f.marginPercent)}
              </p>
              <p className="mt-0.5 text-xs text-neutral-400">Includes recorded expenses.</p>
            </div>
          )}
        </div>

        {editing && (
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={updateProject.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
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
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
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
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Workflow</h2>
        )}
        {!editing && (
          <div className="mb-6 flex items-center rounded-xl border border-neutral-200/70 bg-neutral-50/60 px-4 py-3">
            {WORKFLOW_ORDER.map((stage, i) => (
              <div key={stage} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      i === currentIndex
                        ? "bg-indigo-600 ring-4 ring-indigo-600/20"
                        : i < currentIndex
                          ? "bg-indigo-600"
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
                  <div className={`mx-1 h-px flex-1 ${i < currentIndex ? "bg-indigo-600" : "bg-neutral-200"}`} />
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
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
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

        {/* AI Assistant */}
        {!editing && <AIAssistantPanel projectId={project.id} projectName={project.projectName} />}

        {/* Activity timeline */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Activity Timeline</h2>
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
