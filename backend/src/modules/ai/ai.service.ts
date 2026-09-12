import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { aiConfigured, env } from "../../lib/env";
import { prisma } from "../../lib/prisma";
import {
  canSeeCost,
  canSeeRevenue,
  computeFinancials,
  filterFinancialsForRole,
  groupByCurrency,
  needsAttention,
  sanitizeActivitiesForRole,
  sumExpenses,
} from "../../lib/rbac";
import type { AuthUser } from "../../middleware/auth";
import { AppError } from "../projects/projects.service";

function getClient(): OpenAI {
  if (!aiConfigured) {
    throw new AppError("AI is not configured — set AI_BASE_URL, AI_MODEL_ID, and AI_API_KEY", 503);
  }
  return new OpenAI({ baseURL: env.AI_BASE_URL, apiKey: env.AI_API_KEY });
}

// The system prompt asks the model not to use markdown, but that's a style
// instruction the model doesn't always follow — the UI has no markdown
// renderer, so any that slips through would show up as literal ** and #
// characters. Stripped here as a reliable second layer, not the only one.
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

const PROJECT_INCLUDE = { financial: true, customer: true, supplier: true, owner: true, expenses: true } as const;

function roleContextLine(role: AuthUser["role"]): string {
  if (role === "ADMIN") return "This user is an Admin and can see all financial data: revenue, cost, and profit margin.";
  if (role === "SALES") {
    return "This user is Sales and can only see customer/revenue data (estimated/actual revenue, customer payments, customer balance). They cannot see supplier cost, supplier payments, or profit margin — those fields are absent from the data you are given, not hidden from you.";
  }
  return "This user is Procurement and can only see supplier/cost data (estimated/actual cost, supplier payments, supplier balance). They cannot see customer revenue, customer payments, or profit margin — those fields are absent from the data you are given, not hidden from you.";
}

const CURRENCY_RULE =
  "This application performs NO currency conversion. USD, EUR, and LBP amounts must never be summed or combined into one number. Whenever monetary data spans more than one currency, present each currency's total separately (e.g. \"$12,000 and €3,500\"), never as one combined figure. If the user asks for a single combined total across currencies, explain that FX conversion is not available in this system and give the separate per-currency totals instead.";

const ACCESS_RULE =
  "Only use information present in the data/tool results you are given — never invent numbers, dates, names, or projects. If the user asks about information outside their role's access (e.g. a Sales user asking about supplier cost or profit margin, or a Procurement user asking about customer revenue or profit margin), clearly and politely state that this information is not available to their role. Do not guess, estimate, or attempt to derive it from other figures.";

function baseSystemPrompt(user: AuthUser & { name: string }): string {
  return [
    `You are "Ask My Business", an internal assistant for Master Business Management, an operations tool that tracks customer projects through RFQ -> Quoted -> Ordered -> Shipping -> Closed.`,
    `The current user is ${user.name} (role: ${user.role}). ${roleContextLine(user.role)}`,
    CURRENCY_RULE,
    ACCESS_RULE,
    "Be concise and business-like. Use short bullet points (using a leading dash \"-\", not \"*\") when listing multiple projects. Respond in PLAIN TEXT only — no markdown formatting (no **bold**, no # headings, no _italics_). The interface that displays your answer does not render markdown, so any markdown characters would show up literally to the user.",
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// Daily Brief — deterministic data fetch, no tool-calling needed.
// ---------------------------------------------------------------------------

export async function buildDailyBrief(user: AuthUser & { name: string }) {
  const projects = await prisma.project.findMany({ include: PROJECT_INCLUDE, orderBy: { dueDate: "asc" } });

  const flagged = projects
    .map((p) => {
      const financials = computeFinancials(p.financial, sumExpenses(p.expenses));
      const attention = needsAttention(p, financials, user.role);
      if (!attention.any) return null;
      return {
        projectName: p.projectName,
        status: p.status,
        customer: p.customer.name,
        supplier: p.supplier?.name ?? null,
        dueDate: p.dueDate,
        nextAction: p.nextAction,
        financial: filterFinancialsForRole(financials, user.role),
        flags: attention,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .slice(0, 15);

  if (flagged.length === 0) {
    return { brief: "Nothing needs attention today — all projects are on track.", generatedAt: new Date().toISOString() };
  }

  const client = getClient();
  const response = await client.chat.completions.create({
    model: env.AI_MODEL_ID!,
    messages: [
      {
        role: "system",
        content: [
          baseSystemPrompt(user),
          "Write a short Daily Brief (3-6 sentences, or a short bullet list) summarizing what needs attention today from the JSON list of flagged projects below. Reference specific project names and reasons (overdue, low margin, missing next action, payment hold). Only use figures present in the data.",
        ].join("\n\n"),
      },
      { role: "user", content: JSON.stringify(flagged) },
    ],
  });

  const brief = stripMarkdown(response.choices[0]?.message?.content?.trim() || "Unable to generate a brief right now.");
  return { brief, generatedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Natural language queries — constrained tool-calling.
// ---------------------------------------------------------------------------

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "List projects, optionally filtered. Returns role-filtered financial data, each project's needsAttention flags, and currency-grouped subtotals — never a cross-currency combined total. A single call with no filters already returns every project with its attention flags; prefer that over calling this once per status.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["RFQ", "QUOTED", "ORDERED", "SHIPPING", "CLOSED"] },
          customerName: { type: "string", description: "Partial customer name match" },
          supplierName: { type: "string", description: "Partial supplier name match" },
          overdueOnly: { type: "boolean" },
          lowMarginOnly: { type: "boolean", description: "Margin below 20% (Admin only — has no effect for other roles since margin isn't visible to them)" },
          limit: { type: "number", description: "Max results, default 20, max 50" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_detail",
      description: "Get full detail for one project by name (partial match) or id, including recent activity (already filtered to the caller's role).",
      parameters: {
        type: "object",
        properties: {
          projectName: { type: "string" },
          projectId: { type: "string" },
        },
      },
    },
  },
];

interface ToolProject {
  id: string;
  projectName: string;
  status: string;
  customer: string;
  supplier: string | null;
  owner: string | null;
  dueDate: Date | null;
  nextAction: string | null;
  financial: ReturnType<typeof filterFinancialsForRole>;
  needsAttention: ReturnType<typeof needsAttention>;
}

async function toolListProjects(args: Record<string, unknown>, user: AuthUser) {
  const limit = Math.min(Number(args.limit) || 20, 50);
  const projects = await prisma.project.findMany({
    where: {
      ...(args.status ? { status: args.status as never } : {}),
      ...(args.customerName ? { customer: { name: { contains: String(args.customerName), mode: "insensitive" } } } : {}),
      ...(args.supplierName ? { supplier: { name: { contains: String(args.supplierName), mode: "insensitive" } } } : {}),
    },
    include: PROJECT_INCLUDE,
    orderBy: { lastUpdate: "desc" },
    take: 100,
  });

  let mapped: { p: (typeof projects)[number]; financials: ReturnType<typeof computeFinancials>; attention: ReturnType<typeof needsAttention> }[] =
    projects.map((p) => {
      const financials = computeFinancials(p.financial, sumExpenses(p.expenses));
      return { p, financials, attention: needsAttention(p, financials, user.role) };
    });

  if (args.overdueOnly) mapped = mapped.filter((m) => m.attention.overdue);
  if (args.lowMarginOnly) mapped = mapped.filter((m) => m.attention.lowMargin);

  mapped = mapped.slice(0, limit);

  const result: ToolProject[] = mapped.map(({ p, financials, attention }) => ({
    id: p.id,
    projectName: p.projectName,
    status: p.status,
    customer: p.customer.name,
    supplier: p.supplier?.name ?? null,
    owner: p.owner?.name ?? null,
    dueDate: p.dueDate,
    nextAction: p.nextAction,
    financial: filterFinancialsForRole(financials, user.role),
    needsAttention: attention,
  }));

  const currencyOf = (m: (typeof mapped)[number]) => m.financials?.currency as string | undefined;

  const subtotalsByCurrency: Record<string, Record<string, number>> = {};
  if (canSeeRevenue(user.role)) {
    subtotalsByCurrency.customerBalance = groupByCurrency(mapped, (m) => m.financials?.customerBalance, currencyOf);
    subtotalsByCurrency.revenue = groupByCurrency(mapped, (m) => m.financials?.actualRevenue || m.financials?.estimatedRevenue, currencyOf);
  }
  if (canSeeCost(user.role)) {
    subtotalsByCurrency.supplierBalance = groupByCurrency(mapped, (m) => m.financials?.supplierBalance, currencyOf);
    subtotalsByCurrency.cost = groupByCurrency(mapped, (m) => m.financials?.actualCost || m.financials?.estimatedCost, currencyOf);
  }

  return { projects: result, subtotalsByCurrency, count: result.length };
}

async function toolGetProjectDetail(args: Record<string, unknown>, user: AuthUser) {
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        ...(args.projectId ? [{ id: String(args.projectId) }] : []),
        ...(args.projectName ? [{ projectName: { contains: String(args.projectName), mode: "insensitive" as const } }] : []),
      ],
    },
    include: PROJECT_INCLUDE,
    orderBy: { lastUpdate: "desc" },
  });

  if (!project) return { found: false };

  const financials = computeFinancials(project.financial, sumExpenses(project.expenses));
  const activities = await prisma.activity.findMany({
    where: { projectId: project.id },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const safeActivities = sanitizeActivitiesForRole(activities, user.role);

  return {
    found: true,
    id: project.id,
    projectName: project.projectName,
    status: project.status,
    customer: project.customer.name,
    supplier: project.supplier?.name ?? null,
    owner: project.owner?.name ?? null,
    dueDate: project.dueDate,
    nextAction: project.nextAction,
    description: project.description,
    financial: filterFinancialsForRole(financials, user.role),
    needsAttention: needsAttention(project, financials, user.role),
    recentActivity: safeActivities.map((a) => ({ message: a.message, by: a.user?.name ?? "System", at: a.createdAt })),
  };
}

async function runTool(name: string, args: Record<string, unknown>, user: AuthUser) {
  if (name === "list_projects") return toolListProjects(args, user);
  if (name === "get_project_detail") return toolGetProjectDetail(args, user);
  return { error: `Unknown tool: ${name}` };
}

// Tool calls often fetch a broader set of projects than the model ends up
// mentioning by name (e.g. it lists all projects, then only discusses two of
// them). Grounding the UI's "Grounded on" links to every project ever seen by
// a tool call — rather than the ones actually named in the answer — makes the
// citations misleading. Filtering by whether the project's name appears in
// the final answer text keeps citations honest at the cost of missing a
// project the model paraphrased instead of naming outright.
function groundedProjectsMentionedIn(answer: string, candidates: Map<string, string>): { id: string; name: string }[] {
  const lower = answer.toLowerCase();
  return [...candidates].filter(([, name]) => lower.includes(name.toLowerCase())).map(([id, name]) => ({ id, name }));
}

export async function runQuery(question: string, user: AuthUser & { name: string }) {
  const client = getClient();
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: baseSystemPrompt(user) },
    { role: "user", content: question },
  ];

  const candidates = new Map<string, string>();

  for (let round = 0; round < 6; round++) {
    const response = await client.chat.completions.create({
      model: env.AI_MODEL_ID!,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
    });

    const message = response.choices[0]?.message;
    if (!message) break;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      const answer = stripMarkdown(message.content?.trim() || "I don't have an answer for that.");
      return { answer, groundedOn: groundedProjectsMentionedIn(answer, candidates) };
    }

    messages.push(message);

    for (const call of message.tool_calls) {
      if (call.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // malformed args from the model — run with no filters rather than failing the whole request
      }
      const result = await runTool(call.function.name, args, user);
      if (result && typeof result === "object" && "projects" in result) {
        for (const p of (result as { projects: ToolProject[] }).projects) candidates.set(p.id, p.projectName);
      } else if (result && typeof result === "object" && "found" in result && (result as { found: boolean }).found) {
        const r = result as { id: string; projectName: string };
        candidates.set(r.id, r.projectName);
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  // Ran out of tool-call rounds — force a plain-text answer from whatever
  // tool data was already gathered instead of failing outright.
  const finalResponse = await client.chat.completions.create({
    model: env.AI_MODEL_ID!,
    messages: [...messages, { role: "user", content: "Answer now using only the information already gathered above." }],
    tool_choice: "none",
  });
  const answer = stripMarkdown(finalResponse.choices[0]?.message?.content?.trim() || "I wasn't able to complete that request — try rephrasing your question.");
  return { answer, groundedOn: groundedProjectsMentionedIn(answer, candidates) };
}

// ---------------------------------------------------------------------------
// Draft a follow-up email for one project.
// ---------------------------------------------------------------------------

export async function draftFollowUpEmail(projectId: string, instructions: string | undefined, user: AuthUser & { name: string }) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: PROJECT_INCLUDE });
  if (!project) throw new AppError("Project not found", 404);

  const financials = computeFinancials(project.financial, sumExpenses(project.expenses));
  const activities = await prisma.activity.findMany({
    where: { projectId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const safeActivities = sanitizeActivitiesForRole(activities, user.role);

  const context = {
    projectName: project.projectName,
    status: project.status,
    customer: project.customer.name,
    customerContact: project.customer.contactName,
    supplier: project.supplier?.name ?? null,
    nextAction: project.nextAction,
    dueDate: project.dueDate,
    financial: filterFinancialsForRole(financials, user.role),
    recentActivity: safeActivities.map((a) => a.message),
  };

  const client = getClient();
  const response = await client.chat.completions.create({
    model: env.AI_MODEL_ID!,
    messages: [
      {
        role: "system",
        content: [
          baseSystemPrompt(user),
          "Draft a short, professional follow-up email for the project described below, addressed to the customer contact (unless the context is clearly supplier-facing, e.g. sourcing/cost follow-up, in which case address the supplier). Use only the information given — do not invent figures or commitments. Keep the body under 150 words. Sign off as " +
            user.name +
            `. Respond with ONLY a JSON object of the exact shape {"subject": string, "body": string} and nothing else.`,
        ].join("\n\n"),
      },
      {
        role: "user",
        content: JSON.stringify({ project: context, extraInstructions: instructions || undefined }),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() || "";
  try {
    const cleaned = raw.replace(/^```json\s*|```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as { subject?: string; body?: string };
    if (parsed.subject && parsed.body) {
      return { subject: stripMarkdown(parsed.subject), body: stripMarkdown(parsed.body) };
    }
  } catch {
    // fall through to the raw-text fallback below
  }
  return { subject: `Follow-up: ${project.projectName}`, body: stripMarkdown(raw) || "Unable to draft an email right now." };
}

// ---------------------------------------------------------------------------
// Human approval — record the (possibly edited) draft as a real Activity.
// ---------------------------------------------------------------------------

export async function recordNote(projectId: string, message: string, user: AuthUser) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError("Project not found", 404);
  if (!message || !message.trim()) throw new AppError("Message cannot be empty", 400);

  await prisma.activity.create({
    data: { projectId, userId: user.id, type: "COMMENT", message: message.trim() },
  });

  return prisma.project.findUnique({ where: { id: projectId }, include: PROJECT_INCLUDE });
}
