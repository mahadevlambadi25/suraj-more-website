# Content confirmations (pending)

The approved copy document marks unverified information as `[[CONFIRM: …]]`. None of it is invented on the website:
the text is either **not shown** until confirmed, or shown in a **neutral form** that makes no claim. Each item below
says where it lives and what changes once it is confirmed.

Values marked **/ops** can be changed on the live site without a deploy (`/ops` → Settings). Everything else is a code/content change.

## Business details

| # | Item | Where | Current state |
|---|---|---|---|
| 1 | Support email | **/ops** Settings (default in `src/content/settings.ts`) | placeholder `hello@example.com` shown in footer + Contact |
| 2 | WhatsApp number | **/ops** Settings | placeholder `+91 00000 00000` shown in footer + Contact |
| 3 | Level Zero Whop URL | **/ops** Settings | `https://whop.com/` (Whop homepage). “Join for Free” redirects there via `/go/level-zero` |
| 4 | Mentorship booking link | **/ops** Settings | not set — accepting an application is blocked until it is set |
| 5 | Legal entity name, address, GST | `settings.legalEntity` | hidden; footer shows brand name |
| 6 | Name spelling (More / Morey) and title stack / wordmark | `settings.brandName`, `wordmark` | “Suraj More”, “SURAJ MORE” |
| 7 | Social profiles | `settings.socials` | none shown |

## Copy

| # | Item | Where | Current state |
|---|---|---|---|
| 8 | Approved bio (background, years, roles) | `settings.founder.shortBio`, About → “The story” first paragraph | only the positioning sentence is shown; story paragraph 1 is not rendered |
| 9 | TEDx reference + “3,00,000+ conversations” (definition + proof) | `src/content/proof.ts → trustPoints` | hidden; trust strip shows “Built for” audiences |
| 10 | Was ₹999 a real price? | `/ops` → Workshops → “Verified real past price” | strikethrough price hidden unless verified |
| 11 | What Level Zero includes | `src/content/programs.ts` | generic curriculum from the brief |
| 12 | Application review time (e.g. “2 business days”) | Mentorship page “How applying works”, mentorship form success | no time promise shown (“Every application is read personally.”) |
| 13 | Support reply time (e.g. “one business day”) | Contact page hero | no time promise shown |
| 14 | Framework names, spellings and step wording | `src/content/frameworks.ts` | copy-doc taglines/descriptions; step bodies pending review |
| 15 | Article copy (3 Insights articles) | `src/content/articles.ts` | published drafts — need Suraj’s approval |
| 16 | Testimonials + case studies (permission, exact wording, sources) | `src/content/proof.ts` | none published; honest empty state shown |
| 17 | Legal pages (lawyer review, DPDP, GST, refund terms) | `src/content/legal.ts` | drafts with a visible “Draft pending legal review” banner |

## Assets & operations

| # | Item | Where | Current state |
|---|---|---|---|
| 18 | Founder portraits (8–12) | `settings.founder.portrait`, `/public/images` | monogram placeholder on Home + About |
| 19 | Free-training video (unlisted YouTube/Vimeo ID + transcript) | `settings.freeTraining.video` | “Training video will appear here” placeholder on the watch page |
| 20 | Real workshop cohort: dates, price, seats, VIP add-on, **Zoom attendee link** | `/ops` → Workshops | none in production → site shows the waitlist |
| 21 | Email / WhatsApp / CRM providers | Vercel env (`EMAIL_WEBHOOK_URL`, `WHATSAPP_WEBHOOK_URL`, `CRM_WEBHOOK_URL`) | not configured → messages recorded as NOT_CONFIGURED, nothing is sent |
| 22 | Cashfree webhook registration | Cashfree Test dashboard → Webhooks | `https://suraj-more-website.vercel.app/api/webhooks/cashfree` must be added |

## Deliberate wording deviations from the copy document (honesty)

The copy document promises some deliveries that only become true once item 21 (providers) is configured.
Until then the site says only what is guaranteed:

| Copy document | Website now | Becomes the copy text when |
|---|---|---|
| Workshop confirmation: “Your confirmation and Zoom link are on their way to {email}.” | Shown **only** when both were actually delivered; otherwise “…will be sent to {email} before the workshop.” | automatic — driven by real delivery status |
| Free training watch page: “Your access details are on their way to your inbox.” | “Watch the training below. You can come back to this page any time on this device.” | email provider configured (then restore the copy text) |
| Mentorship success: “You’ll get a confirmation email shortly.” | Not shown; says the answers were saved and will be reviewed | email provider configured |
| Mentorship “Review: within [[2 business days]]”, Contact “reply within [[one business day]]” | no time promise | Suraj confirms the response times (items 12–13) |
