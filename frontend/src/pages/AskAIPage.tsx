import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { SendIcon, SparkleIcon, TrashIcon } from "../components/icons";
import { PageHeader } from "../components/PageHeader";
import { useAIQuery, type GroundedProject } from "../hooks/useAI";
import { useAuth } from "../lib/auth-context";

interface Turn {
  question: string;
  answer: string;
  groundedOn: GroundedProject[];
}

function extractError(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

function storageKey(userId: string | undefined): string {
  return `ai-chat-${userId ?? "anon"}`;
}

function readStoredTurns(userId: string | undefined): Turn[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Turn[];
    // Defensive: chats saved before groundedOn became {id, name}[] stored plain strings —
    // drop those entries' grounding rather than crash rendering a Link with no id.
    return parsed.map((t) => ({
      ...t,
      groundedOn: Array.isArray(t.groundedOn) ? t.groundedOn.filter((g): g is GroundedProject => typeof g === "object" && g !== null && "id" in g) : [],
    }));
  } catch {
    return [];
  }
}

const SUGGESTIONS = [
  "What needs my attention today?",
  "Show me all overdue projects",
  "Which projects are closed this month?",
  "List projects with a low margin",
];

export function AskAIPage() {
  const { user } = useAuth();
  const query = useAIQuery();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>(() => readStoredTurns(user?.id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(user?.id), JSON.stringify(turns));
    } catch {
      // localStorage can throw in private-browsing contexts — chat still works, just won't persist
    }
  }, [turns, user?.id]);

  async function ask(q: string) {
    if (!q.trim() || query.isPending) return;
    setError(null);
    setQuestion("");
    try {
      const result = await query.mutateAsync(q);
      setTurns((t) => [...t, { question: q, answer: result.answer, groundedOn: result.groundedOn }]);
    } catch (err) {
      setError(extractError(err, "Something went wrong asking the AI."));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await ask(question);
  }

  function clearChat() {
    if (turns.length > 0 && !window.confirm("Clear this conversation? This can't be undone.")) return;
    setTurns([]);
    setError(null);
  }

  return (
    <div className="animate-fade-in mx-auto flex min-h-[70vh] max-w-3xl flex-col px-8 py-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <SparkleIcon className="h-5 w-5 text-indigo-600" />
            Ask My Business
          </span>
        }
        subtitle="Ask questions about your projects in plain English — grounded in your live data."
        actions={
          turns.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              className="flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Clear Chat
            </button>
          )
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {turns.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6">
            <p className="mb-3 text-sm text-neutral-500">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-indigo-600 px-4 py-2 text-sm text-white">
              {t.question}
            </div>
            <div className="max-w-[85%] rounded-xl rounded-tl-sm border border-neutral-200/70 bg-white px-4 py-3 text-sm text-neutral-800 shadow-sm">
              <p className="whitespace-pre-wrap">{t.answer}</p>
              {t.groundedOn.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-x-1 border-t border-neutral-100 pt-2 text-xs text-neutral-400">
                  <span>Grounded on:</span>
                  {t.groundedOn.map((g, gi) => (
                    <span key={g.id}>
                      <Link to={`/projects/${g.id}`} className="text-indigo-600 hover:underline">
                        {g.name}
                      </Link>
                      {gi < t.groundedOn.length - 1 && ","}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {query.isPending && (
          <div className="max-w-[85%] rounded-xl rounded-tl-sm border border-neutral-200/70 bg-white px-4 py-3 text-sm text-neutral-400 shadow-sm">
            Thinking...
          </div>
        )}
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your projects, customers, or suppliers..."
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
        />
        <button
          type="submit"
          disabled={query.isPending || !question.trim()}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          <SendIcon className="h-4 w-4" />
          Send
        </button>
      </form>
    </div>
  );
}
