# Master Business Management App (MVP)

Work in progress — this README will be filled in fully once the core app is stable.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL on Supabase (Prisma ORM)
- Auth: JWT
- AI: OpenAI-compatible SDK (configurable base URL / model / key)

## Structure

```
backend/    Express API + Prisma schema
frontend/   React app
docs/       Daily progress notes
```

## Running locally (draft — will be finalized)

```bash
npm run install:all
cp backend/.env.example backend/.env   # fill in DATABASE_URL, JWT_SECRET, AI_* keys
cd backend && npx prisma migrate dev && npx prisma db seed && cd ..
npm run dev
```

**Note on connection**: the database uses Supabase's Session Pooler connection string (not a direct connection) — direct connections default to IPv6, which isn't reachable from every network, and the paid IPv4 add-on isn't worth it for a free demo project. Session Pooler is Supabase's documented free, IPv4-compatible substitute for direct connections and behaves the same way for our long-running Express server.

## Documented assumptions

Things the brief didn't spell out exactly, where a judgment call was made:

- **Profit margin formula**: `margin% = ((revenue - cost) / revenue) * 100`, where `revenue` prefers `actualRevenue` over `estimatedRevenue` (uses whichever is set — actual once it's known, otherwise the estimate), and `cost` follows the same actual-over-estimated preference.
- **Project creation is RFQ-only intake**: creating a project only collects Customer, Project Name, a rough Estimated Revenue, Next Action, and Due Date — matching what's realistically known at the "Customer Request" stage of the brief's lifecycle. Supplier and Estimated Cost aren't known yet at RFQ time; they get added later via Edit, once Procurement has actually sourced a quote.
- **Stage-transition business rules**: moving a project to **Quoted** (or skipping to/past it) requires an estimated or actual revenue greater than 0 — you can't quote a $0 deal. Moving to **Ordered** (or skipping to/past it) requires a supplier assigned *and* an estimated or actual cost greater than 0 — you can't place an order with no supplier or no cost. Both checks apply even to an Admin's skip-forward transitions, not just single-step moves, so business data can't be bypassed by skipping stages.
- **Edit permission mirrors view permission**: a role can edit a financial figure exactly when it can see it (Sales owns the customer/revenue side, Procurement owns the supplier/cost side, Admin both) — this keeps one mental model for both visibility and edit rights instead of two separate rule sets.
- **Customer/Supplier deletion is blocked** (409, not a crash) while any Project still references them, so a project record is never left pointing at a customer or supplier that no longer exists.
- **Currency is per-project** (USD/EUR/LBP), stored on the Financial record, visible and editable by every role regardless of the revenue/cost RBAC split (it's metadata about the amounts, not a sensitive amount itself). No FX conversion is performed anywhere.
- **Payments Due on the Dashboard is grouped by currency**, not summed into one cross-currency number — summing different currencies together would be mathematically meaningless. With the seeded demo data (all USD) this renders as a single line; it only shows multiple lines once a non-USD project exists.
- **Real-time updates**: every mutation invalidates the relevant React Query cache (including Customer/Supplier edits, which also invalidate the Projects cache since projects embed a slim customer/supplier snapshot), and React Query's default `refetchOnWindowFocus` covers cross-tab staleness — switching back to a tab re-syncs it automatically. No SSE/WebSocket layer was added; it wasn't needed to satisfy "no manual refresh required" for this app's actual usage pattern.
