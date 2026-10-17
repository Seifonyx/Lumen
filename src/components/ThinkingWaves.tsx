import { useEffect, useId, useState } from 'react';
import { motionOff } from '../lib/motion';
import { useVisualActivity } from '../lib/visual-activity';

const curves = [
  'M8 22C28 2 36 2 56 22S84 42 128 22',
  'M8 22C28 42 36 42 56 22S84 2 128 22',
  'M8 22C28 12 36 32 56 22S84 12 128 22',
];

/** A small, decorative illustration of work in progress, never a progress estimate. */
export default function ThinkingWaves({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(active);
  const id = useId().replace(/:/g, '');
  const show = active || visible;
  const activity = useVisualActivity(show);
  useEffect(() => {
    if (active) { setVisible(true); return; }
    if (!visible) return;
    if (motionOff()) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(false), 420);
    return () => clearTimeout(timer);
  }, [active, visible]);
  if (!show) return null;
  return <div className="thinking-art" data-phase={active ? 'weaving' : 'dissolving'} aria-hidden="true">
    <svg className="animated-visual thinking-visual" ref={activity.ref} data-visual-active={activity.active} width="136" height="44" viewBox="0 0 136 44" aria-hidden="true">
      <defs><linearGradient id={`${id}wave`}><stop stopColor="var(--signal-strong)" stopOpacity=".2" /><stop offset=".5" stopColor="var(--signal-strong)" /><stop offset="1" stopColor="var(--signal-strong)" stopOpacity=".15" /></linearGradient></defs>
      {curves.map((curve, i) => <path key={i} className="thinking-ribbon" d={curve} fill="none" stroke={`url(#${id}wave)`} strokeWidth={i === 0 ? 2 : 1.4} opacity={1 - i * .2} strokeLinecap="round">
        <animate attributeName="d" values={[curve, curves[(i + 1) % 3], curves[(i + 2) % 3], curve].join(';')} dur="3.2s" repeatCount="indefinite" />
      </path>)}
      {Array.from({ length: 8 }, (_, i) => <circle key={i} className="thinking-spark" cx={18 + i * 14} cy={22 + (i % 2 ? 3 : -3)} r={i % 3 ? 1 : 1.5} fill="var(--signal-strong)" style={{ '--spark-x': `${(i - 3.5) * 2}px`, '--spark-y': `${i % 2 ? 9 : -9}px` } as React.CSSProperties} />)}
    </svg>
  </div>;
}
