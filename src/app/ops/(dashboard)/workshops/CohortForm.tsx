import type { WorkshopCohort } from '@prisma/client';
import { sessionsToText, toIstInput } from '@/lib/admin/cohort-form';
import { sessionsSchema } from '@/lib/cohorts';
import { saveCohortAction } from '../../actions';
import { SubmitButton } from '../../_components/controls';

const rupees = (p: number | null | undefined) => (p == null ? '' : String(p / 100));

/** Create / edit a cohort. Field names are unchanged — they map 1:1 to saveCohortAction. */
export function CohortForm({ cohort, readOnly }: { cohort?: WorkshopCohort; readOnly?: boolean }) {
  const sessions = cohort ? sessionsSchema.safeParse(cohort.sessions) : null;
  const returnTo = cohort ? `/ops/workshops/${cohort.id}` : '/ops/workshops/new';
  return (
    <form action={saveCohortAction} className="o-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      {cohort && <input type="hidden" name="cohortId" value={cohort.id} />}
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 20, minWidth: 0 }}>
        <fieldset className="o-fieldset">
          <legend>Basics</legend>
          <div className="o-field">
            <label htmlFor="title">Title</label>
            <input className="o-input" id="title" name="title" required minLength={3} maxLength={150} defaultValue={cohort?.title ?? 'The One Skill Workshop'} />
          </div>
          <div className="o-form-row">
            <div className="o-field">
              <label htmlFor="slug">Slug</label>
              <input className="o-input" id="slug" name="slug" required pattern="[a-z0-9-]{3,60}" defaultValue={cohort?.slug} readOnly={!!cohort} />
              <span className="o-hint">{cohort ? 'Fixed after creation.' : 'Lowercase, digits and dashes, e.g. osw-2027-01'}</span>
            </div>
            <div className="o-field">
              <label htmlFor="status">Status</label>
              <select className="o-select" id="status" name="status" defaultValue={cohort?.status ?? 'DRAFT'}>
                <option value="DRAFT">Draft — hidden from the website</option>
                <option value="OPEN">Open — bookable until it starts</option>
                <option value="CLOSED">Closed — never bookable</option>
              </select>
            </div>
          </div>
          <div className="o-form-row">
            <div className="o-field">
              <label htmlFor="startsAt">Starts (IST)</label>
              <input className="o-input" type="datetime-local" id="startsAt" name="startsAt" required defaultValue={cohort ? toIstInput(cohort.startsAt) : ''} />
              <span className="o-hint">Booking closes automatically at this moment.</span>
            </div>
            <div className="o-field">
              <label htmlFor="endsAt">Ends (IST)</label>
              <input className="o-input" type="datetime-local" id="endsAt" name="endsAt" required defaultValue={cohort ? toIstInput(cohort.endsAt) : ''} />
            </div>
          </div>
        </fieldset>

        <fieldset className="o-fieldset">
          <legend>Pricing &amp; seats</legend>
          <div className="o-form-row">
            <div className="o-field">
              <label htmlFor="priceRupees">Price (₹)</label>
              <input className="o-input" type="number" min="1" step="1" id="priceRupees" name="priceRupees" required defaultValue={rupees(cohort?.pricePaise) || '47'} />
              <span className="o-hint">Applies to new orders only.</span>
            </div>
            <div className="o-field">
              <label htmlFor="seatLimit">Seat limit <span className="o-optional">(optional)</span></label>
              <input className="o-input" type="number" min="1" id="seatLimit" name="seatLimit" defaultValue={cohort?.seatLimit ?? ''} />
              <span className="o-hint">Only if the limit is operationally real.</span>
            </div>
          </div>
          <div className="o-form-row">
            <div className="o-field">
              <label htmlFor="compareAtRupees">Compare-at price (₹) <span className="o-optional">(optional)</span></label>
              <input className="o-input" type="number" min="0" step="1" id="compareAtRupees" name="compareAtRupees" defaultValue={rupees(cohort?.compareAtPricePaise)} />
            </div>
            <label className="o-check" style={{ alignSelf: 'center' }}>
              <input type="checkbox" name="compareAtPriceVerified" defaultChecked={cohort?.compareAtPriceVerified} />
              <span>Verified real past price — only then is it shown on the website.</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="o-fieldset">
          <legend>Recording + VIP add-on</legend>
          <label className="o-check">
            <input type="checkbox" name="vipAddonActive" defaultChecked={cohort?.vipAddonActive ?? true} />
            <span>Offer the add-on at checkout</span>
          </label>
          <div className="o-form-row">
            <div className="o-field">
              <label htmlFor="vipAddonTitle">Add-on title</label>
              <input className="o-input" id="vipAddonTitle" name="vipAddonTitle" defaultValue={cohort?.vipAddonTitle ?? 'Recording + VIP Pack'} />
            </div>
            <div className="o-field">
              <label htmlFor="vipAddonPriceRupees">Add-on price (₹)</label>
              <input className="o-input" type="number" min="0" id="vipAddonPriceRupees" name="vipAddonPriceRupees" defaultValue={rupees(cohort?.vipAddonPricePaise) || '499'} />
            </div>
          </div>
          <div className="o-field">
            <label htmlFor="vipAddonIncludes">Includes</label>
            <input className="o-input" id="vipAddonIncludes" name="vipAddonIncludes" defaultValue={cohort?.vipAddonIncludes.join(', ') ?? 'Extra VIP day, Live Q&A, Workbook, 1-year recording access'} />
            <span className="o-hint">Comma separated.</span>
          </div>
        </fieldset>

        <fieldset className="o-fieldset">
          <legend>Schedule</legend>
          <div className="o-field">
            <label htmlFor="sessions">Sessions (one per line, IST)</label>
            <textarea className="o-textarea o-mono" id="sessions" name="sessions" required rows={4} defaultValue={sessions?.success ? sessionsToText(sessions.data) : 'Day 1 | 2027-01-16 11:00 | 14:00 | Intent — discovery that earns the right to make an offer\nDay 2 | 2027-01-17 11:00 | 14:00 | Certainty → Close — handling hesitation without pressure'} />
            <span className="o-hint">Format: <code>Label | YYYY-MM-DD HH:mm | HH:mm | Topic</code></span>
          </div>
          <div className="o-field">
            <label htmlFor="reminderCopy">Reminder message <span className="o-optional">(optional)</span></label>
            <textarea className="o-textarea" id="reminderCopy" name="reminderCopy" rows={2} defaultValue={cohort?.reminderCopy ?? ''} />
          </div>
        </fieldset>

        <fieldset className="o-fieldset">
          <legend>Private delivery details</legend>
          <p className="o-hint" style={{ marginTop: -6 }}>Sent to participants only after a verified payment. Never shown on the website.</p>
          <div className="o-form-row">
            <div className="o-field">
              <label htmlFor="zoomJoinUrl">Zoom attendee link</label>
              <input className="o-input" id="zoomJoinUrl" name="zoomJoinUrl" type="url" placeholder="https://zoom.us/j/…" defaultValue={cohort?.zoomJoinUrl ?? ''} />
              <span className="o-hint">Attendee link only — never the host link.</span>
            </div>
            <div className="o-field">
              <label htmlFor="zoomPasscode">Passcode <span className="o-optional">(optional)</span></label>
              <input className="o-input" id="zoomPasscode" name="zoomPasscode" defaultValue={cohort?.zoomPasscode ?? ''} />
            </div>
          </div>
        </fieldset>

        {!readOnly && (
          <div className="o-form-actions">
            <SubmitButton pendingLabel="Saving…">{cohort ? 'Save changes' : 'Create cohort'}</SubmitButton>
          </div>
        )}
      </fieldset>
    </form>
  );
}
