import 'server-only';

export type CashfreeMode = 'mock' | 'sandbox' | 'production';

// Every value is read lazily so tests and serverless cold starts always see the current environment.
function cashfreeMode(): CashfreeMode {
  const m = (process.env.CASHFREE_MODE ?? 'mock') as CashfreeMode;
  if (!['mock', 'sandbox', 'production'].includes(m)) throw new Error(`Invalid CASHFREE_MODE "${m}"`);
  if (m === 'mock' && process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PAYMENTS !== 'true') {
    throw new Error('CASHFREE_MODE=mock is not allowed in production');
  }
  if (m === 'production' && process.env.CASHFREE_ALLOW_PRODUCTION !== 'true') {
    // Live payments are deliberately locked until launch sign-off (docs/LAUNCH_CHECKLIST.md).
    throw new Error('Live Cashfree payments are locked. Set CASHFREE_ALLOW_PRODUCTION=true only at launch.');
  }
  return m;
}

export const env = {
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  },
  get cashfree() {
    const mode = cashfreeMode();
    const secret = process.env.CASHFREE_SECRET_KEY ?? '';
    return {
      mode,
      appId: process.env.CASHFREE_APP_ID ?? '',
      secret,
      // Cashfree signs webhooks with the client secret. CASHFREE_WEBHOOK_SECRET only overrides it if set.
      webhookSecret: process.env.CASHFREE_WEBHOOK_SECRET || secret,
      apiVersion: '2023-08-01',
      baseUrl: mode === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
      /** Re-check successful payments with the Cashfree API before marking paid (default on). */
      verifyWithApi: process.env.CASHFREE_VERIFY_WITH_API !== 'false',
    };
  },
  get crmWebhookUrl() {
    return process.env.CRM_WEBHOOK_URL ?? '';
  },
  get emailWebhookUrl() {
    return process.env.EMAIL_WEBHOOK_URL || process.env.NOTIFY_WEBHOOK_URL || '';
  },
  get whatsappWebhookUrl() {
    return process.env.WHATSAPP_WEBHOOK_URL || process.env.NOTIFY_WEBHOOK_URL || '';
  },
  get opsAlertWebhookUrl() {
    return process.env.OPS_ALERT_WEBHOOK_URL ?? '';
  },
  /** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Unset = scheduled jobs refuse to run. */
  get cronSecret() {
    return process.env.CRON_SECRET ?? '';
  },
  get integrationSigningSecret() {
    return process.env.INTEGRATION_SIGNING_SECRET ?? '';
  },
  get hashSalt() {
    return process.env.HASH_SALT || 'sm-default-salt';
  },
};
