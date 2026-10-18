import assert from 'node:assert/strict';
import * as recovery from '../../src/lib/ai/recovery.js';

const classify = input => recovery.classifyFailure(input);
const decide = (failure, options = {}) => recovery.recoveryDecision(classify(failure), {
  remainingAttempts: 3, remainingMs: 10_000, canFallback: true, ...options,
});

for (const failure of [
  { error: new Error('Invalid YouTube video link. Add it again through Tools.') },
  { error: new TypeError('Invalid attachment data'), phase: 'validation' },
  { status: 422, code: 'invalid_request_error', message: 'messages must contain a user message' },
  { status: 400, code: 'invalid_request_error', message: 'messages must be an array' },
]) {
  assert.equal(classify(failure).kind, 'invalid-input');
  const decision = decide(failure);
  assert.equal(decision.action, 'stop', 'Changing models cannot repair invalid request construction');
  assert.equal(decision.penalizeHealth, false);
  assert.equal(decision.invalidateMetadata, false);
}

for (const failure of [
  { error: Object.assign(new Error('Stopped'), { name: 'AbortError' }) },
  { status: 'cancelled' },
]) {
  assert.equal(classify(failure).kind, 'cancelled');
  assert.equal(decide(failure).action, 'stop');
  assert.equal(decide(failure).penalizeHealth, false);
}

for (const failure of [
  { status: 401, message: 'Invalid API key' },
  { status: 403, message: 'API key is not allowed for this website' },
  { status: 403, message: 'Permission denied for this project' },
]) {
  const result = classify(failure);
  assert.equal(result.scope, 'provider');
  assert(['authentication', 'authorization'].includes(result.kind));
  const decision = decide(failure);
  assert.equal(decision.action, 'next-model');
  assert.equal(decision.skipProvider, true);
  assert.equal(decision.penalizeHealth, false);
}

for (const failure of [
  { status: 403, message: 'This account does not have access to model alpha' },
  { status: 403, message: 'Model alpha is not supported for your account' },
  { status: 403, message: 'Permission denied for model alpha' },
  { status: 404, message: 'Model alpha does not exist' },
  { status: 410, message: 'Model alpha has been retired' },
]) {
  assert.equal(classify(failure).kind, 'model-unavailable');
  assert.equal(classify(failure).scope, 'model');
  const decision = decide(failure);
  assert.equal(decision.action, 'next-model');
  assert.equal(decision.skipProvider, false, 'Model authorization is distinct from a rejected provider credential');
  assert.equal(decision.invalidateMetadata, true);
  assert.equal(decide(failure, { metadataRefreshed: true }).invalidateMetadata, false, 'Metadata recovery cannot recurse within one operation');
}

for (const failure of [
  { status: 400, code: 'context_length_exceeded', message: 'Maximum context length exceeded' },
  { status: 400, code: 'INVALID_ARGUMENT', message: 'The input token count (194873) exceeds the maximum number of tokens allowed (131072).' },
  { status: 400, message: 'The input token count exceeds the maximum number of tokens allowed' },
  { status: 'context', message: 'The context window is too small' },
]) {
  assert.equal(classify(failure).kind, 'context');
  assert.equal(decide(failure).action, 'next-model', 'A context failure must permit a compatible authorized backup');
  assert.equal(decide(failure).invalidateMetadata, true);
  assert.equal(decide(failure).penalizeHealth, false);
}

for (const failure of [
  { status: 400, code: 'invalid_request_error', message: 'This model does not support image inputs' },
  { status: 400, message: 'Unsupported modality: audio' },
  { status: 400, message: 'Tools are not supported by this model' },
  { status: 'capabilities', message: 'Unverified attachment capabilities' },
]) {
  assert.equal(classify(failure).kind, 'capability');
  assert.equal(decide(failure).action, 'next-model');
  assert.equal(decide(failure).invalidateMetadata, true);
}

for (const failure of [
  { status: 400, message: 'Unsupported thinkingConfig parameter' },
  { status: 400, message: 'Unrecognized generation configuration parameter thinking_budget' },
  { status: 400, message: 'Request rejected by this model' },
]) {
  assert.notEqual(classify(failure).kind, 'invalid-input', 'HTTP 400 alone is not proof of terminal user input');
  assert.equal(decide(failure).action, 'next-model');
  assert.notEqual(decide(failure, { allowSameModelRetry: true }).action, 'retry-model', 'Only the adapter can authorize a safe parameter adjustment');
}

for (const failure of [
  { status: 402, message: 'Insufficient credits' },
  { status: 429, message: 'Account daily quota exhausted', limit: { scope: 'day' } },
  { status: 429, message: 'Rate limit reached for organization org-fixture', limit: { scope: 'minute', retryAfterSec: 30 } },
  { status: 429, provider: 'openrouter', message: 'Rate limit exceeded: free-models-per-day' },
]) {
  const decision = decide(failure);
  assert.equal(decision.action, 'next-model');
  assert.equal(decision.skipProvider, true, 'Account-wide limits must not burn the budget trying sibling models');
  assert.equal(decision.penalizeHealth, false);
}
for (const failure of [
  { status: 429, message: 'Rate limit reached for model alpha', limit: { scope: 'minute', retryAfterSec: 2 } },
  { status: 429, message: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier quota exceeded', limit: { scope: 'day' } },
  { status: 429, message: 'Resource exhausted' },
]) {
  assert.equal(decide(failure).skipProvider, false, 'Model-level or unknown quota scope cannot exclude unrelated sibling models');
  assert.equal(decide(failure).penalizeHealth, false);
}

for (const failure of [
  { status: 503, message: 'Overloaded' },
  { error: new TypeError('Failed to fetch') },
  { status: 'timeout' },
  { status: 'empty' },
  { error: Object.assign(new Error('Unexpected EOF'), { code: 'incomplete_stream', name: 'ProviderStreamError' }) },
  { error: Object.assign(new Error('Invalid stream frame'), { code: 'malformed_stream', name: 'ProviderStreamError' }) },
]) {
  assert.equal(decide(failure).action, 'next-model');
  assert.equal(decide(failure).penalizeHealth, true);
  assert.equal(decide(failure, { visibleOutput: true }).action, 'stop', 'Partial replies cannot be silently continued by another model');
  for (const toolEffects of ['pending', 'committed', 'unknown']) {
    assert.equal(decide(failure, { toolEffects }).action, 'stop', 'Uncertain or executed tool work cannot be replayed automatically');
  }
  assert.equal(decide(failure, { remainingAttempts: 0 }).action, 'stop');
  assert.equal(decide(failure, { remainingMs: 0 }).action, 'stop');
  assert.equal(decide(failure, { canFallback: false }).action, 'stop');
}

const transient = { status: 503, message: 'Overloaded' };
const retried = decide(transient, { canFallback: false, allowSameModelRetry: true, retryCount: 0, random: () => 0.5 });
assert.equal(retried.action, 'retry-model');
assert.equal(retried.delayMs, 250);
assert.equal(decide(transient, { canFallback: false, allowSameModelRetry: true, retryCount: 1 }).action, 'stop', 'Same-model retries have their own bounded count');
assert.equal(decide(transient, { canFallback: false, allowSameModelRetry: true, remainingMs: 100 }).action, 'stop', 'A retry cannot exceed its remaining deadline');
assert.equal(classify({ status: 429, limit: { retryAfterSec: 30 } }).retryAfterMs, 30_000);
assert.equal(decide({ status: 429, message: 'Account quota exhausted' }, { canFallback: false, allowSameModelRetry: true }).action, 'stop', 'Provider-wide quota is not retried within the same request');
assert.equal(recovery.recoveryDecision(classify(transient)).action, 'stop', 'Fallback requires explicit caller authorization and budget');
assert.equal(decide({ error: new Error('Unexpected internal serializer failure') }).action, 'stop', 'Unknown local exceptions must not masquerade as provider network errors');

console.log('PASS shared recovery classification, explicit fallback authorization, scoped invalidation, bounded retries and side-effect safety');
