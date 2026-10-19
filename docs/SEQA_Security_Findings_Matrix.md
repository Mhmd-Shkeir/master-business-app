# SEQA – Security Findings Remediation Matrix

Source: screenshots of the 12 findings marked **Open** on 2026-10-19. Screenshot file paths are partly truncated and do **not** contain descriptions, attack paths, reproduction instructions or scanner IDs. This matrix maps each row to the closest confirmed code path; the actual scanner must be rerun on the patch before any finding can be marked closed.

| ID | Severity | Screenshot finding | Identified attack surface | Patch/verification |
|---|---|---|---|---|
| S01 | High | Sensitive data exposure CWE-200 | `backend/src/modules/ai/ai.routes.ts` confirm-note endpoint returned raw financial data through `recordNote` | Return a minimal success receipt, enforce closed-project permissions in a serializable transaction; `security-findings.test.ts` |
| S02 | Medium | Broken auth CWE-613 | `backend/src/middleware/auth.ts` sessions persisted despite logout | Phase 1 sessionVersion and revocation; Phase 3 server-side logout endpoint increments version; frontend awaits logout |
| S03 | Medium | Broken auth CWE-187 | `backend/src/modules/auth/auth.routes.ts` sign-in credential handling | Normalize email identities, same generic failure message, bcrypt dummy check and rate limiting. Scanner's exact CWE-187 evidence still needed |
| S04 | Medium | Sensitive data exposure CWE-209 | `backend/src/modules/projects/projects.service.ts` role-dependent error text | Phase 2 avoids showing customer outstanding amount to Procurement and handles concurrency failures generically |
| S05 | Low | Information disclosure CWE-209 | `backend/src/app.ts` health endpoint | Phase 1 prevents database error details reaching API clients; global handler sends generic errors |
| S06 | Low | Sensitive data exposure CWE-200 | `backend/src/lib/rbac.ts` activity redaction | Phase 3 replaces keyword blacklist with fail-closed allowlisting for non-admin roles, retaining user's own comments |
| S07 | Low | Sensitive data exposure CWE-200 | `backend/src/modules/ai/ai.service.ts` AI context | Uses the same fail-closed redaction in daily/project/email AI workflows and returns role-filtered finance |
| S08 | Low | Authorization bypass CWE-367 | `backend/src/modules/projects/projects.service.ts` status / payment race | Phase 2 serializable transactions with bounded P2034 retry; PostgreSQL concurrency integration tests |
| S09 | Low | Other CWE-362 | `backend/src/modules/projects/projects.service.ts` lost payment updates | Phase 2 transactional `increment` and state checks; database integration tests |
| S10 | Low | Sensitive data exposure CWE-524 | `frontend/src/pages/AskAIPage.tsx` | Phase 3 removes persistent chat history, deletes prior localStorage copies, retains conversations in page memory |
| S11 | Low | Injection CWE-1236 | `frontend/src/pages/ProjectsPage.tsx` CSV export | Phase 3 escapes potentially executable spreadsheet formulas before quoting text |
| S12 | Low | Sensitive data exposure CWE-524 | `frontend/src/pages/ProjectsPage.tsx` browser/export storage | API sets no-store/private headers; auth token uses sessionStorage; export requires explicit confirmation/warns user. Exported files are intentionally saved on user devices and must be handled securely |

## Quality gate
- Code patches and associated regression tests are on `seqa/security-findings-phase-3`.
- GitHub Actions runs backend tests, a disposable PostgreSQL integration test suite, and backend/frontend builds.
- Security scanner findings must be compared **by their exact IDs**, since CWE categories alone are insufficient to prove a specific finding closed.
- Re-run scanner against the patched branch after merging the dependent Phase 1/2 PRs. Confirm each S01–S12 issue is closed or documented as a verified false positive, with a screenshot/report as evidence.
- This checklist is **not** a penetration-test certification.

## Remaining security work
- The per-IP/email login limiter is in-memory and therefore instance-local. For horizontal deployment, use a shared Redis-backed rate limiter (and correctly configure reverse-proxy trust).
- Access tokens are in tab-scoped `sessionStorage`: this reduces durable persistence but does not eliminate XSS-based token theft. For a production internet-facing deployment, migrate to Secure, HttpOnly, SameSite cookies and CSRF protection.
- Free-text historical activity in non-admin timelines is intentionally suppressed unless safe; a longer-term improvement is structured sensitivity metadata and migrations.
- The user's security-scanner report details are needed to verify whether some CWE classifications refer to other specific data paths.
