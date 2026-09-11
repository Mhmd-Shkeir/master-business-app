import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { ErrorState } from "../components/ErrorState";
import { InboxIcon } from "../components/icons";
import { PageHeader } from "../components/PageHeader";
import { useCreateSupplier, useDeleteSupplier, useProjects, useSuppliers, useUpdateSupplier } from "../hooks/useProjects";
import { useAuth } from "../lib/auth-context";
import type { Supplier } from "../lib/types";

function extractError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function SuppliersPage() {
  const { user } = useAuth();
  const { data: suppliers, isLoading, error, refetch } = useSuppliers();
  const { data: projects } = useProjects();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();
  const canManage = user?.role === "ADMIN" || user?.role === "PROCUREMENT";

  const [showCreate, setShowCreate] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", contactName: "", contactEmail: "", country: "", paymentTerms: "" });
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const projectCount = (supplierId: string) => (projects ?? []).filter((p) => p.supplier?.id === supplierId).length;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await createSupplier.mutateAsync({
        name: newSupplier.name,
        contactName: newSupplier.contactName || undefined,
        contactEmail: newSupplier.contactEmail || undefined,
        country: newSupplier.country || undefined,
        paymentTerms: newSupplier.paymentTerms || undefined,
      });
      setNewSupplier({ name: "", contactName: "", contactEmail: "", country: "", paymentTerms: "" });
      setShowCreate(false);
    } catch (err) {
      setCreateError(extractError(err, "Failed to create supplier"));
    }
  }

  function startEditing(s: Supplier) {
    setRowError(null);
    setForm({
      name: s.name,
      contactName: s.contactName ?? "",
      contactEmail: s.contactEmail ?? "",
      country: s.country ?? "",
      paymentTerms: s.paymentTerms ?? "",
    });
    setEditingId(s.id);
  }

  async function saveEditing(id: string) {
    try {
      await updateSupplier.mutateAsync({
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

  async function handleDelete(s: Supplier) {
    if (!window.confirm(`Delete ${s.name}? This cannot be undone.`)) return;
    setRowError(null);
    try {
      await deleteSupplier.mutateAsync(s.id);
    } catch (err) {
      setRowError({ id: s.id, message: extractError(err, "Delete failed") });
    }
  }

  return (
    <div className="animate-fade-in w-full px-8 py-6">
      <PageHeader
        title="Suppliers"
        subtitle="Manage supplier accounts and sourcing relationships"
        actions={
          canManage && (
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              + Add Supplier
            </button>
          )
        }
      />

      {error && <ErrorState message="Failed to load suppliers." onRetry={() => refetch()} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-4 max-w-3xl rounded-xl border border-neutral-200/70 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <input
              required
              placeholder="Name"
              value={newSupplier.name}
              onChange={(e) => setNewSupplier((s) => ({ ...s, name: e.target.value }))}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Contact name"
              value={newSupplier.contactName}
              onChange={(e) => setNewSupplier((s) => ({ ...s, contactName: e.target.value }))}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <input
              type="email"
              placeholder="Contact email"
              value={newSupplier.contactEmail}
              onChange={(e) => setNewSupplier((s) => ({ ...s, contactEmail: e.target.value }))}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Country"
              value={newSupplier.country}
              onChange={(e) => setNewSupplier((s) => ({ ...s, country: e.target.value }))}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Payment terms"
              value={newSupplier.paymentTerms}
              onChange={(e) => setNewSupplier((s) => ({ ...s, paymentTerms: e.target.value }))}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={createSupplier.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createSupplier.isPending ? "Creating..." : "Create Supplier"}
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
        <table className="w-full text-sm">
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
            {suppliers?.length === 0 && !isLoading && (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-neutral-400">
                  <div className="flex flex-col items-center gap-2">
                    <InboxIcon className="h-5 w-5 text-neutral-300" />
                    No suppliers found.
                  </div>
                </td>
              </tr>
            )}
            {suppliers?.map((s) => {
              const isEditing = editingId === s.id;
              return (
                <tr key={s.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  {isEditing ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          value={form.name}
                          onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
                          className="w-full rounded border border-neutral-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={form.contactName}
                          onChange={(e) => setForm((v) => ({ ...v, contactName: e.target.value }))}
                          className="w-full rounded border border-neutral-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={form.contactEmail}
                          onChange={(e) => setForm((v) => ({ ...v, contactEmail: e.target.value }))}
                          className="w-full rounded border border-neutral-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={form.country}
                          onChange={(e) => setForm((v) => ({ ...v, country: e.target.value }))}
                          className="w-full rounded border border-neutral-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={form.paymentTerms}
                          onChange={(e) => setForm((v) => ({ ...v, paymentTerms: e.target.value }))}
                          className="w-full rounded border border-neutral-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-neutral-400">{projectCount(s.id)}</td>
                      <td className="space-x-2 px-4 py-2">
                        <button
                          type="button"
                          onClick={() => saveEditing(s.id)}
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
                        <Link to={`/suppliers/${s.id}`} className="flex items-center gap-2 font-medium text-neutral-900 hover:underline">
                          <Avatar name={s.name} />
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-neutral-600">{s.contactName ?? "—"}</td>
                      <td className="px-4 py-2 text-neutral-600">{s.contactEmail ?? "—"}</td>
                      <td className="px-4 py-2 text-neutral-600">{s.country ?? "—"}</td>
                      <td className="px-4 py-2 text-neutral-600">{s.paymentTerms ?? "—"}</td>
                      <td className="px-4 py-2 text-right text-neutral-600">{projectCount(s.id)}</td>
                      {canManage && (
                        <td className="space-x-2 px-4 py-2">
                          <button
                            type="button"
                            onClick={() => startEditing(s)}
                            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s)}
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
