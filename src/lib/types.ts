// Content types mirror the CMS content model in the project brief (§5).
// When Sanity is connected, these become the GROQ projection shapes.

export type ProgramId = 'level-zero' | 'workshop' | 'mentorship' | 'inner-circle';
export type ProgramStatus = 'open' | 'waitlist' | 'application' | 'coming-soon' | 'closed';

export interface NavLink {
  label: string;
  href: string;
}

export interface SiteSettings {
  brandName: string;
  wordmark: string;
  founderName: string;
  founderTitle: string;
  positioningLine: string;
  contact: {
    email: string;
    whatsappNumber: string; // digits only, with country code
    whatsappDisplay: string;
  };
  /** Only confirmed profiles. Empty array = section hidden. */
  socials: { label: string; href: string }[];
  nav: NavLink[];
  headerCta: NavLink;
  /** null until verified (brief §8 issue 3 & 10). */
  legalEntity: { name: string; address: string; gstin?: string } | null;
  founder: {
    portrait: { src: string; width: number; height: number; alt: string } | null;
    shortBio: string[];
  };
  freeTraining: {
    video: VideoRef | null;
    headline: string;
  };
  levelZero: { joinUrl: string };
  seo: { defaultTitle: string; titleTemplate: string; description: string; ogImage: string };
}

export interface VideoRef {
  provider: 'youtube' | 'vimeo';
  id: string;
  title: string;
  poster?: string;
  captions: boolean;
  transcript?: string;
}

export interface Program {
  id: ProgramId;
  title: string;
  tierLabel: string;
  summary: string;
  /** Short line used on the offer-ladder cards; falls back to `summary`. */
  ladderSummary?: string;
  audience: string[];
  format: string;
  curriculum: string[];
  /** Displayed price; null = never show a price (e.g. mentorship until confirmed). */
  priceLabel: string | null;
  status: ProgramStatus;
  cta: NavLink;
  externalUrl?: string;
}

export interface CohortSession {
  label: string;
  startsAt: string; // ISO 8601 with offset
  endsAt: string;
  topic: string;
}

export interface Cohort {
  id: string; // database UUID
  slug: string;
  programId: 'workshop';
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string; // IANA, e.g. Asia/Kolkata
  status: 'draft' | 'open' | 'closed';
  /** Only shown when operationally true (brief §7). */
  seatLimit: number | null;
  priceInr: number;
  /** Anchor price is shown ONLY if verified as a real past price (brief §8 issue 5). */
  compareAtPriceInr: number | null;
  compareAtPriceVerified: boolean;
  vipAddon: { active: boolean; priceInr: number; title: string; includes: string[] };
  sessions: CohortSession[];
  reminderCopy: string;
  /** Sample data is excluded from production builds automatically. */
  sample?: boolean;
}

/** Public-safe projection of a cohort — never includes delivery (Zoom) details. */
export type PublicCohort = Omit<Cohort, 'reminderCopy'>;

/** A cohort as listed publicly, with live seat availability (seatsLeft is null when there is no limit). */
export type ListedCohort = PublicCohort & { seatsLeft: number | null; soldOut: boolean };

/** Public state of a single workshop page. Drafts and unknown slugs never get this far (404). */
export type CohortPageState = 'open' | 'sold_out' | 'closed';

export type Verification = 'client-reported' | 'independently-verified';

export interface Testimonial {
  id: string;
  quote?: string;
  video?: VideoRef;
  client: string;
  role: string;
  niche: string;
  permissionOnFile: boolean;
  verifiedOutcome?: string;
  verification: Verification;
  status: 'draft' | 'published';
}

export interface CaseStudy {
  id: string;
  client: string;
  role: string;
  permissionOnFile: boolean;
  startingPoint: string;
  intervention: string;
  outcome: { metric: string; baseline: string; result: string; period: string; source: string };
  verification: Verification;
  caveat: string;
  video?: VideoRef;
  status: 'draft' | 'published';
}

export interface Framework {
  id: string;
  name: string;
  tagline: string;
  description: string;
  steps: { title: string; body: string }[];
  relatedProgram: ProgramId;
}

export interface ArticleBlock {
  type: 'p' | 'h2' | 'quote' | 'list';
  text?: string;
  items?: string[];
}

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  kind: 'article' | 'video' | 'framework';
  author: string;
  publishedAt: string;
  readingMinutes: number;
  body: ArticleBlock[];
  video?: VideoRef;
  seo?: { title?: string; description?: string };
}

export interface Faq {
  q: string;
  a: string;
  topic: 'audience' | 'format' | 'time' | 'live-vs-recorded' | 'pricing' | 'results';
}

export interface LegalDoc {
  slug: 'privacy-policy' | 'terms-and-conditions' | 'refund-policy';
  title: string;
  version: string;
  effectiveDate: string;
  reviewed: boolean;
  sections: { heading: string; body: string[] }[];
}
