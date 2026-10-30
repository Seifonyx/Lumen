import { showRoutingSection } from '../lib/routing-center';
import '../styles/canvas-routing-experience.css';
import { useMemo } from 'react';
import { modelLabel, selectCurrentChat, selectCurrentModel, useStore } from '../store';
import { currentRoutingPresentation, completedRoutingRecord } from '../lib/routing-presentation';
import { PROVIDER_NAMES } from '../lib/util';
import { navigateScreen } from '../lib/screen-history';

/** Current preference and actual saved evidence have different headings and no inferred bridge between them. */
export default function RoutingInsight() {
  const chat = useStore(selectCurrentChat), selection = useStore(selectCurrentModel);
  const settings = useStore(s => s.settings), catalog = useStore(s => s.catalog);
  const preference = settings.autoPreferProvider;
  const preferredLabel = preference === 'gemini' ? 'Google AI Studio' : PROVIDER_NAMES[preference as keyof typeof PROVIDER_NAMES] || `${preference} (not in known provider list)`;
  const current = currentRoutingPresentation(selection, settings, catalog);
  const record = useMemo(() => completedRoutingRecord(chat?.messages || []), [chat?.messages]);
  return <section className="rc-routing-insight" aria-label="Routing details">
    <section><h3>Current preference</h3>
      <dl><dt>Default priority</dt><dd>{current.priority} · explicit requests may override this</dd><dt>Recovery permission</dt><dd>{current.fallback.title}</dd>{settings.autoPreferProvider && <><dt>Auto provider preference</dt><dd>{preferredLabel} when eligible</dd></>}{Boolean(settings.autoExcluded?.length) && <><dt>Auto exclusions</dt><dd>{settings.autoExcluded!.length} saved exclusions</dd></>}</dl>
      <p>{current.fallback.description}</p><p className="rc-muted">The next model is not known until the request is evaluated. A preference is not a promised outcome.</p>
      <button type="button" className="rc-link" onClick={() => navigateScreen(() => showRoutingSection('routing'))}>Routing settings</button>
    </section>
    <section><h3>Last completed answer</h3>{record ? <>
      <strong>{modelLabel(catalog, record.model)}</strong><p>{record.via ? `Recorded source: ${record.via}` : 'No source mode was recorded for this answer.'}</p>
      <time dateTime={new Date(record.at).toISOString()}>{new Date(record.at).toLocaleString()}</time>
      {record.recovery.length > 0 && <div><h4>Recorded recovery</h4><ul>{record.recovery.map((text,i) => <li key={i}>{text}</li>)}</ul></div>}
      {record.reasons.length ? <div><h4>{record.recovery.length ? 'Selection notes before recovery' : 'Recorded selection notes'}</h4><ul>{record.reasons.map((text,i)=><li key={i}>{text}</li>)}</ul><p className="rc-muted">Recorded estimates from capabilities and model-family hints; not a guarantee of answer quality.</p></div> : <p>No selection reason was saved for this answer.</p>}
      {record.alternatives.length > 0 ? <div><h4>Recorded alternatives</h4><ul>{record.alternatives.map(id => <li key={id}>{modelLabel(catalog,id)}</li>)}</ul><p className="rc-muted">Candidates recorded at that selection, not promised next models.</p></div> : <p>No alternative models were saved for this answer.</p>}
    </> : <p>No completed answer with a recorded model in this chat yet. Failed, stopped and in-progress replies are not completed-answer evidence.</p>}</section>
  </section>;
}
