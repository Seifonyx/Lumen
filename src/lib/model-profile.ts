import { requiresReasoning } from './ai/eligibility.js';
// Shared model-family hints. Capability metadata remains authoritative; these are heuristics, not benchmarks.
import type { ModelInfo } from '../types';

export type Feature = 'strength' | 'coder' | 'reasoner' | 'slow' | 'speed' | 'vision' | 'pdf' | 'search' | 'longctx' | 'languages' | 'files';

/** Overall strength (0–10) from what's known about model families, else from size in the name. */
const KNOWN: [RegExp, number][] = [
  [/gemini-(?:[3-9][\d.]*|2\.5)-pro|gemini-pro-latest/, 9.2],
  [/qwen-?3[\w.-]*coder|qwen3-coder/, 8.8],
  [/kimi-k2/, 8.7],
  [/deepseek[\w.-]*(r1|v3|v4|chat|reasoner)/, 8.6],
  [/gpt-oss-120b/, 8.4],
  [/glm-(4\.[5-9]|[5-9])/, 8.3],
  [/qwen-?3[\w.-]*(235b|max)/, 8.3],
  [/gemini-flash-latest|gemini-[\d.]+-flash(?!-lite)/, 7.8],
  [/llama-4-maverick/, 7.4],
  [/mistral-large|magistral|command-a|mistral-medium/, 7.2],
  [/qwq/, 7.2],
  [/devstral|codestral/, 7],
  [/llama-?3\.3-70b/, 6.8],
  [/gpt-oss-20b/, 6.5],
  [/gemini[\w.-]*flash-lite/, 6.2],
  [/llama-4-scout/, 6.2],
  [/gemma/, 6],
  [/mistral-small|ministral/, 5.5],
];

const lower = (m: ModelInfo) => `${m.provider}:${m.name}`.toLowerCase();
const params = (n: string) => Number(/(?:^|[-/:._])(\d{1,4}(?:\.\d)?)b(?=[-/:._]|$)/.exec(n)?.[1]) || 0;

export function strength(m: ModelInfo) {
  const n = lower(m);
  const p = params(n);
  const known = KNOWN.find(([re]) => re.test(n));
  // Family reputation must not give a 1B/distilled variant a flagship score.
  if (known) return p > 0 && p < 30 ? Math.min(known[1], p >= 12 ? 5.8 : p >= 7 ? 5 : 3.8) : known[1];
  if (p >= 200) return 8; if (p >= 65) return 7; if (p >= 30) return 6; if (p >= 12) return 5; if (p > 0) return 3.5;
  return /(^|[-/:._])(pro|ultra|large|max|opus|sonnet)([-/:._]|$)/.test(n) ? 7.5 : /(^|[-/:._])(lite|mini|nano|small|tiny|haiku)([-/:._]|$)/.test(n) ? 4.5 : 5.5;
}

/** What a model is good at, each 0–1. */
export function features(m: ModelInfo): Record<Feature, number> {
  const n = lower(m), p = params(n), gemini = m.provider === 'google' && !/gemma/.test(n);
  const light = /(^|[-/:._])(lite|mini|nano|small|tiny|instant|haiku)([-/:._]|$)/.test(n) || (p > 0 && p <= 12);
  const noReasoning=m.thinking===false && ['api','user','documented'].includes(m.metadata?.fields?.thinking || '');
  return {
    strength: strength(m) / 10,
    coder: /coder|codestral|devstral/.test(n) ? 1 : /kimi-k2|glm-(4\.[5-9]|[5-9])|gpt-oss|gpt-(?:4\.[1-9]|[5-9])|claude[\w.-]*(?:sonnet|opus)|deepseek[\w.-]*(v3|v4|chat)|gemini-(?:[3-9][\d.]*|2\.5)-pro|qwen-?3/.test(n) ? 0.6 : 0.15,
    reasoner: noReasoning?0:/\br1\b|-r1|reason|think|qwq|magistral/.test(n) ? 1 : m.thinking ? (strength(m) >= 8.5 ? 1 : 0.7) : 0,
    // Reasoning-only models think at length before every answer.
    slow: requiresReasoning(m) ? 1 : 0,
    speed: m.provider === 'cerebras' ? 1 : m.provider === 'groq' ? 0.9 : light ? 0.65 : /flash/.test(n) ? 0.55 : p >= 200 || /(?:^|[-/:._])(?:pro|large|max|opus)(?:[-/:._]|$)/.test(n) ? 0.1 : 0.35,
    vision: m.vision ? 1 : 0,
    pdf: m.pdf ? 1 : 0,
    search: m.search ? 1 : 0,
    longctx: (m.context || 0) >= 1e6 ? 1 : (m.context || 0) >= 200_000 ? 0.6 : (m.context || 0) >= 128_000 ? 0.35 : 0.1,
    languages: gemini ? 1 : /qwen|gemma|command|mistral|llama-4|glm|deepseek|kimi/.test(n) ? 0.65 : 0.35,
    files: gemini ? 1 : strength(m) >= 8 ? 0.5 : 0.2,
  };
}

/** Separate dated snapshots from semantic versions; aliases have no verified release order. */
function releaseName(m: ModelInfo) {
  const name = m.name.toLowerCase().replace(/:free$/, '');
  const dated = /[-@](\d{8}|\d{4}-\d{2}-\d{2}|\d{4})$/.exec(name);
  return { name: dated ? name.slice(0, dated.index) : name, date: dated ? Number(dated[1].replace(/-/g, '')) : 0 };
}

/** Family and provider stay distinct; sizes, version punctuation and snapshots do not. */
export function familyOf(m: ModelInfo) {
  const {name} = releaseName(m);
  const family = name.replace(/(?:a)?\d+(?:\.\d+)?b\b/g, '').replace(/\d+(?:[.-]\d+)*/g, '')
    .replace(/\b(?:latest|preview|exp|instruct|it|versatile)\b/g, '').replace(/[._-]+/g, '-').replace(/-+(?=\/|$)|(^|\/)-+/g, '$1');
  return `${m.provider}:${family}`;
}
/** Date-only IDs and semantic versions cannot be ordered against each other. */
export function versionFamilyOf(m: ModelInfo) {
  const {name} = releaseName(m);
  const semantic = /\d/.test(name.split('/').at(-1)!.replace(/(?:a)?\d+(?:\.\d+)?b\b/g, ''));
  return `${familyOf(m)}:${semantic ? 'version' : 'snapshot'}`;
}
export function versionOf(m: ModelInfo) {
  if (/\blatest\b/i.test(m.name)) return 0;
  const {name, date} = releaseName(m);
  const clean = name.split('/').at(-1)!.replace(/(?:a)?\d+(?:\.\d+)?b\b/g, '');
  const parts = /(\d+)(?:[.-](\d{1,3}))?(?:[.-](\d{1,3}))?/.exec(clean);
  return (parts ? Number(parts[1]) * 1e6 + Number(parts[2] || 0) * 1e3 + Number(parts[3] || 0) : 0) + date / 1e9;
}

