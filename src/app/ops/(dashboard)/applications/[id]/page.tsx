import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getApplication } from '@/lib/admin/queries';
import { hasRole } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/guards';
import { getMentorshipBookingUrl } from '@/lib/settings';
import { TIMELINES } from '@/lib/validation';
import { decideApplicationAction } from '../../../actions';
import { ConfirmButton } from '../../../_components/controls';
import { Alert, BackLink, Badge, Card, Flash, fmtDate, KV, PageHeader, type SP } from '../../../_components/ui';

export default async function ApplicationDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const { id } = await params;
  const sp = await searchParams;
  const a = await getApplication(id);
  if (!a) notFound();
  const bookingUrl = await getMentorshipBookingUrl();
  const here = `/ops/applications/${a.id}`;
  const canDecide = hasRole(admin, 'ADMIN') && a.status === 'NEW';

  return (
    <>
      <PageHeader title={a.name} description={<>Mentorship application · received {fmtDate(a.createdAt)}</>} actions={<BackLink href="/ops/applications">Applications</BackLink>} />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="o-grid-main">
        <div className="o-stack">
          <Card title="Their business">
            <KV wide items={[['Offer', <span key="o" className="o-prewrap">{a.offer}</span>], ['Biggest sales challenge', <span key="c" className="o-prewrap">{a.salesChallenge}</span>], ['Desired 90-day outcome', <span key="d" className="o-prewrap">{a.desiredOutcome}</span>], ...(a.revenueRange ? ([['Revenue range', a.revenueRange]] as [string, string][]) : [])]} />
          </Card>
        </div>

        <div className="o-stack">
          <Card title="Applicant">
            <KV
              items={[
                ['Status', <Badge key="s" value={a.status}>{a.status === 'NEW' ? 'awaiting decision' : undefined}</Badge>],
                ['Email', <a key="e" href={`mailto:${a.email}`}>{a.email}</a>],
                ['Phone', a.phone],
                ['Website / social', a.link],
                ['Timeline', TIMELINES.find((t) => t.value === a.timeline)?.label ?? a.timeline],
                ['Timezone', a.timezone],
                ['Lead', <Link key="l" href={`/ops/leads/${a.leadId}`}>View lead</Link>],
              ]}
            />
          </Card>

          {a.status !== 'NEW' ? (
            <Card title="Decision">
              <KV
                items={[
                  ['Decision', <Badge key="d" value={a.status} />],
                  ['By', a.decidedBy?.name ?? '—'],
                  ['On', fmtDate(a.decidedAt)],
                  ...(a.status === 'ACCEPTED' ? ([['Booking link', a.bookingLinkSentAt ? <Badge key="b" tone="ok">emailed {fmtDate(a.bookingLinkSentAt)}</Badge> : <Badge key="b" tone="bad">not delivered</Badge>]] as [string, React.ReactNode][]) : []),
                  ...(a.decisionNote ? ([['Note', a.decisionNote]] as [string, string][]) : []),
                ]}
              />
              {a.status === 'ACCEPTED' && !a.bookingLinkSentAt && <div style={{ marginTop: 14 }}><Alert tone="warn">The booking link email was not delivered (no email provider configured or it failed). Contact the applicant manually.</Alert></div>}
            </Card>
          ) : canDecide ? (
            <Card title="Decision" description="The applicant is emailed either way. You can decide only once.">
              <form action={decideApplicationAction} className="o-form">
                <input type="hidden" name="applicationId" value={a.id} />
                <input type="hidden" name="returnTo" value={here} />
                <div className="o-field">
                  <label htmlFor="note">Internal note <span className="o-optional">(optional)</span></label>
                  <textarea className="o-textarea" id="note" name="note" rows={3} maxLength={1000} placeholder="Only visible to your team" />
                </div>
                {!bookingUrl && <Alert tone="info">Add the mentorship booking link in <Link href="/ops/settings">Settings</Link> before accepting — it is emailed only after acceptance.</Alert>}
                <div className="o-form-actions" style={{ justifyContent: 'flex-start' }}>
                  <ConfirmButton variant="primary" name="decision" value="ACCEPTED" disabled={!bookingUrl} title="Accept this application?" message={`${a.name} will be emailed your booking link so they can schedule a conversation.`} confirmLabel="Accept & send link">
                    Accept
                  </ConfirmButton>
                  <ConfirmButton variant="danger-outline" tone="danger" name="decision" value="REJECTED" title="Reject this application?" message={`${a.name} will be told this isn’t the right fit right now. This cannot be undone.`} confirmLabel="Reject application">
                    Reject
                  </ConfirmButton>
                </div>
              </form>
            </Card>
          ) : (
            <Card title="Decision"><p className="o-muted">Awaiting a decision by an admin.</p></Card>
          )}
        </div>
      </div>
    </>
  );
}
