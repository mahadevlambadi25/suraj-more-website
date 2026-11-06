'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { track } from '@/lib/analytics';

type Props = {
  href: string;
  children: ReactNode;
  className?: string;
  /** Analytics: CTA name, e.g. "hero_primary". */
  cta?: string;
  event?: 'primary_cta_click' | 'whatsapp_click' | 'outbound_click';
  placement?: string;
  ariaLabel?: string;
};

/** Link that reports CTA clicks (brief §5: primary_cta_click, whatsapp_click). */
export function TrackedLink({ href, children, className, cta, event = 'primary_cta_click', placement, ariaLabel }: Props) {
  const onClick = () => {
    if (event === 'whatsapp_click') track('whatsapp_click', { cta_placement: placement });
    else track(event, { cta_name: cta, destination: href, cta_placement: placement });
  };
  // /go/* are server redirect trackers — use a plain anchor so Next.js never prefetches (and miscounts) them.
  const isExternal = /^(https?:|mailto:|tel:|\/go\/)/.test(href);
  if (isExternal) {
    const newTab = /^https?:/.test(href);
    return (
      <a href={href} className={className} onClick={onClick} aria-label={ariaLabel} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
