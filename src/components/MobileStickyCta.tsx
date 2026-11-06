'use client';

import { useEffect, useState } from 'react';
import { TrackedLink } from './TrackedLink';

/**
 * Mobile-only sticky CTA. Hides itself whenever a form, the footer or the cookie banner
 * is on screen, so it never covers inputs or legal links (launch checklist).
 */
export function MobileStickyCta({ label, href }: { label: string; href: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const visible = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        setHidden(visible.size > 0 || !!document.querySelector('.cookie-banner'));
      },
      { threshold: 0 },
    );
    const observeAll = () => document.querySelectorAll('[data-sticky-hide], form').forEach((el) => io.observe(el));
    observeAll();
    const mo = new MutationObserver(() => {
      observeAll();
      setHidden(visible.size > 0 || !!document.querySelector('.cookie-banner'));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <>
      <div className="sticky-cta-spacer" aria-hidden="true" />
      <div className="sticky-cta" data-hidden={hidden} aria-hidden={hidden}>
        <TrackedLink href={href} className="btn btn--primary btn--block" cta="mobile_sticky" placement="mobile_sticky">
          {label}
        </TrackedLink>
      </div>
    </>
  );
}
