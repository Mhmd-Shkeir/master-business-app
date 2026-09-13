# Demo Workflow — Bulleted List

Companion to the demo video, per the brief's submission requirement: *"Provide a short video (2-3 minutes) or a bulleted list demonstrating the core workflow (Create RFQ → Quote → Order → Ship) and the AI functionality."* Follows this exact sequence in the running app at `http://localhost:5173`, using the seeded demo accounts (`password123` for all three — see the [README](../README.md#demo-accounts)).

## 1. Core workflow: Create RFQ → Quote → Order → Ship → Close

- Sign in as **Admin** (`admin@demo.com`) or **Sales** (`sales@demo.com`).
- Click **+ New Project** on the Dashboard. Fill in a Project Name, pick a Customer, and enter a real Estimated Revenue (must be greater than 0 — a blank or $0 ask is rejected).
- The project is created in **RFQ** status, with no supplier or cost yet — by design, since neither is known at the initial customer-request stage.
- Sign in as **Procurement** (`procurement@demo.com`) (or stay as Admin). Open the project and use **Assign Supplier** in the Supplier/Cost card — pick a supplier and enter its Estimated Cost together in one step (also required to be greater than 0).
- Click **Move to QUOTED**. This is blocked server-side if revenue isn't set — it already is, so it succeeds.
- Click **Move to ORDERED**. This is blocked if there's no supplier or no cost — already satisfied, so it succeeds.
- Click **Move to SHIPPING**.
- At this point, try **Move to CLOSED** while the customer still owes money — it's blocked (409) with a message explaining the outstanding balance, demonstrating the Shipment Hold business rule.
- Go to the **Payments** page (or the project's Financial Overview) and record a customer payment covering the full balance.
- Return to the project and click **Move to CLOSED** — it now succeeds.
- **Alternative path** (Admin only): instead of paying it off, use the project's hold-override action — enter a reason, confirm, and the project closes immediately with the override logged to the Activity Timeline (admin name, timestamp, and reason).
- Note throughout: backward transitions are always rejected for every role; only Admin can skip stages forward, and the same revenue/cost requirements still apply even to a skip.

## 2. Role-based access control

- While still signed in as **Sales**, open any project: revenue, customer balance, and status are visible; supplier cost, profit margin, and the Payables Due card are not shown at all.
- Sign out, sign in as **Procurement**: the reverse is true — supplier cost and payables are visible, customer revenue and profit margin are not.
- Sign in as **Admin**: everything is visible, including the Admin-only Net Cash Flow figure on the Dashboard and the hold-override action.
- On a Closed project, sign in as Sales or Procurement and confirm the **Edit** button and Record Payment/Add Expense actions are gone — only Admin can still modify a Closed project (enforced server-side, not just hidden).

## 3. AI functionality — "Ask My Business"

- **Daily Brief**: on the Dashboard, click **Generate**. A short, grounded summary appears referencing real flagged projects by name. Click **View details →** to open the side drawer showing the full brief plus a structured Overdue / Missing Next Action / Payment & Supplier Risk breakdown.
- **Natural-language queries** — try any of these from the Ask AI page, the widget on the Projects page, or "Ask about this project" on a project's detail page:
  - *"What needs my attention today?"*
  - *"Which projects are overdue?"*
  - *"What's the outstanding balance on this project?"*
  - As Sales, try asking about profit margin or supplier cost — the assistant explains that information isn't available to your role instead of guessing or fabricating a number.
- **Drafting + Human Approval**: open a project and click **Draft Follow-up Email**. The AI generates a subject and body grounded in that project's real data (customer name, balance, status). Edit the text, then click **Edit and Confirm** — only now is anything recorded, to the project's Activity Timeline. Click **Discard** instead on a different attempt to confirm nothing is recorded that way.

## 4. Bonus: in-app overdue notifications

- Click the bell icon (top of the sidebar). If any project is overdue, a red count badge appears; the dropdown lists each one.
- Click a listed project — it navigates straight to that project's detail page, and the notification is now permanently dismissed for your account (reload the page or sign out and back in to confirm it doesn't reappear).
