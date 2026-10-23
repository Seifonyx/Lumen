import { MARK, WORDMARK, WORDMARK_SMALL, type Drawing } from '../lib/brand-crease-art';
import type { BrandArtProps } from '../lib/canvas-presentation';

// The Lumen identity (Crease, approved 2026-10-23) in the Canvas presentation's brand placements. Imported only by
// src/lib/canvas-presentation.on.ts, so the ordinary build carries none of it. Drawn in currentColor, so they follow
// the theme. Labelled "Lumen" unless `decorative`, for a placement whose control already carries the name.
function Art({ art, height, decorative, className }: { art: Drawing; height: number; decorative?: boolean; className?: string }) {
  const [, , w, h] = art.viewBox.split(' ').map(Number);
  return (
    <svg className={className} viewBox={art.viewBox} height={height} width={Math.round((height * w) / h * 10) / 10} fill="currentColor"
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'Lumen' })} focusable="false">
      <g transform={art.transform}>{art.d.map(([t, d], i) => <path key={i} transform={t || undefined} d={d} />)}</g>
    </svg>
  );
}

/** The integrated wordmark: the Crease as the L of "Lumen". Below 28 px it uses the small-size drawing. */
export function BrandWordmark({ height, decorative, className = '' }: BrandArtProps) {
  return <Art art={height < 28 ? WORDMARK_SMALL : WORDMARK} height={height} decorative={decorative} className={`brand-wordmark ${className}`} />;
}

/** The standalone mark (small-size drawing), for compact placements. */
export function BrandMark({ height, decorative, className = '' }: BrandArtProps) {
  return <Art art={MARK} height={height} decorative={decorative} className={`brand-mark ${className}`} />;
}
