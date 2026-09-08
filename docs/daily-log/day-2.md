# Day 2 — 2026-09-08 (started same day as Day 1, ahead of schedule)

- Built `POST /api/auth/login` (bcrypt + JWT, 7-day expiry).
- Applied RBAC middleware (`authenticate`, `requireRole`) across all routes.
- Built role-based field filtering (`lib/rbac.ts`): Sales sees revenue/no cost/no margin, Procurement sees cost/no revenue/no margin, Admin sees everything — verified live against the real API for all three roles.
- Built Customer and Supplier CRUD (list + create, create restricted to the owning role + Admin).
- Built Project CRUD (list, detail with activity timeline, create) with computed financials (margin, customer/supplier balance) and `needsAttention` flags (overdue, missing next action, low margin, blocked shipment).
- Built `transitionProjectStatus`: Sales/Procurement move one stage at a time, Admin can skip forward, no backward transitions for anyone, and reaching CLOSED with an outstanding customer balance is blocked for every role including Admin.
- Built `overrideShipmentHold` (Admin-only): only valid on a SHIPPING project with a real balance, requires a reason, logs admin name + timestamp + reason to the Activity Timeline, then closes the project.
- Added `express-async-errors` + a global error handler so a thrown/rejected error in any route returns a clean 500 instead of crashing or hanging the server.
- **Tested all of the above live against the real Neon database**: login for all 3 roles, RBAC field filtering confirmed per role, skip-permission enforcement (Sales blocked/Admin allowed), hold-blocks-close for Admin too, override-hold flow end-to-end with the activity log entry confirmed.
- Reset the database back to clean seed state after testing.

Not done yet: frontend isn't wired to any of this (still shows placeholder dashboard). Dashboard/Project Detail data wiring is Day 3 scope.

## Frontend wiring (continued same day, ahead of schedule)

- Auth context (JWT + user in localStorage), protected routes, axios 401-interceptor that logs out and redirects.
- Real login page with demo-account quick-fill buttons.
- Dashboard wired to real data: overview cards (computed from live project list), "Needs My Attention" list with color-coded badges (Overdue, Payment Hold, Low Margin, No Next Action), full projects table.
- Project Detail page: header, role-filtered financial section, activity timeline, workflow transition buttons (single "Move to X" for everyone, extra "Skip to X (Admin)" buttons for Admin only), shipment-hold warning banner with the Admin override form (reason textarea → confirm → logs to Activity Timeline).
- New Project form (RFQ intake) wired to the create endpoint.
- **Bug found and fixed during browser testing**: `color-scheme: light dark` in `index.css` caused unstyled text (dashboard card numbers, etc.) to render white-on-white when the OS is in dark mode — invisible but present in the DOM. This would have silently broken the dashboard for Ibrahim if his machine is in dark mode. Fixed by pinning `color-scheme: light` and giving `body` an explicit dark text color, since this app isn't building a dark theme.
- **Verified everything live in the browser, not just via API**: logged in as Admin, saw all 4 dashboard cards with correct numbers, saw all 4 attention badge types render on the seeded projects, opened the blocked "Acme Showroom Fixtures" project, triggered the Admin override with a reason, confirmed the project closed and the exact required audit line appeared in the Activity Timeline. Logged in as Sales, opened a project, confirmed the Financial section shows only revenue/balance (no cost, no margin) and only the single-step "Move to SHIPPING" button appears (no admin skip buttons).
- Reset the database back to clean seed state after testing.

## Database moved from Neon to Supabase (same day)

- Diagnosed why the dashboard felt slow: Neon's free tier scales its compute to zero after just 5 minutes of inactivity, so during normal active development every gap of a few minutes re-paid a fresh connection handshake (measured 0.7s-9s per request, highly variable).
- Checked Supabase's free tier: pauses the whole project only after 7 days of zero activity, not per-connection - a fundamentally different (better-suited) design for this project.
- Created a new Supabase project (Frankfurt region, Data API disabled since we only use Prisma directly, not supabase-js).
- Supabase's direct connection (IPv6) wasn't reachable from this network; used the Session Pooler connection instead (Supabase's documented free IPv4-compatible substitute for direct connections - appropriate for our single long-running Express server, unlike the Transaction Pooler which is meant for serverless/stateless workloads).
- Re-ran migration + seed against Supabase, verified end-to-end again (health check, RBAC, a live status transition through the actual UI with a correct Activity log entry).
- Result: request latency dropped from 0.7s-9s (Neon) to a stable 0.32s-0.66s (Supabase) - confirmed with repeated timing tests.
- Updated .env.example and README to describe the Supabase Session Pooler setup instead of Neon's pooled/direct split.
