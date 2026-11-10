import { listAdmins } from '@/lib/admin/queries';
import { hasRole } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/guards';
import { env } from '@/lib/env';
import { integrationStatus } from '@/lib/integrations';
import { EDITABLE_SETTINGS, getMentorshipBookingUrl, getMergedSettings, getSettingOverrides, SITE_SETTING_KEYS } from '@/lib/settings';
import { setAdminActiveAction, updateSettingsAction } from '../../actions';
import { ActionForm } from '../../_components/ActionForm';
import { SubmitButton } from '../../_components/controls';
import { Alert, Badge, Card, Flash, fmtDate, PageHeader, type SP } from '../../_components/ui';

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const sp = await searchParams;
  const isOwner = hasRole(admin, 'OWNER');
  const [settings, bookingUrl, admins, overrides] = await Promise.all([getMergedSettings(), getMentorshipBookingUrl(), listAdmins(), getSettingOverrides()]);
  const savedVideoUrl = overrides.freeTrainingVideoUrl ?? '';
  const video = settings.freeTraining.video;
  const current: Record<string, string> = {
    contactEmail: settings.contact.email,
    whatsappNumber: settings.contact.whatsappNumber,
    whatsappDisplay: settings.contact.whatsappDisplay,
    levelZeroJoinUrl: settings.levelZero.joinUrl,
    mentorshipBookingUrl: bookingUrl,
    instagramUrl: overrides.instagramUrl ?? '',
    linkedinUrl: overrides.linkedinUrl ?? '',
    youtubeUrl: overrides.youtubeUrl ?? '',
  };

  let cf: { mode: string; appIdSet: boolean; secretSet: boolean; webhookSecretOverride: boolean; verifyWithApi: boolean; error?: string };
  try {
    const c = env.cashfree;
    cf = { mode: c.mode, appIdSet: !!c.appId, secretSet: !!c.secret, webhookSecretOverride: !!process.env.CASHFREE_WEBHOOK_SECRET, verifyWithApi: c.verifyWithApi };
  } catch (e) {
    cf = { mode: 'misconfigured', appIdSet: false, secretSet: false, webhookSecretOverride: false, verifyWithApi: false, error: e instanceof Error ? e.message : undefined };
  }
  const integ = integrationStatus();
  const configured = (ok: boolean) => (ok ? <Badge tone="ok">configured</Badge> : <Badge tone="bad">not configured</Badge>);

  return (
    <>
      <PageHeader title="Settings" description="Site contact details, integration status and admin accounts." />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="o-grid-main">
        <div className="o-stack">
          <Card title="Site settings" description={isOwner ? 'Shown on the public website. Changes appear within a few minutes.' : 'Only the owner can change these.'}>
            <form action={updateSettingsAction} className="o-form">
              <input type="hidden" name="returnTo" value="/ops/settings" />
              <fieldset disabled={!isOwner} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 18, minWidth: 0 }}>
                {SITE_SETTING_KEYS.map((key) => (
                  <div className="o-field" key={key}>
                    <label htmlFor={key}>{EDITABLE_SETTINGS[key].label}</label>
                    <input className="o-input" id={key} name={key} defaultValue={current[key]} />
                  </div>
                ))}
                {isOwner && <div className="o-form-actions"><SubmitButton pendingLabel="Saving…">Save settings</SubmitButton></div>}
              </fieldset>
            </form>
          </Card>

          <Card title="Free Training" description={isOwner ? 'The video people see on the Free Training watch page after registering.' : 'Only the owner can change this.'}>
            <form action={updateSettingsAction} className="o-form">
              <input type="hidden" name="returnTo" value="/ops/settings" />
              <fieldset disabled={!isOwner} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 18, minWidth: 0 }}>
                <div className="o-field">
                  <label htmlFor="freeTrainingVideoUrl">{EDITABLE_SETTINGS.freeTrainingVideoUrl.label}</label>
                  <input
                    className="o-input"
                    id="freeTrainingVideoUrl"
                    name="freeTrainingVideoUrl"
                    type="url"
                    inputMode="url"
                    placeholder="https://youtu.be/… or https://vimeo.com/…"
                    defaultValue={savedVideoUrl}
                  />
                  <p className="o-hint">YouTube or Vimeo link. Unlisted videos work (for unlisted Vimeo, paste the full share link including its private code). Leave empty to show “Training video is not available yet.”</p>
                </div>
                <div className="o-field">
                  <label htmlFor="freeTrainingVideoCaptions">{EDITABLE_SETTINGS.freeTrainingVideoCaptions.label}</label>
                  <select className="o-select" id="freeTrainingVideoCaptions" name="freeTrainingVideoCaptions" defaultValue={overrides.freeTrainingVideoCaptions === 'on' ? 'on' : 'off'}>
                    <option value="off">Off (viewers can still turn them on)</option>
                    <option value="on">On — show captions when the video starts</option>
                  </select>
                  <p className="o-hint">Uses the captions uploaded to YouTube or Vimeo for this video.</p>
                </div>
                <div className="o-field">
                  <label htmlFor="freeTrainingVideoTranscript">{EDITABLE_SETTINGS.freeTrainingVideoTranscript.label}</label>
                  <textarea className="o-textarea" id="freeTrainingVideoTranscript" name="freeTrainingVideoTranscript" rows={5} maxLength={20000} defaultValue={overrides.freeTrainingVideoTranscript ?? ''} placeholder="Paste the transcript. Leave a blank line between paragraphs." />
                  <p className="o-hint">Shown under the video as “Read the transcript”. Leave empty to hide it.</p>
                </div>
                <dl className="o-dl">
                  <div>
                    <dt>Currently saved</dt>
                    <dd className="o-break">{savedVideoUrl ? <a href={savedVideoUrl} target="_blank" rel="noopener noreferrer">{savedVideoUrl}</a> : <span className="o-muted">No video set</span>}</dd>
                  </div>
                  <div>
                    <dt>Watch page shows</dt>
                    <dd>
                      {video ? (
                        <>
                          <Badge tone="ok">{video.provider === 'youtube' ? 'YouTube video' : 'Vimeo video'}</Badge>{' '}
                          <span className="o-mono o-small">{video.id}{video.hash ? ` (private link)` : ''}</span>
                        </>
                      ) : (
                        <Badge tone="warn">Not available message</Badge>
                      )}
                    </dd>
                  </div>
                </dl>
                {isOwner && <div className="o-form-actions"><SubmitButton pendingLabel="Saving…">Save Changes</SubmitButton></div>}
              </fieldset>
            </form>
          </Card>

          <Card title="Admin accounts" description="New admins are created with npm run admin:create (see docs/ADMIN_DASHBOARD.md)." flush>
            <div className="o-table-wrap">
              <table className="o-table">
                <thead><tr><th>Admin</th><th>Role</th><th>Status</th><th className="o-hide-sm">Last sign-in</th><th /></tr></thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id}>
                      <td><span className="o-cell-title">{a.name}{a.id === admin.id && <span className="o-muted"> (you)</span>}</span><span className="o-cell-sub">{a.email}</span></td>
                      <td style={{ textTransform: 'capitalize' }}>{a.role.toLowerCase()}</td>
                      <td><Badge tone={a.isActive ? 'ok' : 'muted'}>{a.isActive ? 'active' : 'deactivated'}</Badge></td>
                      <td className="o-hide-sm o-nowrap">{fmtDate(a.lastLoginAt)}</td>
                      <td>
                        {isOwner && a.id !== admin.id && (
                          <div className="o-table-actions">
                            <ActionForm
                              action={setAdminActiveAction}
                              fields={{ adminId: a.id, active: String(!a.isActive) }}
                              returnTo="/ops/settings"
                              variant={a.isActive ? 'danger-outline' : 'secondary'}
                              label={a.isActive ? 'Deactivate' : 'Activate'}
                              confirm={
                                a.isActive
                                  ? { title: `Deactivate ${a.name}?`, message: 'They will be signed out immediately and will not be able to sign in until reactivated.', confirmLabel: 'Deactivate', tone: 'danger' }
                                  : { title: `Activate ${a.name}?`, message: 'They will be able to sign in again with their existing password.', confirmLabel: 'Activate' }
                              }
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="o-stack">
          <Card title="Payments" description="Configured with server environment variables. Secrets are never shown here.">
            {cf.error && <div style={{ marginBottom: 14 }}><Alert tone="bad" title="Payment configuration problem">{cf.error}</Alert></div>}
            <dl className="o-dl">
              <div><dt>Mode</dt><dd><Badge tone={cf.mode === 'production' ? 'bad' : cf.mode === 'misconfigured' ? 'bad' : 'warn'}>{cf.mode}</Badge></dd></div>
              <div><dt>App ID</dt><dd>{configured(cf.appIdSet)}</dd></div>
              <div><dt>Secret key</dt><dd>{configured(cf.secretSet)}</dd></div>
              <div><dt>Webhook signing</dt><dd>{cf.webhookSecretOverride ? 'Separate webhook secret' : 'Uses the Cashfree secret key'}</dd></div>
              <div><dt>API verification</dt><dd>{cf.verifyWithApi ? 'On' : 'Off'}</dd></div>
              <div><dt>Webhook URL</dt><dd className="o-mono" style={{ fontSize: 12 }}>{env.siteUrl}/api/webhooks/cashfree</dd></div>
            </dl>
          </Card>
          <Card title="Messaging & CRM" description="Unconfigured channels are recorded as “not configured” — never as sent.">
            <dl className="o-dl">
              <div><dt>Email</dt><dd>{configured(integ.email)}</dd></div>
              <div><dt>WhatsApp</dt><dd>{configured(integ.whatsapp)}</dd></div>
              <div><dt>CRM</dt><dd>{configured(integ.crm)}</dd></div>
              <div><dt>Ops alerts</dt><dd>{configured(integ.opsAlerts)}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
