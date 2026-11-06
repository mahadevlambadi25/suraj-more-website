import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Health check for uptime monitors and post-deploy verification. Never returns secrets. */
export async function GET() {
  const started = Date.now();
  let database: 'ok' | 'error' = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'error';
  }
  let paymentMode: string;
  try {
    paymentMode = env.cashfree.mode;
  } catch {
    paymentMode = 'misconfigured';
  }
  const ok = database === 'ok' && paymentMode !== 'misconfigured';
  return NextResponse.json(
    { status: ok ? 'ok' : 'degraded', database, paymentMode, latencyMs: Date.now() - started, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
