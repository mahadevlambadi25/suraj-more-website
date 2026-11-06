// Shape of the RETIRED local JSON store (.data/db.json) used before PostgreSQL.
// Kept only so scripts/import-legacy-json.ts can migrate existing records. Nothing at runtime uses it.

export interface LegacyConsent {
  granted: boolean;
  wording: string;
  timestamp: string;
  source: string;
}

export interface LegacyAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landingPage?: string;
}

export interface LegacyDB {
  leads: {
    id: string;
    createdAt: string;
    name: string;
    email: string;
    phone: string;
    audienceType: string;
    city?: string;
    businessUrl?: string;
    consents: { marketing: LegacyConsent; whatsapp: LegacyConsent };
    attribution?: LegacyAttribution;
  }[];
  applications: {
    id: string;
    createdAt: string;
    name: string;
    email: string;
    phone: string;
    link: string;
    offer: string;
    salesChallenge: string;
    desiredOutcome: string;
    timeline: string;
    timezone: string;
    revenueRange?: string;
    status: 'new' | 'accepted' | 'declined';
    decidedAt?: string;
    consents: { marketing: LegacyConsent };
    attribution?: LegacyAttribution;
  }[];
  waitlist: { id: string; createdAt: string; name: string; email: string; programId: string; consents: { marketing: LegacyConsent }; attribution?: LegacyAttribution }[];
  orders: {
    id: string;
    createdAt: string;
    updatedAt: string;
    cohortId: string; // legacy cohort slug, e.g. "osw-sample-01"
    customer: { name: string; email: string; phone: string };
    vipAddon: boolean;
    lineItems: { label: string; amountInr: number }[];
    amountInr: number;
    currency: 'INR';
    status: 'pending' | 'paid' | 'failed' | 'dropped' | 'refund_pending' | 'refunded' | 'needs_review';
    paymentSessionId?: string;
    cfPaymentId?: string;
    paidAt?: string;
    fulfilment: { confirmationSentAt?: string; zoomSentAt?: string; crmSyncedAt?: string; lastError?: string };
    purchaseEventClaimedAt?: string;
    consents: { terms: LegacyConsent & { version: string }; marketing: LegacyConsent };
    attribution?: LegacyAttribution;
    log: { at: string; event: string; detail?: string }[];
  }[];
  webhookEvents: { id: string; receivedAt: string; type: string; orderId?: string; processedAt?: string; error?: string }[];
  clicks: { id: string; createdAt: string; target: string; referrer?: string }[];
}
