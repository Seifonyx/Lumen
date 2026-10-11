import assert from 'node:assert/strict';
import { readSSE } from '../../src/lib/ai/http.js';
const encoder = new TextEncoder();
let cancelled = false;
const body = new ReadableStream({
  start(controller) {
    controller.enqueue(encoder.encode(': keepalive\r\ndata: {"text":"answer"}\r\n\r\ndata: {"usage":3}\n\ndata: [DO'));
    controller.enqueue(encoder.encode('NE]\n\ndata: {"text":"must not appear"}\n\n'));
    // Deliberately keep the connection open after DONE.
  },
  cancel() { cancelled = true; },
});
const events = [];
for await (const event of readSSE(body)) events.push(event);
assert.deepEqual(events, [{ text: 'answer' }, { usage: 3 }]);
assert.ok(cancelled);
assert.equal(body.locked, false);
let earlyCancelled = false;
const early = new ReadableStream({ start(c) { c.enqueue(encoder.encode('data: {"error":true}\n\n')); }, cancel() { earlyCancelled = true; } });
for await (const event of readSSE(early)) { assert.ok(event.error); break; }
assert.ok(earlyCancelled);
console.log('PASS split SSE end marker finishes an open connection, preserves usage and cancels early exits');
