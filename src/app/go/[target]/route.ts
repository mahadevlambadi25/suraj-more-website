import { NextResponse, type NextRequest } from 'next/server';
import { getSettings } from '@/lib/cms';
import { prisma } from '@/lib/db';

// Outbound click tracker (brief: Whop "outbound click track karna"). Counts server-side, then redirects.
export async function GET(req: NextRequest, { params }: { params: Promise<{ target: string }> }) {
  const { target } = await params;
  const settings = await getSettings();
  const destinations: Record<string, string> = { 'level-zero': settings.levelZero.joinUrl };
  const url = destinations[target];
  if (!url) return NextResponse.redirect(new URL('/', req.url));

  await prisma.outboundClick
    .create({ data: { target, referrer: req.headers.get('referer')?.slice(0, 300) ?? null } })
    .catch(() => undefined); // tracking must never block the redirect

  return NextResponse.redirect(url, 302);
}
