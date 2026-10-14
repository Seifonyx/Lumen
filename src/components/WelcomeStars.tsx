/** The new-chat mark: three lime sparkles that twinkle softly. */
const STAR = 'M0,-1 Q0.16,-0.16 1,0 Q0.16,0.16 0,1 Q-0.16,0.16 -1,0 Q-0.16,-0.16 0,-1Z';

export default function WelcomeStars({ size = 56 }: { size?: number }) {
  return (
    <svg className="welcome-stars" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path className="star star-main" d={STAR} transform="translate(27 35) scale(21)" />
      <path className="star star-b" d={STAR} transform="translate(50 13) scale(9)" />
      <path className="star star-c" d={STAR} transform="translate(52 44) scale(5.5)" />
    </svg>
  );
}
