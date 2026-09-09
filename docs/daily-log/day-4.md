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

## Not done yet

AI integration (Daily Brief, grounded natural-language queries, drafting with human approval) — the brief's own "critical feature" — has not been started. That's the entire scope of the next session.
