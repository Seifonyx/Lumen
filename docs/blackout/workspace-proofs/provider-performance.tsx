// Test-only Profiler workbench. Never imported by the proof entry or production.
import { createElement, Profiler } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ProofModelAction } from './ProviderBrowser';
import { useStore } from '../../../src/store';
import type { ModelInfo } from '../../../src/types';
const settled = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
export async function measureModelActions(models: ModelInfo[]) {
  const host = document.createElement('div'); host.hidden = true; document.body.append(host);
  const root = createRoot(host), original = useStore.getState();
  let commits = 0; const onSelected = () => {};
  try {
    flushSync(() => root.render(createElement('div', null, models.map(model => createElement(Profiler, { key: model.id, id: model.id, onRender: () => { commits++; } }, createElement(ProofModelAction, { model, onSelected }))))));
    await settled(); const mounted = host.querySelectorAll('button').length;
    commits = 0; const start = performance.now();
    for (let i = 0; i < 10; i++) { flushSync(() => useStore.setState({ catalogErrorDismissed: !useStore.getState().catalogErrorDismissed })); await settled(); }
    const unrelatedCommits = commits, elapsedMs = performance.now() - start;
    commits = 0;
    flushSync(() => useStore.setState({ keys: { ...original.keys, gemini: '' } })); await settled();
    return { models: mounted, unrelatedUpdates: 10, unrelatedCommits, elapsedMs, permissionChangeCommits: commits, disabledAfterKeyRemoval: host.querySelectorAll('button:disabled').length };
  } finally { root.unmount(); host.remove(); useStore.setState({ keys: original.keys, catalogErrorDismissed: original.catalogErrorDismissed }); }
}
