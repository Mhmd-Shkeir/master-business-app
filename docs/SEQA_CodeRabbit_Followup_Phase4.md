# SEQA Phase 4 — CodeRabbit follow-up security scan

The supplied CodeRabbit report (generated 2026-10-19 at 10:50) identifies six findings (one Medium, five Low). These findings were detected **before** this Phase 4 patch; the report cannot establish their status after remediation.

| CWE | Report location | Implemented remediation | Acceptance verification |
|---|---|---|---|
| CWE-307 | backend/src/middleware/login-rate-limit.ts | Reject over-budget IPs before allocating account keys; never evict active counters under capacity pressure | limiter-capacity.test.ts; single-instance load test; repeat security scan |
| CWE-200 | backend/src/modules/ai/ai.service.ts | Hide customer name/contact in Procurement drafting context; add authorized supplier contact and supplier-facing prompt | ai-email-contact.test.ts; inspect model payload role by role |
| CWE-200 | backend/src/modules/projects/projects.routes.ts | Hide debt-derived shipmentHoldOverridden unless canSeeRevenue(role) | security-responses.test.ts for Sales and Procurement |
| CWE-200 | backend/src/modules/projects/projects.service.ts | Reject Procurement CLOSED transitions before evaluating financial balance | financial-integrity.test.ts checks authorization before DB read |
| CWE-367 | backend/src/modules/suppliers/suppliers.routes.ts | Change supplier FK to ON DELETE RESTRICT, map FK violations to HTTP 409, never allow implicit project detachment | Prisma migration + PostgreSQL integration test |
| CWE-524 | frontend/src/hooks/useProjects.ts | Cancel/clear React Query cached queries and mutations upon login, logout, profile/session changes and scope read keys by account ID/role (also users/notifications) | frontend build and manual same-tab Admin→Procurement switch, no stale financials or activity |

## Deployment and test notes

**Database migration:** Deploy `20261019090000_restrict_supplier_deletion` against the target database before updating the API service. Back up the database first.

```bash
npm ci --prefix backend
cd backend
npx prisma generate
npx prisma migrate deploy
RUN_DB_INTEGRATION_TESTS=1 npm test
npm run build
cd ../frontend
npm ci
npm run build
```

Concurrency tests must run with a disposable test PostgreSQL database, **never production**.

The login limiter remains **in-memory and single-process only**. A production deployment with multiple Node replicas or serverless instances needs shared atomic rate-limit storage (such as Redis) in addition to this fix.

Sensitive data in React Query is now scoped to the signed-in user and role. Manual account-switch testing remains essential; a successful build does not prove absence of the CWE-524 issue.

**Status:** Code fixes and regression tests in this branch; **do not mark scanner findings Closed** until retested against the new branch.
