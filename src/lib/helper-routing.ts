import type { ModelInfo, Settings } from '../types';
import { AUTO, analyze, planRoute, type RouteInput } from './routing';
import { modelProblem } from './ai/eligibility.js';
import { choosePreference, compareKnownCost, estimatedCost } from './ai/preferences.js';

export type HelperRoutingSettings = Pick<Settings, 'enabledModels' | 'autoExcluded' | 'routingPreference' | 'autoPreferProvider'>;

export interface HelperRoutingOptions {
  tokens: number;
  outputTokens?: number;
  text?: string;
  preferred?: string;
  priority?: Settings['routingPreference'];
  blocked: (id: string) => boolean;
  left: (id: string) => number | null;
}

/** Uses the same eligibility and task ranking as Auto for summaries, titles and synthesis. */
export function helperModels(catalog: ModelInfo[], settings: HelperRoutingSettings, options: HelperRoutingOptions): string[] {
  const { tokens, outputTokens = 8192, text = '', preferred, blocked, left } = options;
  if (![tokens, outputTokens].every(value => Number.isFinite(value) && value >= 0)) return [];
  const inputTokens = tokens + 100; // Match the shared router's request overhead.
  const info = new Map(catalog.map(model => [model.id, model]));
  const remaining = new Map<string, number | null>();
  const enabled = [...new Set(settings.enabledModels)].filter(id => {
    const model = info.get(id);
    if (!model || id === AUTO || blocked(id)) return false;
    const quota = left(id);
    remaining.set(id, quota);
    if (quota !== null && quota <= 0) return false;
    return !modelProblem(model, { tokens: inputTokens,streaming:false,outputTokens });
  });
  const input: RouteInput = {
    selected: AUTO, enabled, catalog, text, streaming:false,files: [], conversationTokens: tokens, search: false,
    blocked: () => false, left: id => remaining.get(id) ?? null,
    excluded: settings.autoExcluded, preferProvider: settings.autoPreferProvider,
    preference: options.priority ?? settings.routingPreference,
  };
  const plan = planRoute(input);
  const ranked = plan.model ? [plan.model, ...plan.fallbacks] : [];
  if (choosePreference(input.preference, analyze(input)) === 'cost') {
    ranked.sort((a, b) => compareKnownCost(estimatedCost(info.get(a), inputTokens, outputTokens), estimatedCost(info.get(b), inputTokens, outputTokens)));
  }
  // Only a compatible explicit preference may bypass an Auto exclusion.
  return preferred && enabled.includes(preferred)
    ? [preferred, ...ranked.filter(id => id !== preferred)]
    : ranked;
}
