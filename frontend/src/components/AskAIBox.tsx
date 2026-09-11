import { useState, type FormEvent } from "react";
import { useAIQuery } from "../hooks/useAI";
import { SparkleIcon } from "./icons";

function extractError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function AskAIBox({
  title = "Ask AI",
  placeholder = "Ask a question...",
}: {
  title?: string;
  placeholder?: string;
}) {
  const query = useAIQuery();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || query.isPending) return;
    setError(null);
    setAnswer(null);
    try {
      const result = await query.mutateAsync(question);
      setAnswer(result.answer);
    } catch (err) {
      setError(extractError(err, "Couldn't answer that right now."));
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
        <SparkleIcon className="h-3.5 w-3.5" />
        {title}
      </h2>
      <form onSubmit={handleAsk} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={query.isPending || !question.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {query.isPending ? "Asking..." : "Ask"}
        </button>
      </form>
      {answer && (
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-white p-2 text-sm text-neutral-800 shadow-sm">{answer}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
