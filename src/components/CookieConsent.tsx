'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { captureAttribution } from '@/lib/analytics';

type Consent = { analytics: boolean; marketing: boolean; at: string };
const KEY = 'sm_cookie_consent_v1';

/**
 * Cookie consent + consent-gated tag loading. GTM (and anything inside it: GA4, Meta Pixel,
 * LinkedIn Insight) loads only after the visitor allows analytics. Also captures UTM attribution.
 */
export function CookieConsent({ gtmId }: { gtmId?: string }) {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);
  const [custom, setCustom] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    captureAttribution();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setConsent(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const save = (c: Omit<Consent, 'at'>) => {
    const value = { ...c, at: new Date().toISOString() };
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* ignore */
    }
    setConsent(value);
  };

  const loadTags = !!gtmId && !!consent?.analytics;

  return (
    <>
      {loadTags && (
        <Script id="gtm" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{analytics_storage:'granted',ad_storage:'${consent?.marketing ? 'granted' : 'denied'}',ad_user_data:'${consent?.marketing ? 'granted' : 'denied'}',ad_personalization:'${consent?.marketing ? 'granted' : 'denied'}'});
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}

      {ready && !consent && (
        <div className="cookie-banner" role="dialog" aria-modal="false" aria-labelledby="cookie-title" data-sticky-hide="">
          <h2 id="cookie-title">Cookies on this site</h2>
          <p style={{ margin: 0 }}>
            We use essential cookies to run the site. With your permission we also use analytics cookies to understand which pages help people,
            and marketing cookies to measure ads. <Link href="/privacy-policy">Privacy policy</Link>.
          </p>
          {custom && (
            <label className="checkbox">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              <span>Allow marketing cookies (ad measurement)</span>
            </label>
          )}
          <div className="btn-row">
            {custom ? (
              <button type="button" className="btn btn--dark btn--sm" onClick={() => save({ analytics: true, marketing })}>
                Save choices
              </button>
            ) : (
              <button type="button" className="btn btn--dark btn--sm" onClick={() => save({ analytics: true, marketing: true })}>
                Accept all
              </button>
            )}
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => save({ analytics: false, marketing: false })}>
              Essential only
            </button>
            {!custom && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setCustom(true)}>
                Customise
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
