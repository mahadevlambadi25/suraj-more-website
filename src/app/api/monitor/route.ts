import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { alertOps } from '@/lib/integrations';
import { clientIp, isRateLimited } from '@/lib/security';

// PRD §13.2 / §13.3: error monitoring + 404 monitoring. Browser-side page errors and "page not found" hits are
// recorded in the operations alert ledger (visible in /ops → Overview) and forwarded to OPS_ALERT_WEBHOOK_URL
// when one is configured. Only the path is kept — never query strings, form data or personal details.
export const dynamic = 'force-dynamic';

const pathOnly = (v: string) => {
  try {
    const u = new URL(v, 'https://x.invalid');
    return u.pathname.slice(0, 200);
  } catch {
    return '';
  }
};

const schema = z.object({
  type: z.enum(['client_error', 'not_found']),
  path: z.string().max(500).transform(pathOnly),
  referrer: z.string().max(500).optional().transform((v) => {
    if (!v) return undefined;
    try {
      const u = new URL(v);
      return `${u.origin}${u.pathname}`.slice(0, 200);
    } catch {
      return undefined;
    }
  }),
  digest: z.string().max(80).regex(/^[A-Za-z0-9_-]*$/).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success || !parsed.data.path) return NextResponse.json({ ok: false }, { status: 400 });

  // Bots probing random URLs must not flood the ledger.
  if (await isRateLimited('monitor', clientIp(req.headers), 10, 60_000)) return NextResponse.json({ ok: true, recorded: false });

  const { type, path, referrer, digest } = parsed.data;
  await alertOps(type === 'not_found' ? `Page not found (404): ${path}` : `Page error on ${path}`, { type, path, referrer, digest });
  return NextResponse.json({ ok: true, recorded: true });
}
