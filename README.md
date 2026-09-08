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
