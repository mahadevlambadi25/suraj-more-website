# Payments (Cashfree)

API: Cashfree Payment Gateway, `x-api-version: 2023-08-01`, server-to-server only. Code: `src/lib/cashfree.ts` (API client + signature), `src/lib/orders.ts` (state machine), `src/app/api/webhooks/cashfree/route.ts`.

## Modes

| `CASHFREE_MODE` | Use | Notes |
|---|---|---|
| `mock` | Local development | Simulated checkout at `/workshop/checkout-mock`; events are stored with provider `MOCK`. Refused in production and blocked on Vercel by `check-env`. Real webhooks are rejected (401). |
| `sandbox` | Previews, QA, pre-launch | `https://sandbox.cashfree.com/pg` with sandbox credentials. No real money. |
| `production` | Live | **Locked**: requires `CASHFREE_ALLOW_PRODUCTION=true` and Vercel `production` environment. Do not enable before the launch checklist is done. |

## Sandbox setup

1. Cashfree merchant dashboard → switch to **Test environment** → Developers → API Keys → copy App ID and Secret Key.
2. Set in Vercel (Preview environment): `CASHFREE_MODE=sandbox`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL=https://<preview-domain>`.
3. Cashfree → Developers → **Webhooks** → add `https://<preview-domain>/api/webhooks/cashfree` with webhook version **2023-08-01**, and enable *Payment success*, *Payment failed*, *Payment user dropped* and *Refund status*. The URL must be public; Vercel Deployment Protection must **not** block `/api/webhooks/*` (use a Protection Bypass or an unprotected sandbox domain).
4. Create an OPEN cohort in `/ops/workshops` (sample cohorts are hidden in production builds).
5. Buy a seat using Cashfree's test cards/UPI from their sandbox docs. Check `/ops/orders` → *paid*, and `/ops/webhooks` → *processed*.

`CASHFREE_WEBHOOK_SECRET` is optional. Cashfree signs webhooks with the client secret key, which is the default.

## Flow and guarantees

1. **Order** (`createWorkshopOrder`): the cohort must be OPEN, not started, not a hidden sample and have seats. The amount is computed in paise from the DB; browser-sent prices are ignored. A `PENDING` order is created, then the Cashfree order (`order_amount` in rupees, `x-idempotency-key` = order number).
2. **Webhook**: HMAC-SHA256(`timestamp + raw body`), base64-encoded and compared in constant time → 401 if invalid. The event is stored with a unique idempotency key (`x-idempotency-key` header, or the SHA-256 of the body). An already-processed key returns `duplicate: true`.
3. **Verification**: for success events in sandbox/production, the payment is confirmed via `GET /orders/{id}/payments` (`CASHFREE_VERIFY_WITH_API`, on by default). If Cashfree doesn't confirm it, the event is marked FAILED and the endpoint returns 500, so Cashfree retries.
4. **markPaid**: one transaction that upserts the payment, validates the amount **and** currency (a mismatch → `NEEDS_REVIEW`), then runs the compare-and-set `PENDING|FAILED|DROPPED → PAID`. It creates the registration exactly once. Concurrent duplicates serialise on the row lock.
5. **Out of order**: a late FAILED/DROPPED never downgrades PAID/REFUNDED. A success after a failure (customer retried) is accepted.
6. **Fulfilment**: confirmation, Zoom link and CRM, each idempotent and resumable. A step is only marked done when the provider accepted it.
7. **Confirmation page** reads status only. A stale PENDING triggers a server-side reconcile. The `purchase` analytics event is claimed atomically once per order.

## Refunds

- Only from `/ops` (role ADMIN), with a reason and an explicit confirmation. Full refund of the order amount.
- The atomic `PAID → REFUND_PENDING` transition means at most one active refund per order (double clicks and concurrent admins included).
- Cashfree `POST /orders/{id}/refunds` with `refund_id` = our `refundNumber` (also the idempotency key).
- A 4xx from Cashfree (definitive rejection) → refund `FAILED`, order back to `PAID`.
- A timeout or 5xx (outcome unknown) → stays `REFUND_PENDING` so no second refund can be issued; use *Sync status*.
- `REFUND_STATUS_WEBHOOK` updates the status. A `SUCCESS` refund never regresses. Refunds created in the Cashfree portal are recorded automatically.

## Failure handling

| Situation | What happens | Where you see it |
|---|---|---|
| Invalid signature | 401, nothing stored, ops alert | Ops alert channel |
| Processing error (unknown order, API down, invalid payload) | Event `FAILED` with error, 500 → Cashfree retries | `/ops/webhooks` (Retry button) |
| Webhook never arrives | Confirmation page reconciles; order listed as needing attention after 15 min | Overview, Orders |
| Amount/currency mismatch | `NEEDS_REVIEW`, no registration | Overview, Orders |
| Provider down at checkout | Order `FAILED`, friendly message to the customer | Orders |

## Tests

`tests/payments.test.ts` covers 26 cases (pricing, closed/draft/started/full cohorts, Cashfree request shape, invalid signature, signed sandbox end to end, API non-confirmation, duplicate and concurrent webhooks, late failure, failure then success, amount and currency mismatch, invalid payload, admin retry, single purchase event, refunds including concurrency, regression, definitive vs unknown provider errors). Cashfree HTTP calls are stubbed there; the real sandbox endpoint was reached manually with test keys (see the final report). Before launch, run at least one real sandbox purchase and refund end to end.
