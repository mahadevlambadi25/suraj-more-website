import Link from 'next/link';
import { PageHero } from '@/components/Sections';
import { getArticles } from '@/lib/cms';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Sales Conversation Insights | Suraj More',
  absoluteTitle: true,
  description: 'Practical articles and frameworks on discovery, objections, follow-up and closing.',
  path: '/insights',
});

const KIND = { article: 'Article', video: 'Video', framework: 'Framework' } as const;

export default async function InsightsPage() {
  const articles = await getArticles();
  return (
    <>
      <PageHero eyebrow="Insights" title="Ideas for better sales conversations." lead="Practical articles, videos and frameworks you can use on your next call." />
      <section className="section">
        <div className="container container--narrow">
          {articles.length === 0 ? (
            <div className="empty-state">
              <h2 style={{ fontSize: '1.4rem' }}>First articles coming soon</h2>
              <p>Meanwhile, the free training covers the core frameworks.</p>
              <Link href="/free-training" className="btn btn--secondary">Watch the Free Training</Link>
            </div>
          ) : (
            <div className="article-list">
              {articles.map((a) => (
                <Link key={a.slug} href={`/insights/${a.slug}`} className="article-item">
                  <span className="small">
                    <span className="tag" style={{ marginBottom: 8 }}>{KIND[a.kind]}</span>
                    <br />
                    {new Date(a.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span>
                    <h2 style={{ fontSize: '1.35rem', marginBottom: 8 }}>{a.title}</h2>
                    <p>{a.excerpt}</p>
                  </span>
                  <span className="small">{a.kind === 'video' ? 'Watch' : 'Read'} · {a.readingMinutes} min</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
