// Model layouts: a named set of models for a kind of work ("Max coding", "Everyday"…). A layout is
// picked like a model; its models answer either Auto-style (the best one for each message) or in
// order (the first one, then the next if it fails), and it can add its own instructions.
// Recommended layouts are built from the models this account actually has; custom ones are saved
// in settings (and so synced across devices).

import type { ModelInfo } from '../types';

export interface Layout {
  id: string;
  name: string;
  icon: LayoutIcon;
  description: string;
  /** model ids, best first */
  models: string[];
  /** 'auto' = pick the best of these for each message; 'order' = first one, then the next */
  mode: 'auto' | 'order';
  /** extra instructions for every model in this layout */
  instructions?: string;
  builtin?: boolean;
}

export type LayoutIcon = 'code' | 'sun' | 'brain' | 'zap' | 'file' | 'languages' | 'layers' | 'flask' | 'pen' | 'graduation';
export const LAYOUT_ICONS: LayoutIcon[] = ['layers', 'code', 'sun', 'brain', 'zap', 'file', 'languages', 'flask', 'pen', 'graduation'];

export const LAYOUT_PREFIX = 'layout:';
export const isLayoutId = (id?: string | null): id is string => Boolean(id && id.startsWith(LAYOUT_PREFIX));
export const layoutKey = (id: string) => id.slice(LAYOUT_PREFIX.length);

const PRO = /gemini-(?:2\.5|[3-9][\d.]*)-pro|gemini-pro-latest/;

interface Recipe {
  id: string;
  name: string;
  icon: LayoutIcon;
  description: string;
  mode: 'auto' | 'order';
  /** tried in order; each adds up to `per` matching models */
  wants: RegExp[];
  per?: number;
  instructions?: string;
}

const RECIPES: Recipe[] = [
  {
    id: 'coding',
    name: 'Max coding',
    icon: 'code',
    description: 'The strongest coding models first: Qwen3 Coder, GPT-OSS 120B, Gemini Pro, Kimi, DeepSeek.',
    mode: 'order',
    wants: [/qwen-?3.*coder/, /gpt-oss-120b/, PRO, /kimi-k2/, /deepseek.*(chat|v3)/, /devstral|codestral/, /glm-4\.[5-9]/, /deepseek-r1/, /llama-3\.3-70b/, /gemini-flash-latest/],
    instructions:
      'You are an expert software engineer. Write correct, complete, production-quality code that follows the existing style. Prefer small, focused changes over rewrites. Briefly explain what you changed and why, point out edge cases, and say how to test it.',
  },
  {
    id: 'everyday',
    name: 'Everyday',
    icon: 'sun',
    description: 'Quick, capable all-rounders for daily questions, writing and planning.',
    mode: 'auto',
    wants: [/gemini-flash-latest/, /gemini-[\d.]+-flash$/, /llama-3\.3-70b/, /gpt-oss-120b/, /gemini-flash-lite-latest/, /llama-?3\.1-8b/],
  },
  {
    id: 'thinking',
    name: 'Deep thinking',
    icon: 'brain',
    description: 'Reasoning models for hard problems, maths, analysis and decisions.',
    mode: 'order',
    wants: [PRO, /deepseek-r1/, /qwen-?3-235b/, /gpt-oss-120b/, /qwq/, /gemini-flash-latest/],
    instructions: 'Think the problem through carefully before answering. Check facts, units and calculations, consider alternatives, and state your assumptions.',
  },
  {
    id: 'fast',
    name: 'Fastest',
    icon: 'zap',
    description: 'Near-instant replies from Cerebras and Groq, then Gemini Flash-Lite.',
    mode: 'order',
    wants: [/^cerebras:/, /^groq:.*(8b-instant|llama-3\.3-70b|gpt-oss)/, /gemini-flash-lite/, /gemini-flash-latest/],
    per: 2,
  },
  {
    id: 'documents',
    name: 'Documents & files',
    icon: 'file',
    description: 'The most reliable models for Word, Excel, PowerPoint and reading PDFs.',
    mode: 'order',
    wants: [/gemini-flash-latest/, PRO, /gemini-[\d.]+-flash$/],
  },
  {
    id: 'arabic',
    name: 'Arabic',
    icon: 'languages',
    description: 'Models that write natural Arabic, including Egyptian dialect.',
    mode: 'order',
    wants: [/gemini-flash-latest/, PRO, /gemma/, /qwen/],
    instructions: 'Reply in Arabic unless the user writes in another language. Use natural, clear Arabic; match Egyptian dialect if the user uses it.',
  },
];

/** Recommended layouts, filled with the best matching models from this account's catalog. */
export function recommendedLayouts(catalog: ModelInfo[], hidden: string[] = []): Layout[] {
  return RECIPES
    .filter((r) => !hidden.includes(r.id))
    .map((r) => {
      const models: string[] = [];
      for (const want of r.wants) {
        const hits = catalog.filter((m) => !m.preview && want.test(m.id) && !models.includes(m.id)).slice(0, r.per ?? 1);
        models.push(...hits.map((m) => m.id));
        if (models.length >= 8) break;
      }
      return { id: r.id, name: r.name, icon: r.icon, description: r.description, models, mode: r.mode, instructions: r.instructions, builtin: true };
    });
}

/** Every layout: recommended first, then the user's own. */
export function allLayouts(catalog: ModelInfo[], custom: Layout[] = [], hidden: string[] = []): Layout[] {
  return [...recommendedLayouts(catalog, hidden), ...custom];
}

export function findLayout(id: string, catalog: ModelInfo[], custom: Layout[] = [], hidden: string[] = []): Layout | undefined {
  const key = isLayoutId(id) ? layoutKey(id) : id;
  return allLayouts(catalog, custom, hidden).find((l) => l.id === key);
}

export const newLayoutId = () => `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
