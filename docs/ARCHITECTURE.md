# Architecture

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| Public pages | `src/app/(routes)`, `src/components` | Marketing site. Static/ISR (revalidate 300 s). No business logic in components. |
| Content | `src/content/*` → `src/lib/cms.ts` | Copy, programs, FAQs, frameworks, articles, legal drafts (files); **cohorts and editable settings come from the DB**. Pages read only through `cms.ts`. |
| Public API | `src/app/api/*` | Thin handlers: parse → validate → call a service → respond. |
| Domain services | `src/lib/orders.ts`, `forms.ts`, `cohorts.ts`, `leads.ts`, `settings.ts` | All business rules. Framework-free apart from `server-only`, so they are unit-tested directly. |
| Admin | `src/app/ops/*` (UI + server actions) → `src/lib/admin/queries.ts` (reads), `commands.ts` (writes) | Each command checks the role itself and writes an audit log. |
| Auth | `src/lib/auth/password.ts` (scrypt), `session.ts` (pure session logic), `guards.ts` (Next.js cookies/redirects), `src/middleware.ts` (cookie-presence redirect) | |
| Integrations | `src/lib/cashfree.ts`, `src/lib/integrations.ts` | Cashfree PG API; email/WhatsApp/CRM/ops-alert webhooks with an honest delivery ledger. |
| Persistence | `prisma/schema.prisma`, `src/lib/db.ts` | PostgreSQL via Prisma; one pooled client per serverless instance. |

## Key flows

**Free training:** form → `POST /api/leads/free-training` → DB rate limit + honeypot + zod → `submitFreeTraining` (transaction: lead upsert, consent ledger, registration) → access cookie → `/free-training/watch`. Email/WhatsApp/CRM follow-ups are recorded in `IntegrationEvent`.

**Workshop purchase:**
1. `POST /api/workshop/order` checks the cohort is OPEN, not started, not a hidden sample and has seats. The amount is computed in paise from the DB. A PENDING order is created, and the Cashfree order with it.
2. Cashfree checkout (JS SDK, redirect).
3. `POST /api/webhooks/cashfree` verifies the HMAC on the raw body and stores a `WebhookEvent` under a unique idempotency key. In sandbox/production the payment is re-checked with the Cashfree API. Then `markPaid` (compare-and-set PENDING/FAILED/DROPPED → PAID) creates the registration, and fulfilment sends confirmation + Zoom + CRM.
4. `/workshop/confirmation` polls `GET /api/workshop/order/:id`, which **reads only**. If the webhook is late, the server reconciles with Cashfree directly.

**Mentorship:** application (3-step form) → NEW → admin accepts/rejects in `/ops` → booking link emailed only on acceptance → booking provider handles scheduling.

## Design decisions

- **Paise everywhere** (integers). Rupees only at display and at the Cashfree API boundary.
- **Compare-and-set state transitions** (`UPDATE … WHERE status IN (...)`) instead of read-then-write. This makes duplicate and concurrent webhooks safe across serverless instances.
- **Fail safe:** if the DB is down, no cohort is shown as open (nothing can be bought) and settings fall back to file defaults.
- **Honest integrations:** a message counts as sent only when a provider endpoint returned 2xx (`SENT`). Unconfigured channels are stored as `NOT_CONFIGURED`.
- **No new runtime dependencies** beyond Prisma: scrypt hashing and HMAC come from Node `crypto`, and validation uses zod (already present).
