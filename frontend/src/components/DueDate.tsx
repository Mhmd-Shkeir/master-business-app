import { formatDate } from "../lib/format";

export function DueDate({ date, overdue }: { date: string | null | undefined; overdue: boolean }) {
  if (!overdue) return <span>{formatDate(date)}</span>;
  return (
    <span className="font-medium text-red-600">
      {formatDate(date)} <span className="text-xs">· Overdue</span>
    </span>
  );
}
