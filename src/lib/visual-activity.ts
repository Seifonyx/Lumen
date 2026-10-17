import { useEffect, useRef, useState } from 'react';

/** Decorative SVG timelines run only while visible, foregrounded and permitted by the motion preference. */
export function useVisualActivity(enabled = true) {
  const ref = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const svg = ref.current;
    if (!svg || !enabled) { setActive(false); return; }
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const update = () => {
      const running = visible && document.visibilityState === 'visible' && !preference.matches;
      if (running) svg.unpauseAnimations(); else svg.pauseAnimations();
      setActive(running);
    };
    svg.pauseAnimations();
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0);
      update();
    });
    observer.observe(svg);
    preference.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect(); svg.pauseAnimations();
      preference.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [enabled]);
  return { ref, active };
}
