# Day 5 — 2026-09-11 to 2026-09-12

A long stretch covering three threads: closing out Dashboard/UI polish requested against real screenshots, a full responsive pass across every page and breakpoint, and a brief-compliance re-read that caught a real Header gap and several backend RBAC/business-rule tightenings. Ends with the technical evaluation report and a full README rewrite.

## Dashboard hierarchy freeze

Per an explicit, fully-specified decision: Needs My Attention moved ahead of the KPI row (the brief's "most critical screen" framing outweighs a KPIs-first layout), a single compact `AttentionSummaryCard` replaced a panel that had been showing the same overdue/low-margin/missing-next-action breakdown twice on one page, an explicit "Business KPIs" section label was added, and the Daily Brief kept its place beside the summary card. RBAC-visible behavior (Low Margin amber not red, currency separation, role-gated cards) was explicitly required to stay unchanged and was re-verified per role after the reorder. Declined two Figma-inspired additions the user themselves flagged as questionable: a fabricated "Cancelled" project status (no such status exists in the schema, would need a real backend change) and a cross-project "Recent Activity" feed (new backend scope, no existing data source) — both because they'd require inventing data or scope, not because they were bad ideas.

Follow-up polish once real screenshots showed rough edges: removed a `line-clamp-4` that was cutting the Daily Brief's real AI output off mid-sentence; added real (non-fabricated) subtitles to the RFQ/Quote/Order KPI cards from data already being fetched; made the top nav scroll smoothly instead of jumping; widened the Dashboard header to the full page width instead of matching content max-width.

## RBAC leak found and fixed: `needsAttention()` was role-blind

The user's own reasoning caught this: `lowMargin` and `blockedShipment` were computed once and returned identically to every role, regardless of whether that role can see the underlying financial data a `true` would reveal. Telling a Sales user "this project has low margin" leaks a fact about supplier cost they aren't authorized to see, even without showing the number — a bare boolean is itself a leak. Fixed by threading `role` through `needsAttention()` and gating both flags on the same `canSeeMargin`/`canSeeRevenue` checks used for the raw figures. Verified the fix cascades correctly through the REST API, the AI Daily Brief, and the AI's tool-calling results with zero additional per-surface changes — direct proof the "one `rbac.ts`, every surface shares it" architecture works as designed.

## Full responsive pass, then a real pushback with evidence

First pass: rebuilt the sidebar as a proper mobile drawer (was previously just always-visible, unusable under ~768px), fixed five tables that were squeezing cell text into multiple lines instead of scrolling (the actual bug: `<table className="w-full">` inside an `overflow-x-auto` wrapper can never exceed its container, so it never triggers scroll — needed an explicit `min-w-[Npx]` on the table itself), fixed several flexbox `min-width: auto` gotchas (`<main>`, financial-card inputs, the Ask AI input beside its Send button), and moved a KPI-grid breakpoint that collided with the sidebar's own breakpoint at exactly 768px.

The user pushed back with real Chrome DevTools screenshots at ~628px proving genuine breakage the first pass missed: a currency value overflowing its card, and table text still wrapping into three lines. This was the right call — my own testing had only sampled 375/768/1024/1920px and missed the 320–650px range entirely. Root-caused with live measurement (`scrollWidth − clientWidth` on the actual scroll container, bisection via hiding sections one at a time) rather than eyeballing more screenshots. Two of my own "fixes" during this made things briefly worse before landing correctly: a truncate-only attempt on the Needs My Attention row shrank the project name to near-zero width while badges stayed full-size (caught by re-screenshotting after the fix, not before shipping it), and an `items-start` on the redesigned stacked layout blocked `min-w-0`/`truncate` from working at all, increasing overflow rather than fixing it (caught by inspecting `getBoundingClientRect()` directly). Final state re-verified clean across the full 320–1920px range.

## Extended the page-header convention everywhere

A new shared `PageHeader` component replaced ad-hoc header markup on every page that didn't already have the Dashboard's boxed-header treatment — Projects, Customers, Suppliers, Users, Payments, Profile, Ask AI, and the Customer/Supplier/Project detail and New Project pages, each with page-appropriate width/padding.

## Brief re-read caught a real gap: Header didn't match Header

The brief specifies the Project Detail page's Header as "Project Name, Status, Owner, Next Action, Due Date" — literally all five together. The actual header only had Project Name and Status; Owner/Next Action/Due Date lived in a separate "Project Overview" card below. Fixed by moving those three fields into the header block itself and restructuring what's left below into a leaner Project Overview (Last Update + Description), per later feedback redone again as a single row (heading left, Last Update right) rather than a tall stacked card.

## AI: two real bugs found during a full-capability re-check

1. **Over-broad "Grounded on" citations.** The citation list included every project any tool call had fetched during the conversation, not just the ones the model's final answer actually named — asking "which customer has the highest revenue" cited all 6 fetched projects when the answer only discussed 2. Fixed by filtering citations to project names present in the final answer text.
2. **Tool-budget exhaustion on the page's own canned suggestion.** "What needs my attention today?" — one of the four example prompts shown on the Ask AI page — failed with a generic apology because the model called `list_projects` once per status (5 calls) and ran out of the 3-round tool-call budget before answering, even though a single unfiltered call already returns every project's attention flags. Fixed by raising the budget to 6 rounds, clarifying the tool description to discourage the redundant per-status calls, and adding a forced-synthesis fallback pass so a chatty round-trip degrades to a best-effort answer instead of a hard failure.

Verified all four required AI capabilities (Daily Brief, natural-language query, drafting, human approval) live across every entry point (Dashboard, the Projects-page widget, the per-project "Ask about this project" mini-widget, the dedicated Ask AI page) and confirmed the RBAC-safe citation/query behavior.

## Backend hardening: architecture, data integrity, and two new business rules

- Added missing indexes on every foreign-key column (`Project.customerId/supplierId/ownerId/status`, `Expense.projectId`, `Activity.projectId/userId`) — Postgres doesn't auto-index these the way MySQL does, and `Activity.projectId` in particular is queried on every project-detail page load.
- **Profit margin suppression:** a fresh RFQ defaults to $0 cost, and the formula was dividing by revenue regardless, showing e.g. "100% margin" for a deal nobody had costed out yet — read as wildly profitable rather than "not started." Fixed by withholding the margin (returning `null`) until a real cost figure exists; this also corrected the Dashboard's Margin Health widget, which had been silently counting every uncosted RFQ as maximally healthy.
- **Closed projects locked to Admin-only edits.** Nothing previously stopped Sales/Procurement from editing, paying, or expensing a Closed project. Now enforced server-side (403, verified via a direct API call, not just a hidden button) — Admin retains access for exceptional corrections, still logged to the Activity Timeline like any other edit.
- **A real UX gap fixed: inline "Assign Supplier."** Procurement/Admin previously had no way to assign a supplier without entering full Edit mode. Added a dedicated action directly in the Supplier/Cost card.
- **Estimated Revenue must be a real number > 0** at project creation (a blank or $0 ask isn't a real RFQ), and **assigning a supplier for the first time now requires a real Estimated Cost > 0** entered in the same step — both enforced client- and server-side. The existing workflow-transition gate (can't advance to Ordered without cost) is unchanged and still fires as a second safety net.

## Deliverables

A technical evaluation report (`docs/Evaluation_Report.docx`) mapped section-by-section to the coding test's five grading criteria, each backed by a build/typecheck result, a live-tested behavior, or a specific bug found and fixed — not assertion. A full README rewrite: accurate stack/structure, a Prerequisites section, demo accounts, and a bulleted core-workflow walkthrough (RFQ → Quote → Order → Ship, Shipment Hold, role-based access, all four AI capabilities) satisfying the brief's "video or bulleted list" submission requirement.

## Verified live, not just via code review

Every item above that touches user-visible behavior was clicked through in a real browser session as the relevant role(s) — including two cases where "verified" first meant discovering my own automation was giving a false signal (an unresponsive-looking Ask AI button that was actually a `form_input` React-state-sync artifact, not a real bug; and a "Payables Due doesn't update" report that turned out to be a stale cache from my own `history.pushState` navigation shortcut, not a real invalidation bug — both confirmed by redoing the exact same test with genuine clicks only). Backend and frontend typecheck/build clean throughout.
