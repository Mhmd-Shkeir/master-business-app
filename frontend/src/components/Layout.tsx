import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { Avatar } from "./Avatar";
import {
  CustomersIcon,
  DashboardIcon,
  LogoutIcon,
  PaymentsIcon,
  ProjectsIcon,
  SettingsIcon,
  ShieldIcon,
  SparkleIcon,
  SuppliersIcon,
} from "./icons";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  SALES: "Sales",
  PROCUREMENT: "Procurement",
};

function NavLink({
  to,
  icon,
  collapsed,
  children,
}: {
  to: string;
  icon: ReactNode;
  collapsed: boolean;
  children: string;
}) {
  const location = useLocation();
  const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      title={collapsed ? children : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-indigo-600 text-white shadow-sm shadow-indigo-900/30" : "text-neutral-400 hover:bg-white/5 hover:text-white"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="whitespace-nowrap">{children}</span>}
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const iconClass = "h-5 w-5";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <aside
        className={`flex h-screen shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 transition-[width] duration-150 ${
          collapsed ? "w-[68px]" : "w-64"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-bold text-white shadow-sm">
              M
            </span>
            {!collapsed && (
              <span className="whitespace-nowrap leading-tight">
                <span className="block text-sm font-semibold text-white">Master Business</span>
                <span className="block text-xs text-neutral-500">Management</span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="shrink-0 rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-white"
            >
              «
            </button>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="mx-auto mb-1 rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-white"
          >
            »
          </button>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {!collapsed && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
              Operations
            </p>
          )}
          <nav className="space-y-0.5">
            <NavLink to="/" icon={<DashboardIcon className={iconClass} />} collapsed={collapsed}>
              Dashboard
            </NavLink>
            <NavLink to="/projects" icon={<ProjectsIcon className={iconClass} />} collapsed={collapsed}>
              Projects
            </NavLink>
            {(user?.role === "ADMIN" || user?.role === "SALES") && (
              <NavLink to="/customers" icon={<CustomersIcon className={iconClass} />} collapsed={collapsed}>
                Customers
              </NavLink>
            )}
            {(user?.role === "ADMIN" || user?.role === "PROCUREMENT") && (
              <NavLink to="/suppliers" icon={<SuppliersIcon className={iconClass} />} collapsed={collapsed}>
                Suppliers
              </NavLink>
            )}
            <NavLink to="/payments" icon={<PaymentsIcon className={iconClass} />} collapsed={collapsed}>
              Payments
            </NavLink>
            <NavLink to="/ai" icon={<SparkleIcon className={iconClass} />} collapsed={collapsed}>
              Ask AI
            </NavLink>
            {user?.role === "ADMIN" && (
              <NavLink to="/users" icon={<ShieldIcon className={iconClass} />} collapsed={collapsed}>
                Users
              </NavLink>
            )}
          </nav>
        </div>

        <div className="shrink-0 border-t border-neutral-800 p-3">
          <NavLink to="/profile" icon={<SettingsIcon className={iconClass} />} collapsed={collapsed}>
            Settings
          </NavLink>

          <div className={`mt-2 flex items-center gap-2.5 p-2 ${collapsed ? "justify-center" : ""}`}>
            <Avatar name={user?.name ?? "?"} size="sm" />
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-white">{user?.name}</span>
                <span className="block text-xs text-neutral-500">{ROLE_LABEL[user?.role ?? ""]}</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className={`mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-500 hover:bg-white/5 hover:text-white ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogoutIcon className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && "Log out"}
          </button>
        </div>
      </aside>

      <div className="flex h-screen min-w-0 flex-1 scroll-smooth flex-col overflow-y-auto">
        <main className="flex-1">{children}</main>
        <footer className="border-t border-neutral-200 bg-white">
          <div className="flex flex-col items-center justify-between gap-2 px-6 py-4 text-xs text-neutral-400 sm:flex-row">
            <p className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span>&copy; {new Date().getFullYear()} Master Business Management</span>
              <span className="text-neutral-300">·</span>
              <span>Version 1.0</span>
              <span className="text-neutral-300">·</span>
              <span>Internal Business Platform</span>
            </p>
            <p className="flex items-center gap-2 text-neutral-400">
              <span>Help &amp; Support</span>
              <span className="text-neutral-300">·</span>
              <span>Privacy</span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
