import type { CaseStudy, Testimonial } from '@prisma/client';
import { saveCaseStudyAction, saveTestimonialAction } from '../../actions';
import { SubmitButton } from '../../_components/controls';

// Create / edit forms for proof items (PRD §8.2 case-study format, §11.2 content types).
// Nothing is public until Status = Published AND written permission is confirmed.

function Publishing({ item, readOnly }: { item?: { status: string; permissionOnFile: boolean; verification: string; sortOrder: number }; readOnly?: boolean }) {
  return (
    <fieldset className="o-fieldset">
      <legend>Verification & publishing</legend>
      <div className="o-form-row">
        <div className="o-field">
          <label htmlFor="verification">Result is</label>
          <select className="o-select" id="verification" name="verification" defaultValue={item?.verification ?? 'CLIENT_REPORTED'}>
            <option value="CLIENT_REPORTED">Client-reported</option>
            <option value="INDEPENDENTLY_VERIFIED">Independently verified</option>
          </select>
        </div>
        <div className="o-field">
          <label htmlFor="status">Status</label>
          <select className="o-select" id="status" name="status" defaultValue={item?.status ?? 'DRAFT'}>
            <option value="DRAFT">Draft (not shown on the website)</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
      </div>
      <div className="o-form-row">
        <div className="o-field">
          <label htmlFor="sortOrder">Display order <span className="o-optional">(optional)</span></label>
          <input className="o-input" id="sortOrder" name="sortOrder" type="number" min={0} max={9999} defaultValue={item?.sortOrder ?? 0} />
          <span className="o-hint">Lower numbers appear first.</span>
        </div>
        <div className="o-field">
          <label className="o-check" htmlFor="permissionOnFile">
            <input type="checkbox" id="permissionOnFile" name="permissionOnFile" defaultChecked={item?.permissionOnFile ?? false} disabled={readOnly} />
            <span>Written permission from the client is on file, including their name, role and the exact wording</span>
          </label>
          <span className="o-hint">Required before publishing.</span>
        </div>
      </div>
    </fieldset>
  );
}

export function TestimonialForm({ item, readOnly }: { item?: Testimonial; readOnly?: boolean }) {
  return (
    <form action={saveTestimonialAction} className="o-form">
      <input type="hidden" name="returnTo" value={item ? `/ops/proof/testimonials/${item.id}` : '/ops/proof/testimonials/new'} />
      {item && <input type="hidden" name="testimonialId" value={item.id} />}
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 20, minWidth: 0 }}>
        <fieldset className="o-fieldset">
          <legend>Client</legend>
          <div className="o-form-row">
            <div className="o-field">
              <label htmlFor="client">Client name</label>
              <input className="o-input" id="client" name="client" required maxLength={120} defaultValue={item?.client} />
            </div>
            <div className="o-field">
              <label htmlFor="role">Role</label>
              <input className="o-input" id="role" name="role" required maxLength={120} defaultValue={item?.role} placeholder="e.g. Founder" />
            </div>
          </div>
          <div className="o-field">
            <label htmlFor="niche">Business / niche</label>
            <input className="o-input" id="niche" name="niche" required maxLength={120} defaultValue={item?.niche} placeholder="e.g. Fitness coach" />
          </div>
        </fieldset>
        <fieldset className="o-fieldset">
          <legend>Testimonial</legend>
          <div className="o-field">
            <label htmlFor="quote">Approved quote</label>
            <textarea className="o-textarea" id="quote" name="quote" rows={4} maxLength={2000} defaultValue={item?.quote ?? ''} />
            <span className="o-hint">Use the exact wording the client approved. A quote or a video is required.</span>
          </div>
          <div className="o-field">
            <label htmlFor="videoUrl">Video link <span className="o-optional">(optional)</span></label>
            <input className="o-input" id="videoUrl" name="videoUrl" type="url" maxLength={500} defaultValue={item?.videoUrl ?? ''} placeholder="https://youtu.be/… or https://vimeo.com/…" />
          </div>
          <div className="o-field">
            <label htmlFor="verifiedOutcome">Outcome <span className="o-optional">(optional)</span></label>
            <input className="o-input" id="verifiedOutcome" name="verifiedOutcome" maxLength={300} defaultValue={item?.verifiedOutcome ?? ''} />
            <span className="o-hint">Only a result you can source. Set “Result is” below accordingly.</span>
          </div>
        </fieldset>
        <Publishing item={item} readOnly={readOnly} />
        {!readOnly && (
          <div className="o-form-actions">
            <SubmitButton pendingLabel="Saving…">{item ? 'Save changes' : 'Create testimonial'}</SubmitButton>
          </div>
        )}
      </fieldset>
    </form>
  );
}

export function CaseStudyForm({ item, readOnly }: { item?: CaseStudy; readOnly?: boolean }) {
  const field = (name: keyof CaseStudy, label: string, max: number, hint?: string, area = false) => (
    <div className="o-field">
      <label htmlFor={name}>{label}</label>
      {area ? (
        <textarea className="o-textarea" id={name} name={name} required rows={3} maxLength={max} defaultValue={(item?.[name] as string) ?? ''} />
      ) : (
        <input className="o-input" id={name} name={name} required maxLength={max} defaultValue={(item?.[name] as string) ?? ''} />
      )}
      {hint && <span className="o-hint">{hint}</span>}
    </div>
  );
  return (
    <form action={saveCaseStudyAction} className="o-form">
      <input type="hidden" name="returnTo" value={item ? `/ops/proof/case-studies/${item.id}` : '/ops/proof/case-studies/new'} />
      {item && <input type="hidden" name="caseStudyId" value={item.id} />}
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 20, minWidth: 0 }}>
        <fieldset className="o-fieldset">
          <legend>Client</legend>
          <div className="o-form-row">
            {field('client', 'Client name', 120)}
            {field('role', 'Role / company / niche', 160)}
          </div>
        </fieldset>
        <fieldset className="o-fieldset">
          <legend>Story</legend>
          {field('startingPoint', 'Starting point', 2000, 'The sales problem before working with Suraj.', true)}
          {field('intervention', 'Intervention', 2000, 'Which framework, training or system was applied.', true)}
        </fieldset>
        <fieldset className="o-fieldset">
          <legend>Outcome</legend>
          <div className="o-form-row">
            {field('outcomeMetric', 'Metric', 200, 'e.g. Close rate on qualified calls')}
            {field('outcomePeriod', 'Period', 120, 'e.g. 90 days')}
          </div>
          <div className="o-form-row">
            {field('outcomeBaseline', 'Baseline (before)', 200)}
            {field('outcomeResult', 'Result (after)', 200)}
          </div>
          {field('outcomeSource', 'Source', 300, 'Where the numbers come from, e.g. client CRM export.')}
          {field('caveat', 'Caveat', 500, 'e.g. Results vary and are not guaranteed.')}
          <div className="o-field">
            <label htmlFor="videoUrl">Video link <span className="o-optional">(optional)</span></label>
            <input className="o-input" id="videoUrl" name="videoUrl" type="url" maxLength={500} defaultValue={item?.videoUrl ?? ''} placeholder="https://youtu.be/… or https://vimeo.com/…" />
          </div>
        </fieldset>
        <Publishing item={item} readOnly={readOnly} />
        {!readOnly && (
          <div className="o-form-actions">
            <SubmitButton pendingLabel="Saving…">{item ? 'Save changes' : 'Create case study'}</SubmitButton>
          </div>
        )}
      </fieldset>
    </form>
  );
}
