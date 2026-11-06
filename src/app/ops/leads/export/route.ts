import { NextResponse, type NextRequest } from 'next/server';
import { leadsCsv } from '@/lib/admin/queries';
import { audit } from '@/lib/audit';
import { getCurrentAdmin, requestMeta } from '@/lib/auth/guards';
import { hasRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** CSV export of leads (contains personal data → ADMIN role, audited). Cookie is SameSite=Strict. */
export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 401 });
  if (!hasRole(admin, 'ADMIN')) return NextResponse.json({ ok: false }, { status: 403 });

  const p = req.nextUrl.searchParams;
  const filters = { q: p.get('q') ?? undefined, source: p.get('source') ?? undefined, status: p.get('status') ?? undefined, from: p.get('from') ?? undefined, to: p.get('to') ?? undefined };
  const { csv, count } = await leadsCsv(filters);
  const { ipHash } = await requestMeta();
  await audit({ adminId: admin.id, action: 'leads.export', entityType: 'lead', metadata: { filters, count }, ipHash });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
