import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { z, ZodTypeAny } from 'zod';
import { clientIp, isRateLimited } from './security';
import { antiSpamSchema, attributionSchema, fieldErrors, type Attribution } from './validation';

// ── Fast in-memory limiter: only for cheap, high-frequency reads (order status polling).
//    Form submissions use the database-backed limiter below, which works across serverless instances. ──
const g = globalThis as unknown as { __smRate?: Map<string, number[]> };
g.__smRate ??= new Map();

export function rateLimited(req: NextRequest, bucket: string, max = 6, windowMs = 60_000) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
  const key = `${bucket}:${ip}`;
  const t = Date.now();
  const hits = (g.__smRate!.get(key) ?? []).filter((h) => t - h < windowMs);
  hits.push(t);
  g.__smRate!.set(key, hits);
  return hits.length > max;
}

export function jsonError(status: number, message: string, errors?: Record<string, string>) {
  return NextResponse.json({ ok: false, message, errors }, { status });
}

/**
 * Parses a public form submission: rate limit → JSON → honeypot/timing → schema.
 * Returns either { data, attribution } or a ready-to-return error response.
 */
export async function parseForm<S extends ZodTypeAny, T = z.infer<S>>(
  req: NextRequest,
  bucket: string,
  schema: S,
): Promise<{ data: T; attribution: Attribution } | { response: NextResponse }> {
  let limited: boolean;
  try {
    limited = await isRateLimited(`form:${bucket}`, clientIp(req.headers), 6, 60_000);
  } catch {
    limited = rateLimited(req, bucket); // DB unavailable → best-effort in-memory limit
  }
  if (limited) return { response: jsonError(429, 'Too many attempts. Please wait a minute and try again.') };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return { response: jsonError(400, 'Invalid request.') };
  }

  const spam = antiSpamSchema.safeParse(body);
  const tooFast = typeof body.startedAt === 'number' && Date.now() - body.startedAt < 1500;
  if (!spam.success || tooFast) {
    // Pretend success to bots; do nothing.
    return { response: NextResponse.json({ ok: true }) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return { response: jsonError(422, 'Please check the highlighted fields.', fieldErrors(parsed.error)) };

  const attribution = attributionSchema.safeParse(body.attribution);
  return { data: parsed.data as T, attribution: attribution.success ? attribution.data : undefined };
}
