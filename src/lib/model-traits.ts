import type { ModelInfo } from '../types';
import { formatTokens } from './usage';

/** What sets a model apart when choosing between a few (Canvas Compare): its context size and what it can read.
 * Only what the catalog states; nothing is guessed. */
export function modelTraits(model: ModelInfo | undefined) {
  if (!model) return '';
  return [model.context ? `${formatTokens(model.context)} context` : '', model.vision ? 'images' : '', model.pdf ? 'PDFs' : ''].filter(Boolean).join(' · ');
}
