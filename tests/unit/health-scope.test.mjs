import assert from 'node:assert/strict';
import * as health from '../../src/lib/ai/health.js';

const stored = new Map();
const previousStorage = globalThis.localStorage;
globalThis.localStorage = {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, String(value)),
};
const A = 'a'.repeat(64), B = 'b'.repeat(64), C = 'c'.repeat(64);
const ID = 'gemini:fixture';
const key = scope => `mr.modelRecord.v2.${scope}`;
const clock = Date.now;
const now = 1_800_000_000_000;
Date.now = () => now;

try {
  assert.equal(typeof health.setHealthScope, 'function', 'Health must expose explicit account/configuration scoping');
  stored.set('mr.modelRecord', JSON.stringify({ [ID]: { ok: 0, n: 100, at: now } }));
  health.setHealthScope(A);
  assert.equal(health.healthScope(), A);
  assert.equal(health.reliability(ID), null, 'Unscoped historical failures cannot be assigned to an account');
  for (let i = 0; i < 4; i++) health.noteFailure(ID, 503);
  health.noteReplyLatency(ID, 1000); health.noteReplyLatency(ID, 1000);
  assert(health.reliability(ID) < 0.5);
  assert(health.isCoolingDown(ID));
  assert.equal(health.replyLatency(ID), 1000);

  health.setHealthScope(A);
  assert(health.isCoolingDown(ID), 'Reinstalling the same scope must preserve current observations');
  health.setHealthScope(B);
  assert.equal(health.reliability(ID), null, 'Another account or endpoint cannot inherit failures');
  assert.equal(health.isCoolingDown(ID), false);
  assert.equal(health.replyLatency(ID), null);
  for (let i = 0; i < 4; i++) health.noteSuccess(ID);
  const successful = health.reliability(ID);
  health.noteFailure(ID, 503, '', A);
  health.noteReplyLatency(ID, 500, A); health.noteReplyLatency(ID, 500, A);
  assert.equal(health.reliability(ID), successful, 'A late failure from the old scope must be ignored');
  assert.equal(health.isCoolingDown(ID), false);
  assert.equal(health.replyLatency(ID), null);

  health.setHealthScope(A);
  assert(health.reliability(ID) < 0.5, 'Returning to an account restores only its own persisted history');
  const failed = health.reliability(ID);
  health.noteSuccess(ID, B);
  assert.equal(health.reliability(ID), failed, 'A late success must not contaminate a different scope');
  health.setHealthScope(B);
  assert.equal(health.reliability(ID), successful);

  stored.set(key(C), JSON.stringify({
    [ID]: { ok: 3, n: 4, at: now },
    'bad:negative': { ok: -1, n: 4, at: now },
    'bad:impossible': { ok: 5, n: 4, at: now },
    'bad:string': { ok: '3', n: 4, at: now },
    'bad:future': { ok: 3, n: 4, at: now + 1 },
    'bad:zero': { ok: 0, n: 0, at: now },
    'bad:array': [],
    ['__proto__']: [],
  }));
  health.setHealthScope(C);
  assert(health.reliability(ID) > 0.5, 'Valid persisted observations still inform routing');
  for (const id of ['bad:negative', 'bad:impossible', 'bad:string', 'bad:future', 'bad:zero', 'bad:array', '__proto__']) {
    assert.equal(health.reliability(id), null, `Malformed stored observation ${id} must be ignored`);
  }
  for (const malformed of ['null', '[]', '42', '{broken']) {
    health.setHealthScope(null);
    stored.set(key(C), malformed);
    health.setHealthScope(C);
    assert.equal(health.reliability(ID), null, 'Invalid persisted records must not affect routing');
  }
  for (const invalid of ['raw-secret', '', 'a'.repeat(63), A.toUpperCase(), 123, undefined]) {
    assert.throws(() => health.setHealthScope(invalid), TypeError);
    assert.equal(health.healthScope(), C, 'An invalid scope cannot switch or persist health state');
  }

  health.setHealthScope(null);
  const before = new Map(stored);
  for (let i = 0; i < 4; i++) health.noteSuccess(ID);
  assert(health.reliability(ID) > 0.5, 'Unscoped tests can use ephemeral observations');
  assert.deepEqual(stored, before, 'An unresolved scope never persists observations');
  health.setHealthScope(null);
  assert.equal(health.reliability(ID), null, 'Invalidating an unresolved scope also drops ephemeral observations');
} finally {
  health.setHealthScope?.(null);
  Date.now = clock;
  if (previousStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = previousStorage;
}

console.log('PASS health account/credential/endpoint isolation, safe persistence, stale callbacks and unresolved scope');
