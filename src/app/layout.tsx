import type { Metadata, Viewport } from 'next';
import { AnnouncementStrip } from '@/components/AnnouncementStrip';
import { CookieConsent } from '@/components/CookieConsent';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { PublicOnly } from '@/components/PublicOnly';
import { getActiveCohort, getSettings } from '@/lib/cms';
import { formatDateShort, formatInr, formatTime } from '@/lib/format';
import { siteUrl } from '@/lib/seo';
// Self-hosted fonts (Sora, Inter, DM Serif Display) — identical to the former next/font/google output,
// with no build-time download from Google. Must load before globals.css, which consumes --font-*.
import './fonts.css';
import './globals.css';

// Static pages refresh every 5 minutes (and immediately when a cohort is saved in /ops). Pages that show
// workshop availability render dynamically, and the announcement strip re-checks on navigation.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: s.seo.defaultTitle, template: s.seo.titleTemplate },
    description: s.seo.description,
    openGraph: { siteName: s.brandName, locale: 'en_IN', type: 'website' },
    twitter: { card: 'summary_large_image' },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#101827',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, cohort] = await Promise.all([getSettings(), getActiveCohort()]);

  return (
    <html lang="en-IN">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <PublicOnly>
          {/* Always mounted: it re-checks the next workshop on navigation, so closing/opening one in /ops
              is reflected in already-open tabs. Server-rendered initial value avoids any layout flash. */}
          <AnnouncementStrip
            initial={
              cohort
                ? {
                    title: cohort.title,
                    href: `/workshop/${cohort.slug}`,
                    startsAt: cohort.startsAt,
                    dateLabel: formatDateShort(cohort.startsAt, cohort.timezone),
                    timeLabel: formatTime(cohort.startsAt, cohort.timezone),
                    priceLabel: formatInr(cohort.priceInr),
                  }
                : null
            }
          />
          <Header wordmark={settings.wordmark} nav={settings.nav} cta={settings.headerCta} />
        </PublicOnly>
        <main id="main">{children}</main>
        <PublicOnly>
          <Footer settings={settings} />
          {/* Analytics never load inside the admin dashboard. */}
          <CookieConsent gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
        </PublicOnly>
      </body>
    </html>
  );
}
