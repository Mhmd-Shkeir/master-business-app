# SEQA Security Hardening — Phase 1

## Scope

This branch introduces the first set of security improvements for the Master Business App, without changing the documented business workflows or the existing API route paths.

### Changes
- JWTs now carry an account identifier plus `sessionVersion`. The backend verifies the HMAC algorithm and consults the database on each authenticated request to obtain **current** role information. Deleted accounts and invalidated sessions are rejected.
- Changing a password increments `User.sessionVersion`, invalidates all old sessions, and returns a replacement JWT to preserve the current session in the browser.
- JWT signing keys must contain at least 32 characters (a random value is still required).
- Allowed browser origins are explicitly configured by `CORS_ORIGINS`; production requires this environment variable.
- The public health endpoint stops exposing database connection exception text.
- Demo data seeding is prohibited when `NODE_ENV=production`. Demo-account helper UI appears only in development builds.
- Added isolated authentication unit tests.

### Migration and deployment order

1. Back up the database.
2. Generate a random `JWT_SECRET` (for example: `openssl rand -hex 32`), and set `CORS_ORIGINS` to the production frontend's exact HTTPS origin(s).
3. Deploy the database migration `20261019070000_session_version` **before** starting the updated backend; generate the Prisma client from the updated schema.
4. Deploy backend and frontend together. All older JWTs are deliberately invalidated; users sign in once again.
5. Verify: login, role restrictions, password change, subsequent authenticated calls, deletion/revocation, blocked origins, and health endpoint behavior.

### Tests

```bash
cd backend
npm ci
npx prisma generate
npm test
npm run build
```

Then run `npm ci && npm run build` from `frontend/`.

**Status:** tests have been authored but were not executed in the current review environment. Do not merge without running builds and tests against the target Node version and a test PostgreSQL database.

### Findings that remain open

1. Financial payment and stage-transition operations read data before their write transactions; concurrent requests can cause lost updates or invalid state transitions. Use transactional isolation with retries or conditional atomic updates and add concurrency integration tests.
2. Login has no request-rate limiting / abuse prevention. Use a maintained rate-limiter with proxy-aware settings and shared storage when deployed behind multiple instances.
3. Browser JWT storage remains localStorage; a future session redesign may use Secure/HttpOnly/SameSite cookies with appropriate CSRF controls.
4. Demo accounts previously installed in a production database are **not** removed by blocking future seeding. Change their passwords or delete them as appropriate.
5. The AI activity redaction relies on regular-expression keyword matching. Consider explicit sensitivity categories and centrally enforced field-level authorization.
6. Add continuous security dependency scanning, CI checks, and end-to-end role-by-role tests.

## Relation to SEQA deliverables

Document the as-is architecture and as-is ERD against the `main` branch baseline; document proposed improvements against the stabilized and merged secure implementation. Activity diagrams must include failed authorization, invalid state transitions and rejected payments. UI/UX work should include authentication error, password rotation, form validation and accessible responsive layouts.
