// Routing settings as a file (Canvas Routing Center): Auto's preference, fallback switch, exclusions, enabled models,
// the default and your Layouts. Never keys, connections, chats or memory. Imports are rebuilt field by field from
// what is allowed, so a file can't carry anything else in, and models this account's catalog doesn't have are left out.
import type { Layout, LayoutIcon } from './layouts';
import type { Settings } from '../types';

export const ROUTING_FILE = 'lumen-routing';
export type RoutingFile = { format: typeof ROUTING_FILE; version: 1; exportedAt: string } & RoutingPart;
type RoutingPart = Pick<Settings, 'routingPreference' | 'autoSwitch' | 'autoExcluded' | 'enabledModels' | 'defaultModel' | 'layouts' | 'hiddenLayouts'>;

const ICONS: LayoutIcon[] = ['code', 'sun', 'brain', 'zap', 'file', 'languages', 'layers', 'flask', 'pen', 'graduation'];
const PRIORITY = ['balanced', 'quality', 'speed', 'cost'] as const;
const MODEL = /^[a-z0-9-]{2,24}:[\w.\/:@+-]{1,160}$/i;
const ID = /^[\w:-]{1,80}$/;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const pick = <T extends string>(v: unknown, from: readonly T[]) => (from.includes(v as T) ? (v as T) : undefined);
const models = (v: unknown, max = 60) => (Array.isArray(v) ? [...new Set(v.filter((m): m is string => typeof m === 'string' && MODEL.test(m)))].slice(0, max) : []);
const ids = (v: unknown, max = 60) => (Array.isArray(v) ? [...new Set(v.filter((m): m is string => typeof m === 'string' && ID.test(m)))].slice(0, max) : []);

export function exportRouting(s: Settings): RoutingFile {
  return {
    format: ROUTING_FILE, version: 1, exportedAt: new Date().toISOString(),
    routingPreference: s.routingPreference, autoSwitch: s.autoSwitch, autoExcluded: s.autoExcluded || [], enabledModels: s.enabledModels,
    defaultModel: s.defaultModel, layouts: (s.layouts || []).map(cleanLayout).filter((l): l is Layout => Boolean(l)), hiddenLayouts: s.hiddenLayouts || [],
  };
}

function cleanLayout(v: unknown): Layout | null {
  if (!v || typeof v !== 'object') return null;
  const l = v as Record<string, unknown>;
  const id = typeof l.id === 'string' && ID.test(l.id) ? l.id : null, name = text(l.name, 80).trim(), mode = pick(l.mode, ['auto', 'order'] as const);
  if (!id || !name || !mode) return null;
  const r = l.requirements && typeof l.requirements === 'object' ? l.requirements as Record<string, unknown> : null;
  const out: Layout = { id, name, icon: pick(l.icon, ICONS) || 'layers', description: text(l.description, 400), models: models(l.models, 30), mode };
  if (l.instructions) out.instructions = text(l.instructions, 4000);
  const priority = pick(l.priority, PRIORITY), fallback = pick(l.fallback, ['none', 'layout', 'enabled'] as const);
  if (priority) out.priority = priority;
  if (fallback) out.fallback = fallback;
  if (r) {
    const caps = Array.isArray(r.capabilities) ? r.capabilities.filter((c): c is 'vision' | 'pdf' | 'search' => ['vision', 'pdf', 'search'].includes(c as string)) : [];
    const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1e8 ? Math.round(n) : undefined);
    out.requirements = { ...(caps.length ? { capabilities: [...new Set(caps)] } : {}), ...(num(r.minContext) ? { minContext: num(r.minContext) } : {}), ...(num(r.minInputTokens) ? { minInputTokens: num(r.minInputTokens) } : {}), ...(r.noReasoning === true ? { noReasoning: true } : {}) };
  }
  if (l.builtin === true) out.builtin = true;
  if (l.edited === true) out.edited = true;
  return out;
}

/** Reads a routing file into the settings it may change, keeping only models this catalog has. Throws a readable error. */
export function readRouting(raw: string, current: Settings, catalogIds: Set<string>): { patch: Partial<Settings>; summary: string[] } {
  if (raw.length > 200_000) throw new Error('That file is too large to be a Lumen routing file.');
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw); } catch { throw new Error('That file isn’t valid JSON.'); }
  if (!data || data.format !== ROUTING_FILE || data.version !== 1) throw new Error('That isn’t a Lumen routing file.');
  const patch: Partial<Settings> = {}, summary: string[] = [];
  const preference = pick(data.routingPreference, PRIORITY);
  if (preference) { patch.routingPreference = preference; summary.push(`Auto prefers ${preference === 'balanced' ? 'a balance' : preference}`); }
  if (typeof data.autoSwitch === 'boolean') { patch.autoSwitch = data.autoSwitch; summary.push(`Switching models when one fails: ${data.autoSwitch ? 'on' : 'off'}`); }
  const enabled = models(data.enabledModels, 400).filter((m) => catalogIds.has(m)), skipped = models(data.enabledModels, 400).length - enabled.length;
  if (enabled.length) { patch.enabledModels = enabled; summary.push(`${enabled.length} enabled models${skipped ? ` (${skipped} not in your catalog left out)` : ''}`); }
  const excluded = models(data.autoExcluded, 400);
  if (Array.isArray(data.autoExcluded)) { patch.autoExcluded = excluded; summary.push(`${excluded.length} models kept out of Auto`); }
  const layouts = Array.isArray(data.layouts) ? data.layouts.slice(0, 40).map(cleanLayout).filter((l): l is Layout => Boolean(l)) : [];
  if (layouts.length) {
    const byId = new Map((current.layouts || []).map((l) => [l.id, l]));
    for (const l of layouts) byId.set(l.id, l);
    patch.layouts = [...byId.values()];
    summary.push(`${layouts.length} ${layouts.length === 1 ? 'Layout' : 'Layouts'} added or updated`);
  }
  if (Array.isArray(data.hiddenLayouts)) patch.hiddenLayouts = ids(data.hiddenLayouts);
  const def = typeof data.defaultModel === 'string' ? data.defaultModel : '';
  const layoutIds = new Set((patch.layouts || current.layouts || []).map((l) => l.id));
  if (def === 'auto' || (def.startsWith('layout:') && layoutIds.has(def.slice(7))) || catalogIds.has(def)) { patch.defaultModel = def; summary.push('Default for new chats'); }
  if (!summary.length) throw new Error('Nothing in that file applies to this account.');
  return { patch, summary };
}
