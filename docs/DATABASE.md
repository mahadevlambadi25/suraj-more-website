# Database

PostgreSQL via Prisma 6. Schema: [`prisma/schema.prisma`](../prisma/schema.prisma). Migrations: `prisma/migrations/`.

## Entities

| Model | Purpose | Notable constraints |
|---|---|---|
| `Admin` | Dashboard users | `email` unique; role `OWNER`/`ADMIN`/`VIEWER`; `isActive` |
| `AdminSession` | Login sessions | `tokenHash` unique (SHA-256; the raw token is never stored); absolute + idle expiry |
| `RateLimitEvent` | Serverless-safe rate limiting (login, forms) | indexed `(bucket, key, createdAt)`; pruned automatically |
| `AuditLog` | Admin and security actions | indexed by time, entity, admin |
| `AppSetting` | Admin-editable site settings (no payment config) | key/value |
| `Lead` | One row per person | `email` unique; first-touch UTM columns; status |
| `ConsentRecord` | Append-only consent ledger | exact wording, version, source, timestamp |
| `FreeTrainingRegistration` | Each free-training sign-up | attribution JSON |
| `WorkshopCohort` | Dates, prices (paise), seats, add-on, **private** Zoom link | `slug` unique |
| `WorkshopRegistration` | Created once per paid order | `orderId` unique |
| `Order` | Workshop orders | `orderNumber` unique (= Cashfree `order_id`); `amountPaise` int |
| `OrderEvent` | Append-only order timeline | |
| `Payment` | Every payment attempt | unique `(provider, providerPaymentId)` |
| `WebhookEvent` | Every provider webhook + payload (for retries) | `idempotencyKey` unique |
| `Refund` | Refund requests and their status | `refundNumber` unique (also the Cashfree idempotency key) |
| `MentorshipApplication` | Applications + decisions | decided by / at / note |
| `WaitlistEntry` | Waitlists | unique `(email, programId)` |
| `IntegrationEvent` | Delivery ledger: email/WhatsApp/CRM/alerts | status `SENT` / `NOT_CONFIGURED` / `SKIPPED` / `FAILED` |
| `OutboundClick` | Level Zero (Whop) click tracking | |

Payment history (`Order`, `Payment`, `Refund`, `WebhookEvent`, `OrderEvent`) is never deleted by the application.

## Neon setup (recommended managed Postgres)

1. Create a Neon project in **AWS Asia Pacific (Singapore, `ap-southeast-1`)** — Neon's closest region to India (it has no Mumbai region) — matching the Vercel function region `sin1`.
2. Create two branches: `main` (production) and `preview` (Vercel previews / sandbox testing).
3. For each branch, copy both connection strings:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`, with `?sslmode=require&pgbouncer=true&connection_limit=1` appended
   - **Direct** → `DIRECT_URL` (`?sslmode=require`)
4. Apply the schema: `DATABASE_URL=<direct> DIRECT_URL=<direct> npm run db:deploy`.

`connection_limit=1` keeps each serverless function to one connection; Neon's PgBouncer multiplexes them.

### How Neon credentials are kept separate (since 6 Nov 2026)

| File | Points to | Loaded by |
|---|---|---|
| `.env` | local Postgres (`localhost:5433/suraj_dev`) | Next.js dev server + Prisma CLI, automatically |
| `.env.neon` | Neon (pooled `DATABASE_URL` with `pgbouncer=true&connection_limit=1`, direct `DIRECT_URL`) | **only** `npm run neon -- …` |
| Vercel env vars | Neon (same two values as `.env.neon`) | the deployed app |

`.env.neon` is git-ignored and excluded from Vercel CLI uploads; `.env.neon.example` is the committed template.
Nothing loads `.env.neon` automatically, so local work can never hit production by accident.

```bash
npm run neon -- migrate status --ipv4   # read-only
npm run neon -- migrate diff   --ipv4   # read-only; exit 0 = schema matches
npm run neon -- verify         --ipv4   # read-only structure + record counts
npm run neon -- migrate deploy --ipv4   # applies pending migrations (non-destructive)
```
The runner refuses anything else (`migrate reset`, `migrate dev`, `db push`, `db seed`, `migrate resolve`, extra flags).

**`--ipv4`:** on the development PC, IPv6 to Neon times out and Prisma's engine does not fall back to IPv4
(Node does). `--ipv4` routes that single command over IPv4 (IPv4 address + Neon's `options=endpoint=<id>`),
in memory only. Vercel does not need it.

**Findings (verified 6 Nov 2026):** Prisma 6 ignores `channel_binding` (an invalid value still connects) — keep it for other clients;
Neon refuses `sslmode=disable`, so TLS is enforced. Neon has no Mumbai region; the project is in Singapore (`ap-southeast-1`).

### Exact migration runbook (Neon)

Verified on 6 Nov 2026:
- The migration SQL uses only standard types, needs no extensions, superuser rights or `GRANT`s, and generates UUIDs in Prisma.
- The full test suite passes with `?pgbouncer=true&connection_limit=1` (pooled-connection behaviour).

Connection string shapes (copy the real values from Neon → *Connect*):
```
DATABASE_URL = postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require&pgbouncer=true&connection_limit=1
DIRECT_URL   = postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```
Migrations always use the **direct** URL (Prisma's migration engine takes advisory locks, which PgBouncer can't hold).

**PowerShell (Windows)**: run from the project folder. The variables apply to this terminal session only and are never written to disk:
```powershell
$env:DATABASE_URL = "<DIRECT url of the Neon branch>"
$env:DIRECT_URL   = "<DIRECT url of the Neon branch>"
npx prisma migrate status          # 1. expect: "1 migration not yet applied" on a new branch
npx prisma migrate deploy          # 2. applies prisma/migrations/* (non-destructive, idempotent)
npx prisma migrate status          # 3. expect: "Database schema is up to date!"
npx prisma migrate diff --from-url $env:DIRECT_URL --to-schema-datamodel prisma/schema.prisma   # 4. expect: "No difference detected."
# 5. production only: create the owner admin (see ADMIN_DASHBOARD.md), then close the window
Remove-Item Env:DATABASE_URL, Env:DIRECT_URL
```
**bash / macOS / Linux:**
```bash
export DATABASE_URL="<DIRECT url>" DIRECT_URL="<DIRECT url>"
npx prisma migrate status && npx prisma migrate deploy && npx prisma migrate status
npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma
unset DATABASE_URL DIRECT_URL
```
Do **not** run `prisma migrate dev`, `migrate reset` or `db push` against Neon: those are development commands and can drop data. Do **not** run `npm run db:seed` against production: the sample cohort is for development only. If seeding is ever needed, `SEED_SAMPLE_DATA=false` skips it.

## Migrations

- Development: edit `schema.prisma`, then `npm run db:migrate -- --name describe_change`. Review the generated SQL before committing.
- Production: `npm run db:deploy` (`prisma migrate deploy`) as a **separate, controlled step**. It never runs at app startup or automatically during the Vercel build.
- Destructive changes (dropping or renaming columns) must be split into expand → migrate data → contract releases, and called out in the PR.

## Legacy JSON import

The site originally stored data in `.data/db.json`. On 6 Nov 2026 a backup was taken (`backups/legacy-db-*.json`, git-ignored because it contains personal data) and its 5 records (1 lead, 1 application, 1 order, 1 webhook event, 1 click) were imported into the dev database:

```bash
npm run db:seed                                       # legacy orders reference the seeded cohort slug
npm run db:import-legacy -- .data/db.json --dry-run   # preview
npm run db:import-legacy -- .data/db.json             # import; prints a source/imported/present/failed table
```
The import is idempotent: each imported legacy id is recorded in `AuditLog` (`legacy.import`) and skipped on re-runs. Legacy webhook events had no stored payload, so they are imported as history only and cannot be retried. Those legacy records were **local test data**. Production starts with an empty database unless you choose to run the import against it.

## Backup & restore

- **Point-in-time restore (primary):** Neon keeps history (7 days on the free plan, longer on paid plans). To restore: Neon console → Branches → *Create branch from a point in time*, verify the data, then promote the branch or point `DATABASE_URL` at it and redeploy.
- **Logical backups (secondary):** schedule a daily dump (for example from a GitHub Action) to encrypted storage:
  ```bash
  pg_dump "$DIRECT_URL" --format=custom --no-owner --file=suraj-$(date +%F).dump
  ```
  Restore into an empty database:
  ```bash
  pg_restore --no-owner --clean --if-exists --dbname="$TARGET_DIRECT_URL" suraj-YYYY-MM-DD.dump
  ```
- Test a restore at least once before launch (see the launch checklist).

## Local development database

`npm run db:local` starts a real PostgreSQL 18 server via the `embedded-postgres` dev dependency on port 5433, with data in `.pgdata/`, UTF-8 encoding, user/password `postgres`/`postgres`, and databases `suraj_dev` and `suraj_test`. It is for development and tests only.
