/**
 * The new-chat mark: Lumen's eclipse turning into a crescent moon. It starts as a thin ring of lime light
 * (the moon covered by its shadow); the shadow slides away to leave a glowing crescent, two sparkles pop in
 * beside it, and then it floats and breathes softly while the sparkles twinkle. The shadow is cut out of the
 * moon with a mask, so nothing but the lit part is ever drawn, on any background.
 */
import { useId } from 'react';

const STAR = 'M0,-1 Q0.16,-0.16 1,0 Q0.16,0.16 0,1 Q-0.16,0.16 -1,0 Q-0.16,-0.16 0,-1Z';

export default function WelcomeStars({ size = 64 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="welcome-stars welcome-moon" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <filter id={`${id}h`} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" /></filter>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="-10" y="-10" width="84" height="84">
          <rect x="-10" y="-10" width="84" height="84" fill="#fff" />
          <circle className="moon-shadow" cx="28" cy="34" r="16" fill="#000" />
        </mask>
      </defs>
      <g className="moon-float">
        <g mask={`url(#${id}m)`}>
          <circle className="moon-halo" cx="28" cy="34" r="17" filter={`url(#${id}h)`} />
          <circle className="moon-disc" cx="28" cy="34" r="17" />
        </g>
      </g>
      <g transform="translate(53 12) scale(7.5)"><path className="star star-b" d={STAR} /></g>
      <g transform="translate(56 42) scale(4.5)"><path className="star star-c" d={STAR} /></g>
    </svg>
  );
}
