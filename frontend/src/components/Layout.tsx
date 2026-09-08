import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  SALES: "Sales",
  PROCUREMENT: "Procurement",
};

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <Link to="/" className="text-sm font-semibold text-neutral-900">
          Master Business Management
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-500">
            {user?.name} <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium">{ROLE_LABEL[user?.role ?? ""]}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            Log out
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
