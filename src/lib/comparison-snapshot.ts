import type { Chat, Memory, Settings } from '../types';
import { isTemporaryChat } from './temporary-chat';

export interface ComparisonSnapshotInput {
  settings: Settings;
  chat: Chat | null;
  projectId?: string | null;
  memories: readonly Memory[];
}

/** Ephemeral equality key for request meaning. Never log or persist it; it may contain private context. */
export function comparisonSnapshotKey({ settings, chat, projectId, memories }: ComparisonSnapshotInput): string {
  const scope = chat ? chat.projectId : projectId;
  const project = settings.projects?.find(item => item.id === scope);
  const files = (items: NonNullable<Chat['messages'][number]['files']> = []) => items.map(({ kind, name, mime, text, data, videoUri }) => ({ kind, name, mime, text, data, videoUri }));
  const view = {
    privacy: [settings.privacyShield, settings.privacyMode, settings.privacyRestore],
    instructions: [settings.customInstructions, settings.replyLanguage || '', settings.answerLength || 'auto'],
    routing: [settings.enabledModels, settings.autoExcluded || [], settings.autoSwitch, settings.routingPreference || 'balanced', settings.autoPreferProvider || '', settings.webSearch, settings.modelDeclarations || [],settings.defaultModel,settings.layouts || [],settings.hiddenLayouts || []],
    memory: [settings.memory, settings.memoryAuto, settings.memory && !isTemporaryChat(chat) ? settings.aboutMe || '' : '',
      settings.memory && !isTemporaryChat(chat) ? memories.filter(item => !item.projectId || item.projectId === scope).map(({ id, text, projectId }) => ({ id, text, projectId })) : []],
    project: [scope || null, project ? { id: project.id, name: project.name, instructions: project.instructions,defaultModel:project.defaultModel, files: files(project.files?.filter(file => Boolean(file.text))) } : null],
    chat: chat ? {
      id: chat.id,model:chat.model, projectId: chat.projectId, repo: chat.repo, context: chat.context || [],
      assistant: chat.assistant ? { id: chat.assistant.id, model: chat.assistant.model, instructions: chat.assistant.instructions } : null,
      summary: chat.summary,
      messages: chat.messages.map(({ id, role, text, files: attachments, privacy, error, status }) => ({ id, role, text, files: files(attachments), privacy, error, status })),
    } : null,
  };
  return JSON.stringify(view, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
}

/** Titles use the first user input only; later tool reads/turns do not change that input. */
export function titleSnapshotKey(input: ComparisonSnapshotInput): string {
  const chat=input.chat;
  return JSON.stringify([input.settings.autoTitle,comparisonSnapshotKey({...input,chat:chat?{...chat,repo:undefined,context:[],summary:undefined,
    messages:chat.messages.filter(message=>message.role==='user').slice(0,1)}:null})]);
}
