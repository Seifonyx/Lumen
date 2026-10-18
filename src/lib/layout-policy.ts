import type { ModelInfo } from '../types';
import type { Layout } from './layouts';
import type { TaskProfile } from './layout-builder';
import { modelRequirementsProblem } from './ai/eligibility.js';
import { AUTO,planRoute,type RouteInput,type RoutePlan } from './routing';

export function layoutRequirements(task:TaskProfile):Layout['requirements'] {
  const capabilities=[...new Set([...(task.requires?[task.requires]:[]),...(task.requiresAll || [])])];
  if(!capabilities.length && !task.minContext && !task.minInputTokens && !task.noReasoning)return undefined;
  return {capabilities,...(task.minContext?{minContext:task.minContext}:{}),...(task.minInputTokens?{minInputTokens:task.minInputTokens}:{}),...(task.noReasoning?{noReasoning:true}:{})};
}
export function layoutModelProblem(layout:Layout,model?:ModelInfo):string|null {
  return modelRequirementsProblem(model,layout.requirements);
}
export function layoutPolicy(layout:Layout,automaticSwitching:boolean) {
  const fallback=layout.fallback===undefined?'enabled':layout.fallback;
  const switching=automaticSwitching && ['layout','enabled'].includes(fallback);
  return {switching,outside:switching && fallback==='enabled'};
}

/** Candidate-set and fixed-order layouts share Auto's hard checks and ranking. */
export function planLayout(layout:Layout,input:RouteInput,automaticSwitching:boolean):RoutePlan {
  const policy=layoutPolicy(layout,automaticSwitching);
  const known=new Map(input.catalog.map(m=>[m.id,m]));
  const denied=new Set(input.unavailable || []);
  const allowed=(id:string)=>!denied.has(id)&&!layoutModelProblem(layout,known.get(id));
  const inside=[...new Set(layout.models)].filter(allowed);
  const outside=policy.outside?input.enabled.filter(id=>!layout.models.includes(id)&&allowed(id)):[];
  const disabled=automaticSwitching?'Fallback is disabled for this layout. Edit its fallback setting or choose a compatible model.':'Automatic switching is off. Edit the layout or reconnect its provider in Settings.';
  const failure=(message:string):RoutePlan=>({model:'',fallbacks:[],reason:null,notice:null,error:`${layout.name}: ${message}`});
  if(layout.mode==='order'&&!policy.switching&&!allowed(layout.models[0]))return failure(`The first model no longer meets its saved requirements or is unavailable. ${disabled}`);
  if(!inside.length&&!outside.length)return failure(`No compatible assigned model is available. ${policy.switching?'Edit the model assignments or reconnect their providers.':disabled}`);
  const common={...input,preference:layout.priority || input.preference,allowFallback:policy.switching,preserveOrder:layout.mode==='order',disabledFallbackHint:disabled,
    unavailable:[...(input.unavailable || []),...layout.models.filter(id=>!allowed(id))]};
  const primary=planRoute({...common,selected:layout.mode==='auto'?AUTO:layout.models[0],enabled:inside});
  const backup=outside.length?planRoute({...common,selected:AUTO,enabled:outside}):null;
  const next=backup?.model?[backup.model,...backup.fallbacks]:[];
  if(!primary.model) {
    if(!backup?.model)return failure(primary.error || 'No eligible model can handle this request.');
    return {...backup,notice:`No model in “${layout.name}” fits its saved requirements and this request — using ${known.get(backup.model)?.label || backup.model}.`};
  }
  const fallbacks=policy.switching?[...new Set([...primary.fallbacks,...next])].filter(id=>id!==primary.model):[];
  return {...primary,fallbacks,...(primary.detail?{detail:{...primary.detail,next:fallbacks.slice(0,3)}}:{})};
}
