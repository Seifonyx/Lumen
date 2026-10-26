import assert from 'node:assert/strict';
import { usageEvidence } from '../../src/lib/usage-presentation';
import type { UsageView } from '../../src/lib/usage';

const now = 1_800_000_000_000;
assert.deepEqual(usageEvidence(null, ['gemini:flash'], now), {
  available: false,
  requests: null,
  tokens: null,
  blocked: 0,
  rows: [],
  knownResetAt: null,
});

const view: UsageView = {
  models: {
    'gemini:flash': { id: 'gemini:flash', requests: 3, input: 100, output: 50, quota: null, blockedUntil: null, blockScope: null },
    'anthropic:claude': { id: 'anthropic:claude', requests: 2, input: 20, output: 30, quota: 10, blockedUntil: now + 60_000, blockScope: 'minute' },
  },
  openrouter: { used: 0, limit: null, resetAt: now + 86_400_000 },
  geminiResetAt: now + 86_400_000,
};
const evidence = usageEvidence(view, ['gemini:flash', 'anthropic:claude'], now);
assert.equal(evidence.available, true);
assert.equal(evidence.requests, 5);
assert.equal(evidence.tokens, 200);
assert.equal(evidence.blocked, 1);
assert.equal(evidence.knownResetAt, now + 60_000, 'only a block or known allowance can establish a relevant reset');
assert.deepEqual(evidence.rows.map(({ id, status, allowance, remaining }) => ({ id, status, allowance, remaining })), [
  { id: 'anthropic:claude', status: 'temporarily-blocked', allowance: 'known', remaining: 8 },
  { id: 'gemini:flash', status: 'no-block-recorded', allowance: 'unknown', remaining: null },
]);

const noEvidence: UsageView = { models: {}, openrouter: { used: 0, limit: null, resetAt: now + 10 }, geminiResetAt: now + 20 };
assert.equal(usageEvidence(noEvidence, ['gemini:flash'], now).knownResetAt, null, 'scheduled provider midnights are not shown as quota resets without quota evidence');
assert.equal(usageEvidence(noEvidence, ['gemini:flash'], now).rows[0].status, 'no-block-recorded');

const blockedOnly: UsageView = {
  models: { 'groq:blocked-disabled': { id: 'groq:blocked-disabled', requests: 0, input: 0, output: 0, quota: null, blockedUntil: now + 30_000, blockScope: 'minute' } },
  openrouter: { used: 0, limit: null, resetAt: now + 60_000 },
  geminiResetAt: now + 60_000,
};
const blockedOnlyEvidence = usageEvidence(blockedOnly, [], now);
assert.equal(blockedOnlyEvidence.blocked, 1, 'a disabled/removed model with a current block remains visible in the account activity record');
assert.equal(blockedOnlyEvidence.rows[0].id, 'groq:blocked-disabled');
assert.equal(blockedOnlyEvidence.rows[0].status, 'temporarily-blocked');
assert.equal(usageEvidence(blockedOnly, [], now + 45_000).blocked, 0, 'expired blocks do not remain active');

console.log('PASS app counter availability, unknown allowance, temporary block and evidence-backed reset semantics');
