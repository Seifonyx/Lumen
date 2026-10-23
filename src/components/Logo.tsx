import { useId } from 'react';
import EclipseOrbit from './EclipseOrbit';
import { useVisualActivity } from '../lib/visual-activity';
import { CANVAS_SHELL } from '../lib/canvas-presentation';
import InkMark from './InkMark';

/** The Lumen mark: an eclipse, a dark moon ringed by lime light with one bright flare. Same tile in every theme (it's the app icon). */
export default function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  const activity = useVisualActivity();
  const id = useId().replace(/:/g, '');
  // Small marks (sidebar, shared pages) get a softer halo so they don't glow over the text beside them.
  const small = size <= 32;
  // Canvas: the one ink mark in place of the lime eclipse.
  if (CANVAS_SHELL) return <InkMark size={size} className={`logo ${className}`} />;
  return (
    <svg ref={activity.ref} data-visual-active={activity.active} className={`logo animated-visual ${className}`} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <clipPath id={`${id}c`}><rect width="512" height="512" rx="120" /></clipPath>
        <radialGradient id={`${id}bg`} cx=".5" cy=".45" r=".7"><stop offset="0" stopColor="#18200f" /><stop offset="1" stopColor="#060708" /></radialGradient>
        <linearGradient id={`${id}ring`} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#f6ffc8" /><stop offset=".45" stopColor="#c2ef3a" /><stop offset="1" stopColor="#6f9e00" /></linearGradient>
        <filter id={`${id}b1`} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="30" /></filter>
        <filter id={`${id}b2`} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9" /></filter>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="512" height="512" fill={`url(#${id}bg)`} />
        <circle cx="256" cy="256" r="150" fill="#c2ef3a" opacity={small ? 0.28 : 0.75} filter={`url(#${id}b1)`} />
        <circle cx="256" cy="256" r="134" fill="none" stroke={`url(#${id}ring)`} strokeWidth="14" />
        <circle cx="268" cy="246" r="132" fill="#060708" />
        <circle cx="166" cy="344" r="34" fill="#fff" opacity={small ? 0.5 : 0.9} filter={`url(#${id}b2)`} />
        <path d="M166 298Q170.6 339.4 212 344Q170.6 348.6 166 390Q161.4 348.6 120 344Q161.4 339.4 166 298Z" fill="#fff" />
        <EclipseOrbit x={256} y={256} radius={158} />
      </g>
    </svg>
  );
}
