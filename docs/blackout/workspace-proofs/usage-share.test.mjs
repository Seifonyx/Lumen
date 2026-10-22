// node docs/blackout/workspace-proofs/usage-share.test.mjs
import assert from 'node:assert/strict';
import { usageShare } from './usage-share.js';

assert.deepEqual(usageShare(0, 50_000), { label: '0%', text: '0% used', arc: 0 });
// The fixture conversation: ~231 of 50K tokens is 0.46%, previously shown as "0%".
assert.equal(usageShare(231, 50_000).label, '<1%');
assert.equal(usageShare(231, 50_000).text, 'Less than 1% used');
assert.ok(usageShare(231, 50_000).arc > 0, 'a nonzero share draws a visible arc');
assert.equal(usageShare(1, 1_000_000).label, '<1%');
assert.equal(usageShare(500, 50_000).label, '1%');
assert.equal(usageShare(12_340, 50_000).label, '25%');
assert.equal(usageShare(49_800, 50_000).label, '>99%', 'just under the limit is not shown as full');
assert.equal(usageShare(50_000, 50_000).label, '100%');
assert.equal(usageShare(80_000, 50_000).label, '100%');
assert.equal(usageShare(3, 0).label, '—', 'an unknown limit stays unknown');
assert.equal(usageShare(Number.NaN, 10).label, '—');
console.log('PASS usage share display rule');
