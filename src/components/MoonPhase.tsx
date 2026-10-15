import { useId } from 'react';

/** Waiting for a reply: a tiny moon going through its phases (a shadow passes across a lime disc). */
export default function MoonPhase({ size = 14 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="moon-phase" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <defs><clipPath id={`${id}m`}><circle cx="8" cy="8" r="6.5" /></clipPath></defs>
      <circle className="mp-glow" cx="8" cy="8" r="7.5" />
      <g clipPath={`url(#${id}m)`}>
        <circle className="mp-disc" cx="8" cy="8" r="6.5" />
        <circle className="mp-shadow" cx="8" cy="8" r="6.5" />
      </g>
    </svg>
  );
}
