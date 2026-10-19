import type { StreamEvent } from './api';
import type { ComparedAnswer, Source } from '../types';
import { waitFor } from './ai/abort.js';

export interface ComparisonStageResult {
  text: string;
  status: Exclude<ComparedAnswer['status'], 'loading'>;
  error?: string;
  sources?: Source[];
  model?: string;
}

export interface ComparisonStagePatch extends Omit<ComparisonStageResult, 'status'> {
  status: ComparedAnswer['status'];
}

interface StageOutput {
  text: string;
  error?: string;
  stopped?: boolean;
  sources?: Source[];
  model?: string;
}

export function comparisonStageResult(output: StageOutput): ComparisonStageResult {
  const error = output.error || (!output.text.trim() ? 'No answer was returned.' : undefined);
  return Object.freeze({
    text: output.text,
    status: output.stopped ? 'stopped' : error ? 'error' : 'done',
    ...(!output.stopped && error ? { error } : {}),
    ...(output.sources?.length ? { sources: copySources(output.sources) } : {}),
    ...(output.model ? { model: output.model } : {}),
  });
}

function copySources(sources: Source[]): Source[] {
  const snapshot = sources.map(source => Object.freeze({ ...source }));
  Object.freeze(snapshot);
  return snapshot;
}

export interface ComparisonStageOptions {
  events: AsyncIterable<StreamEvent>;
  signal: AbortSignal;
  transformText?: (text: string) => string;
  onEvent?: (event: StreamEvent) => void;
  patch: (patch: ComparisonStagePatch) => void;
  isCurrent?: () => boolean;
}

/** Runs one comparison answer or synthesis; request construction and recovery stay with the caller. */
export async function runComparisonStage(options: ComparisonStageOptions): Promise<ComparisonStageResult> {
  const { events, signal, onEvent, patch, transformText = text => text, isCurrent = () => true } = options;
  let rawText = '', text = '';
  let sources: Source[] = [];
  let model: string | undefined;
  let error: string | undefined;
  let stopped = false;
  let exhausted = false;
  let iterator: AsyncIterator<StreamEvent> | undefined;
  const emit = () => {
    if (isCurrent()) patch(Object.freeze({ text, sources: copySources(sources), status: 'loading', error: undefined, ...(model ? { model } : {}) }));
  };
  try {
    if (isCurrent() && !signal.aborted) {
      iterator = events[Symbol.asyncIterator]();
      while (isCurrent() && !signal.aborted) {
        const next = await waitFor(iterator.next(), signal) as IteratorResult<StreamEvent>;
        if (!isCurrent() || signal.aborted) break;
        if (next.done) { exhausted = true; break; }
        const event = next.value;
        onEvent?.(event);
        if (!isCurrent() || signal.aborted) break;
        if (event.t === 'text') {
          rawText += event.text;
          text = transformText(rawText);
          emit();
        } else if (event.t === 'sources') {
          sources = [...sources, ...copySources(event.items)];
          emit();
        } else if (event.t === 'model') {
          model = event.id;
          emit();
        } else if (event.t === 'error') {
          error = event.text || 'The model request failed.';
        } else if (event.t === 'discard') {
          rawText = text = '';
          sources = [];
          error = undefined;
          emit();
        } else if (event.t === 'done') {
          break;
        }
      }
    }
  } catch (failure) {
    stopped = failure instanceof Error && failure.name === 'AbortError';
    if (!stopped) error = failure instanceof Error ? failure.message || 'The model request failed.' : String(failure);
  } finally {
    // A pending next()/return() may ignore cancellation; never hold recovery open on it.
    if (iterator && !exhausted) {
      try { void Promise.resolve(iterator.return?.()).catch(() => {}); } catch { /* Already closed. */ }
    }
  }
  const result = comparisonStageResult({ text, sources, model, error, stopped: stopped || signal.aborted || !isCurrent() });
  if (isCurrent()) patch(result);
  return result;
}
