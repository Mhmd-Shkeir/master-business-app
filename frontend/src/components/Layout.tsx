import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { Avatar } from "./Avatar";
import {
  CloseIcon,
  CustomersIcon,
  DashboardIcon,
  LogoutIcon,
  MenuIcon,
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
  onNavigate,
  children,
}: {
  to: string;
  icon: ReactNode;
  collapsed: boolean;
  onNavigate: () => void;
  children: string;
}) {
  const location = useLocation();
  const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      onClick={onNavigate}
      title={collapsed ? children : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-indigo-600 text-white shadow-sm shadow-indigo-900/30" : "text-neutral-400 hover:bg-white/5 hover:text-white"
      } ${collapsed ? "md:justify-center" : ""}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className={`whitespace-nowrap ${collapsed ? "md:hidden" : ""}`}>{children}</span>
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const iconClass = "h-5 w-5";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 transition-transform duration-200 md:relative md:translate-x-0 md:transition-[width] md:duration-150 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-[68px]" : "md:w-64"}`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <Link to="/" onClick={closeMobile} className="flex items-center gap-2.5 overflow-hidden">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-bold text-white shadow-sm">
              M
            </span>
            <span className={`whitespace-nowrap leading-tight ${collapsed ? "md:hidden" : ""}`}>
              <span className="block text-sm font-semibold text-white">Master Business</span>
              <span className="block text-xs text-neutral-500">Management</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className={`hidden shrink-0 rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-white md:block ${
              collapsed ? "md:hidden" : ""
            }`}
          >
            «
          </button>
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Close menu"
            className="shrink-0 rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-white md:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="mx-auto mb-1 hidden rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-white md:block"
          >
            »
          </button>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <p className={`mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 ${collapsed ? "md:hidden" : ""}`}>
            Operations
          </p>
          <nav className="space-y-0.5">
            <NavLink to="/" icon={<DashboardIcon className={iconClass} />} collapsed={collapsed} onNavigate={closeMobile}>
              Dashboard
            </NavLink>
            <NavLink to="/projects" icon={<ProjectsIcon className={iconClass} />} collapsed={collapsed} onNavigate={closeMobile}>
              Projects
            </NavLink>
            {(user?.role === "ADMIN" || user?.role === "SALES") && (
              <NavLink to="/customers" icon={<CustomersIcon className={iconClass} />} collapsed={collapsed} onNavigate={closeMobile}>
                Customers
              </NavLink>
            )}
            {(user?.role === "ADMIN" || user?.role === "PROCUREMENT") && (
              <NavLink to="/suppliers" icon={<SuppliersIcon className={iconClass} />} collapsed={collapsed} onNavigate={closeMobile}>
                Suppliers
              </NavLink>
            )}
            <NavLink to="/payments" icon={<PaymentsIcon className={iconClass} />} collapsed={collapsed} onNavigate={closeMobile}>
              Payments
            </NavLink>
            <NavLink to="/ai" icon={<SparkleIcon className={iconClass} />} collapsed={collapsed} onNavigate={closeMobile}>
              Ask AI
            </NavLink>
            {user?.role === "ADMIN" && (
              <NavLink to="/users" icon={<ShieldIcon className={iconClass} />} collapsed={collapsed} onNavigate={closeMobile}>
                Users
              </NavLink>
            )}
          </nav>
        </div>

        <div className="shrink-0 border-t border-neutral-800 p-3">
          <NavLink to="/profile" icon={<SettingsIcon className={iconClass} />} collapsed={collapsed} onNavigate={closeMobile}>
            Settings
          </NavLink>

          <div className={`mt-2 flex items-center gap-2.5 p-2 ${collapsed ? "md:justify-center" : ""}`}>
            <Avatar name={user?.name ?? "?"} size="sm" />
            <span className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
              <span className="block truncate text-sm font-medium text-white">{user?.name}</span>
              <span className="block text-xs text-neutral-500">{ROLE_LABEL[user?.role ?? ""]}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className={`mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-500 hover:bg-white/5 hover:text-white ${
              collapsed ? "md:justify-center" : ""
            }`}
          >
            <LogoutIcon className="h-3.5 w-3.5 shrink-0" />
            <span className={collapsed ? "md:hidden" : ""}>Log out</span>
          </button>
        </div>
      </aside>

      <div className="flex h-screen min-w-0 flex-1 scroll-smooth flex-col overflow-y-auto">
        <div className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-bold text-white">
              M
            </span>
            <span className="text-sm font-semibold text-neutral-900">Master Business</span>
          </span>
        </div>

        <main className="min-w-0 flex-1">{children}</main>
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
