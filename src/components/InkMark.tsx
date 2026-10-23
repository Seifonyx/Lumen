// Canvas's one ink mark (item 10): the Eclipse redrawn in monochrome. `tile` is the app icon (a dark tile in every
// theme); without it the glyph is drawn in the current text colour, for the home screen and inline brand marks.
// The owner picks the variant; MARK holds that choice so every place changes together.
export type InkMarkVariant = 'A' | 'B' | 'C';
export const MARK: InkMarkVariant = 'A';

export default function InkMark({ size = 24, tile = true, className = '' }: { size?: number; tile?: boolean; className?: string }) {
  const paper = MARK === 'C';
  const ground = tile ? (paper ? '#f4f4f2' : '#0b0b0c') : 'var(--bg, transparent)';
  const light = tile ? (paper ? '#0b0b0c' : '#f4f4f2') : 'currentColor';
  return (
    <svg className={`ink-mark ${className}`} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      {tile && <rect width="512" height="512" rx="114" fill={ground} />}
      {MARK === 'A' && <>
        <circle cx="256" cy="256" r="140" fill="none" stroke={light} strokeWidth="30" />
        <circle cx="282" cy="232" r="134" fill={ground} />
      </>}
      {MARK === 'B' && <>
        <circle cx="256" cy="256" r="178" fill="none" stroke={light} strokeOpacity=".28" strokeWidth="8" />
        <circle cx="256" cy="256" r="146" fill={light} />
        <circle cx="286" cy="228" r="138" fill={ground} />
      </>}
      {MARK === 'C' && <>
        <circle cx="256" cy="256" r="144" fill={light} />
        <circle cx="286" cy="226" r="128" fill={ground} />
        <circle cx="286" cy="226" r="118" fill={light} />
      </>}
    </svg>
  );
}
