import { useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../hooks/useProjects";
import { formatDate } from "../lib/format";
import { BellIcon } from "./icons";

export function NotificationBell({
  onNavigate,
  buttonClassName = "text-neutral-400 hover:bg-white/5 hover:text-white",
}: {
  onNavigate?: () => void;
  buttonClassName?: string;
}) {
  // "Overdue" is purely a function of the clock, not of any mutation — a project can silently
  // cross into overdue with zero user action, which none of React Query's default refetch
  // triggers (mount, window focus, cache invalidation) would ever catch. A light poll is the
  // simplest fix that doesn't need a WebSocket or background worker.
  const { data: projects } = useProjects({ refetchInterval: 60_000 });
  const [open, setOpen] = useState(false);

  const overdue = (projects ?? []).filter((p) => p.needsAttention.overdue);

  function handleSelect() {
    setOpen(false);
    onNavigate?.();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Overdue notifications"
        className={`relative rounded-md p-1.5 ${buttonClassName}`}
      >
        <BellIcon className="h-5 w-5" />
        {!open && overdue.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {overdue.length > 9 ? "9+" : overdue.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-neutral-200 bg-white shadow-lg">
            <div className="border-b border-neutral-100 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Overdue Projects {overdue.length > 0 && `(${overdue.length})`}
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {overdue.length === 0 ? (
                <p className="px-3 py-3 text-sm text-neutral-400">Nothing overdue. You're all caught up.</p>
              ) : (
                overdue.map((p) => (
                  <Link
                    key={p.id}
                    to={`/projects/${p.id}`}
                    onClick={handleSelect}
                    className="block px-3 py-2 hover:bg-neutral-50"
                  >
                    <p className="truncate text-sm font-medium text-neutral-900">{p.projectName}</p>
                    <p className="text-xs text-red-600">Due {formatDate(p.dueDate)} · Overdue</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
