# Master Business Management App (MVP)

An internal tool for managing the full lifecycle of a customer project — Request, Quotation, Order, Shipping, and Closing — with role-based permissions and a data-grounded AI assistant ("Ask My Business").

See [`docs/Evaluation_Report.docx`](docs/Evaluation_Report.docx) for a technical evaluation report mapped to the coding test's five grading criteria (Architecture, Data Integrity, AI Grounding, UX/UI, Code Quality), with concrete evidence — build/typecheck results, live-tested behavior, and real bugs found and fixed during QA — for each.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL on Supabase (Prisma ORM)
- Auth: JWT + bcrypt
- AI: OpenAI-compatible SDK (configurable base URL / model / key — used with Groq in development)

## Structure

```
backend/    Express API + Prisma schema
frontend/   React app
docs/       Evaluation report + daily progress notes
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

A bell icon (sidebar header on desktop, top bar on mobile) shows a count of the current user's overdue projects and a dropdown listing them — click one to jump straight to its detail page. It's in-app only (no email), reuses the exact same overdue definition already used everywhere else (`DueDate < today AND status != CLOSED`, computed once in `lib/rbac.ts`) rather than a second one, and respects existing visibility — no new RBAC surface, since due dates aren't a restricted field for any role. No bonus items beyond this were implemented (see the evaluation report for the rest of the bonus list, deliberately left as future work).

## Documented assumptions

Things the brief didn't spell out exactly, where a judgment call was made:

- **Profit margin formula**: `margin% = ((revenue - cost) / revenue) * 100`, where `revenue` prefers `actualRevenue` over `estimatedRevenue` (uses whichever is set — actual once it's known, otherwise the estimate), and `cost` follows the same actual-over-estimated preference. Margin is withheld (not just hidden by RBAC) until a cost figure actually exists — a fresh RFQ defaults to $0 cost, and showing e.g. "100% margin" for a deal nobody has costed out yet would read as wildly profitable rather than "not started."
- **Closed projects are read-only for Sales/Procurement**: once a project reaches CLOSED, only Admin can edit its fields, record a payment, or add an expense — Sales/Procurement get a 403 (enforced server-side, not just hidden in the UI). This keeps a settled deal from being quietly altered after the fact while still letting Admin make an exceptional correction (e.g. a late invoice), which — like every other edit — is logged to the Activity Timeline.
- **Project creation is RFQ-only intake**: creating a project only collects Customer, Project Name, a rough Estimated Revenue, Next Action, and Due Date — matching what's realistically known at the "Customer Request" stage of the brief's lifecycle. Estimated Revenue must be a real number greater than 0 (enforced client- and server-side) — a blank or $0 ask isn't a real RFQ. Supplier and Estimated Cost aren't known yet at RFQ time; a supplier is assigned later via the project page's "Assign Supplier" action, once Procurement has actually sourced a quote — and that action itself requires entering a real (> 0) Estimated Cost at the same time, so a project can never sit with a supplier "assigned" but no cost behind it.
- **Stage-transition business rules**: moving a project to **Quoted** (or skipping to/past it) requires an estimated or actual revenue greater than 0 — you can't quote a $0 deal. Moving to **Ordered** (or skipping to/past it) requires a supplier assigned *and* an estimated or actual cost greater than 0 — you can't place an order with no supplier or no cost. Both checks apply even to an Admin's skip-forward transitions, not just single-step moves, so business data can't be bypassed by skipping stages.
- **Edit permission mirrors view permission**: a role can edit a financial figure exactly when it can see it (Sales owns the customer/revenue side, Procurement owns the supplier/cost side, Admin both) — this keeps one mental model for both visibility and edit rights instead of two separate rule sets.
- **Customer/Supplier deletion is blocked** (409, not a crash) while any Project still references them, so a project record is never left pointing at a customer or supplier that no longer exists.
- **Currency is per-project** (USD/EUR/LBP), stored on the Financial record, visible and editable by every role regardless of the revenue/cost RBAC split (it's metadata about the amounts, not a sensitive amount itself). No FX conversion is performed anywhere — multi-currency totals are always shown per-currency, never combined.
- **Payments Due on the Dashboard is grouped by currency**, not summed into one cross-currency number — summing different currencies together would be mathematically meaningless. With the seeded demo data (all USD) this renders as a single line; it only shows multiple lines once a non-USD project exists.
- **Real-time updates**: every mutation invalidates the relevant React Query cache (including Customer/Supplier edits, which also invalidate the Projects cache since projects embed a slim customer/supplier snapshot), and React Query's default `refetchOnWindowFocus` covers cross-tab staleness — switching back to a tab re-syncs it automatically. No SSE/WebSocket layer was added; it wasn't needed to satisfy "no manual refresh required" for this app's actual usage pattern.
- **AI "Grounded on" citations** list only the projects actually named in the AI's answer text, not every project a tool call happened to fetch internally — this keeps the citations honest when the model reasons over a broader result set than it ends up mentioning.
