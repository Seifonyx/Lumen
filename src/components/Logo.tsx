/** The Model Router mark: two inputs routed to one model. Drawn in the current text colour. */
export default function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`logo ${className}`} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <g stroke="var(--logo-ink, #fff)" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M11.5 11 L19.5 15.2 M11.5 21 L19.5 16.8" />
      </g>
      <circle cx="10" cy="10.5" r="2.6" fill="var(--logo-ink, #fff)" />
      <circle cx="10" cy="21.5" r="2.6" fill="var(--logo-ink, #fff)" />
      <circle cx="22" cy="16" r="3.4" fill="var(--logo-ink, #fff)" />
    </svg>
  );
}
