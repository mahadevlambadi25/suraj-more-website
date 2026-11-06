'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { NavLink } from '@/lib/types';
import { CloseIcon, MenuIcon } from './Icons';
import { TrackedLink } from './TrackedLink';

export function Header({ wordmark, nav, cta }: { wordmark: string; nav: NavLink[]; cta: NavLink }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const [first, ...rest] = wordmark.split(' ');
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="wordmark" aria-label={`${wordmark} home`}>
          {first} <span>{rest.join(' ')}</span>
        </Link>
        <nav aria-label="Main">
          <ul className="nav-links">
            {nav.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={isActive(l.href) ? 'page' : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="header-actions">
          <TrackedLink href={cta.href} className="btn btn--primary btn--sm" cta="header" placement="header">
            {cta.label}
          </TrackedLink>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      <div id="mobile-nav" className="mobile-nav" data-open={open} hidden={!open}>
        <nav aria-label="Mobile">
          <ul>
            <li>
              <Link href="/">Home</Link>
            </li>
            {nav.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={isActive(l.href) ? 'page' : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <TrackedLink href={cta.href} className="btn btn--primary btn--block btn--lg" cta="mobile_menu" placement="mobile_menu">
            {cta.label}
          </TrackedLink>
        </nav>
      </div>
    </header>
  );
}
