import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { ErrorState } from "../components/ErrorState";
import { InboxIcon } from "../components/icons";
import { useCustomers, useDeleteCustomer, useUpdateCustomer } from "../hooks/useProjects";
import { useAuth } from "../lib/auth-context";
import type { Customer } from "../lib/types";

function extractError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function CustomersPage() {
  const { user } = useAuth();
  const { data: customers, isLoading, error, refetch } = useCustomers();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const canManage = user?.role === "ADMIN" || user?.role === "SALES";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  function startEditing(c: Customer) {
    setRowError(null);
    setForm({
      name: c.name,
      contactName: c.contactName ?? "",
      contactEmail: c.contactEmail ?? "",
      country: c.country ?? "",
      paymentTerms: c.paymentTerms ?? "",
    });
    setEditingId(c.id);
  }

  async function saveEditing(id: string) {
    try {
      await updateCustomer.mutateAsync({
        id,
        data: {
          name: form.name,
          contactName: form.contactName || null,
          contactEmail: form.contactEmail || null,
          country: form.country || null,
          paymentTerms: form.paymentTerms || null,
        },
      });
      setEditingId(null);
    } catch (err) {
      setRowError({ id, message: extractError(err, "Update failed") });
    }
  }

  async function handleDelete(c: Customer) {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    setRowError(null);
    try {
      await deleteCustomer.mutateAsync(c.id);
    } catch (err) {
      setRowError({ id: c.id, message: extractError(err, "Delete failed") });
    }
  }

  return (
    <div className="animate-fade-in mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-lg font-semibold text-neutral-900">Customers</h1>

      {isLoading && <p className="text-sm text-neutral-400">Loading...</p>}
      {error && <ErrorState message="Failed to load customers." onRetry={() => refetch()} />}

      <div className="overflow-hidden rounded-xl border border-neutral-200/70 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Contact</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Country</th>
              <th className="px-4 py-2.5">Payment Terms</th>
              {canManage && <th className="px-4 py-2.5">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {customers?.length === 0 && !isLoading && (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-4 py-8 text-center text-neutral-400">
                  <div className="flex flex-col items-center gap-2">
                    <InboxIcon className="h-5 w-5 text-neutral-300" />
                    No customers found.
                  </div>
                </td>
              </tr>
            )}
            {customers?.map((c) => {
              const isEditing = editingId === c.id;
              return (
                <tr key={c.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  {isEditing ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          value={form.name}
                          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                          className="w-full rounded border border-neutral-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={form.contactName}
                          onChange={(e) => setForm((s) => ({ ...s, contactName: e.target.value }))}
                          className="w-full rounded border border-neutral-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={form.contactEmail}
                          onChange={(e) => setForm((s) => ({ ...s, contactEmail: e.target.value }))}
                          className="w-full rounded border border-neutral-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={form.country}
                          onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))}
                          className="w-full rounded border border-neutral-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={form.paymentTerms}
                          onChange={(e) => setForm((s) => ({ ...s, paymentTerms: e.target.value }))}
                          className="w-full rounded border border-neutral-300 px-2 py-1"
                        />
                      </td>
                      <td className="space-x-2 px-4 py-2">
                        <button
                          type="button"
                          onClick={() => saveEditing(c.id)}
                          className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2">
                        <Link to={`/customers/${c.id}`} className="flex items-center gap-2 font-medium text-neutral-900 hover:underline">
                          <Avatar name={c.name} />
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-neutral-600">{c.contactName ?? "—"}</td>
                      <td className="px-4 py-2 text-neutral-600">{c.contactEmail ?? "—"}</td>
                      <td className="px-4 py-2 text-neutral-600">{c.country ?? "—"}</td>
                      <td className="px-4 py-2 text-neutral-600">{c.paymentTerms ?? "—"}</td>
                      {canManage && (
                        <td className="space-x-2 px-4 py-2">
                          <button
                            type="button"
                            onClick={() => startEditing(c)}
                            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rowError && <p className="mt-3 text-sm text-red-600">{rowError.message}</p>}
    </div>
  );
}
