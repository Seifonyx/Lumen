import type { Catalog, Chat, Settings } from '../types';
import { parseModelId } from './ai/providers.js';
import { findLayout,isLayoutId } from './layouts';

/** The displayed selection and the execution selection must have the same owner. */
export function selectedModel(chat:Chat|null,settings:Settings,catalog:Catalog|null,activeProjectId?:string|null):string {
  const enabled=settings.enabledModels;
  const project=settings.projects?.find(p=>p.id===(chat?chat.projectId:activeProjectId));
  const layoutOk=(id:string)=>isLayoutId(id)&&Boolean(findLayout(id,catalog?.models || [],settings.layouts,settings.hiddenLayouts));
  const choice=[chat?.model,project?.defaultModel,settings.defaultModel,...enabled].find(id=>id &&
    (id==='auto'||enabled.includes(id)||settings.unavailableModels?.includes(id)||(id===settings.defaultModel&&parseModelId(id))||layoutOk(id)));
  return choice || enabled[0] || catalog?.defaults[0] || '';
}
