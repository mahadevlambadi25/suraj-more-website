import Link from 'next/link';
import type { SiteSettings } from '@/lib/types';
import { whatsappHref } from '@/lib/format';
import { TrackedLink } from './TrackedLink';

export function Footer({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer" data-sticky-hide="">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link href="/" className="wordmark">
              {settings.wordmark}
            </Link>
            <p style={{ marginTop: 16, maxWidth: '38ch' }}>{settings.positioningLine}</p>
            {settings.socials.length > 0 && (
              <ul style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }} aria-label="Social profiles">
                {settings.socials.map((s) => (
                  <li key={s.href}>
                    <a href={s.href} target="_blank" rel="noopener noreferrer">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2>Programs</h2>
            <ul>
              <li><Link href="/level-zero">Level Zero</Link></li>
              <li><Link href="/workshop">One Skill Workshop</Link></li>
              <li><Link href="/mentorship">Mentorship</Link></li>
              <li><Link href="/free-training">Free Training</Link></li>
            </ul>
          </div>
          <div>
            <h2>Explore</h2>
            <ul>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/results">Results</Link></li>
              <li><Link href="/insights">Insights</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h2>Contact</h2>
            <ul>
              <li>
                <a href={`mailto:${settings.contact.email}`}>{settings.contact.email}</a>
              </li>
              <li>
                <TrackedLink href={whatsappHref(settings.contact.whatsappNumber)} event="whatsapp_click" placement="footer">
                  WhatsApp {settings.contact.whatsappDisplay}
                </TrackedLink>
              </li>
            </ul>
            {settings.legalEntity && (
              <address style={{ fontStyle: 'normal', marginTop: 16 }}>
                {settings.legalEntity.name}
                <br />
                {settings.legalEntity.address}
                {settings.legalEntity.gstin && (
                  <>
                    <br />
                    GSTIN: {settings.legalEntity.gstin}
                  </>
                )}
              </address>
            )}
          </div>
        </div>
        <div className="footer-bottom">
          <p style={{ margin: 0 }}>
            © {year} {settings.legalEntity?.name ?? settings.brandName}. All rights reserved.
          </p>
          <nav aria-label="Legal">
            <ul style={{ display: 'flex', gap: 20, flexWrap: 'wrap', margin: 0 }}>
              <li style={{ margin: 0 }}><Link href="/privacy-policy">Privacy</Link></li>
              <li style={{ margin: 0 }}><Link href="/terms-and-conditions">Terms</Link></li>
              <li style={{ margin: 0 }}><Link href="/refund-policy">Refunds</Link></li>
            </ul>
          </nav>
        </div>
        <p className="disclaimer" style={{ color: '#7d8796' }}>
          Results vary. Nothing on this website is a promise or guarantee of income, revenue or conversion rates.
        </p>
      </div>
    </footer>
  );
}
