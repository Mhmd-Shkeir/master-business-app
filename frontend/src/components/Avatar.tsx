const PALETTE = [
  "bg-emerald-600",
  "bg-violet-600",
  "bg-blue-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-teal-600",
  "bg-indigo-600",
  "bg-cyan-600",
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-12 w-12 text-lg" : size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg font-semibold text-white ${colorFor(name)} ${dims}`}
    >
      {initials(name)}
    </span>
  );
}
