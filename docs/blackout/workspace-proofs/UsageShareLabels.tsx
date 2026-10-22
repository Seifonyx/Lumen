// Preview-only presentation fix for the canonical UsageMeter panel. Its data, calculations, meter values and
// unknown-allowance handling are unchanged; only a share that would round to a misleading 0% or 100% gets an
// honest label ("<1%", ">99%"), spoken text and a visible minimum arc. Migrate into CompactNote when approved.
import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { compactLimit, contextTokens } from '../../../src/lib/compact';
import { AUTO } from '../../../src/lib/routing';
import { modelInfo, selectCurrentChat, selectCurrentModel, useStore } from '../../../src/store';
import { usageShare } from './usage-share.js';

type Share = ReturnType<typeof usageShare>;
const CHAT_METER = 'How full this chat is';

function GaugeLabel({ gauge, share, speak }: { gauge: HTMLElement; share: Share; speak: string | null }) {
  useLayoutEffect(() => {
    gauge.setAttribute('data-proof-share', '');
    gauge.style.setProperty('--proof-arc', String(share.arc));
    if (speak) gauge.setAttribute('aria-valuetext', speak);
    return () => {
      gauge.removeAttribute('data-proof-share');
      gauge.style.removeProperty('--proof-arc');
      if (speak) gauge.removeAttribute('aria-valuetext');
    };
  }, [gauge, share.arc, speak]);
  return createPortal(<span className="proof-gauge-label" aria-hidden="true">{share.label}</span>, gauge);
}

export default function UsageShareLabels() {
  const chat = useStore(selectCurrentChat), model = useStore(selectCurrentModel), catalog = useStore((s) => s.catalog);
  const [gauges, setGauges] = useState<HTMLElement[]>([]);
  useEffect(() => {
    let frame = 0;
    const sync = () => {
      frame = 0;
      const next = Array.from(document.querySelectorAll<HTMLElement>('.usage-pop .um-gauge[role=meter]'));
      setGauges((old) => (old.length === next.length && old.every((g, i) => g === next[i]) ? old : next));
    };
    const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(sync); });
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  if (!chat) return null;
  // The same canonical inputs the UsageMeter uses for "This chat".
  const used = contextTokens(chat), limit = compactLimit(model === AUTO ? undefined : modelInfo(catalog, model));
  return <>{gauges.map((gauge, i) => {
    const chatMeter = gauge.getAttribute('aria-label') === CHAT_METER;
    const share = chatMeter ? usageShare(used, limit) : usageShare(Number(gauge.getAttribute('aria-valuenow')), Number(gauge.getAttribute('aria-valuemax')));
    // Only the misleading edge cases are relabelled; every other value keeps the canonical label.
    if (!['<1%', '>99%'].includes(share.label)) return null;
    return <GaugeLabel key={i} gauge={gauge} share={share} speak={chatMeter ? `${share.text} of this chat's room before it is compacted` : null} />;
  })}</>;
}
