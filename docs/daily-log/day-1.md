# Day 1 — 2026-09-08

- Sent clarification email to Ibrahim (deadline discrepancy, Admin workflow-skip question).
- Decided final stack: React + Vite + TS + Tailwind + shadcn/ui (frontend), Node + Express + TS (backend), Prisma + PostgreSQL on Neon, JWT auth, OpenAI SDK against Groq for AI.
- Scaffolded repo: `backend/` (Express + TS + Prisma schema) and `frontend/` (Vite + React + TS).
- Drafted initial Prisma schema: User, Customer, Supplier, Project, Financial, Expense, Activity.
- Wrote seed script with deterministic demo data covering each dashboard scenario (overdue, missing next action, low margin, blocked shipment, closeable shipment, closed project).
- Wired up Neon connection, ran first migration, confirmed `/api/health` reaches the DB. Seeded demo data (3 users, 3 customers, 2 suppliers, 6 projects) — verified end-to-end.
- Ibrahim replied to the clarification email: **Admin can skip workflow stages directly; Sales/Procurement must follow the strict linear progression** (`RFQ → Quoted → Ordered → Shipping → Closed`, one step at a time). He agreed with everything else (deadline note, assumption-and-document approach, dashboard layout with AI side panel). This is now the spec for the Day 2 status-transition endpoint.
