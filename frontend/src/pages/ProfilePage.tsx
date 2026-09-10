import { useState, type FormEvent } from "react";
import { Avatar } from "../components/Avatar";
import { useChangePassword, useUpdateProfile } from "../hooks/useProjects";
import { useAuth } from "../lib/auth-context";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  SALES: "Sales",
  PROCUREMENT: "Procurement",
};

function extractError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function ProfilePage() {
  const { user } = useAuth();
  const changePassword = useChangePassword();
  const updateProfile = useUpdateProfile();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function startEditingName() {
    setNameError(null);
    setName(user?.name ?? "");
    setEditingName(true);
  }

  async function saveName() {
    setNameError(null);
    if (!name.trim()) {
      setNameError("Name can't be empty.");
      return;
    }
    try {
      await updateProfile.mutateAsync({ name: name.trim() });
      setEditingName(false);
    } catch (err) {
      setNameError(extractError(err, "Failed to update name"));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(extractError(err, "Failed to change password"));
    }
  }

  return (
    <div className="animate-fade-in mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-lg font-semibold text-neutral-900">My Profile</h1>

      <div className="mb-6 rounded-xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar name={user?.name ?? "?"} size="lg" />
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1 text-base font-medium outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={saveName}
                  disabled={updateProfile.isPending}
                  className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updateProfile.isPending ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-medium text-neutral-900">{user?.name}</p>
                <button
                  type="button"
                  onClick={startEditingName}
                  className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Edit
                </button>
              </div>
            )}
            {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
            <p className="text-sm text-neutral-500">{user?.email}</p>
            <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
              {ROLE_LABEL[user?.role ?? ""]}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">Change Password</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-neutral-600">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-600">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-600">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Password changed successfully.</p>}
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {changePassword.isPending ? "Saving..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
