// Model layouts: a named set of models for a kind of work ("Max coding", "Everyday"…). A layout is
// picked like a model; its models answer either Auto-style (the best one for each message) or in
// order (the first one, then the next if it fails), and it can add its own instructions.
// Recommended layouts are built from the models this account actually has; custom ones are saved
// in settings (and so synced across devices).

import type { ModelInfo } from '../types';
import { rankForTask, TASKS, type Context } from './layout-builder';
import { layoutRequirements } from './layout-policy';

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
  /** Omitted fields preserve saved layouts from earlier versions. */
  priority?: 'balanced' | 'quality' | 'speed' | 'cost';
  fallback?: 'none' | 'layout' | 'enabled';
  requirements?: {
    capabilities?: ('vision' | 'pdf' | 'search')[];
    minContext?: number;
    minInputTokens?: number;
    noReasoning?: boolean;
  };
  builtin?: boolean;
  /** a recommended layout the user changed */
  edited?: boolean;
}

export type LayoutIcon = 'code' | 'sun' | 'brain' | 'zap' | 'file' | 'languages' | 'layers' | 'flask' | 'pen' | 'graduation';
export const LAYOUT_ICONS: LayoutIcon[] = ['layers', 'code', 'sun', 'brain', 'zap', 'file', 'languages', 'flask', 'pen', 'graduation'];

export const LAYOUT_PREFIX = 'layout:';
export const isLayoutId = (id?: string | null): id is string => Boolean(id && id.startsWith(LAYOUT_PREFIX));
export const layoutKey = (id: string) => id.slice(LAYOUT_PREFIX.length);

// Recommended layouts: the task profiles in layout-builder, filled with the best models this account has.
const RECOMMENDED = ['coding', 'everyday', 'thinking', 'fast', 'documents', 'writing', 'languages'];
/** Older ids that were renamed. */
const RENAMED: Record<string, string> = { arabic: 'languages' };

/** Recommended layouts, filled with the best matching models from this account's catalog. */
export function recommendedLayouts(catalog: ModelInfo[], ctx: Context = {}): Layout[] {
  return RECOMMENDED.map((id) => TASKS.find((t) => t.id === id)!).map((t) => ({
    id: t.id, name: t.name, icon: t.icon, description: t.description, mode: t.mode, instructions: t.instructions, builtin: true,
    requirements:layoutRequirements(t),priority:t.id==='fast'?'speed':t.priority,
    models: rankForTask(t, catalog, ctx, t.id === 'fast' ? 5 : 6).map((p) => p.id),
  }));
}

export const RECOMMENDED_IDS = RECOMMENDED;
export const isRecommendedId = (id: string) => RECOMMENDED_IDS.includes(id);

/**
 * Every layout: recommended first, then the user's own. A saved layout with a recommended id is an
 * edited recommended layout and takes its place; `hidden` lists recommended layouts the user removed.
 */
export function allLayouts(catalog: ModelInfo[], custom: Layout[] = [], hidden: string[] = []): Layout[] {
  const edited = new Map(custom.filter((l) => isRecommendedId(l.id)).map((l) => [l.id, l]));
  const recommended = recommendedLayouts(catalog)
    .filter((l) => !hidden.includes(l.id))
    .map((l) => (edited.has(l.id) ? { ...edited.get(l.id)!, builtin: true, edited: true } : l));
  return [...recommended, ...custom.filter((l) => !isRecommendedId(l.id))];
}

export function findLayout(id: string, catalog: ModelInfo[], custom: Layout[] = [], hidden: string[] = []): Layout | undefined {
  const raw = isLayoutId(id) ? layoutKey(id) : id;
  const key = RENAMED[raw] && !custom.some((l) => l.id === raw) ? RENAMED[raw] : raw;
  return allLayouts(catalog, custom, hidden).find((l) => l.id === key);
}

export const newLayoutId = () => `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
