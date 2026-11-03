// Prism presentation of the canonical Layout editor/settings. Existing back-layer/screen memory owns navigation.
import '../styles/canvas-routing-experience.css';
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { LayoutEditor } from './LayoutsTab';
import { allLayouts, findLayout, LAYOUT_PREFIX, newLayoutId, type Layout } from '../lib/layouts';
import { layoutPreview, layoutAssignmentProblem } from '../lib/routing-presentation';
import { modelLabel, selectCurrentModel, useStore } from '../store';
import { useBackLayer } from '../lib/back-stack';
import { finishScreen, screenBack } from '../lib/screen-history';
import { useScreenMemory } from '../lib/screen-memory';
import { closeRoutingCenter } from '../lib/routing-center';
import { usePhoneLayout } from '../lib/phone-layout';
import { PROVIDER_NAMES } from '../lib/util';
import LayoutIcon from './LayoutIcon';
const RoutingFile = lazy(() => import('./RoutingExtras').then(m => ({ default: m.RoutingFile })));
const EMPTY: { editing: boolean; draft: Layout | null } = { editing: false, draft: null };

export default function PrismLayouts() {
  const catalog = useStore(s => s.catalog), settings = useStore(s => s.settings);
  const owner = useStore(s => s.user?.uid), conversation = useStore(s => s.currentId), selected = useStore(selectCurrentModel);
  const [view, setView] = useScreenMemory(`prism-layout-editor:${conversation || 'new'}`, EMPTY);
  const [selection, setSelection] = useScreenMemory<string | null>(`prism-layout-selection:${conversation || 'new'}`, null);
  const [focused, setFocused] = useScreenMemory(`prism-layout-focused:${conversation || 'new'}`, false);
  const phone = usePhoneLayout();
  const index = useRef<HTMLDivElement>(null), lastEdit = useRef<string | null>(null);
  const currentOwner = () => useStore.getState().user?.uid === owner && useStore.getState().currentId === conversation;
  const layouts = useMemo(() => allLayouts(catalog?.models || [], settings.layouts, settings.hiddenLayouts), [catalog, settings.layouts, settings.hiddenLayouts]);
  const saved = settings.layouts || [], recommended = layouts.filter(l => l.builtin && !l.edited);
  const leave = () => { if (currentOwner()) setView(s => ({ ...s, editing: false })); };
  useBackLayer(phone && focused, () => { if (currentOwner()) setFocused(false); }, () => { if (currentOwner()) setFocused(true); }, 'prism-layout-detail');
  useBackLayer(view.editing, leave, () => { if (currentOwner()) setView(s => ({ ...s, editing: true })); }, `prism-layout:${view.draft?.id || 'new'}`);
  const chosen = saved.find(l => l.id === selection) || layouts.find(l => l.id === selection) || saved[0] || layouts[0];
  useEffect(() => { if (!view.editing && (!phone || focused)) { const heading = index.current?.querySelector<HTMLElement>('.rc-layout h3'); heading?.focus({ preventScroll: true }); if (phone) heading?.scrollIntoView({ block: 'start' }); } }, [chosen?.id, focused, phone, view.editing]);
  const choose = (layout: Layout) => { setSelection(layout.id); if (phone) setFocused(true); };
  const edit = (layout: Layout) => { lastEdit.current = layout.id; setView({ editing: true, draft: layout }); };
  const done = (result?: 'saved' | 'cancelled') => {
    if (result === 'saved' && view.draft) setSelection(view.draft.id);
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
      {phone && <button type="button" className="rc-link rc-layout-back" onClick={() => screenBack(() => setFocused(false))}><ChevronLeft size={17} aria-hidden="true" />All layouts</button>}
      <header><div><span className="rc-label">{l.builtin && !l.edited ? 'Recommended layout' : 'Your layout'}{selected === LAYOUT_PREFIX + l.id ? ' · Current in this chat' : ''}</span><h3 tabIndex={-1}>{l.name}</h3>{l.description && <p>{l.description}</p>}</div></header>
      <dl className="rc-layout-facts"><div><dt>How it answers</dt><dd>{l.mode === 'order' ? 'In order' : 'Best for each message'}<p>{preview.mode}</p></dd></div><div><dt>Instructions</dt><dd>{l.instructions?.trim() ? 'Custom instructions' : 'None'}<p>{l.instructions?.trim() ? 'Added to your usual instructions.' : 'Models get your usual instructions only.'}</p></dd></div><div><dt>Recovery</dt><dd>{preview.fallback.title}<p>{preview.priority} priority for automatic choices.</p></dd></div></dl>
      {!selectable && <p>Not available in selection. This saved configuration is retained.</p>}
      <div className="rc-layout-model-heading"><h4>Models</h4><span>{l.models.length}</span></div>
      <ol aria-label={`${l.name} assignments`}>{l.models.map(id => { const model = catalog?.models.find(m => m.id === id);const problem = layoutAssignmentProblem(l, model);return <li key={id}><div><strong>{modelLabel(catalog,id)}</strong>{problem && <span>{model ? `This model ${problem}.` : 'Not in current catalog · kept in this Layout'}</span>}</div>{model && <small>{model.provider === 'google' ? 'Google AI Studio' : PROVIDER_NAMES[model.provider]}</small>}</li>; })}</ol>
      {!l.models.length && <p>No models in the current catalog fit this Layout. Connect a provider or edit the assignments.</p>}
      {l.builtin && !l.edited && <p className="rc-muted">Recommended layouts use models from your current catalog. Save an edit to make this set your own.</p>}
      <div className="rc-layout-actions"><button type="button" className="rc-primary" disabled={!l.models.length || !selectable} aria-label={`Use ${l.name}`} onClick={() => use(l.id)}>Use in this chat</button><button type="button" className="rc-link rc-layout-edit" aria-label={`Edit ${l.name}`} onClick={() => edit(l)}>{l.builtin && !l.edited ? 'Make it my own' : `Edit ${l.name}`}</button></div><details><summary>Selection &amp; requirements</summary><p>{preview.mode} {preview.fallback.description} {preview.priority} priority for automatic choices. {preview.requirements}</p></details>
    </article>;
  };
  return <div className="rc-body rc-layouts" ref={index} onKeyDown={e => {
    if (view.editing && e.key === 'Escape' && !e.defaultPrevented && !e.nativeEvent.isComposing && !(e.target as Element).closest('[role="menu"],[role="listbox"],select')) { e.preventDefault(); e.stopPropagation(); screenBack(leave); }
  }}>
    <div className="rc-layout-console" data-focused={phone && (focused || view.editing) || undefined}>
      <aside className="rc-layout-index" aria-label="Layouts">
        <div className="rc-panel-title"><h2>Layouts <small>{layouts.length}</small></h2><button type="button" className="rc-link" onClick={() => edit({ id: newLayoutId(), name: '', icon: 'layers', description: '', models: [], mode: 'order', fallback: 'layout' })}><Plus size={16} aria-hidden="true" />New layout</button></div>
        {!saved.length && <section className="rc-layout-empty"><h3>Make a model set your own</h3><p>Choose a recommendation or create a layout.</p></section>}
        {([['Your layouts', saved], ['Recommended Layouts', recommended]] as [string, Layout[]][]).map(([title, items]) => items.length > 0 && <section key={title}><h3 className="rc-label">{title}<span>{items.length}</span></h3><ul>{items.map(l => <li key={l.id}><button type="button" className="rc-layout-option" data-layout-option={l.id} aria-current={!view.editing && chosen?.id === l.id ? 'true' : undefined} onClick={() => choose(l)}><span className="rc-layout-mark"><LayoutIcon icon={l.icon} size={18} /></span><span><strong>{l.name}</strong><small>{l.mode === 'order' ? 'In order' : 'Best for each message'} · {l.models.length} models{selected === LAYOUT_PREFIX + l.id ? ' · Current' : ''}</small></span><ChevronRight size={16} aria-hidden="true" /></button></li>)}</ul></section>)}
        <details className="rc-layout-file"><summary>Import or export routing settings</summary><Suspense fallback={null}><RoutingFile /></Suspense></details>
      </aside>
      {view.editing && view.draft ? <div className="rc-editor"><LayoutEditor presentation="prism" key={view.draft.id} start={view.draft} onDraftChange={draft => { if (currentOwner()) setView(s => s.draft === draft ? s : { ...s, draft }); }} onDone={done} /></div> : chosen ? card(chosen) : <div className="rc-layout-welcome"><LayoutIcon icon="layers" size={28} /><h3>A model set for your work</h3><p className="rc-muted">Choose models, how they answer and the recovery rules you want.</p></div>}
    </div>
  </div>;
}
