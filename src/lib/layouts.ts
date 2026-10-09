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
/** Changes the user made to recommended layouts: edited copies and removed ids. */
export interface LayoutOverrides {
  edits?: Record<string, Layout>;
  hidden?: string[];
}

/** Recommended layouts, filled with the best matching models from this account's catalog. */
export function recommendedLayouts(catalog: ModelInfo[], overrides: LayoutOverrides = {}): Layout[] {
  const hidden = overrides.hidden ?? [];
  return RECIPES.filter((r) => !hidden.includes(r.id)).map((r) => {
    const edited = overrides.edits?.[r.id];
    if (edited) return { ...edited, id: r.id, builtin: true };
    return { id: r.id, name: r.name, icon: r.icon, description: r.description, models: pickModels(catalog, r.wants, r.per), mode: r.mode, instructions: r.instructions, builtin: true };
  });
}

function pickModels(catalog: ModelInfo[], wants: RegExp[], per = 1): string[] {
  const models: string[] = [];
  for (const want of wants) {
    const hits = catalog.filter((m) => !m.preview && want.test(m.id) && !models.includes(m.id)).slice(0, per);
    models.push(...hits.map((m) => m.id));
    if (models.length >= 8) break;
  }
  return models;
}

/** Every layout: recommended first, then the user's own. */
export function allLayouts(catalog: ModelInfo[], custom: Layout[] = [], overrides: LayoutOverrides = {}): Layout[] {
  return [...recommendedLayouts(catalog, overrides), ...custom];
}

export function findLayout(id: string, catalog: ModelInfo[], custom: Layout[] = [], overrides: LayoutOverrides = {}): Layout | undefined {
  const key = isLayoutId(id) ? layoutKey(id) : id;
  return allLayouts(catalog, custom, overrides).find((l) => l.id === key);
}

/** Result of an edit/delete/restore: the new settings values to save. */
export interface LayoutState {
  custom: Layout[];
  overrides: LayoutOverrides;
}

const isRecommendedId = (id: string) => RECIPES.some((r) => r.id === id);

/** Save an edited layout. Recommended ones are stored as an edit; custom ones are replaced or added. */
export function saveLayout(layout: Layout, state: LayoutState): LayoutState {
  if (isRecommendedId(layout.id)) {
    return { ...state, overrides: { ...state.overrides, edits: { ...state.overrides.edits, [layout.id]: { ...layout, builtin: true } } } };
  }
  const exists = state.custom.some((l) => l.id === layout.id);
  const custom = exists ? state.custom.map((l) => (l.id === layout.id ? layout : l)) : [...state.custom, layout];
  return { ...state, custom };
}

/** Delete a layout. Recommended ones are hidden (and can be restored); custom ones are removed. */
export function deleteLayout(id: string, state: LayoutState): LayoutState {
  if (isRecommendedId(id)) {
    const edits = { ...state.overrides.edits };
    delete edits[id];
    return { ...state, overrides: { edits, hidden: [...new Set([...(state.overrides.hidden ?? []), id])] } };
  }
  return { ...state, custom: state.custom.filter((l) => l.id !== id) };
}

/** Bring back every recommended layout and undo edits to them. Custom layouts are untouched. */
export function restoreRecommended(state: LayoutState): LayoutState {
  return { ...state, overrides: {} };
}

/** Undo the edits to one recommended layout only. */
export function resetLayout(id: string, state: LayoutState): LayoutState {
  const edits = { ...state.overrides.edits };
  delete edits[id];
  return { ...state, overrides: { ...state.overrides, edits } };
}

export type Need = 'coding' | 'thinking' | 'fast' | 'documents' | 'arabic' | 'everyday';
export const NEEDS: { id: Need; label: string }[] = [
  { id: 'coding', label: 'Coding' },
  { id: 'thinking', label: 'Hard thinking & maths' },
  { id: 'documents', label: 'Documents & files' },
  { id: 'arabic', label: 'Arabic' },
  { id: 'fast', label: 'Speed' },
  { id: 'everyday', label: 'Everyday questions' },
];

/** Build a layout for the chosen needs from the models this account has. No AI call, no quota used. */
export function generateLayout(catalog: ModelInfo[], needs: Need[], name?: string): Layout | null {
  const recipes = needs.map((n) => RECIPES.find((r) => r.id === n)).filter((r): r is Recipe => Boolean(r));
  if (!recipes.length) return null;

  // Take each need's best pick first, then their second picks, and so on, so every need is covered.
  const depth = Math.max(...recipes.map((r) => r.wants.length));
  const models: string[] = [];
  for (let i = 0; i < depth && models.length < 8; i++) {
    for (const r of recipes) {
      if (!r.wants[i]) continue;
      const hits = catalog.filter((m) => !m.preview && r.wants[i].test(m.id) && !models.includes(m.id)).slice(0, r.per ?? 1);
      models.push(...hits.map((m) => m.id));
    }
  }
  if (!models.length) return null;

  const onlyLight = recipes.every((r) => r.id === 'everyday' || r.id === 'fast');
  const instructions = recipes.map((r) => r.instructions).filter(Boolean).join(' ') || undefined;
  const label = recipes.map((r) => r.name).join(' + ');
  return {
    id: newLayoutId(),
    name: name?.trim() || label,
    icon: recipes.length === 1 ? recipes[0].icon : 'layers',
    description: `Built for: ${label}.`,
    models: models.slice(0, 8),
    mode: onlyLight ? 'auto' : 'order',
    instructions,
  };
}
export const newLayoutId = () => `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
