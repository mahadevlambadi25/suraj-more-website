# Security

Audit performed 6 Nov 2026 against the current codebase. ✅ = implemented and tested · ⚠ = needs action outside the code.

| Area | Status | Controls |
|---|---|---|
| Authentication | ✅ | scrypt (N=2^15) password hashing; random 256-bit session tokens stored as SHA-256; HttpOnly + Secure + SameSite=Strict cookie, `__Host-` prefix in production; 12 h absolute and 2 h idle expiry; logout deletes the session; same error for wrong email or password; timing equalised with a dummy hash; deactivating an admin kills their sessions. No hard-coded credentials; admins are created via CLI from env vars. |
| Brute force | ✅ | DB-backed limits: 5 attempts per email and 20 per IP per 15 min; attempts audited. |
| Authorization | ✅ | Middleware only checks cookie presence. **Every** dashboard page re-validates the session in the DB; every server action and the CSV route call `requireAdminAction(role)`; every admin service function calls `assertRole` again (tested with VIEWER/unauthenticated actors). |
| CSRF | ✅ | Admin mutations are Next.js server actions (Origin/Host check; a cross-origin forgery was tested and rejected). Session cookie is SameSite=Strict. Public forms are JSON POSTs with no ambient authority. |
| Input validation | ✅ | zod schemas shared by browser and server; UUID checks on ids; lengths capped; cohort/settings forms validated (https-only URLs). |
| SQL injection | ✅ | Prisma parameterised queries only. The only raw SQL is static (`SELECT 1`; test TRUNCATE). |
| XSS | ✅ | React escaping; no `dangerouslySetInnerHTML` except JSON-LD (escaped `<`); CSP restricts script/frame/connect origins. |
| CSV export | ✅ | ADMIN only, audited, formula-injection guarded. |
| Webhooks | ✅ | HMAC verified on the raw body with constant-time comparison; mock mode rejects real webhooks; idempotency key unique; payment re-verified with the Cashfree API; unverified events cannot be processed. |
| Payment integrity | ✅ | Server-side pricing in paise; amount and currency validated; compare-and-set transitions; no manual "mark paid"; refunds deduplicated; live mode locked behind an explicit flag. |
| Sensitive data | ✅ | Secrets only in server env; client bundles scanned (no secret, DB URL, Zoom field or password hash found); Zoom links never in public APIs or the integration ledger; Prisma query logging off outside dev; `safeError` redacts secrets from stored and logged errors; IPs stored only as salted hashes; free-text mentorship answers are never sent to analytics. |
| Data access | ✅ | Single-tenant. Public order status needs the unguessable order number and returns masked email and no delivery links. |
| Rate limiting | ✅ | Public forms: 6 per minute per IP (DB-backed), honeypot plus minimum fill time. |
| Headers | ✅ | CSP, HSTS (2 years, preload), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy; `/ops` also sends noindex + no-store. |
| Audit logging | ✅ | Logins, failures, logout, lead status, cohort create/update (changed fields), refunds, webhook retries, decisions, settings, admin activation, CSV exports, legacy imports. |
| Error handling | ✅ | Generic messages to users; ops alerts; `/api/health`; error boundary page. |
| Error monitoring | ⚠ | Add Sentry (or similar) and wire it to `app/error.tsx` and `alertOps`. |
| Backups | ⚠ | Enable Neon PITR plus scheduled `pg_dump`; test a restore. |
| Dependency updates | ⚠ | Enable Dependabot/Renovate; `npm audit` in CI. |
| 2FA for admins | ⚠ | Not implemented. Recommended before granting more than a few admins (e.g. TOTP). |

## Secrets handling

- `.env`, `.env.local`, `.data/`, `.pgdata/` and `backups/` are git-ignored. `backups/` contains personal data from the legacy store; keep it off shared drives and delete it when no longer needed.
- Rotate `CASHFREE_SECRET_KEY` if it is ever exposed (Cashfree dashboard), update Vercel, redeploy. Webhook signatures follow automatically.
- Rotate `HASH_SALT` only between audits (it changes IP hashes).
