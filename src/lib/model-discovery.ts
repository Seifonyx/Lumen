import type { Catalog, ModelInfo, Settings } from '../types';
import type { ApiKeys } from './firebase';
import { providerEnabled } from './ai/provider-config.js';
import { modelProblem } from './ai/eligibility.js';
import { providerOfId } from './util';
import { modelProvider } from './model-search';

export type SelectionContext = { authed: boolean | null; user: { uid: string } | null; keys: ApiKeys; catalog: Catalog | null; settings: Pick<Settings, 'enabledModels' | 'unavailableModels'> };
export const selectionIndex = (state: SelectionContext) => ({ enabled: new Set(state.settings.enabledModels), present: new Set(state.catalog?.models.map(m => m.id)), denied: new Set([...(state.catalog?.deniedModelIds || []), ...(state.settings.unavailableModels || [])]) });
/** Characterization of Prism's existing manual-selection gates, not send-time eligibility/scoring. */
export function selectionProblem(state: SelectionContext, model: ModelInfo, index = selectionIndex(state)): string | null {
  const id = modelProvider(model);
  if (!state.authed || !state.user) return 'Sign in to choose a model.';
  if (!providerEnabled(id, state.keys)) return 'Save a key and enable this provider first.';
  if (!index.enabled.has(model.id)) return 'Enable this model in Settings → Models first.';
  if (!index.present.has(model.id) || index.denied.has(model.id)) return 'This model is unavailable for this account.';
  if (state.catalog?.providerStatus?.[id]?.errorKind === 'auth') return 'Update this provider’s connection first.';
  const problem = modelProblem(model);
  return problem ? `This model ${problem}.` : null;
}
export function modelCapabilities(model: ModelInfo): string[] {
  return [model.vision && 'Images', model.pdf && 'PDFs', model.search && 'Web search', model.thinking && 'Reasoning', model.tools === true && 'Tools'].filter(Boolean) as string[];
}

/** Retain a saved manual choice removed from discovery, without inventing capabilities or limits. */
export function withCurrentModel(models: ModelInfo[], current: string, label: string): ModelInfo[] {
  if (!current || current === 'auto' || current.startsWith('layout:') || models.some(m => m.id === current)) return models;
  return [...models, { id: current, name: current.split(':').slice(1).join(':'), label, provider: providerOfId(current), context: null,
    vision: false, pdf: false, search: false, thinking: false,
    metadata: { fields: { context: 'unknown', vision: 'unknown', pdf: 'unknown', search: 'unknown', thinking: 'unknown' } } }];
}
