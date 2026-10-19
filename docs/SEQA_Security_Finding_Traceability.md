# SEQA Security Finding Traceability (Pre-Remediation Baseline)

**Source:** two user-provided screenshots of an earlier security scan of `master-business-app`, dated before SEQA refactoring. The screenshots identify CWE, severity and truncated file locations, but do **not** show the scanner's full finding descriptions, rule identifiers, reproduction steps, or scanner run ID.

**Important:** All 12 findings were marked **Open in the ORIGINAL scan**. The status shown there is not a measurement of our later changes. Findings below are **mapped to proposed remediation**, not declared closed in the scanner until a fresh scan/review confirms the exact condition was eliminated.

| # | Original CWE / Severity | Screenshot location | Remediation in review branches | Revalidation |
|---|---|---|---|---|
| SEC-01 | CWE-200 / High | `backend/src/modules/ai/ai.routes.ts:64...` | Phase 3: confirmed AI notes return `{success:true}` only, never the raw project model. `recordNote()` returns no secret fields; frontend consumes acknowledgement. | Authenticated Sales/Procurement POST must not include `Financial`, `Expense`, user passwords, or raw Prisma fields; regression test. |
| SEC-02 | CWE-613 / Medium | `backend/src/middleware/auth.ts:27` | Phases 1 & 3: DB-checked session versions and current roles, password-change/logout revocation, restricted JWT algorithm and 1-hour expiration. | Deleted user, old JWT after logout/password change, role downgrade and expired token must be rejected. |
| SEC-03 | CWE-287 / Medium | `backend/src/modules/auth/auth.routes.ts...` | Phase 3: generic authentication failure, constant bcrypt comparison for missing accounts, per-IP/per-email sign-in throttling. | Verify 401 responses do not reveal existing accounts and repeated attempts yield 429. **Current in-memory throttling needs a shared datastore when scaled beyond one Node process.** |
| SEC-04 | CWE-209 / Medium | `backend/src/modules/projects/projects...` | Phase 2: confidential customer balances removed from Procurement's status-transition error; other errors use bounded business responses. | Procurement attempts to close unpaid order get generic error with no monetary values. |
| SEC-05 | CWE-209 / Low | `backend/src/app.ts:24` | Phase 1: health-check DB errors are masked; generic global HTTP error handler. | Force DB failure; HTTP response must not contain connection strings or exception text. |
| SEC-06 | CWE-200 / Low | `backend/src/lib/rbac.ts:194` | Phase 3: activity visibility fails closed for non-admins; only known-safe system messages and the user's own comments are allowed. | Add sensitive text without keywords, check it does not leak to unauthorized roles; test system messages. |
| SEC-07 | CWE-200 / Low | `backend/src/modules/ai/ai.service.ts...` | Phases 1/3: role-filtered structured financial data, restricted activity context, limited AI request sizes and no raw AI-note model response. | Role-by-role AI-output tests including arbitrary sensitive activity notes, plus manual prompt-injection tests. |
| SEC-08 | CWE-367 / Low | `backend/src/modules/projects/projects...` | Phase 2: serializable transaction reads and writes for stage changes, edits and hold overrides, with conflict retries. | Real PostgreSQL concurrency tests exercise stage-change races. |
| SEC-09 | CWE-362 / Low | `backend/src/modules/projects/projects...` | Phase 2: atomic payment increments, balance revalidation in a serializable transaction, conflict retries. | Concurrent payments must not lose updates or exceed outstanding balance; integration tests. |
| SEC-10 | CWE-524 / Low | `frontend/src/pages/AskAIPage.tsx:54` | Phase 3: chat stored in component memory, old browser-persisted chat keys removed. | Reload browser; AI conversations no longer reappear from persistent local storage. |
| SEC-11 | CWE-1236 / Low | `frontend/src/pages/ProjectsPage.ts...` | Phase 3: neutralize formula-like CSV values before quoting, protect against spreadsheet formula execution. | Export names beginning with `=`, `+`, `-`, `@`, control/whitespace prefixes and verify spreadsheet interpretation. |
| SEC-12 | CWE-524 / Low | `frontend/src/pages/ProjectsPage.ts...` | Phase 3: browser/API no-store headers and explicit sensitive-data export confirmation. | Confirm cached API results are not stored by caches. CSV files deliberately downloaded to the user's disk **remain the user's responsibility** and cannot be revoked from the server. |

## Acceptance workflow

1. Run the SEQA GitHub Actions workflow (backend unit tests, PostgreSQL concurrency suite, frontend/backend builds).
2. Re-run the **same security scanner and ruleset** against the remediation branch, then against the final deployment.
3. Match findings by scanner IDs/path/line and verify whether each is closed, moved, or remains open; a finding can move after refactoring.
4. Manually verify remaining exposure across all three roles (Admin, Sales, Procurement), including API responses, cached state, downloads, and third-party AI provider data.
5. Record evidence (test output, commit SHA, scanner output), actual severity and final state in Azure DevOps.

## Deployment and residual risks

- Phase 1 introduces the `sessionVersion` migration; deploy it before the new backend. Old JWTs are intentionally invalidated.
- The frontend uses tab-scoped `sessionStorage` rather than persistent `localStorage`; that does **not** protect a token from JavaScript running in the page after an XSS compromise. A future HttpOnly/SameSite cookie flow with CSRF protections is stronger.
- Per-email/IP rate limiting is currently **process-local** and should be moved to Redis or another shared atomic store if multiple backend instances serve login requests.
- Existing activity messages are arbitrary free text; restricted-role filtering intentionally prefers underexposure to accidental leakage. A future typed-sensitivity field and migration would improve both correctness and transparency.
- The AI provider receives authorized role-filtered data; its data-handling and prompt-injection boundaries require independent review.
- A downloaded CSV can remain on disk and be redistributed after logout. No application-level cache header can revoke an already-downloaded file.

No assertion of scanner closure should be made based solely on this document or on old screenshots.
