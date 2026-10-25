// Prism presentation of the canonical Layout editor/settings. Existing back-layer/screen memory owns navigation.
import '../styles/canvas-routing-experience.css';
import { lazy, Suspense, useMemo, useRef } from 'react';
import { Plus } from 'lucide-react';
import { LayoutEditor } from './LayoutsTab';
import { allLayouts, findLayout, LAYOUT_PREFIX, newLayoutId, type Layout } from '../lib/layouts';
import { layoutPreview, layoutAssignmentProblem } from '../lib/routing-presentation';
import { modelLabel, selectCurrentModel, useStore } from '../store';
import { useBackLayer } from '../lib/back-stack';
import { finishScreen, screenBack } from '../lib/screen-history';
import { useScreenMemory } from '../lib/screen-memory';
import { closeRoutingCenter } from '../lib/routing-center';
const RoutingFile = lazy(() => import('./RoutingExtras').then(m => ({ default: m.RoutingFile })));
const EMPTY: { editing: boolean; draft: Layout | null } = { editing: false, draft: null };

export default function PrismLayouts() {
  const catalog = useStore(s => s.catalog), settings = useStore(s => s.settings);
  const owner = useStore(s => s.user?.uid), conversation = useStore(s => s.currentId), selected = useStore(selectCurrentModel);
  const [view, setView] = useScreenMemory(`prism-layout-editor:${conversation || 'new'}`, EMPTY);
  const index = useRef<HTMLDivElement>(null), lastEdit = useRef<string | null>(null);
  const currentOwner = () => useStore.getState().user?.uid === owner && useStore.getState().currentId === conversation;
  const layouts = useMemo(() => allLayouts(catalog?.models || [], settings.layouts, settings.hiddenLayouts), [catalog, settings.layouts, settings.hiddenLayouts]);
  const saved = settings.layouts || [], recommended = layouts.filter(l => l.builtin && !l.edited);
  const leave = () => { if (currentOwner()) setView(s => ({ ...s, editing: false })); };
  useBackLayer(view.editing, leave, () => { if (currentOwner()) setView(s => ({ ...s, editing: true })); }, `prism-layout:${view.draft?.id || 'new'}`);
  const edit = (layout: Layout) => { lastEdit.current = layout.id; setView({ editing: true, draft: layout }); };
  const done = () => {
    finishScreen(() => setView(EMPTY));
    requestAnimationFrame(() => { if (currentOwner()) index.current?.querySelector<HTMLButtonElement>(`[data-layout="${CSS.escape(lastEdit.current || '')}"] .rc-layout-edit`)?.focus({ preventScroll: true }); });
  };
  const use = (id: string) => {
    const fresh = useStore.getState();
    if (!currentOwner() || !fresh.authed || !fresh.user) return;
    const layout = findLayout(id, fresh.catalog?.models || [], fresh.settings.layouts, fresh.settings.hiddenLayouts);
    if (!layout?.models.length) return;
    fresh.setChatModel(LAYOUT_PREFIX + layout.id); closeRoutingCenter(); fresh.toast(`Now using ${layout.name} in this chat`);
    requestAnimationFrame(() => { if (currentOwner() && !useStore.getState().settingsOpen && !useStore.getState().page) document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus({ preventScroll: true }); });
  };
  const card = (l: Layout) => {
    const preview = layoutPreview(l, settings);
    const selectable = Boolean(findLayout(l.id, catalog?.models || [], settings.layouts, settings.hiddenLayouts));
    return <article key={l.id} className="rc-layout" data-layout={l.id} aria-label={l.name}>
      <header><div><span className="rc-label">{l.mode === 'order' ? 'In saved order' : 'Match each request'}{selected === LAYOUT_PREFIX + l.id ? ' · Current in this chat' : ''}</span><h3>{l.name}</h3>{l.description && <p>{l.description}</p>}</div></header>
      <p><b>{preview.fallback.title}.</b></p>{!selectable && <p>Not available in selection. This saved configuration is retained.</p>}
      <ol aria-label={`${l.name} assignments`}>{l.models.map(id => { const model = catalog?.models.find(m => m.id === id);const problem = layoutAssignmentProblem(l, model);return <li key={id}><strong>{modelLabel(catalog,id)}</strong>{problem && <span>{model ? `This model ${problem}.` : 'Not in current catalog · kept in this Layout'}</span>}</li>; })}</ol>
      {!l.models.length && <p>No models in the current catalog fit this Layout. Connect a provider or edit the assignments.</p>}
      <div className="rc-layout-actions"><button type="button" className="rc-primary" disabled={!l.models.length || !selectable} aria-label={`Use ${l.name}`} onClick={() => use(l.id)}>Use layout</button><button type="button" className="rc-link rc-layout-edit" onClick={() => edit(l)}>Edit {l.name}</button><details><summary>Selection &amp; requirements</summary><p>{preview.mode} {preview.fallback.description} {preview.priority} priority for automatic choices. {preview.requirements}</p></details></div>
    </article>;
  };
  return <div className="rc-body rc-layouts" ref={index} onKeyDown={e => {
    if (view.editing && e.key === 'Escape' && !e.defaultPrevented && !e.nativeEvent.isComposing && !(e.target as Element).closest('[role="menu"],[role="listbox"],select')) { e.preventDefault(); e.stopPropagation(); screenBack(leave); }
  }}>
    {view.editing && view.draft ? <div className="rc-editor"><LayoutEditor presentation="prism" key={view.draft.id} start={view.draft} onDraftChange={draft => { if (currentOwner()) setView(s => s.draft === draft ? s : { ...s, draft }); }} onDone={done} /></div> : <>
      <div className="rc-panel-title"><div><h2>Layouts</h2><p className="rc-muted">A model set with selection, requirements and recovery rules.</p></div><button type="button" className="rc-primary" onClick={() => edit({ id: newLayoutId(), name: '', icon: 'layers', description: '', models: [], mode: 'order', fallback: 'layout' })}><Plus size={16} aria-hidden="true" />New layout</button></div>
      {saved.length ? saved.map(card) : <section className="rc-layout-empty"><h3>Make a model set your own</h3><p>Create a Layout for a kind of work. Choose its models, how they are selected and what recovery is permitted. Nothing is sent while you edit.</p></section>}
      {recommended.length > 0 && <details className="rc-layout-recommended"><summary>Recommended Layouts · {recommended.length}</summary><p className="rc-muted">Built from your current catalog. Hidden recommendations stay hidden; saved edits take precedence.</p>{recommended.map(card)}</details>}
      <details className="rc-layout-file"><summary>Import or export routing settings</summary><Suspense fallback={null}><RoutingFile /></Suspense></details>
    </>}
  </div>;
}
