import { useState } from "react";
import { useRecordPayment } from "../hooks/useProjects";
import { formatCurrency } from "../lib/format";
import type { ProjectSummary } from "../lib/types";

function extractError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function RecordPaymentForm({
  project,
  side,
  onDone,
}: {
  project: ProjectSummary;
  side: "customer" | "supplier";
  onDone: () => void;
}) {
  const recordPayment = useRecordPayment(project.id);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const balance = side === "customer" ? project.financial?.customerBalance : project.financial?.supplierBalance;
  const currency = project.financial?.currency ?? "USD";
  const numericAmount = Number(amount);
  const isValid = amount !== "" && numericAmount > 0 && (balance == null || numericAmount <= balance);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await recordPayment.mutateAsync({ side, amount: numericAmount, note: note || undefined });
      onDone();
    } catch (err) {
      setError(extractError(err, "Failed to record payment"));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs text-neutral-500">
        Outstanding balance: <span className="font-medium">{formatCurrency(balance, currency)}</span>
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-500">{currency}</span>
        <input
          type="number"
          min="0"
          max={balance ?? undefined}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
        />
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reference / note (optional)"
        className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!isValid || recordPayment.isPending}
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {recordPayment.isPending ? "Recording..." : "Record Payment"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
