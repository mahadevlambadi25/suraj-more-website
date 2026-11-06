# Vercel deployment

## One-time setup

1. **Database**: create a Neon project and branches (see [DATABASE.md](DATABASE.md)).
2. **Repository**: push to GitHub (the `.gitignore` excludes `.env*`, `.data`, `.pgdata`, `backups`).
3. **Vercel** → New Project → import the repo. Framework: Next.js. `vercel.json` sets the function region `sin1` (Singapore) — the same region as the Neon database, so database queries never cross regions; visitors in India still get static/ISR pages from Vercel's edge network — and the build command `node scripts/check-env.mjs && npm run build` (`prisma generate && next build`).
4. **Environment variables** (Settings → Environment Variables), set separately for *Preview* and *Production*:

| Variable | Preview | Production (pre-launch) |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Neon `preview` branch | Neon `main` branch |
| `NEXT_PUBLIC_SITE_URL` | preview domain | `https://<final domain>` |
| `CASHFREE_MODE` | `sandbox` | `sandbox` until launch sign-off |
| `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY` | sandbox keys | sandbox keys (live keys only at launch) |
| `HASH_SALT` | random | different random value |
| messaging/CRM/booking/GTM | optional | as configured |

5. **Migrate**: `DATABASE_URL=<direct> DIRECT_URL=<direct> npm run db:deploy` against each branch. This is deliberately not part of the build.
6. **Admin**: run `npm run admin:create` against the production database (see [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md)).
7. **Cashfree webhook URL**: `https://<domain>/api/webhooks/cashfree` (see [PAYMENTS.md](PAYMENTS.md)). If Vercel Deployment Protection is on for previews, add a bypass for this path or Cashfree cannot reach it.
8. **Deploy**, then verify:
   ```bash
   curl https://<domain>/api/health          # {"status":"ok","database":"ok","paymentMode":"sandbox"}
   BASE_URL=https://<domain> npm run smoke    # 28 public checks (add SESSION_COOKIE=… for dashboard pages)
   ```

## Routine release

1. Open a PR. CI should run `npm ci && npm run typecheck && npm test` (tests need a Postgres service with a database named `*test*`; set `TEST_DATABASE_URL`).
2. Vercel builds a preview, which `check-env` validates.
3. If the PR includes a migration, run `npm run db:deploy` against the preview branch, then smoke-test the preview.
4. Merge. Run `npm run db:deploy` against production **before** promoting if the migration is additive (expand first), then deploy.

## Rollback

- **Code**: Vercel → Deployments → choose the previous good deployment → *Promote to Production* (instant).
- **Schema**: migrations are forward-only. Ship additive changes first so the previous code version keeps working, which lets code rollbacks stay instant. If a migration damaged data, restore via a Neon point-in-time branch ([DATABASE.md](DATABASE.md#backup--restore)) and point `DATABASE_URL` at it.
- **Payments**: to stop sales immediately, close the cohort in `/ops/workshops` (purchases are blocked server-side), or set `CASHFREE_MODE=sandbox` and redeploy.

## Serverless notes

- No runtime writes to the local filesystem. All state is in Postgres.
- Rate limiting is DB-backed, so it works across instances.
- One pooled Prisma connection per function instance (`connection_limit=1` on the pooled URL).
- Public pages are ISR (5 minutes); cohort and settings changes from `/ops` also trigger immediate revalidation.
