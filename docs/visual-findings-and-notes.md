# Visual findings and notes for later

Date: 18 Nov 2026. Branch `fix/visual-layout` (from main). The design is unchanged; only layout and accessibility were corrected.

## Findings (visual bugs) - fixed on the branch

| ID | Bug | Where | Cause | Fix |
|---|---|---|---|---|
| V1 | Content stretches edge to edge on wide screens and when zoomed out (60-67%). List pages were about 2600 px wide at 2860 px, while detail pages stayed 576-896 px, so pages looked inconsistent. | Dashboard, Projects, Customers, Suppliers, Payments, Users | List pages used `w-full` with no maximum width | One shared container in `Layout.tsx`: `mx-auto w-full max-w-[1600px]` |
| V2 | Footer also stretched across the whole screen and did not line up with the page content. | Footer | Footer had no maximum width | Same `max-w-[1600px]` centred container |
| V3 | At tablet width (about 800 px) the full 256 px sidebar left too little room, so tables and cards were cramped. | Sidebar | Sidebar always started expanded | Sidebar starts as the icon rail at 768-1023 px; the user can still expand it |
| V4 | The date in the dashboard header and the items in the Needs My Attention card broke in the middle of a phrase when space was tight. | Dashboard | Text could wrap anywhere | `whitespace-nowrap` on the date and on each attention item (items still wrap as a whole) |
| V5 | No visible keyboard focus on links and buttons. | All pages | No focus style defined | Global `:focus-visible` outline in `index.css` |
| V6 | Animations ignored the system "reduce motion" setting. | All pages | No reduced-motion rule | `prefers-reduced-motion` rule in `index.css` |

Checked: at 2860 px every page content is capped at 1600 px; at 800 px the sidebar is the icon rail and nothing overflows sideways; earlier checks at 390 px showed no overflow. `tsc -b` and `npm run build` pass.

## Notes for adding later (not visual, not done now)

- Login page shows "Invalid email or password" also for the rate-limit answer (429). Show the "Too many attempts" message (F1).
- "Move to CLOSED" is shown to Procurement although the server refuses it (F2). Hide it for that role.
- Projects table has no sorting (D4 said "sorting"). Add column sorting or change the diagram.
- A role that opens a forbidden page is sent back to the Dashboard without a message. Add a short "no access" notice.
- Backend checks to add: trim spaces-only names and categories (B1, B7); check that customer and supplier exist before saving (B3, B4); atomic customer delete (B2); no 500 for unknown project in dismiss-overdue (B8); fallback text when the AI provider fails (B9); hide `shipmentHoldOverridden` in the status response for Procurement (B5); decide on direct edit of paid amounts (B6).
- Larger design ideas for later: a language pack for non-technical users, a login-first flow, and a mobile card layout for the wide tables (they scroll sideways at 390 px).
- Vercel: add an Ignored Build Step to avoid hitting the deployment limit again.
