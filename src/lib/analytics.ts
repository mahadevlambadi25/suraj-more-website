'use client';

// Client analytics: pushes to the GTM dataLayer. GTM itself only loads after consent,
// so events queue harmlessly until then. Event names follow the brief (§5).
type EventName =
  | 'primary_cta_click'
  | 'free_training_submit'
  | 'video_progress'
  | 'workshop_checkout_start'
  | 'purchase'
  | 'mentorship_application_submit'
  | 'booking_complete'
  | 'whatsapp_click'
  | 'waitlist_submit'
  | 'outbound_click';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

const ATTR_KEY = 'sm_attr';

export type ClientAttribution = Partial<Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content' | 'referrer' | 'landingPage', string>>;

/** Captures first-touch UTM + referrer for the session. Called once from the root layout. */
export function captureAttribution() {
  try {
    if (sessionStorage.getItem(ATTR_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const attr: ClientAttribution = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const) {
      const v = params.get(k);
      if (v) attr[k] = v.slice(0, 150);
    }
    if (document.referrer && !document.referrer.startsWith(window.location.origin)) attr.referrer = document.referrer.slice(0, 300);
    attr.landingPage = window.location.pathname;
    sessionStorage.setItem(ATTR_KEY, JSON.stringify(attr));
  } catch {
    /* storage unavailable */
  }
}

export function getAttribution(): ClientAttribution {
  try {
    return JSON.parse(sessionStorage.getItem(ATTR_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function track(event: EventName, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const attr = getAttribution();
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    page: window.location.pathname,
    utm_source: attr.utm_source,
    utm_medium: attr.utm_medium,
    utm_campaign: attr.utm_campaign,
    ...params,
  });
}
