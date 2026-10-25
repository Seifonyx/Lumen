// Read-only wording for existing routing choices, Layout policy and saved answer evidence. Never predicts a route.
import type { Message, Settings, Catalog, ModelInfo } from '../types';
import { findLayout, isLayoutId, type Layout } from './layouts';
import { layoutPolicy, layoutModelProblem } from './layout-policy';
import { modelProblem } from './ai/eligibility.js';
import { choosePreference } from './ai/preferences.js';
import { isReroute } from './reroute';

const priorities = { balanced: 'Balanced', quality: 'Quality', speed: 'Speed', cost: 'Cost' };
const priorityName = (value?: Settings['routingPreference']) => priorities[choosePreference(value) as keyof typeof priorities];
export function fallbackPresentation(layout: Layout | undefined, switching: boolean) {
  if (!switching) return { title: 'Automatic switching is off', description: 'A different model is not permitted automatically. Any saved Layout fallback rule is retained.' };
  if (!layout) return { title: 'Enabled models permitted', description: 'Existing recovery may try another eligible enabled model if needed. Permissions and request requirements still apply.' };
  const policy = layoutPolicy(layout, switching);
  if (!policy.switching) return { title: 'No automatic fallback', description: 'This Layout does not permit an automatic replacement. Unavailable or incompatible assignments may stop the request.' };
  return policy.outside
    ? { title: 'Layout, then enabled models', description: 'Eligible assigned models are considered first. Other enabled models are permitted if needed and must meet the same saved requirements.' }
    : { title: 'Only this Layout', description: 'Recovery is limited to eligible assigned models. Models outside this Layout are not permitted.' };
}
export function layoutPreview(layout: Layout, settings: Settings) {
  const r = layout.requirements;
  const requirements = [
    ...(r?.capabilities || []).map(cap => ({ vision: 'Images', pdf: 'Native PDF input', search: 'Web search' }[cap])),
    r?.minContext && `at least ${r.minContext.toLocaleString()} context tokens`,
    r?.minInputTokens && `room for ${r.minInputTokens.toLocaleString()} input tokens and a reply`,
    r?.noReasoning && 'excludes models that require lengthy reasoning',
  ].filter(Boolean).join(' · ');
  const priority = priorityName(layout.priority || settings.routingPreference);
  return {
    mode: layout.mode === 'order' ? 'Tries models in your saved order, subject to availability, requirements and recovery rules.' : 'Chooses within the assigned set for each request. Task fit may override the displayed order.',
    priority,
    priorityExplanation: layout.mode === 'auto'
      ? `${priority} guides initial model selection within this Layout. Automatic-switching permission is described separately.`
      : `${priority} is saved but inactive in In order mode. Initial selection and any permitted fallback follow the saved model order.`,
    requirements: requirements || 'No extra Layout requirements.',
    fallback: fallbackPresentation(layout, settings.autoSwitch),
  };
}
/** A completed answer is evidence; failed/stopped/streaming/legacy-unknown entries are not completed answers. */
export function completedRoutingRecord(messages: Message[]) {
  const answer = messages.findLast(m => m.role === 'assistant' && m.status === 'done' && !m.error && m.model);
  if (!answer?.model) return null;
  const recovery = (answer.notices || []).filter(n => isReroute(n) || /^.+ reached its limit \(available again .+\) — using .+\.$/.test(n) || / — using .+ for this message\.$/.test(n) || /^No model in “.+” fits its saved requirements and this request — using .+\.$/.test(n));
  return { model: answer.model, at: answer.createdAt, via: answer.via,
    reasons: answer.routeDetail?.why?.length ? answer.routeDetail.why : answer.route ? [answer.route] : [],
    alternatives: answer.routeDetail?.next || [], recovery };
}
export function currentRoutingPresentation(selection: string, settings: Settings, catalog: Catalog | null) {
  const layout = isLayoutId(selection) ? findLayout(selection, catalog?.models || [], settings.layouts, settings.hiddenLayouts) : undefined;
  const kind = selection === 'auto' ? 'Auto' : isLayoutId(selection) ? layout ? 'Layout' : 'Missing Layout' : 'Manual';
  return { kind,
    description: layout ? layoutPreview(layout, settings).mode : kind === 'Auto' ? 'Chooses for each request from your enabled models. The request, availability and saved preferences influence selection.' : kind === 'Missing Layout' ? 'This saved Layout could not be found. Choose another mode or review your Layouts.' : 'This chat prefers the selected model. Existing fallback and request requirements still apply.',
    priority: priorityName(layout?.priority || settings.routingPreference), fallback: fallbackPresentation(layout, settings.autoSwitch) };
}

/** Advisory only: keep the editor’s Add/save gates unchanged; request-time incompatibilities can still be explained. */
export function layoutAssignmentProblem(layout: Layout, model?: ModelInfo): string | null {
  return layoutModelProblem(layout, model) || modelProblem(model);
}
