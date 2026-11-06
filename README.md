# Suraj More — Website

Premium personal-brand site for Suraj More (Premium Sales Coach), built from *Suraj More Website: Project Requirements* (Developer Brief v1.0).

**Stack:** Next.js 15 (App Router) · TypeScript · PostgreSQL + Prisma 6 · Cashfree PG (API 2023-08-01) · Vercel.

| Doc | What's inside |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, request flows, where business logic lives |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, Neon setup, migrations, backup & restore, legacy import |
| [docs/ADMIN_DASHBOARD.md](docs/ADMIN_DASHBOARD.md) | Admin accounts, roles, every dashboard module |
| [docs/PAYMENTS.md](docs/PAYMENTS.md) | Cashfree sandbox setup, webhook flow, refunds, failure handling |
| [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) | Deploy, environment variables, rollback |
| [docs/SECURITY.md](docs/SECURITY.md) | Security audit and controls |
| [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) | Everything required before live payments |

---

## 1. Architecture (short)

```
Browser ──► Next.js pages (SSG/ISR, 5-min revalidate)        public site, unchanged design
        ──► /api/* route handlers ──► src/lib/* services ──► Prisma ──► PostgreSQL
Cashfree ─► /api/webhooks/cashfree (HMAC verified) ─► orders.ts state machine
Admin ────► /ops (session cookie) ─► server actions ─► src/lib/admin/commands.ts (role check + audit)
```
UI components contain no business logic. Domain logic lives in `src/lib/` (`orders.ts`, `forms.ts`, `cohorts.ts`, `admin/*`). Details: [ARCHITECTURE](docs/ARCHITECTURE.md).

## 2. Local installation

Requirements: Node 20+ (tested on 24), npm 10+.

```bash
npm install
cp .env.example .env.local          # app settings (CASHFREE_MODE=mock works without keys)
# Prisma CLI reads .env — put DATABASE_URL and DIRECT_URL there too (see .env.example)

npm run db:local                    # terminal 1: disposable local Postgres on :5433 (dev/test only)
npm run db:deploy                   # apply migrations
npm run db:seed                     # sample cohort (dev only; hidden in production)
ADMIN_EMAIL=you@x.com ADMIN_NAME="You" ADMIN_PASSWORD='a-long-unique-pass-1' npm run admin:create
npm run dev                         # http://localhost:3000   ·   dashboard: /ops
```
To use your own Postgres or a Neon dev branch instead of `db:local`, point `DATABASE_URL`/`DIRECT_URL` at it.

## 3. Environment variables

Full annotated list: [.env.example](.env.example). Required in every deployed environment:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres URL (Neon `-pooler` host) used by the app |
| `DIRECT_URL` | Direct Postgres URL used only by `prisma migrate` |
| `NEXT_PUBLIC_SITE_URL` | Public https URL (Cashfree return/notify URLs are built from it) |
| `CASHFREE_MODE` | `sandbox` until launch. `mock` is refused on Vercel; `production` is locked |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` | Cashfree credentials for the selected mode |
| `HASH_SALT` | Random string for hashing IPs in rate limits / audit log |

Optional: `CASHFREE_WEBHOOK_SECRET`, `CASHFREE_VERIFY_WITH_API`, `EMAIL_WEBHOOK_URL`, `WHATSAPP_WEBHOOK_URL`, `NOTIFY_WEBHOOK_URL`, `CRM_WEBHOOK_URL`, `OPS_ALERT_WEBHOOK_URL`, `INTEGRATION_SIGNING_SECRET`, `MENTORSHIP_BOOKING_URL`, `NEXT_PUBLIC_GTM_ID`.

## 4–6. PostgreSQL, Prisma & migrations

| Command | What it does |
|---|---|
| `npm run db:local` | Local throwaway Postgres 18 on :5433 (`suraj_dev`, `suraj_test`) |
| `npm run db:migrate -- --name x` | Create a new migration (development only) |
| `npm run db:deploy` | Apply pending migrations (CI / production — never runs at app startup) |
| `npm run db:status` | Show migration status |
| `npm run db:seed` | Seed reference data (never overwrites dashboard edits) |
| `npm run db:import-legacy -- .data/db.json [--dry-run]` | Import records from the retired JSON store (idempotent, verified) |
| `npm run db:studio` | Prisma Studio |

Neon setup, backup and restore: [DATABASE.md](docs/DATABASE.md).

## 7–8. Admin accounts & dashboard

Create the first owner account with `npm run admin:create` (credentials come from environment variables, so nothing is hard-coded or committed). Then sign in at **`/ops/login`**. Roles: `OWNER` (everything + settings/admins), `ADMIN` (operations), `VIEWER` (read-only). See [ADMIN_DASHBOARD.md](docs/ADMIN_DASHBOARD.md).

## 9–10. Cashfree sandbox & webhooks

Set `CASHFREE_MODE=sandbox` + sandbox App ID/Secret, and register `https://<your-domain>/api/webhooks/cashfree` in Cashfree → Developers → Webhooks. Step by step: [PAYMENTS.md](docs/PAYMENTS.md).

## 11. Vercel deployment

Import the repo in Vercel, set the env vars, then run `npm run db:deploy` against the production database before (or right after) the first deploy. `vercel.json` runs `scripts/check-env.mjs` before every build and fails unsafe configs. Full guide + rollback: [VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md).

## 12. Backup & restore

Neon point-in-time restore (branch from a timestamp) plus a scheduled `pg_dump`. Commands in [DATABASE.md §Backup](docs/DATABASE.md#backup--restore).

## 13. Troubleshooting

| Symptom | Fix |
|---|---|
| `/ops` redirects to `/ops/login` | Expected without a session. Create an admin with `npm run admin:create`. |
| Earlier `/ops` returned **404** | The old basic-auth middleware returned 404 when `OPS_PASSWORD` was unset. It has been replaced by real login. |
| Workshop shows "Not currently open" | No OPEN cohort with a future start date in the DB, the DB is unreachable (fails safe), or only a *sample* cohort exists in production. Check `/ops/workshops` and `/api/health`. |
| Payment stuck "Confirming…" | Webhook not received: check `/ops/webhooks`, the Cashfree webhook URL, and use **Check status with Cashfree** on the order. |
| `character … has no equivalent in encoding "WIN1252"` | The local Postgres cluster isn't UTF-8. `db:local` forces UTF-8; recreate `.pgdata`. |
| Messages show `NOT_CONFIGURED` | No email/WhatsApp/CRM webhook URL is set. They were **not** sent. |
| `prisma generate` EPERM on Windows | Stop running dev servers (they lock the engine DLL), then retry. |
| Build fails at `check-env` | Read the ✗ line. It names the missing or unsafe variable. |

## 14. Tests & launch

```bash
npm run db:local      # tests need Postgres; they use the separate suraj_test database
npm test              # 68 tests: database, auth, forms, payments, refunds, dashboard, health
npm run typecheck
BASE_URL=https://<preview>.vercel.app npm run smoke   # post-deploy smoke test
```
Before taking real money, complete [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md).
