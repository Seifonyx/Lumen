import assert from "node:assert/strict";
import {
  chunks,
  DIMENSIONS,
  lexicalScore,
  normalizedVector,
  normalizeKnowledgeSources,
  pageChunks,
  scoreChunk,
} from "../../src/lib/knowledge/core";
const text =
  "a".repeat(3488) +
  " Patient Ahmed Mahmoud, phone 01012345678. " +
  "b".repeat(3500);
const pieces = pageChunks(text);
assert.ok(pieces.length >= 2);
assert.ok(pieces.some((p) => p.text.includes("01012345678")));
for (const part of pieces) {
  assert.ok(!part.embeddingText.includes("01012345678"));
  assert.ok(!part.embeddingText.includes("Ahmed Mahmoud"));
}
assert.ok(pieces.some((p) => p.embeddingText.includes("[PHONE_1]")));
for (let offset = 3400; offset < 3560; offset++) {
  const parts = pageChunks(
    "x".repeat(offset) +
      "\nPatient Ahmed Mahmoud, phone 01012345678.\n" +
      "z".repeat(3500),
  );
  for (const part of parts) {
    assert.ok(!part.embeddingText.includes("01012345678"));
    assert.ok(!part.embeddingText.includes("Ahmed Mahmoud"));
  }
}
assert.deepEqual(chunks(""), []);
assert.throws(() => chunks("abc", 10, 11));
const vector = normalizedVector(
  Array.from({ length: DIMENSIONS }, (_, i) => (i === 0 ? 10 : 0)),
);
assert.equal(vector[0], 1);
assert.throws(() => normalizedVector([1, 2]));
assert.throws(() => normalizedVector(Array(DIMENSIONS).fill(0)));
assert.throws(() => normalizedVector(Array(DIMENSIONS).fill(Infinity)));
assert.ok(
  lexicalScore("ICU protocol ICU safety", "ICU protocol") >
    lexicalScore("ICU", "ICU protocol"),
);
assert.ok(lexicalScore("دليل العناية المركزة", "العناية") > 0);
assert.ok(
  scoreChunk(
    {
      id: "a",
      docId: "a",
      ordinal: 0,
      page: 1,
      text: "ICU protocol",
      embeddingText: "ICU protocol",
      vector,
    },
    "ICU",
    vector,
  ) > 1,
);
assert.deepEqual(
  normalizeKnowledgeSources([
    { docId: "../../bad", page: 1, title: "bad", excerpt: "" },
  ]),
  [],
);
assert.equal(
  normalizeKnowledgeSources([
    { docId: "doc-1", page: 2, title: "Book.pdf", excerpt: "text" },
  ])[0].page,
  2,
);
console.log(
  "PASS knowledge chunk boundaries, whole-page masking, finite normalized vectors, multilingual ranking and citation validation",
);
