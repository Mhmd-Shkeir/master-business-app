import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { AuthUser } from "../lib/types";

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@demo.com" },
  { label: "Sales", email: "sales@demo.com" },
  { label: "Procurement", email: "procurement@demo.com" },
];

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: AuthUser }>("/auth/login", { email, password });
      login(res.data.token, res.data.user);
      navigate("/");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-100 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200/70 bg-white p-8 shadow-lg shadow-neutral-200/50">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-sm font-bold text-white">
            M
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight text-neutral-900">Master Business Management</h1>
            <p className="text-xs text-neutral-400">Sign in to continue</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-neutral-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              placeholder="you@demo.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-600">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 border-t border-neutral-100 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Demo accounts</p>
          <div className="space-y-1">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword("password123");
                }}
                className="block w-full rounded px-2 py-1 text-left text-sm text-neutral-600 hover:bg-neutral-50"
              >
                {acc.label} — {acc.email}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
