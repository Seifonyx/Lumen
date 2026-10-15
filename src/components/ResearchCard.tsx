// Deep research as it happens: the plan, each search (with the sites it read), then the report being written.
// Once the report is done it folds into one line you can open again.
import { Check, ChevronDown, Telescope, X } from 'lucide-react';
import { useState } from 'react';
import type { Research } from '../types';
import MoonPhase from './MoonPhase';

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

export default function ResearchCard({ research }: { research: Research }) {
  const live = research.phase === 'planning' || research.phase === 'searching' || research.phase === 'writing';
  const [open, setOpen] = useState(false);
  const shown = live || open;
  const done = research.steps.filter((s) => s.status === 'done').length;
  const sites = new Set(research.steps.flatMap((s) => (s.sources || []).map((x) => x.url))).size;
  const title = research.phase === 'planning' ? 'Planning the research'
    : research.phase === 'searching' ? `Searching the web · ${done} of ${research.steps.length}`
    : research.phase === 'writing' ? 'Writing the report'
    : research.phase === 'done' ? `Researched ${research.steps.length} searches · ${sites} ${sites === 1 ? 'source' : 'sources'}`
    : research.phase === 'stopped' ? 'Research stopped' : 'Research failed';
  const progress = research.phase === 'planning' ? 0.06 : research.phase === 'searching' ? 0.1 + (0.75 * done) / Math.max(1, research.steps.length) : research.phase === 'writing' ? 0.9 : 1;
  return (
    <div className={`research-card${live ? ' live' : ''}`} data-phase={research.phase}>
      <button type="button" className="research-head" onClick={() => !live && setOpen(!open)} aria-expanded={shown} disabled={live}>
        <span className="research-icon" aria-hidden="true">{live ? <MoonPhase /> : <Telescope size={16} />}</span>
        <span className="research-title" role={live ? 'status' : undefined}>{title}</span>
        {!live && <ChevronDown size={15} className="research-chevron" aria-hidden="true" />}
      </button>
      {live && <div className="research-bar" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>}
      {shown && research.steps.length > 0 && (
        <ol className="research-steps">
          {research.steps.map((s, i) => (
            <li key={i} className={`research-step ${s.status}`}>
              <span className="research-dot" aria-hidden="true">{s.status === 'done' ? <Check size={11} strokeWidth={3} /> : s.status === 'failed' ? <X size={11} strokeWidth={3} /> : null}</span>
              <span className="research-query">{s.query}</span>
              {s.sources && s.sources.length > 0 && (
                <span className="research-sites">
                  {s.sources.slice(0, 4).map((x) => <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer" title={x.title}>{x.title && !/^https?:/.test(x.title) ? x.title : host(x.url)}</a>)}
                  {s.sources.length > 4 && <span className="muted">+{s.sources.length - 4}</span>}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
