import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { DueDate } from "../components/DueDate";
import { ErrorState } from "../components/ErrorState";
import { StatusBadge } from "../components/StatusBadge";
import { useCustomer, useProjects, useUpdateCustomer } from "../hooks/useProjects";
import { groupByCurrency } from "../lib/aggregate";
import { formatCurrency } from "../lib/format";

function extractError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const { data: customer, isLoading, error, refetch } = useCustomer(id);
  const { data: projects } = useProjects();
  const updateCustomer = useUpdateCustomer();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  if (isLoading) return <div className="p-6 text-sm text-neutral-400">Loading...</div>;
  if (error) return <ErrorState message="Failed to load customer." onRetry={() => refetch()} />;
  if (!customer) return <div className="p-6 text-sm text-red-600">Customer not found.</div>;

  const relatedProjects = (projects ?? []).filter((p) => p.customer?.id === id);
  const revenueByCurrency = groupByCurrency(relatedProjects, "actualRevenue");
  const balanceByCurrency = groupByCurrency(relatedProjects, "customerBalance");

  function startEditing() {
    setSaveError(null);
    setForm({
      name: customer!.name,
      contactName: customer!.contactName ?? "",
      contactEmail: customer!.contactEmail ?? "",
      country: customer!.country ?? "",
      paymentTerms: customer!.paymentTerms ?? "",
    });
    setEditing(true);
  }

  async function handleSave() {
    setSaveError(null);
    try {
      await updateCustomer.mutateAsync({
        id: id!,
        data: {
          name: form.name,
          contactName: form.contactName || null,
          contactEmail: form.contactEmail || null,
          country: form.country || null,
          paymentTerms: form.paymentTerms || null,
        },
      });
      setEditing(false);
    } catch (err) {
      setSaveError(extractError(err, "Update failed"));
    }
  }

  return (
    <div className="animate-fade-in mx-auto max-w-4xl px-8 py-6">
      <Link to="/customers" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        &larr; Back to customers
      </Link>

      <header className="mb-6 rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {!editing && <Avatar name={customer.name} size="md" />}
            <div>
              {editing ? (
                <input
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1 text-lg font-semibold outline-none focus:border-indigo-500"
                />
              ) : (
                <h1 className="text-lg font-semibold text-neutral-900">{customer.name}</h1>
              )}
              {!editing && <p className="text-sm text-neutral-400">{customer.contactName ?? "No contact on file"}</p>}
            </div>
          </div>
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
      </header>

      <div className="rounded-xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          {(["contactName", "contactEmail", "country", "paymentTerms"] as const).map((key) => (
            <div key={key}>
              <p className="text-neutral-400">
                {key === "contactName" ? "Contact" : key === "contactEmail" ? "Email" : key === "country" ? "Country" : "Payment Terms"}
              </p>
              {editing ? (
                <input
                  value={form[key]}
                  onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
                />
              ) : (
                <p className="text-neutral-800">{customer[key] ?? "—"}</p>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={updateCustomer.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {updateCustomer.isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        )}
        {saveError && <p className="mb-4 text-sm text-red-600">{saveError}</p>}

        <div className="mb-6 grid grid-cols-3 gap-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-sm">
          <div>
            <p className="text-neutral-400">Projects</p>
            <p className="text-xl font-semibold">{relatedProjects.length}</p>
          </div>
          <div>
            <p className="text-neutral-400">Revenue</p>
            {[...revenueByCurrency.entries()].map(([c, v]) => (
              <p key={c} className="font-medium text-neutral-800">
                {formatCurrency(v, c)}
              </p>
            ))}
            {revenueByCurrency.size === 0 && <p className="text-neutral-800">—</p>}
          </div>
          <div>
            <p className="text-neutral-400">Outstanding Balance</p>
            {[...balanceByCurrency.entries()].map(([c, v]) => (
              <p key={c} className={`font-medium ${v > 0 ? "text-red-600" : "text-neutral-800"}`}>
                {formatCurrency(v, c)}
              </p>
            ))}
            {balanceByCurrency.size === 0 && <p className="text-neutral-800">—</p>}
          </div>
        </div>

        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Projects</h2>
        <div className="space-y-2">
          {relatedProjects.length === 0 && <p className="text-sm text-neutral-400">No projects yet.</p>}
          {relatedProjects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="font-medium text-neutral-900">{p.projectName}</span>
              <span className="flex items-center gap-2 text-neutral-500">
                <StatusBadge status={p.status} />
                <DueDate date={p.dueDate} overdue={p.needsAttention.overdue} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
