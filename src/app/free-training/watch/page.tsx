import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowRight } from '@/components/Icons';
import { SectionHead } from '@/components/Sections';
import { TrackedLink } from '@/components/TrackedLink';
import { VideoPlayer } from '@/components/VideoPlayer';
import { getActiveCohort, getSettings } from '@/lib/cms';
import { formatDate, formatInr } from '@/lib/format';
import { pageMeta } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = pageMeta({ title: 'Your free training', description: 'Your free training from Suraj More.', path: '/free-training/watch', noindex: true });

export default async function WatchPage() {
  const jar = await cookies();
  if (!jar.get('sm_ft_access')) redirect('/free-training');
  const [settings, cohort] = await Promise.all([getSettings(), getActiveCohort()]);

  return (
    <>
      <section className="page-hero">
        <div className="container container--narrow">
          <div className="alert alert--success" role="status" style={{ marginBottom: 28 }}>
            {/* Copy doc says "Your access details are on their way to your inbox" — only true once an email provider is
                configured, so the banner states what is guaranteed instead (access cookie lasts 1 year on this device). */}
            <strong>You’re in.</strong> Watch the training below. You can come back to this page any time on this device.
          </div>
          <p className="eyebrow">Free training</p>
          <h1 style={{ maxWidth: 'none' }}>{settings.freeTraining.headline}</h1>
          <div style={{ marginTop: 32 }}>
            <VideoPlayer video={settings.freeTraining.video} label="Play the free training" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          <SectionHead eyebrow="Your next step" title={cohort ? 'Practise it live in the One Skill Workshop' : 'Keep going with Level Zero'} />
          {cohort ? (
            <div className="card">
              <p>
                The next live workshop starts <strong>{formatDate(cohort.startsAt, cohort.timezone)}</strong>. Two days on Zoom, practising the
                frameworks from this training on real situations, for {formatInr(cohort.priceInr)}.
              </p>
              <TrackedLink href="/workshop" className="btn btn--primary" cta="watch_next_workshop" placement="post_training">
                Explore the Workshop <ArrowRight />
              </TrackedLink>
            </div>
          ) : (
            <div className="card">
              <p>Keep building the foundations in Level Zero, the free course and community, alongside others doing the same work.</p>
              <TrackedLink href="/level-zero" className="btn btn--primary" cta="watch_next_level_zero" placement="post_training">
                Join Level Zero for Free <ArrowRight />
              </TrackedLink>
            </div>
          )}
          <p className="small" style={{ marginTop: 24 }}>
            Running an established consulting or agency business? <TrackedLink href="/mentorship" className="text-link" cta="watch_mentorship" placement="post_training">Apply for Mentorship</TrackedLink>.
          </p>
        </div>
      </section>
    </>
  );
}
