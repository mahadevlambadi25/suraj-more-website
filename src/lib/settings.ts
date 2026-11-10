import 'server-only';
import { z } from 'zod';
import { settings as fileSettings } from '@/content/settings';
import { prisma } from './db';
import type { SiteSettings, VideoRef } from './types';
import { parseVideoUrl } from './video';

/** Optional https profile URL on one of the given hosts (PRD §5.2: approved profile links only). */
const profileUrl = (hosts: string[], name: string) =>
  z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .max(300)
      .url()
      .startsWith('https://', 'Must be an https:// link')
      .refine((v) => hosts.includes(new URL(v).hostname.replace(/^www\./, '').replace(/^m\./, '')), `Enter a valid ${name} profile link`),
  ]);

// Admin-editable settings (stored in AppSetting). Anything payment-related is deliberately NOT here:
// payment configuration only comes from server environment variables.
export const EDITABLE_SETTINGS = {
  contactEmail: { label: 'Support email', schema: z.string().trim().email() },
  whatsappNumber: { label: 'WhatsApp number (digits incl. country code)', schema: z.string().trim().regex(/^\d{10,15}$/, 'Digits only, e.g. 919876543210') },
  whatsappDisplay: { label: 'WhatsApp number as displayed', schema: z.string().trim().min(6).max(30) },
  levelZeroJoinUrl: { label: 'Level Zero (Whop) join URL', schema: z.string().trim().url().startsWith('https://') },
  mentorshipBookingUrl: { label: 'Mentorship booking link (sent only after acceptance)', schema: z.union([z.literal(''), z.string().trim().url().startsWith('https://')]) },
  // PRD §5.2 / §11.2 social links — shown in the footer and the Person schema only when set.
  instagramUrl: { label: 'Instagram profile URL (optional)', schema: profileUrl(['instagram.com'], 'Instagram') },
  linkedinUrl: { label: 'LinkedIn profile URL (optional)', schema: profileUrl(['linkedin.com'], 'LinkedIn') },
  youtubeUrl: { label: 'YouTube channel URL (optional)', schema: profileUrl(['youtube.com'], 'YouTube') },
  // Shown in its own "Free Training" card in /ops → Settings. Empty = no video (the watch page says so).
  freeTrainingVideoUrl: {
    label: 'Free Training Video URL',
    section: 'freeTraining',
    schema: z.union([
      z.literal(''),
      z.string().trim().max(500).refine((v) => parseVideoUrl(v) !== null, 'Enter a valid YouTube or Vimeo video link (e.g. https://youtu.be/… or https://vimeo.com/…)'),
    ]),
  },
  // PRD §11.1 / §9.4: captions and a transcript for the training video.
  freeTrainingVideoCaptions: {
    label: 'Show captions by default',
    section: 'freeTraining',
    schema: z.enum(['on', 'off'], { errorMap: () => ({ message: 'Choose on or off' }) }),
  },
  freeTrainingVideoTranscript: {
    label: 'Video transcript (optional)',
    section: 'freeTraining',
    // Browsers submit textarea line breaks as CRLF; normalise to LF so paragraphs split correctly.
    schema: z.string().trim().max(20000, 'Transcript is too long (max 20,000 characters)').transform((v) => v.replace(/\r\n?/g, '\n')),
  },
} as const;

/** Settings shown in the general "Site settings" card (everything without its own section). */
export const SITE_SETTING_KEYS = (Object.keys(EDITABLE_SETTINGS) as (keyof typeof EDITABLE_SETTINGS)[]).filter((k) => !('section' in EDITABLE_SETTINGS[k]));

/** Saved video URL → what the player embeds. Null when empty or no longer recognised. */
export function videoFromUrl(url: string | undefined, title: string, extra: { captions?: boolean; transcript?: string } = {}): VideoRef | null {
  const v = url ? parseVideoUrl(url) : null;
  if (!v) return null;
  return {
    ...v,
    title,
    captions: extra.captions ?? false,
    ...(extra.transcript ? { transcript: extra.transcript } : {}),
    ...(v.provider === 'youtube' ? { poster: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` } : {}),
  };
}

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
    socials: socialsFrom(o, fileSettings.socials),
    freeTraining: {
      ...fileSettings.freeTraining,
      // Once an admin has saved this setting it wins (an empty value means "no video yet").
      video:
        o.freeTrainingVideoUrl !== undefined
          ? videoFromUrl(o.freeTrainingVideoUrl, `Free training: ${fileSettings.freeTraining.headline}`, {
              captions: o.freeTrainingVideoCaptions === 'on',
              transcript: o.freeTrainingVideoTranscript || undefined,
            })
          : fileSettings.freeTraining.video,
    },
  };
}

/** Admin-set profile links win; with none saved, the content-file list is used. */
function socialsFrom(o: Partial<Record<SettingKey, string>>, fallback: SiteSettings['socials']): SiteSettings['socials'] {
  const set = ([['Instagram', o.instagramUrl], ['LinkedIn', o.linkedinUrl], ['YouTube', o.youtubeUrl]] as const).filter(([, href]) => href !== undefined);
  if (set.length === 0) return fallback;
  return set.filter(([, href]) => !!href).map(([label, href]) => ({ label, href: href! }));
}

export async function getMentorshipBookingUrl() {
  const o = await getSettingOverrides().catch(() => ({}) as Partial<Record<SettingKey, string>>);
  return o.mentorshipBookingUrl || process.env.MENTORSHIP_BOOKING_URL || '';
}
