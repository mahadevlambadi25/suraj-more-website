import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from '@/components/Icons';
import { JsonLd } from '@/components/Sections';
import { TrackedLink } from '@/components/TrackedLink';
import { VideoPlayer } from '@/components/VideoPlayer';
import { getArticle, getArticles } from '@/lib/cms';
import { articleSchema, pageMeta } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getArticles()).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  if (!a) return {};
  return pageMeta({ title: a.seo?.title ?? a.title, description: a.seo?.description ?? a.excerpt, path: `/insights/${a.slug}` });
}

export default async function ArticlePage({ params }: Props) {
  const a = await getArticle((await params).slug);
  if (!a) notFound();

  return (
    <>
      <JsonLd data={articleSchema(a)} />
      <section className="page-hero">
        <div className="container container--narrow">
          <p className="eyebrow">
            <Link href="/insights" style={{ color: 'inherit' }}>Insights</Link>
          </p>
          <h1 style={{ maxWidth: 'none', fontSize: 'clamp(2rem,4.4vw,3rem)' }}>{a.title}</h1>
          <p className="small" style={{ color: '#8e98a7' }}>
            {a.author} · {new Date(a.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · {a.readingMinutes} min
          </p>
        </div>
      </section>
      <article className="section">
        <div className="container container--narrow prose">
          {a.video && <div style={{ marginBottom: 32 }}><VideoPlayer video={a.video} /></div>}
          {a.body.map((b, i) => {
            if (b.type === 'h2') return <h2 key={i}>{b.text}</h2>;
            if (b.type === 'quote') return <blockquote key={i}>{b.text}</blockquote>;
            if (b.type === 'list') return <ul key={i}>{b.items?.map((it) => <li key={it}>{it}</li>)}</ul>;
            return <p key={i}>{b.text}</p>;
          })}
          <hr className="rule" />
          <div className="card" style={{ fontSize: '1rem' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.3rem' }}>Want the full structure?</h2>
            <p>The free training walks through the complete Intent → Certainty → Close flow.</p>
            <TrackedLink href="/free-training" className="btn btn--primary" cta="article_cta" placement="article_footer">
              Watch the Free Training <ArrowRight />
            </TrackedLink>
          </div>
        </div>
      </article>
    </>
  );
}
