import Image from 'next/image';
import type { SiteSettings } from '@/lib/types';

/**
 * Real founder photography only (brief §6). Until the shoot is delivered, shows a neutral
 * monogram — never AI portraits or stock imagery.
 */
export function Portrait({ portrait, name, priority }: { portrait: SiteSettings['founder']['portrait']; name: string; priority?: boolean }) {
  if (portrait) {
    return (
      <div className="portrait-frame">
        <div className="portrait">
          <Image src={portrait.src} alt={portrait.alt} width={portrait.width} height={portrait.height} priority={priority} sizes="(max-width: 900px) 100vw, 480px" />
        </div>
      </div>
    );
  }
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('');
  return (
    <div className="portrait-frame">
      <div className="portrait portrait--placeholder" role="img" aria-label={`Portrait of ${name} (photo coming soon)`}>
        <span className="monogram">{initials}</span>
        <span className="ph-note">Founder portrait — real photography to be added</span>
      </div>
    </div>
  );
}
