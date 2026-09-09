import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { CustomersIcon, DashboardIcon, PaymentsIcon, ProjectsIcon, ShieldIcon, SuppliersIcon } from "./icons";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  SALES: "Sales",
  PROCUREMENT: "Procurement",
};

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-violet-50 text-violet-700",
  SALES: "bg-blue-50 text-blue-700",
  PROCUREMENT: "bg-amber-50 text-amber-700",
};

function NavLink({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  const location = useLocation();
  const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
      }`}
    >
      <span className={active ? "text-neutral-700" : "text-neutral-400"}>{icon}</span>
      {children}
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const iconClass = "h-4 w-4";

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/85 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link to="/" className="flex shrink-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-950 text-sm font-bold text-white shadow-sm">
                M
              </span>
              <span className="hidden whitespace-nowrap text-sm font-semibold tracking-tight text-neutral-900 lg:inline">
                Master Business Management
              </span>
            </Link>
            <span className="hidden h-6 w-px shrink-0 bg-neutral-200 lg:inline-block" />
            <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-1">
              <NavLink to="/" icon={<DashboardIcon className={iconClass} />}>
                Dashboard
              </NavLink>
              <NavLink to="/projects" icon={<ProjectsIcon className={iconClass} />}>
                Projects
              </NavLink>
              {(user?.role === "ADMIN" || user?.role === "SALES") && (
                <NavLink to="/customers" icon={<CustomersIcon className={iconClass} />}>
                  Customers
                </NavLink>
              )}
              {(user?.role === "ADMIN" || user?.role === "PROCUREMENT") && (
                <NavLink to="/suppliers" icon={<SuppliersIcon className={iconClass} />}>
                  Suppliers
                </NavLink>
              )}
              <NavLink to="/payments" icon={<PaymentsIcon className={iconClass} />}>
                Payments
              </NavLink>
              {user?.role === "ADMIN" && (
                <NavLink to="/users" icon={<ShieldIcon className={iconClass} />}>
                  Users
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              to="/profile"
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              <span className="hidden sm:inline">{user?.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE[user?.role ?? ""] ?? "bg-neutral-100 text-neutral-700"}`}
              >
                {ROLE_LABEL[user?.role ?? ""]}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-4 text-xs text-neutral-400 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Master Business Management. Internal operations platform.</p>
          <p className="flex items-center gap-1.5">
            Signed in as <span className="font-medium text-neutral-600">{user?.name}</span>
            <span aria-hidden className="text-neutral-300">
              ·
            </span>
            {ROLE_LABEL[user?.role ?? ""]}
          </p>
        </div>
      </footer>
    </div>
  );
}
