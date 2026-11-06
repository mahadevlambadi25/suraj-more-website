import { NextResponse, type NextRequest } from 'next/server';
import { jsonError, parseForm } from '@/lib/api';
import { createWorkshopOrder, OrderError } from '@/lib/orders';
import { safeError } from '@/lib/security';
import { workshopOrderSchema } from '@/lib/validation';

/** Step 1 of the payment flow: create a PENDING order and a Cashfree payment session. */
export async function POST(req: NextRequest) {
  const parsed = await parseForm(req, 'workshop-order', workshopOrderSchema);
  if ('response' in parsed) return parsed.response;

  try {
    const result = await createWorkshopOrder(parsed.data, parsed.attribution);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof OrderError && (err.code === 'COHORT_CLOSED' || err.code === 'COHORT_FULL')) return jsonError(409, err.message);
    if (err instanceof OrderError) return jsonError(502, err.message);
    console.error('[workshop-order]', safeError(err));
    return jsonError(500, 'Something went wrong starting your registration. Please try again.');
  }
}
