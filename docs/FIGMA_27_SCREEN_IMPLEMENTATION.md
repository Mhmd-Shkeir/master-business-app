# Figma implementation and interactive screen map

Design: https://www.figma.com/design/4MedtbdDYQaYaB10JR2Ouy/Master-Business-Management---UX-UI?node-id=0-1

The Figma file has 27 **application** screens (desktop and mobile), plus "00 Cover & Notes", a design reference rather than an application route. Role variants, overlays and responsive views share code deliberately: separate hard-coded HTML pages would create inconsistencies and data security issues.

All 27 screen states are exercised in `frontend/tests/e2e/figma-screens.spec.ts`, using Chromium at desktop and Figma's 419px mobile width. The mock-only browser checks test navigation and rendering; backend integration tests exercise business rules against a disposable PostgreSQL instance. Live E2E sign-in and visual pixel matching must be separately confirmed.

| Figma frame | Route or state | Functional behavior |
|---|---|---|
| 01 Login desktop | `/login` | Form validates and signs in via `POST /auth/login`; demo role selector fills email, never exposes public password |
| 02 Admin dashboard | `/` (ADMIN) | Live KPIs, attention reasons, projects, currency-aware payments, pipeline, briefs |
| 03 Sales dashboard | `/` (SALES) | Revenue view; supplier costs and margin excluded |
| 04 Procurement dashboard | `/` (PROCUREMENT) | Supplier payables; customer revenue and margin excluded |
| 05 Daily Brief drawer | `/` Generate → View details | Role-safe data-grounded brief + live attention links; deterministic summary if AI provider unavailable |
| 06 Notification dropdown | Bell on any authenticated page | Live overdue projects, per-account dismissal persisted by API |
| 07 Projects list | `/projects` | Search, status filter, safe CSV export, project detail links, inline Ask AI |
| 08 New RFQ | `/projects/new` | Customer select, required revenue, optional next action/date, create project |
| 09 Admin project detail | `/projects/:id` (ADMIN) | Full workflow, payment, expenses, edit, AI draft, audit timeline |
| 10 Override open | Admin detail → Admin Override | Requires reason; backend audits shipment-hold override |
| 11 Sales project detail | `/projects/:id` (SALES) | Revenue/customer payment; no supplier costs/margin |
| 12 Procurement project detail | `/projects/:id` (PROCUREMENT) | Supplier costs/payment; no revenue/margin; closing denied by server |
| 13 Customers | `/customers` | Create/edit/delete; FK-protected references; Sales and Admin |
| 14 Customer detail | `/customers/:id` | Edit contact, linked projects, revenue and outstanding |
| 15 Suppliers | `/suppliers` | Create/edit/delete; assigned supplier deletion returns 409 |
| 16 Supplier detail | `/suppliers/:id` | Edit supplier, linked projects, cost and payables |
| 17 Payments | `/payments` | Role-specific receivables/payables, inline payment form with boundary validation |
| 18 Ask My Business | `/ai` | Question suggestions, grounded project links, chat, role-safe deterministic search when no provider |
| 19 Profile/Settings | `/profile` | Edit account name and change password; JWT rotated, cached private data cleared |
| 20 Users | `/users` (ADMIN) | List team members, create accounts with roles |
| M01 Mobile login | `/login` @ 419px | Responsive sign-in and demo account picker |
| M02 Mobile dashboard | `/` @ 419px | Stacked attention cards/KPIs, notification bell |
| M03 Mobile projects | `/projects` @ 419px | Search/filter/export and horizontally scrollable table |
| M04 Mobile admin project | `/projects/:id` @ 419px | Responsive workflow, money, actions, activity timeline |
| M05 Mobile payments | `/payments` @ 419px | Currency-preserving receivables/payables |
| M06 Mobile Ask AI | `/ai` @ 419px | Compact grounded question form |
| M07 Mobile nav drawer | Mobile menu button | Role-filtered route list; closes on navigation |

## Non-interactive design artifact

The Figma frame `00 Cover & Notes` is a cover and visual reference (palette, project notes) **not** a business application screen. It is intentionally not published as an application route.

## Verification

1. `npm ci --prefix backend` and backend PostgreSQL integration/regression tests via SEQA Quality Checks.
2. `npm ci --prefix frontend`, frontend typecheck and production build via SEQA Quality Checks.
3. Chromium UI tests via `.github/workflows/figma-screens.yml`, including 27 screen-state cases and additional workflow validations.
4. Smoke test over HTTPS for the production frontend and `/api/health` with PostgreSQL connectivity.

AI provider-based generation requires `AI_API_KEY`, `AI_MODEL_ID` and `AI_BASE_URL`. Without these, the fallback is **clearly labeled** as an automatic data-based summary/search/template rather than claiming a language model generated the text.

Note that demonstration records are synthetic and intended only for an empty demo database. Never seed a production database containing real customer or supplier records.
