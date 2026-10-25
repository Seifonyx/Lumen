import type { ModelInfo } from '../types';
import { PROVIDER_NAMES } from './util';

export const modelProvider = (model: ModelInfo) => model.provider === 'google' ? 'gemini' : model.provider;
export const modelProviderLabel = (model: ModelInfo) => model.provider === 'google' ? 'Google AI Studio' : PROVIDER_NAMES[model.provider];
/** Every word may match a different real field; provider aliases match in both Prism and the picker. */
export function matchesModel(model: ModelInfo, query: string) {
  const text = `${model.id} ${model.name} ${model.label} ${model.provider} ${modelProviderLabel(model)}`.toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every(word => text.includes(word));
}
