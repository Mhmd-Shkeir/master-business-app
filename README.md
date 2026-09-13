# Master Business Management App (MVP)

An internal tool for managing the full lifecycle of a customer project — Request, Quotation, Order, Shipping, and Closing — with role-based permissions and a data-grounded AI assistant ("Ask My Business").

See [`docs/Evaluation_Report.docx`](docs/Evaluation_Report.docx) for a technical evaluation report mapped to the coding test's five grading criteria (Architecture, Data Integrity, AI Grounding, UX/UI, Code Quality), with concrete evidence — build/typecheck results, live-tested behavior, and real bugs found and fixed during QA — for each. See [`docs/Total_Report.docx`](docs/Total_Report.docx) for the full chronological build story, day 1 through submission — every feature, every bug found and how it was caught, and the final verified state. See [`docs/daily-log`](docs/daily-log) for the underlying day-by-day log both reports are drawn from.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL on Supabase (Prisma ORM)
- Auth: JWT + bcrypt
- AI: OpenAI-compatible SDK (configurable base URL / model / key — used with Groq in development)

## Frameworks and packages

Every dependency actually exercised by the app (not just present in `package.json` from initial scaffolding):

**Backend**
- `express` + `express-async-errors` — HTTP layer; the latter forwards thrown/rejected errors from async route handlers to Express's error middleware instead of crashing the process.
- `@prisma/client` / `prisma` — ORM and migrations against PostgreSQL.
- `zod` — request-body validation on every mutating route (`.strict()` schemas reject unexpected fields rather than silently ignoring them).
- `jsonwebtoken` + `bcryptjs` — JWT issuing/verification and password hashing.
- `openai` — the official OpenAI SDK, pointed at Groq's OpenAI-compatible endpoint via `AI_BASE_URL` (works unmodified against real OpenAI or any other OpenAI-compatible provider by changing that one value). Used for both plain completions (Daily Brief, email drafting) and function-calling (natural-language queries against `list_projects`/`get_project_detail`).
- `cors`, `dotenv` — cross-origin requests from the Vite dev server, environment loading.

**Frontend**
- `react` + `react-dom` (v19), `react-router-dom` (v7) — SPA routing.
- `@tanstack/react-query` — server-state cache, mutation handling, and the invalidation strategy every mutation relies on to keep other views in sync (see "Real-time updates" below).
- `axios` — HTTP client, with a request interceptor attaching the JWT and a response interceptor handling 401s.
- `tailwindcss` v4 (`@tailwindcss/vite` plugin) — utility-first styling; every icon in the app is a small hand-rolled inline SVG (`components/icons.tsx`) rather than an icon library.
- `vite` + `typescript` — dev server and build.

## Design approach

- **RBAC as the single source of truth, not a UI convention.** One function (`lib/rbac.ts`) computes financial visibility and attention flags; the REST API, the AI's tool results, and the AI's Daily Brief all call the same function rather than each re-implementing the rule. When a leak was found (Day 5's role-blind `needsAttention` flags), fixing it in one place fixed it everywhere with no additional per-surface changes — direct evidence the architecture holds up under a real bug, not just in theory.
- **Attention-first, not KPIs-first.** The Dashboard's "Needs My Attention" section sits above the KPI row on the explicit reading that the brief's "most critical screen" language means surfacing problems before summary counts, not after.
- **No fabricated data, ever.** Several requests were explicitly declined rather than faked to look more complete — a "Cancelled" project status that doesn't exist in the schema, a cross-project activity feed with no backing data source, a "vs. last month" trend indicator with no historical snapshots to compute it from. Each is logged in the daily log with the reasoning, not silently dropped.
- **Business rules enforced server-side, reflected client-side.** Every constraint that matters (RBAC edit permissions, the Closed-project lock, revenue/cost-must-be-positive rules, the Shipment Hold) is checked in the backend first and verified there directly via API calls that bypass the UI — the frontend hiding a button is a UX courtesy, never the actual enforcement.
- **Real measurement over eyeballing, especially for responsive layout.** Two genuine responsive bugs (Day 5, Day 6) were found only because real screenshots at specific window widths were pushed back on and re-verified with `scrollWidth`/`clientWidth` measurement rather than a handful of preset breakpoints assumed to be representative.
- **Restraint over decoration.** No stock illustrations, no decorative animation, no icon library — plain color-coded status, a small hand-rolled icon set, and generous whitespace, matching how an enterprise B2B tool actually reads rather than a marketing landing page.

## Structure

```
backend/    Express API + Prisma schema
frontend/   React app
docs/       Evaluation report, total build report, and daily progress notes
```

## Prerequisites

- **Node.js 20 or newer** (developed and tested on Node 22) and npm.
- **A PostgreSQL database.** The free tier of [Supabase](https://supabase.com) works well and is what this project was built against — create a project there, no local Postgres install needed.
- **An OpenAI-compatible API key**, for the AI features. [Groq](https://console.groq.com) has a free tier and is what this project was built and tested against; any OpenAI-compatible endpoint works by changing `AI_BASE_URL`/`AI_MODEL_ID`. The app still runs and every non-AI feature works without this — the AI endpoints just return a 503 until it's configured.
- Git, to clone the repository.

## Downloading and running locally

```bash
git clone https://github.com/Mhmd-Shkeir/master-business-app.git
cd master-business-app
npm run install:all
```

Then set up environment variables — copy each example file and fill in real values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

- In `backend/.env`: set `DATABASE_URL`/`DIRECT_DATABASE_URL` to your Supabase project's **Session Pooler** connection string (Supabase dashboard → Connect → Connection string → Session pooler — see note below), set `JWT_SECRET` to any long random string, and set `AI_BASE_URL`/`AI_MODEL_ID`/`AI_API_KEY` to your AI provider's values (see comments in the file for a Groq-specific example).
- `frontend/.env` only needs `VITE_API_BASE_URL`, which already defaults to `http://localhost:4000/api` — no change needed unless the backend runs elsewhere.

Set up the database (run once, from the repo root):

```bash
cd backend && npx prisma migrate dev && npx prisma db seed && cd ..
```

This applies the schema and seeds demo data (3 users, 3 customers, 2 suppliers, several projects across every workflow stage — see [Demo accounts](#demo-accounts) below).

Start both servers:

```bash
npm run dev
```

This runs the backend on `http://localhost:4000` and the frontend on `http://localhost:5173` concurrently. Open `http://localhost:5173` and sign in with one of the demo accounts below.

**Note on the database connection string**: use Supabase's **Session Pooler** connection string, not the direct connection — direct connections default to IPv6, which isn't reachable from every network, and the paid IPv4 add-on isn't worth it for a free demo project. Session Pooler is Supabase's documented free, IPv4-compatible substitute and behaves the same way for a long-running Express server.

## Demo accounts

Seeded by `npx prisma db seed`, password `password123` for all three:

| Role | Email | Can see |
|---|---|---|
| Admin | `admin@demo.com` | Everything — revenue, cost, margin, overrides |
| Sales | `sales@demo.com` | Customer data, revenue, project status. Not supplier cost or margin |
| Procurement | `procurement@demo.com` | Supplier data, cost. Not customer revenue or margin |

## Core workflow walkthrough

**Project lifecycle (RFQ → Quoted → Ordered → Shipping → Closed)**
- Sign in as Admin. From the Dashboard, click **+ New Project** to create an RFQ for a customer with a real (> 0) estimated revenue, next action, and due date.
- Open the project (as Admin or Procurement) and use **Assign Supplier** in the Supplier/Cost card to pick a supplier and enter its estimated cost together in one step, then advance status to **Quoted**, then **Ordered**, then **Shipping** — each transition is blocked server-side until the required data for that stage exists (e.g. no supplier/cost, no Order).
- Backward transitions are always rejected; only Admin may skip stages forward, and even then the same per-stage data checks apply.

**Shipment hold**
- While a project is in **Shipping** with an outstanding customer balance, attempting to close it is blocked and the project is flagged on the Dashboard's "Needs My Attention" list as blocked.
- Record a customer payment (Payments page or the project's Financial Overview) to clear the balance and close normally, **or** sign in as Admin and use the project's override action — it requires a reason and logs the admin's name, timestamp, and reason to the Activity Timeline.

**Role-based access**
- Sign in as Sales: the same project shows revenue and customer balance, but no supplier cost, no profit margin, and no Payables Due card.
- Sign in as Procurement: the reverse — supplier cost and payables, no customer revenue, no margin.
- Try asking the AI something outside your role's data (e.g. Sales asking about profit margin) — it explains the information isn't available to your role rather than guessing.

**AI — "Ask My Business"**
- Dashboard **Daily Brief**: click Generate for a summary of what needs attention today, grounded in the same data as the "Needs My Attention" list.
- **Natural language queries**: use the Ask AI page, the widget on the Projects page, or "Ask about this project" on a project's detail page — try "What needs my attention today?", "Which projects are overdue?", "What's the outstanding balance on this project?".
- **Drafting + Human Approval**: on a project's page, click **Draft Follow-up Email** — the AI drafts a subject/body grounded in that project's real data. Nothing is sent or recorded until you review, optionally edit, and click **Edit and Confirm**, which logs it to the Activity Timeline. Clicking Discard records nothing.

## Bonus: in-app overdue notifications

A bell icon (sidebar header on desktop, top bar on mobile) shows a count of the current user's overdue projects and a dropdown listing them — click one to jump straight to its detail page. It's in-app only (no email), reuses the exact same overdue definition already used everywhere else (`DueDate < today AND status != CLOSED`, computed once in `lib/rbac.ts`) rather than a second one, and respects existing visibility — no new RBAC surface, since due dates aren't a restricted field for any role. The badge count polls every 60 seconds, since "overdue" changes purely with the clock and none of React Query's default refetch triggers (mount, focus, mutation) would otherwise catch a project silently crossing into overdue.

Following a notification's link **permanently dismisses it for that exact account** — persisted server-side (a small `NotificationDismissal` table keyed on user + project), not just for the browser session, and scoped only to that specific link — reaching the same project any other way (the Projects list, Needs My Attention, Recent Projects) does not dismiss it, and the Needs My Attention section itself is never affected, since it must always reflect true business state regardless of who's acknowledged the bell.

No bonus items beyond this were implemented (see the evaluation report for the rest of the bonus list, deliberately left as future work).

## Documented assumptions

Things the brief didn't spell out exactly, where a judgment call was made:

- **Profit margin formula**: `margin% = ((revenue - cost) / revenue) * 100`, where `revenue` prefers `actualRevenue` over `estimatedRevenue` (uses whichever is set — actual once it's known, otherwise the estimate), and `cost` follows the same actual-over-estimated preference. Margin is withheld (not just hidden by RBAC) until a cost figure actually exists — a fresh RFQ defaults to $0 cost, and showing e.g. "100% margin" for a deal nobody has costed out yet would read as wildly profitable rather than "not started."
- **Closed projects are read-only for Sales/Procurement**: once a project reaches CLOSED, only Admin can edit its fields, record a payment, or add an expense — Sales/Procurement get a 403 (enforced server-side, not just hidden in the UI). This keeps a settled deal from being quietly altered after the fact while still letting Admin make an exceptional correction (e.g. a late invoice), which — like every other edit — is logged to the Activity Timeline.
- **Project creation is RFQ-only intake**: creating a project only collects Customer, Project Name, a rough Estimated Revenue, Next Action, and Due Date — matching what's realistically known at the "Customer Request" stage of the brief's lifecycle. Estimated Revenue must be a real number greater than 0 (enforced client- and server-side) — a blank or $0 ask isn't a real RFQ. Supplier and Estimated Cost aren't known yet at RFQ time; a supplier is assigned later via the project page's "Assign Supplier" action, once Procurement has actually sourced a quote — and that action itself requires entering a real (> 0) Estimated Cost at the same time, so a project can never sit with a supplier "assigned" but no cost behind it.
- **Stage-transition business rules**: moving a project to **Quoted** (or skipping to/past it) requires an estimated or actual revenue greater than 0 — you can't quote a $0 deal. Moving to **Ordered** (or skipping to/past it) requires a supplier assigned *and* an estimated or actual cost greater than 0 — you can't place an order with no supplier or no cost. Both checks apply even to an Admin's skip-forward transitions, not just single-step moves, so business data can't be bypassed by skipping stages.
- **Edit permission mirrors view permission**: a role can edit a financial figure exactly when it can see it (Sales owns the customer/revenue side, Procurement owns the supplier/cost side, Admin both) — this keeps one mental model for both visibility and edit rights instead of two separate rule sets.
- **Customer/Supplier deletion is blocked** (409, not a crash) while any Project still references them, so a project record is never left pointing at a customer or supplier that no longer exists.
- **Net Cash Flow** (Dashboard, Admin-only) is actual money received from customers minus actual money paid to suppliers, per currency — not requested by the brief, added as a genuinely different figure from Profit Margin, which is revenue-vs-cost on paper regardless of whether anyone has actually been paid.
- **Currency is per-project** (USD/EUR/LBP), stored on the Financial record, visible and editable by every role regardless of the revenue/cost RBAC split (it's metadata about the amounts, not a sensitive amount itself). No FX conversion is performed anywhere — multi-currency totals are always shown per-currency, never combined.
- **Payments Due on the Dashboard is grouped by currency**, not summed into one cross-currency number — summing different currencies together would be mathematically meaningless. With the seeded demo data (all USD) this renders as a single line; it only shows multiple lines once a non-USD project exists.
- **Real-time updates**: every mutation invalidates the relevant React Query cache (including Customer/Supplier edits, which also invalidate the Projects cache since projects embed a slim customer/supplier snapshot), and React Query's default `refetchOnWindowFocus` covers cross-tab staleness — switching back to a tab re-syncs it automatically. No SSE/WebSocket layer was added; it wasn't needed to satisfy "no manual refresh required" for this app's actual usage pattern.
- **AI "Grounded on" citations** list only the projects actually named in the AI's answer text, not every project a tool call happened to fetch internally — this keeps the citations honest when the model reasons over a broader result set than it ends up mentioning.
