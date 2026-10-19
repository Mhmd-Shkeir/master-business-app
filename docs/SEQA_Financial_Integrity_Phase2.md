# SEQA — Financial Integrity and Concurrency (Phase 2)

## Background and objective

The legacy code checked payment limits and project status **outside** the write transaction. Two overlapping requests could read the same old balance or status, then both submit updates. In particular, assigning an absolute `customerPaid = currentPaid + amount` could lose a payment, and two valid-looking payments could exceed the remaining balance.

The updated implementation performs the read, business-rule validation, database mutation, and Activity audit insertion within a single Prisma interactive transaction at PostgreSQL `SERIALIZABLE` isolation. The P2034 conflict path retries the **whole transaction** (including its validations) up to five times with bounded backoff. Only the committed result is returned.

## Measurable acceptance requirements

| ID | Requirement | Verification |
| --- | --- | --- |
| FI-01 | At most one of two concurrent 60.00 customer payments can commit when the outstanding balance is 100.00. The other must be rejected without a payment or audit entry. | `financial-concurrency.integration.test.ts` |
| FI-02 | The system never commits a CLOSED status for a project with an outstanding customer balance, even when a payment arrives concurrently. | `financial-concurrency.integration.test.ts` |
| FI-03 | Two simultaneous transitions from RFQ to QUOTED must not both succeed or write duplicate transition audits. | `financial-concurrency.integration.test.ts` |
| FI-04 | The system obtains editable/closed status inside the same transaction that modifies the data. | `financial-integrity.test.ts` |
| FI-05 | A Procurement user must not receive an exact customer balance in a shipment-hold error. | `financial-integrity.test.ts` |
| FI-06 | Payment and expense inputs must be positive with no more than two decimal places. | `financial-integrity.test.ts` |
| FI-07 | Serialization failures must cause a bounded full-transaction retry; unrelated failures must not be retried. | `transaction.test.ts` |

## Design notes

- Business operations covered: `recordPayment`, `transitionProjectStatus`, `overrideShipmentHold`, `updateProject`, and `addExpense`.
- `recordPayment` uses Prisma's `increment` operation, not a stale read-modify-write assignment.
- Status and outstanding-balance decisions are made from a coherent transaction snapshot.
- New payment and expense audits are created in the same transaction as the state mutation.
- An exhausted P2034 conflict returns a retryable HTTP 409 instead of a generic HTTP 500.
- The implementation continues the existing role model (Admin, Sales, Procurement) and does not change the stage names (RFQ, Quoted, Ordered, Shipping, Closed).

## Test environment and procedure

Automated tests run in GitHub Actions using Node 22. The workflow launches an **ephemeral PostgreSQL 16 service** with disposable test credentials, runs the existing Prisma migrations, then executes Vitest plus backend/frontend builds. Integration tests are gated by `RUN_DB_INTEGRATION_TESTS=1` and must *never* be run against production data.

To reproduce locally with a dedicated database:

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
RUN_DB_INTEGRATION_TESTS=1 npm test
npm run build
cd ../frontend
npm ci
npm run build
```

Use a **dedicated disposable PostgreSQL database** in `DATABASE_URL`/`DIRECT_DATABASE_URL` for all integration tests. Do not run migrations or tests against an existing deployment without backups and approval.

## Residual issues and next sprints

1. The general financial editing endpoint permits correction of customerPaid and supplierPaid by authorized roles. These direct adjustments should be governed by a clearly defined correction and approval policy.
2. Currency can currently be changed without converting existing values. The team should decide whether currency is immutable after project creation or requires an explicit audited conversion workflow.
3. The Activity message field mixes sensitive monetary data and free text, complicating reliable role-based redaction. Replace the regex heuristic with structured events and visibility metadata.
4. Login throttling, session storage, and request limits for AI endpoints remain separate security-hardening tasks.
5. UI/UX and Activity Diagrams should cover payment rejection, role denial, serializable conflict (409), shipment hold, and the authorized Admin override.

## Relationship to the course

This implements the lecture's distinction between unit, integration, and system testing, documents traceable acceptance requirements, and automates repeatable checks with CI/CD. Test results must be captured from the actual GitHub Actions run and must never be inferred from a passing frontend deployment.
