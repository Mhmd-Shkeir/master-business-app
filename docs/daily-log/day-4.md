# Day 4 — 2026-09-10

Three passes today: multi-currency/description support, an information-architecture pass that turns the Dashboard-does-everything prototype into a real multi-page app with proper department separation, and a visual design pass. AI integration is still ahead — see the end of this log.

## Multi-currency and description

- New `Currency` enum (`USD`/`EUR`/`LBP`) on `Financial`, `@default(USD)`. Visible/editable by **every** role unconditionally — currency is metadata about an amount, not a sensitive amount itself, so it's deliberately not gated behind `canSeeRevenue`/`canSeeCost` the way the dollar figures are.
- New `description` field on `Project`, same unconditional-visibility tier as `nextAction`/`dueDate`.
- Every currency-bearing aggregate (Dashboard's Payments/Payables Due, Customer/Supplier detail stats) is grouped by currency into its own line rather than summed across currencies — no FX conversion is performed anywhere in the app.
- Fixed a real cache gap: editing or deleting a Customer/Supplier now also invalidates the `["projects"]` query, so a renamed customer no longer goes stale in an already-loaded project list.

## Information architecture and RBAC hardening

- `GET /customers` and `GET /suppliers` are now role-restricted (Admin+Sales, Admin+Procurement respectively) — this was the actual bug behind "why does Procurement see the Customers list," fixed at the backend, the only place this project treats as the authority on visibility.
- New Users module (list + create, Admin-only): duplicate email returns a clean `409` instead of a raw Prisma error, `passwordHash` is excluded at the query level so it's structurally impossible to leak.
- New self-service password change (`PATCH /api/auth/password`).
- New dedicated `POST /api/projects/:id/payment` for recording a customer/supplier payment — separate from the existing free-form financial Edit, because "record a payment" has real business rules the free-form edit doesn't: amount must be `> 0`, amount can't exceed the outstanding balance, and currency is never accepted as input (it always uses the project's own currency — nothing for a client to override).
- Dashboard split apart: a lean overview + "Recent Projects" (top 5) remains on `/`, with a full searchable/filterable list moved to its own `/projects` page. New `/payments` (role-aware Receivables/Payables with inline Record Payment), `/profile` (account info + password change), `/customers/:id` and `/suppliers/:id` (detail pages with client-side aggregation over already-role-filtered data — no new data-exposure surface). Nav and route guards are role-aware throughout; a direct URL to a page a role shouldn't see redirects home.

## Visual design pass

Functionality was solid but the UI read as a prototype. Rebuilt the presentation layer only — no schema, RBAC, or business-rule changes:

- Color-coded status badges (RFQ/Quoted/Ordered/Shipping/Closed each get a distinct color) instead of one flat gray pill, directly targeting the brief's own "is the dashboard instantly readable" bar.
- A real header (icon-labeled nav, active-page highlighting, role-colored badge, gradient logomark) and a real footer (copyright, signed-in-as) on every page.
- Caught and fixed a genuine bug during testing: the header was capped at the same narrow max-width as page content, causing Admin's full 6-item nav to wrap onto two lines. Decoupled header width from content width — the header now spans the full window and only falls back to a horizontal scroll if a window is genuinely too narrow.
- Skeleton loading (shimmer placeholders) on the Dashboard instead of a spinner, small inline icon set for nav items and empty states, subtle fade-in on page transitions, hover-shadow micro-interactions on cards.
- Deliberately did **not** add decorative images/illustrations or heavy animation — restraint in color and motion is what actually reads as an enterprise B2B tool, not stock art.

## Verified live (not just via API)

- Full curl pass per role on every new endpoint: Customers/Suppliers list gating, Users list/create/duplicate-email, password change (wrong password → 401, correct → 200, new password confirmed to work and old one confirmed to fail), Record Payment (`0`/negative amount → 400, amount over balance → 400 with the DB confirmed unchanged after the rejected attempt, a valid payment → 200 with the balance and Activity entry both correct, a `currency` field in the payload → 400 since the schema is `.strict()`).
- Full type-check on both frontend and backend, clean.
- Browser walk-through as Admin, Sales, and Procurement: nav only shows permitted links, a direct URL to a disallowed page redirects home, the new Payables Due card appears for Procurement (previously just a dash), Customer/Supplier detail aggregates checked against a manual sum, the Record Payment form's client-side cap and the backend's own rejection both confirmed, the override/hold flow re-confirmed unregressed, header/footer/status-badges/skeleton loading checked at both a cramped and a normal desktop width.
- Database reset to clean seed state after testing.

## Further UI iteration (same day, before AI)

The visual design pass above went through two more rounds before settling: a dark collapsible sidebar (replacing the light top-nav, matching a reference layout the user liked), then a final polish pass — per-page title+subtitle headers, a `DueDate` component that renders overdue dates in red with an "Overdue" label (Projects list, Dashboard, Project Detail, Customer/Supplier detail), color-coded avatar-initial chips, and Project Detail reorganized into labeled sections (Project Overview / Financial Overview / Workflow / Activity Timeline) with a short display ID next to the customer/supplier line. One real functional gap surfaced and was fixed along the way: Customers/Suppliers had Edit/Delete but no Create UI in the frontend even though the backend `POST` endpoints already existed from Day 1 — added real create forms plus a live per-row project count computed from already-fetched project data. Deliberately skipped anything that would require fabricated data (a "vs last month" trend indicator — no historical snapshots exist to back it) or a feature not actually wired to anything (Settings now genuinely routes to the account page rather than being a dead link).

## AI Assistant — Daily Brief, Ask My Business, drafting (the brief's "critical feature")

Built per an approved plan with three explicit hardening requirements from the user layered in before implementation, not after:

- **Grounding, two mechanisms.** Daily Brief is a deterministic server-side fetch (no tool-calling) — compute the same `needsAttention` flags the Dashboard already uses across every project, role-filter the financials, hand the compact JSON to the model for one prose write-up. Natural-language queries and drafting use OpenAI-SDK function-calling against exactly two backend tools (`list_projects`, `get_project_detail`), each backed by a real parameterized Prisma query — the model can never write SQL or reach outside a project's own fields.
- **RBAC is enforced in code, not in the prompt.** Every tool result passes through the same `filterFinancialsForRole`/`computeFinancials` functions the REST API already uses, moved to `lib/rbac.ts` so there's exactly one implementation to trust. The system prompt only governs *how to phrase* an absence ("that information isn't available to your role"), never *whether* data is withheld.
- **Currency safety.** A new `groupByCurrency` helper returns tool subtotals as `{USD: x, EUR: y}`, never a combined sum — verified live by asking, as Admin, for a single combined total across a USD and a EUR project: the assistant correctly refused to combine them, explained FX conversion isn't available, and gave the two totals separately, even though the question explicitly asked for "one number."
- **Human approval is a real recorded action.** There's no email-sending infrastructure in this app (correctly — never asked for), so "Edit and Confirm" records the human-edited text as a real `Activity` (type `COMMENT`) via the same `prisma.activity.create` pattern every other mutation uses. Confirmed live: an edited draft's exact edited text appears in the Activity Timeline immediately, attributed to the confirming user.

**Two real bugs caught during verification, not assumed away:**
1. `draftFollowUpEmail` was passing raw Activity messages to the model. A seeded free-text activity — "Supplier increased cost by 3% due to steel prices." — doesn't match any system-generated template, so the first cost-side keyword filter (exact-phrase matching) missed it and leaked cost information into a Sales user's context. Fixed by rewriting `sanitizeActivitiesForRole` to use case-insensitive word-boundary pattern matching instead of exact-phrase matching, and re-verified in both directions (Sales no longer receives the cost-side message; Procurement no longer receives the mirrored "Customer payment of..." message).
2. The model didn't reliably obey the "no markdown" system-prompt instruction (the chat UI has no markdown renderer, so `**bold**` showed up as literal asterisks). Fixed with a server-side `stripMarkdown` post-processor applied to all three AI outputs — a prompt instruction alone isn't a reliable contract with an LLM, so this is now enforced in code as a second layer.

**Verified live, per role:** Daily Brief generates real prose referencing actual overdue/low-margin projects and their real figures; a Sales user asking directly for supplier cost or margin is declined without guessing, and the underlying tool payload was inspected directly (not just the model's phrasing) to confirm the fields are structurally absent, not merely undiscussed; the mirror check passed for Procurement asking about customer revenue; draft-email as Sales produces a real draft with no cost/margin mentioned; confirm-note creates a real, attributed Activity row. Chat history on the new `/ai` page persists per-user across a refresh (`localStorage`, scoped by user id) with an explicit "Clear Chat" action, rather than silently discarding a conversation on every accidental navigation.

## Expenses — a real gap found in a brief re-read, not asked for up front

A pass back through the original brief (Financials: "Revenue, Cost, Expenses") surfaced a genuine miss: the `Expense` model has existed in the schema since Day 1, but no API or UI ever exposed it. Built once the user explicitly authorized it:

- `POST /api/projects/:id/expenses` (Zod `.strict()` — `category`, `amount` positive, optional `note`), gated by `canSeeCost` (same tier as Supplier/Cost data — Admin + Procurement). Records the expense and a matching Activity entry (`"Expense recorded: {category} — {amount} {currency}."`) in one transaction.
- Frontend: an Expenses section on Project Detail (list + inline add form, category dropdown) rendered only when the role can see cost data.
- While testing this live, the user asked the natural follow-up question: are expenses actually folded into Cost and Margin? They weren't yet — `computeFinancials` only knew about `estimatedCost`/`actualCost`. Explicitly authorized to fix.

**The fold itself:** `computeFinancials` now takes a `totalExpenses` second argument and computes a `totalCost = supplierCost + totalExpenses`, used for `marginPercent` — but `supplierBalance` deliberately still uses raw `supplierCost` alone, not `totalCost`. Expenses (shipping, inspection, customs, etc.) reduce real profitability but aren't necessarily owed to the assigned Supplier — they can go to a third party (a shipper, an inspector) — so "what we still owe the Supplier" and "what this deal actually cost us" are kept as two different numbers on purpose. `totalExpenses`/`totalCost` are gated behind `canSeeCost` the same as the rest of the Supplier/Cost card; `marginPercent` (now expense-inclusive) stays Admin-only, unchanged.

**Two more pre-existing RBAC leaks found while testing Expenses live, not part of the original AI work:**
1. The AI's activity-sanitization regex didn't have "expense" as a cost-side keyword, so "Expense recorded: Shipping — 120.00 USD." slipped past the AI context filter for Sales. Added `expense` to `COST_SIDE_PATTERN`.
2. Bigger one: the **real UI Activity Timeline** (`GET /projects/:id`) was never field-filtered at all — only the AI's context and the structured Financial JSON were. This bug predates Expenses; it's existed since Day 3, when activities were introduced. Sales could read "Expense recorded: Shipping — 120.00 USD." and Procurement could read "Customer payment of 5000.00 USD recorded." directly in the timeline. Fixed by applying the same `sanitizeActivitiesForRole` used for the AI to the real endpoint too — one sanitizer, two call sites, so they can't drift apart again.

**Verified live, all three roles, on the actual project the user was testing with (a EUR project with a €200 Inspection expense):** Admin sees "Total Cost (incl. €200.00 expenses) → €984.00" and a Profit Margin of 80.3% (down from 84.3% pre-fix — the expense is now counted); Procurement sees the same Total Cost line but no Profit Margin; Sales sees neither, and correctly sees only revenue-side data as before. The Dashboard's "Low Margin" attention flag (which every role sees, unlike the number itself) already reflects the expense-inclusive margin for all roles, since `needsAttention` and the AI Daily Brief share the same `computeFinancials` call.

## Not done yet

Final full regression pass across all three roles after today's UI + AI + Expenses changes, README/demo-video prep, and a database reset to clear test artifacts (a temporary EUR-currency project used to verify multi-currency separation, and a couple of AI-confirmed test notes) — deferred at the user's request so testing can continue first.
