import { useState, type FormEvent } from "react";
import { Avatar } from "../components/Avatar";
import { ErrorState } from "../components/ErrorState";
import { InboxIcon, ShieldIcon } from "../components/icons";
import { PageHeader } from "../components/PageHeader";
import { useCreateUser, useUsers } from "../hooks/useUsers";
import type { Role } from "../lib/types";
import { formatDate } from "../lib/format";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  SALES: "Sales",
  PROCUREMENT: "Procurement",
};

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-indigo-100 text-indigo-700",
  SALES: "bg-blue-100 text-blue-700",
  PROCUREMENT: "bg-violet-100 text-violet-700",
};

function extractError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function UsersPage() {
  const { data: users, isLoading, error, refetch } = useUsers();
  const createUser = useCreateUser();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("SALES");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await createUser.mutateAsync({ name, email, password, role });
      setName("");
      setEmail("");
      setPassword("");
      setRole("SALES");
    } catch (err) {
      setFormError(extractError(err, "Failed to create user"));
    }
  }

  const roleCounts = {
    ADMIN: (users ?? []).filter((u) => u.role === "ADMIN").length,
    SALES: (users ?? []).filter((u) => u.role === "SALES").length,
    PROCUREMENT: (users ?? []).filter((u) => u.role === "PROCUREMENT").length,
  };

  return (
    <div className="animate-fade-in w-full px-8 py-6">
      <PageHeader title="Users" subtitle="Manage internal team accounts and roles" />

      {error && <ErrorState message="Failed to load users." onRetry={() => refetch()} />}

      {!isLoading && (users?.length ?? 0) > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-4 sm:max-w-lg">
          {(["ADMIN", "SALES", "PROCUREMENT"] as const).map((r) => (
            <div key={r} className="rounded-xl border border-neutral-200/70 bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-start justify-between">
                <p className="text-xs font-medium text-neutral-500">{ROLE_LABEL[r]}</p>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                  <ShieldIcon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="text-xl font-semibold text-neutral-900">{roleCounts[r]}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 overflow-hidden rounded-xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Created</th>
            </tr>
          </thead>
          <tbody>
            {users?.length === 0 && !isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                  <div className="flex flex-col items-center gap-2">
                    <InboxIcon className="h-5 w-5 text-neutral-300" />
                    No users found.
                  </div>
                </td>
              </tr>
            )}
            {users?.map((u) => (
              <tr key={u.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 font-medium text-neutral-900">
                    <Avatar name={u.name} />
                    {u.name}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{u.email}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_BADGE[u.role]}`}>
                    {ROLE_LABEL[u.role]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <div className="max-w-2xl rounded-xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">Add User</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-neutral-600">Full Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-600">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-neutral-600">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-600">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                <option value="ADMIN">Admin</option>
                <option value="SALES">Sales</option>
                <option value="PROCUREMENT">Procurement</option>
              </select>
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={createUser.isPending}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {createUser.isPending ? "Creating..." : "Create User"}
          </button>
        </form>
      </div>
    </div>
  );
}
