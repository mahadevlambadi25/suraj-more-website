# Admin dashboard (`/ops`)

## Why `/ops` used to return 404

The first version protected `/ops` with HTTP basic auth in `src/middleware.ts`. When `OPS_PASSWORD` was **not set**, that middleware deliberately returned `404 Not found` to hide the dashboard. The route existed and exported correctly, and the behaviour was the same in dev and production builds; the variable just wasn't set during local testing. Basic auth has been replaced by database-backed accounts and sessions, so `/ops` now always redirects to `/ops/login` without a session.

## Accounts

Admins are created from the command line. Credentials are passed as environment variables, so they are never hard-coded or committed:

```bash
ADMIN_EMAIL=owner@example.com ADMIN_NAME="Suraj More" ADMIN_ROLE=OWNER \
ADMIN_PASSWORD='use-a-long-unique-passphrase-2026' npm run admin:create

# reset a password (also signs that admin out everywhere)
ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='new-long-passphrase-9' npm run admin:create -- --reset
```
Passwords must be at least 12 characters and include a number. For production, run it with `DATABASE_URL`/`DIRECT_URL` pointing at the production database.

| Role | Can |
|---|---|
| `VIEWER` | See everything; no changes, no CSV export |
| `ADMIN` | + lead status, cohorts, refunds, reconcile, retry webhooks/fulfilment, application decisions, CSV export |
| `OWNER` | + site settings, activate/deactivate admins |

Sessions: HttpOnly, `Secure`, `SameSite=Strict` cookie (`__Host-` prefixed in production). They expire after 12 hours, or after 2 hours idle. Login is limited to 5 attempts per email and 20 per IP per 15 minutes. Logins, failures and every privileged action are written to the audit log.

## Modules

| Page | What it does |
|---|---|
| **Overview** `/ops` | Leads, registrations, paid orders, net revenue, pending, failed, applications, waitlist (live queries). Orders needing attention and recent delivery problems. |
| **Leads** `/ops/leads` | Search name/email; filter by source, status and date (IST); paginate; lead detail with UTM and activity (consent records are still saved in the `ConsentRecord` table, but not listed in the admin); status changes; **CSV export** (formula-injection safe, audited). |
| **Workshops** `/ops/workshops` | Create/edit cohorts: dates in IST, price in ₹ (stored as paise), seat limit, compare-at price (shown only if marked verified), VIP add-on, sessions, private Zoom link. Participants and waitlist. Closed or started cohorts can never be booked. Price changes only affect new orders. |
| **Orders & payments** `/ops/orders` | Filters: all / paid / pending / failed / refunded / needs review / needs attention; search by order no., Cashfree id, email or name. Order detail: customer, line items, payments, refunds, webhook events, delivery status, timeline. Actions: *Check status with Cashfree*, *Retry confirmation/Zoom/CRM*, *Request refund*. **There is no "mark as paid".** |
| **Webhooks** `/ops/webhooks` | Every event with id, type, provider, signature check, status, attempts, error and linked order. **Retry** re-processes a FAILED event from its stored payload. It is idempotent and audited. |
| **Refunds** `/ops/refunds` | All refunds with amount, status, Cashfree reference, who requested and why. *Sync status* pulls the current state from Cashfree. |
| **Mentorship** `/ops/applications` | Filter by status; full answers; accept (requires a booking link and emails it) or reject, with an internal note. Each application can be decided only once. Shows honestly whether the email was delivered. |
| **Settings** `/ops/settings` | Owner-editable: support email, WhatsApp number, Whop URL, mentorship booking link. Read-only integration status (never shows secrets), the webhook URL to register, and admin accounts. (Privileged actions are still recorded in the `AuditLog` table; it is no longer listed on this page.) |

## Operations runbook

- **Next cohort:** Workshops → New cohort → status *Open*, set dates, price and Zoom link → Save. The site updates within about 5 minutes; the cohort closes itself at its start time.
- **Pause an offer:** set the cohort status to *Closed*. The site shows the waitlist instead.
- **Customer paid but sees "confirming":** Orders → open the order → *Check status with Cashfree*.
- **Confirmation/Zoom not delivered:** Overview → needs attention → order → fix the provider/Zoom link → *Retry confirmation / Zoom / CRM*.
- **Refund:** order → *Request refund* (reason + confirmation). If the status shows *Provider response unknown*, use *Sync status*; **do not** issue a second refund.
- **Replace the free-training video (VSL):** Settings → *Free Training* → paste the YouTube/Vimeo link (unlisted Vimeo: the full share link incl. its private code), choose captions on/off, paste the transcript → *Save Changes*. Empty link = “Training video is not available yet.”
- **Publish a testimonial or case study:** Proof → *New testimonial* / *New case study* → enter the approved wording (case studies: baseline, result, period and source) → tick *Written permission is on file* → Status *Published* → Save. Set Status back to *Draft* to take it down; *Delete* removes it.
- **Social profile links:** Settings → Site settings → Instagram / LinkedIn / YouTube URL. Shown in the footer and in search-engine profile data only when set.
- **Workshop reminders:** sent automatically once a day (09:00 IST) to paid attendees whose workshop starts within the next 36 hours, including the Zoom link. Needs `CRON_SECRET` in Vercel and an email/WhatsApp provider; until then each attempt is listed under Overview → *Message delivery & site alerts* as “not configured”.
- **Site alerts:** Overview → *Message delivery & site alerts* lists page errors, 404s (with the broken path) and broken external links (Whop, booking, social), found by the daily check. Set `OPS_ALERT_WEBHOOK_URL` to also receive them in Slack/email.
