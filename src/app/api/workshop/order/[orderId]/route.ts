import { NextResponse, type NextRequest } from 'next/server';
import { rateLimited } from '@/lib/api';
import { getOrderStatus } from '@/lib/orders';

export const dynamic = 'force-dynamic';

/** Read-only order status for the confirmation page. Never changes payment state from the browser. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  if (rateLimited(req, 'order-status', 60)) return NextResponse.json({ ok: false }, { status: 429 });
  const { orderId } = await params;
  if (!/^[A-Za-z0-9_-]{6,45}$/.test(orderId)) return NextResponse.json({ ok: false }, { status: 404 });

  const status = await getOrderStatus(orderId, req.nextUrl.searchParams.get('claim') === '1');
  if (!status) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } });
}
