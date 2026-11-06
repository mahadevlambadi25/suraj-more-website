import 'server-only';
import crypto from 'crypto';
import type { IntegrationChannel, IntegrationStatus } from '@prisma/client';
import { prisma } from './db';
import { env } from './env';
import { safeError } from './security';

// Provider-agnostic integration layer. No CRM / email / WhatsApp provider has been chosen yet (brief §8),
// so each channel POSTs a JSON event to a configurable webhook (Make, Zapier, n8n or a provider endpoint).
//
// Every attempt is written to IntegrationEvent with an HONEST status:
//   SENT            provider endpoint accepted it (2xx)
//   NOT_CONFIGURED  no endpoint configured — the message was NOT delivered
//   SKIPPED         e.g. promotional message without consent
//   FAILED          endpoint errored

export type DeliveryStatus = IntegrationStatus;

interface Related {
  relatedType?: string;
  relatedId?: string;
}

function sign(body: string) {
  const secret = env.integrationSigningSecret;
  return secret ? crypto.createHmac('sha256', secret).update(body).digest('hex') : undefined;
}

async function deliver(opts: {
  channel: IntegrationChannel;
  kind: string;
  template: string;
  recipient?: string;
  url: string;
  payload: Record<string, unknown>;
  skip?: boolean;
} & Related): Promise<DeliveryStatus> {
  let status: DeliveryStatus;
  let error: string | undefined;

  if (opts.skip) {
    status = 'SKIPPED';
  } else if (!opts.url) {
    status = 'NOT_CONFIGURED';
    if (process.env.NODE_ENV !== 'test') console.info(`[integration:not-configured] ${opts.channel} ${opts.template} → ${opts.recipient ?? ''}`);
  } else {
    try {
      const body = JSON.stringify({ channel: opts.channel, kind: opts.kind, template: opts.template, to: opts.recipient, data: opts.payload, at: new Date().toISOString() });
      const signature = sign(body);
      const res = await fetch(opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(signature ? { 'X-Signature': signature } : {}) },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      status = 'SENT';
    } catch (err) {
      status = 'FAILED';
      error = safeError(err);
    }
  }

  await prisma.integrationEvent
    .create({
      data: {
        channel: opts.channel,
        kind: opts.kind,
        template: opts.template,
        recipient: opts.recipient,
        status,
        error,
        // Never store delivery secrets (e.g. Zoom passcodes) in the ledger.
        payload: JSON.parse(JSON.stringify({ ...opts.payload, zoomJoinUrl: undefined, zoomPasscode: undefined })),
        relatedType: opts.relatedType,
        relatedId: opts.relatedId,
      },
    })
    .catch((e) => console.error('[integration] could not record event', safeError(e)));

  return status;
}

/** Transactional and promotional messages are kept strictly separate (brief §4). */
export function sendMessage(msg: {
  kind: 'transactional' | 'promotional';
  channel: 'email' | 'whatsapp';
  template: string;
  to: string;
  data: Record<string, unknown>;
  consentGranted?: boolean;
} & Related) {
  return deliver({
    channel: msg.channel === 'email' ? 'EMAIL' : 'WHATSAPP',
    kind: msg.kind,
    template: msg.template,
    recipient: msg.to,
    url: msg.channel === 'email' ? env.emailWebhookUrl : env.whatsappWebhookUrl,
    payload: msg.data,
    skip: msg.kind === 'promotional' && !msg.consentGranted,
    relatedType: msg.relatedType,
    relatedId: msg.relatedId,
  });
}

/** CRM: lead source, tags, form responses, cohort registration, application status. */
export function crmSync(event: {
  type: 'lead' | 'workshop_registration' | 'mentorship_application' | 'application_status' | 'waitlist';
  email: string;
  name?: string;
  phone?: string;
  tags: string[];
  fields?: Record<string, unknown>;
  marketingConsent?: boolean;
} & Related) {
  const { relatedType, relatedId, ...payload } = event;
  return deliver({ channel: 'CRM', kind: 'sync', template: event.type, recipient: event.email, url: env.crmWebhookUrl, payload, relatedType, relatedId });
}

/** Ops visibility for failed payments, webhook errors, missing confirmations, form failures. */
export async function alertOps(message: string, context: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV !== 'test') console.error('[ops-alert]', message, JSON.stringify(context));
  await deliver({ channel: 'OPS_ALERT', kind: 'alert', template: 'ops_alert', url: env.opsAlertWebhookUrl, payload: { message, ...context } }).catch(() => undefined);
}

export function integrationStatus() {
  return {
    email: !!env.emailWebhookUrl,
    whatsapp: !!env.whatsappWebhookUrl,
    crm: !!env.crmWebhookUrl,
    opsAlerts: !!env.opsAlertWebhookUrl,
  };
}
