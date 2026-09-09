# Day 3 — 2026-09-09

Closed the gap flagged at the end of Day 2: creation asked for everything up front and nothing could be edited afterward. Made the project lifecycle actually behave like a real business process, matching the brief's Customer Request → Quotation → Order → Closing flow.

## RFQ-only intake

- `POST /api/projects` now only accepts `projectName`, `customerId`, `nextAction`, `dueDate`, `estimatedRevenue` — Supplier and Estimated Cost are no longer collected at creation (schema is `.strict()`, so a stray field 400s instead of being silently accepted).
- `NewProjectPage.tsx` trimmed to match, with a short explanatory note on the form about why.

## Real Project Edit

- New `PATCH /api/projects/:id`, backed by `updateProject()` in `projects.service.ts`. Field-level permission mirrors field-level *visibility* (reuses `canSeeRevenue`/`canSeeCost` from `lib/rbac.ts`) — a field the caller's role can't touch is silently dropped rather than rejected, but a body with nothing the caller could touch is a real 403. Every actual change lands in one combined `UPDATE` Activity entry.
- `ProjectDetailPage.tsx` got a real Edit mode: Project Name/Next Action/Due Date editable by everyone, Supplier reassignment for Admin/Procurement, financial figures editable wherever the existing read-only display already showed them (same role-based field presence, now with inputs instead of just text).

## Realistic stage-transition business rules

- Moving to **Quoted** (or past it, for an Admin skip) now requires revenue > 0. Moving to **Ordered** (or past it) requires a supplier assigned and cost > 0. Checked as a loop over every stage between current and target, so an Admin skip can't route around the rule.
- Checked all 6 seeded projects against both new rules before touching anything — **all already satisfy them under their current stage, no seed changes needed.**

## Customer/Supplier CRUD

- Added `GET/PATCH/DELETE /:id` to both `customers.routes.ts` and `suppliers.routes.ts`, same role restriction as their existing `POST /`. Delete is blocked with a 409 (not a crash) if any Project still references the entity.
- New `CustomersPage.tsx`/`SuppliersPage.tsx` — simple tables with inline edit, delete with a confirm step. Edit/Delete controls only shown to the owning role; other roles see a read-only table. Added to nav.

## Role-aware UI gating

- Dashboard's "+ New Project" link now only shows for Admin/Sales — Procurement previously saw it and then hit a 403 after filling out the form.

## Verified live (not just via API)

- Full curl pass on every new endpoint, per role: Project Edit RBAC (Sales blocked from cost fields, mixed-permission body applies only the allowed field, Procurement assigning supplier+cost), both new stage-transition rules blocking and then succeeding after an Edit, Customer/Supplier edit RBAC and the referenced-entity delete block.
- Full lifecycle walked through in the actual browser: Sales creates an RFQ (name/customer/revenue only) → Procurement edits it to assign a supplier and cost → Sales moves it QUOTED → ORDERED → SHIPPING → Admin is blocked from closing (409, balance outstanding) → Admin overrides with a reason → project closes, exact existing audit message format confirmed unchanged. Customers/Suppliers pages checked per role (Sales: Customers editable, Suppliers read-only; mirrored for Procurement).
- Database reset to clean seed state after testing.

Not done yet: AI integration (Daily Brief, natural-language queries, drafting) — Day 4 scope.
