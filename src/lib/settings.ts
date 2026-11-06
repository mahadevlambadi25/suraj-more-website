import 'server-only';
import { z } from 'zod';
import { settings as fileSettings } from '@/content/settings';
import { prisma } from './db';
import type { SiteSettings } from './types';

// Admin-editable settings (stored in AppSetting). Anything payment-related is deliberately NOT here:
// payment configuration only comes from server environment variables.
export const EDITABLE_SETTINGS = {
  contactEmail: { label: 'Support email', schema: z.string().trim().email() },
  whatsappNumber: { label: 'WhatsApp number (digits incl. country code)', schema: z.string().trim().regex(/^\d{10,15}$/, 'Digits only, e.g. 919876543210') },
  whatsappDisplay: { label: 'WhatsApp number as displayed', schema: z.string().trim().min(6).max(30) },
  levelZeroJoinUrl: { label: 'Level Zero (Whop) join URL', schema: z.string().trim().url().startsWith('https://') },
  mentorshipBookingUrl: { label: 'Mentorship booking link (sent only after acceptance)', schema: z.union([z.literal(''), z.string().trim().url().startsWith('https://')]) },
} as const;

export type SettingKey = keyof typeof EDITABLE_SETTINGS;

export async function getSettingOverrides(): Promise<Partial<Record<SettingKey, string>>> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.keys(EDITABLE_SETTINGS) } } });
  return Object.fromEntries(rows.filter((r) => typeof r.value === 'string').map((r) => [r.key, r.value as string]));
}

/** Content-file settings merged with admin overrides. Falls back to the file if the DB is unreachable. */
export async function getMergedSettings(): Promise<SiteSettings> {
  let o: Partial<Record<SettingKey, string>> = {};
  try {
    o = await getSettingOverrides();
  } catch (err) {
    console.error('[settings] using file defaults; database unavailable', err instanceof Error ? err.message : err);
  }
  return {
    ...fileSettings,
    contact: {
      email: o.contactEmail || fileSettings.contact.email,
      whatsappNumber: o.whatsappNumber || fileSettings.contact.whatsappNumber,
      whatsappDisplay: o.whatsappDisplay || fileSettings.contact.whatsappDisplay,
    },
    levelZero: { joinUrl: o.levelZeroJoinUrl || fileSettings.levelZero.joinUrl },
  };
}

export async function getMentorshipBookingUrl() {
  const o = await getSettingOverrides().catch(() => ({}) as Partial<Record<SettingKey, string>>);
  return o.mentorshipBookingUrl || process.env.MENTORSHIP_BOOKING_URL || '';
}
