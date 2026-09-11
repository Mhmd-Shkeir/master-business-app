import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { ErrorState } from "../components/ErrorState";
import { InboxIcon } from "../components/icons";
import { PageHeader } from "../components/PageHeader";
import { useCreateCustomer, useCustomers, useDeleteCustomer, useProjects, useUpdateCustomer } from "../hooks/useProjects";
import { useAuth } from "../lib/auth-context";
import type { Customer } from "../lib/types";

function extractError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function CustomersPage() {
  const { user } = useAuth();
  const { data: customers, isLoading, error, refetch } = useCustomers();
  const { data: projects } = useProjects();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const canManage = user?.role === "ADMIN" || user?.role === "SALES";

  const [showCreate, setShowCreate] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", contactName: "", contactEmail: "", country: "", paymentTerms: "" });
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const projectCount = (customerId: string) => (projects ?? []).filter((p) => p.customer?.id === customerId).length;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await createCustomer.mutateAsync({
        name: newCustomer.name,
        contactName: newCustomer.contactName || undefined,
        contactEmail: newCustomer.contactEmail || undefined,
        country: newCustomer.country || undefined,
        paymentTerms: newCustomer.paymentTerms || undefined,
      });
      setNewCustomer({ name: "", contactName: "", contactEmail: "", country: "", paymentTerms: "" });
      setShowCreate(false);
    } catch (err) {
      setCreateError(extractError(err, "Failed to create customer"));
    }
  }

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
    <div className="animate-fade-in w-full px-8 py-6">
      <PageHeader
        title="Customers"
        subtitle="Manage customer accounts and relationships"
        actions={
          canManage && (
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              + Add Customer
            </button>
          )
        }
      />

      {error && <ErrorState message="Failed to load customers." onRetry={() => refetch()} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-4 max-w-3xl rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <input
              required
              placeholder="Name"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer((s) => ({ ...s, name: e.target.value }))}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Contact name"
              value={newCustomer.contactName}
              onChange={(e) => setNewCustomer((s) => ({ ...s, contactName: e.target.value }))}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <input
              type="email"
              placeholder="Contact email"
              value={newCustomer.contactEmail}
              onChange={(e) => setNewCustomer((s) => ({ ...s, contactEmail: e.target.value }))}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Country"
              value={newCustomer.country}
              onChange={(e) => setNewCustomer((s) => ({ ...s, country: e.target.value }))}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Payment terms"
              value={newCustomer.paymentTerms}
              onChange={(e) => setNewCustomer((s) => ({ ...s, paymentTerms: e.target.value }))}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={createCustomer.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createCustomer.isPending ? "Creating..." : "Create Customer"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Contact</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Country</th>
              <th className="px-4 py-2.5">Payment Terms</th>
              <th className="px-4 py-2.5 text-right">Projects</th>
              {canManage && <th className="px-4 py-2.5">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {customers?.length === 0 && !isLoading && (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-neutral-400">
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
                      <td className="px-4 py-2 text-right text-neutral-400">{projectCount(c.id)}</td>
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
                      <td className="px-4 py-2 text-right text-neutral-600">{projectCount(c.id)}</td>
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
      </div>
      {rowError && <p className="mt-3 text-sm text-red-600">{rowError.message}</p>}
    </div>
  );
}
