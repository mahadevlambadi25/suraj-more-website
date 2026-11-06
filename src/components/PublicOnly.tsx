'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Renders public-site chrome (header, footer, banners, analytics) everywhere except the /ops dashboard. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/ops' || pathname.startsWith('/ops/')) return null;
  return <>{children}</>;
}
