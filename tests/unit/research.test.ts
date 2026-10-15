import assert from 'node:assert/strict';
import { linkCitations, numberSources, parsePlan, reportBrief } from '../../src/lib/research';

// Plans: a JSON array, a fenced one, or plain lines; duplicates dropped, at most six.
assert.deepEqual(parsePlan('["a b c", "d e f"]', 'q'), ['a b c', 'd e f']);
assert.deepEqual(parsePlan('```json\n["one query", "two query", "One query"]\n```', 'q'), ['one query', 'two query']);
assert.deepEqual(parsePlan('1. first search\n2. second search', 'q'), ['first search', 'second search']);
assert.equal(parsePlan(JSON.stringify(Array.from({ length: 9 }, (_, i) => `query ${i}`)), 'q').length, 6);
assert.deepEqual(parsePlan('', 'the question'), ['the question']);

// Sources are numbered once across all searches.
const steps = [
  { query: 'x', status: 'done' as const, notes: 'Note one', sources: [{ title: 'A', url: 'https://a.example' }, { title: 'B', url: 'https://b.example' }] },
  { query: 'y', status: 'done' as const, notes: 'Note two', sources: [{ title: 'B', url: 'https://b.example' }, { title: 'C', url: 'https://c.example' }] },
  { query: 'z', status: 'failed' as const },
];
const { sources } = numberSources(steps);
assert.deepEqual(sources.map((s) => s.title), ['A', 'B', 'C']);
const brief = reportBrief('Why?', steps);
assert.match(brief, /Search 1: x\nSources: \[1\] \[2\]/);
assert.match(brief, /Search 2: y\nSources: \[2\] \[3\]/);
assert.match(brief, /\[3\] C — https:\/\/c\.example/);
assert.doesNotMatch(brief, /Search 3/);

// Citations become links (not inside code, not unknown numbers), and the list is added.
const out = linkCitations('Fact [1][3]. Unknown [9]. `arr[1]`\n```\nx[2]\n```', sources);
assert.match(out, /Fact \[\[1\]\]\(https:\/\/a\.example\)\[\[3\]\]\(https:\/\/c\.example\)/);
assert.match(out, /Unknown \[9\]/);
assert.match(out, /`arr\[1\]`/);
assert.match(out, /x\[2\]/);
assert.match(out, /## Sources\n\n1\. \[A\]\(https:\/\/a\.example\)\n2\. \[B\]/);
assert.equal(linkCitations('No sources', []), 'No sources');
console.log('research: ok');
