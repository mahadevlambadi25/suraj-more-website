import Link from 'next/link';
import { MobileStickyCta } from '@/components/MobileStickyCta';
import { PageHero } from '@/components/Sections';
import { TrackedLink } from '@/components/TrackedLink';
import { getSettings } from '@/lib/cms';
import { whatsappHref } from '@/lib/format';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Contact | Suraj More',
  absoluteTitle: true,
  description: 'Get support with a program or send a business enquiry by WhatsApp or email.',
  path: '/contact',
});

export default async function ContactPage() {
  const s = await getSettings();
  const wa = whatsappHref(s.contact.whatsappNumber, 'Hi, I have a question about');
  return (
    <>
      <PageHero eyebrow="Contact" title="How can we help?" lead="For program support or business enquiries, message us directly." />
      {/* [[CONFIRM: reply time, e.g. "We usually reply within one business day"]] — not published until confirmed. */}
      <section className="section">
        <div className="container">
          <div className="contact-grid">
            <article className="card">
              <span className="tag">Fastest</span>
              <h2 style={{ fontSize: '1.5rem', marginTop: 14 }}>WhatsApp</h2>
              <p>Workshop access, payment questions, quick support.</p>
              <p style={{ color: 'var(--text)', fontWeight: 600 }}>{s.contact.whatsappDisplay}</p>
              <TrackedLink href={wa} className="btn btn--primary" event="whatsapp_click" placement="contact_page">
                Message on WhatsApp
              </TrackedLink>
            </article>
            <article className="card">
              <span className="tag tag--muted">Detailed enquiries</span>
              <h2 style={{ fontSize: '1.5rem', marginTop: 14 }}>Email</h2>
              <p>Business enquiries, partnerships, speaking, data requests.</p>
              <p style={{ color: 'var(--text)', fontWeight: 600 }}>{s.contact.email}</p>
              <TrackedLink href={`mailto:${s.contact.email}`} className="btn btn--secondary" cta="contact_email" placement="contact_page">
                Send an Email
              </TrackedLink>
            </article>
          </div>

          <div className="card card--flat" style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: '1.2rem' }}>Before you write</h2>
            <ul className="check-list" style={{ margin: 0 }}>
              <li>For a workshop payment, include the <strong>order reference</strong> from your confirmation.</li>
              <li>For mentorship, the fastest route is the <Link href="/mentorship#apply">application form</Link>.</li>
              <li>To access or delete your personal data, email us with the subject “Data request.” See the <Link href="/privacy-policy">privacy policy</Link>.</li>
            </ul>
          </div>
        </div>
      </section>
      <MobileStickyCta label="Message on WhatsApp" href={wa} />
    </>
  );
}
