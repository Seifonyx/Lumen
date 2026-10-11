import assert from 'node:assert/strict';
import { releasePythonRunner, runCode, runLang, type RunArtifact } from '../../src/lib/runner';
class FakeWorker {
  static workers: FakeWorker[] = [];
  onmessage?: (event: { data: Record<string, unknown> }) => void;
  onerror?: (event: { message: string; preventDefault(): void }) => void;
  payload?: Record<string, unknown>;
  terminated = false;
  constructor() { FakeWorker.workers.push(this); }
  postMessage(payload: Record<string, unknown>) { this.payload = payload; }
  terminate() { this.terminated = true; }
  emit(data: Record<string, unknown>) { this.onmessage?.({ data }); }
}
Object.assign(globalThis, { Worker: FakeWorker, location: { origin: 'https://analysis.local' } });
assert.equal(runLang(' Python3 '), 'python');
assert.equal(runLang('sql'), null);
const output: string[] = [];
const one = runCode('python', 'print(1)', line => output.push(line.text));
const first = FakeWorker.workers[0];
const artifacts: RunArtifact[] = [];
const two = runCode('python', 'print(2)', line => output.push(line.text), 1000, { analysis: true, files: [{ name: 'a.csv', data: new Uint8Array([1]) }], onArtifact: file => artifacts.push(file) });
assert.equal((await one.done).failed, true);
assert.ok(first.terminated);
const second = FakeWorker.workers[1];
assert.equal(second.payload?.origin, 'https://analysis.local');
assert.equal(second.payload?.analysis, true);
first.emit({ id: first.payload?.id, kind: 'log', text: 'stale' });
second.emit({ id: 'wrong', kind: 'log', text: 'wrong' });
assert.ok(!output.includes('stale') && !output.includes('wrong'));
second.emit({ id: second.payload?.id, kind: 'artifact', name: 'chart.png', data: new Uint8Array([2]) });
second.emit({ id: second.payload?.id, kind: 'done' });
assert.equal((await two.done).failed, false);
assert.equal(artifacts[0].name, 'chart.png');
releasePythonRunner();assert.ok(second.terminated);
const three = runCode('python', 'while True: pass', line => output.push(line.text), 5);
assert.equal((await three.done).failed, true);assert.ok(FakeWorker.workers[2].terminated);
assert.ok(output.some(line => line.includes('Stopped after')));
console.log('PASS runner replacement, event isolation, files/artifacts, release and timeout');
