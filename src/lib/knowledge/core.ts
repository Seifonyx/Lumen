import type { KnowledgeSource } from "../../types";
import { diffChars } from "diff";
import { Masker } from "../privacy";

export const EMBEDDING_MODEL = "gemini-embedding-2";
export const DIMENSIONS = 768;
export interface KnowledgeDocument {
  id: string;
  name: string;
  size: number;
  pages: number;
  chunks: number;
  indexed: number;
  createdAt: number;
  status: "importing" | "ready" | "indexing" | "paused" | "indexed";
  error?: string;
  model: string;
  privacy: "masked" | "asIs";
  findings: number;
}
export interface KnowledgePage {
  id: string;
  docId: string;
  page: number;
  text: string;
}
export interface KnowledgeChunk {
  id: string;
  docId: string;
  page: number;
  ordinal: number;
  text: string;
  embeddingText: string;
  vector?: Float32Array;
}

/** Project raw windows onto whole-page masking; include a complete placeholder at boundaries. */
export function pageChunks(
  text: string,
  masker = new Masker(),
): { text: string; embeddingText: string }[] {
  const masked = masker.mask(text).text,
    changes = diffChars(text, masked);
  let raw = 0,
    safe = 0;
  const spans = changes.map((change) => {
    const span = {
      raw,
      safe,
      old: change.added ? 0 : change.value.length,
      next: change.removed ? 0 : change.value.length,
      changed: Boolean(change.added || change.removed),
    };
    raw += span.old;
    safe += span.next;
    return span;
  });
  const position = (offset: number, end: boolean) => {
    for (let i = 0; i < spans.length; i++) {
      const s = spans[i];
      if (offset >= s.raw && offset < s.raw + s.old) {
        if (!s.changed) return s.safe + offset - s.raw;
        return end
          ? s.safe + (spans[i + 1]?.old === 0 ? spans[i + 1].next : 0)
          : s.safe;
      }
    }
    return masked.length;
  };
  const out: { text: string; embeddingText: string }[] = [];
  for (let start = 0; start < text.length; start += 3150) {
    const end = Math.min(text.length, start + 3500);
    if (text.slice(start, end).trim())
      out.push({
        text: text.slice(start, end),
        embeddingText: masked.slice(
          position(start, false),
          position(end, true),
        ),
      });
    if (end === text.length) break;
  }
  return out;
}
export interface KnowledgeHit {
  docId: string;
  page: number;
  score: number;
  text: string;
}

/** Split only after whole-page masking, so sensitive values never cross an unmasked boundary. */
export function chunks(text: string, size = 3500, overlap = 350): string[] {
  if (size <= overlap || overlap < 0) throw new Error("Invalid chunk size");
  const out: string[] = [];
  for (let start = 0; start < text.length; start += size - overlap) {
    const part = text.slice(start, start + size).trim();
    if (part) out.push(part);
    if (start + size >= text.length) break;
  }
  return out;
}
export function normalizedVector(values: unknown): Float32Array {
  if (
    !Array.isArray(values) ||
    values.length !== DIMENSIONS ||
    values.some((v) => typeof v !== "number" || !Number.isFinite(v))
  )
    throw new Error("Invalid embedding response. Nothing was saved.");
  const length = Math.hypot(...values);
  if (length < 1e-12)
    throw new Error("Empty embedding response. Nothing was saved.");
  return Float32Array.from(values, (v) => v / length);
}
export function lexicalScore(text: string, query: string): number {
  const terms = [
    ...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) || []),
  ];
  if (!terms.length) return 0;
  const lower = text.toLocaleLowerCase();
  let matches = 0,
    total = 0;
  for (const term of terms) {
    let at = 0,
      count = 0;
    while ((at = lower.indexOf(term, at)) !== -1 && count < 20) {
      count++;
      at += term.length;
    }
    if (count) matches++;
    total += Math.log1p(count);
  }
  return matches / terms.length + total / (terms.length * 5);
}
export function scoreChunk(
  chunk: KnowledgeChunk,
  query: string,
  vector?: Float32Array,
): number {
  const lexical = lexicalScore(chunk.text, query);
  let semantic = 0;
  if (vector?.length === DIMENSIONS && chunk.vector?.length === DIMENSIONS) {
    let dot = 0;
    for (let i = 0; i < DIMENSIONS; i++) dot += vector[i] * chunk.vector[i];
    if (Number.isFinite(dot)) semantic = Math.max(0, dot);
  }
  return lexical + (semantic > 0.2 ? semantic : 0);
}
export function normalizeKnowledgeSources(raw: unknown): KnowledgeSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 6)
    .flatMap((s) =>
      s &&
      typeof s.docId === "string" &&
      /^[\w-]{1,80}$/.test(s.docId) &&
      Number.isInteger(s.page) &&
      s.page >= 1 &&
      s.page <= 3000 &&
      typeof s.title === "string" &&
      typeof s.excerpt === "string"
        ? [
            {
              docId: s.docId,
              page: s.page,
              title: s.title.slice(0, 180),
              excerpt: s.excerpt.slice(0, 8000),
            },
          ]
        : [],
    );
}
