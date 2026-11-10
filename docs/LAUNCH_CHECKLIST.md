# Launch checklist

Live payments stay **off** (`CASHFREE_MODE=sandbox`) until every item in sections A–D is ticked.

## A. Business inputs from Suraj (brief §8, still open)

- [ ] Approved name spelling ("More" vs "Morey"), title and logo lock-up → `src/content/settings.ts`
- [ ] Legal entity that takes payments, display address, GST wording → `settings.legalEntity`, legal pages
- [ ] Lawyer-reviewed Privacy Policy, Terms and Refund Policy (DPDP Act, GST) → `src/content/legal.ts` (`reviewed: true`)
- [ ] Real support email, WhatsApp number, Whop Level Zero URL → `/ops/settings`
- [ ] Mentorship offer details (still no price published) and the booking provider link → `/ops/settings`
- [ ] Whether "regular ₹999" was ever a real price (otherwise keep it unverified, which hides it)
- [ ] TEDx and "3,00,000+" proof, or keep them hidden
- [ ] Founder photos, VSL video ID, approved testimonials with written permission
- [ ] Approval of framework names and article copy

## B. Infrastructure

- [ ] Neon production branch created; `npm run db:deploy` applied; `npm run db:status` clean
- [ ] Neon PITR retention confirmed; daily `pg_dump` scheduled; **one restore tested**
- [ ] Vercel production env vars set (check-env passes), custom domain + HTTPS
- [ ] Owner admin created in production; test admin accounts removed
- [ ] Sample cohort absent in production (`/ops/workshops` shows no "sample" rows you rely on)
- [ ] New migration `20261110105807_prd_reminders_and_proof` applied to Neon (`npm run neon -- migrate deploy --ipv4`; additive only: Testimonial, CaseStudy, reminderSentAt)
- [ ] `CRON_SECRET` set in Vercel (enables the daily 09:00 IST job: workshop reminders + external link check)
- [ ] Error monitoring: page errors and 404s are recorded in `/ops` → Overview; connect Sentry (or similar) for server-side stack traces
- [ ] Uptime monitor on `/api/health`

## C. Integrations

- [ ] Email provider webhook (`EMAIL_WEBHOOK_URL`) delivering confirmation, Zoom link and application emails; `/ops` shows `SENT`
- [ ] WhatsApp provider with **separate** transactional and promotional templates (`WHATSAPP_WEBHOOK_URL`)
- [ ] CRM webhook receiving lead, registration and application events
- [ ] Ops alert channel (`OPS_ALERT_WEBHOOK_URL`, e.g. Slack/email)
- [ ] GTM container: GA4, plus Meta/LinkedIn only if approved; consent mode verified; purchase fires once

## D. Payment sign-off (sandbox, on the production domain)

- [ ] Webhook URL registered in the Cashfree **test** dashboard; signature verification passing
- [ ] Successful purchase → order PAID, registration, confirmation and Zoom delivered, purchase event once
- [ ] Failed payment and closed checkout → correct pages; order FAILED/DROPPED
- [ ] Duplicate webhook (resend from the Cashfree dashboard) → "duplicate", no second registration
- [ ] Refund from `/ops` → Cashfree sandbox refund → REFUNDED via webhook
- [ ] Closed cohort cannot be purchased (UI and API)
- [ ] `BASE_URL=https://<domain> npm run smoke` passes

## E. Go live (only after A–D)

1. Cashfree **production** account approved (KYC); copy live App ID/Secret.
2. Register the production webhook URL in the Cashfree **production** dashboard.
3. Vercel Production env: `CASHFREE_MODE=production`, live keys, `CASHFREE_ALLOW_PRODUCTION=true` → redeploy.
4. Open the real cohort in `/ops/workshops`.
5. Make one small real purchase, refund it from `/ops`, and confirm both in Cashfree.
6. Watch `/ops` (overview, webhooks, delivery problems) for the first 48 hours.

**Rollback:** close the cohort in `/ops` (immediate), or set `CASHFREE_MODE=sandbox` and redeploy.

## Brief launch checklist mapping

| Brief item | Status |
|---|---|
| Name, legal entity, address, primary CTA locked | ⏳ section A |
| Workshop dates/price/add-on CMS-driven; expired events not purchasable | ✅ `/ops/workshops`, tested |
| Cashfree server-side verified; duplicate callback creates no duplicate | ✅ tested; ⏳ live sandbox run (D) |
| Confirmation and Zoom workflow on successful registration | ✅ logic tested; ⏳ provider (C) |
| Forms validate, record consent, preserve UTM | ✅ tested |
| Purchase event once, matching server value | ✅ tested |
| HTTPS, headers, spam protection, backups, error monitoring | ✅ headers/spam · ⏳ backups and monitoring (B) |
| No fake counters, scarcity or unsupported claims | ✅ |
| Legal pages reconciled with offers | ⏳ section A |
