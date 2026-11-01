import type { Attachment, Chat, Message } from '../types';
import { liveMessages } from './compact';
import { rerouteReason } from './reroute';

/**
 * Answer details: what Lumen saved about how a reply was made. Only recorded facts; anything not saved with the
 * reply is reported as not saved, never guessed (no invented reasons, costs, confidence or source use).
 */
export interface AnswerSelection {
  kind: 'auto' | 'layout' | 'combined' | 'fallback' | 'unrecorded';
  /** the layout's name (layout) */
  layout?: string;
  /** recorded reasons, as saved */
  reasons: string[];
  /** recorded alternatives (model ids), Auto only */
  next: string[];
  /** the recorded reason Lumen switched models while answering */
  switched?: string;
}

const COMBINED = /^Combined from \d+ answers$/;

export function answerSelection(message: Message): AnswerSelection {
  const switched = rerouteReason(message.notices);
  const base = { next: [] as string[], ...(switched ? { switched } : {}) };
  if (message.via && COMBINED.test(message.via)) return { ...base, kind: 'combined', reasons: [message.via] };
  if (message.via) return { ...base, kind: 'layout', layout: message.via, reasons: message.route ? [message.route] : [] };
  if (message.route) {
    const why = message.routeDetail?.why?.filter(Boolean);
    return { ...base, kind: 'auto', reasons: why?.length ? why : [message.route], next: message.routeDetail?.next?.filter(Boolean) || [] };
  }
  if (switched) return { ...base, kind: 'fallback', reasons: [] };
  return { ...base, kind: 'unrecorded', reasons: [] };
}

/** One short phrase for the footer and the details title line. */
export function selectionWords(selection: AnswerSelection): string {
  switch (selection.kind) {
    case 'auto': return 'Chosen by Auto';
    case 'layout': return `Via ${selection.layout}`;
    case 'combined': return 'Combined in Compare';
    case 'fallback': return 'Switched while answering';
    default: return 'No selection record';
  }
}

export type CompareSource =
  | { ok: true; question: Message; prompt: string; files: Attachment[] }
  | { ok: false; reason: string; question?: Message };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The question a reply answers, for "Compare with…": the message right before it, when that is something you typed.
 * Anything Lumen can't repeat as it was asked (an app-added file message in between, a summarized part of the chat,
 * a file that isn't on this device, a special mode) is refused with a plain reason instead of guessing.
 */
export function compareSource(chat: Chat | null | undefined, replyId: string): CompareSource {
  const messages = chat?.messages || [];
  const index = messages.findIndex((m) => m.id === replyId);
  const reply = messages[index];
  if (!chat || !reply || reply.role !== 'assistant') return { ok: false, reason: 'This reply is no longer in the conversation.' };
  const question = messages[index - 1];
  if (!question || question.role !== 'user' || question.auto) return { ok: false, reason: 'Lumen can’t tell which question this reply answers, so it can’t set up a comparison.' };
  if (!liveMessages(chat).some((m) => m.id === question.id)) return { ok: false, question, reason: 'This part of the conversation was condensed into a summary, so the question can’t be repeated with its original context.' };
  if (reply.coding || question.coding) return { ok: false, question, reason: 'Coding replies can’t be compared side by side.' };
  if (question.deepResearch || reply.research) return { ok: false, question, reason: 'Deep research can’t be compared side by side.' };
  if (question.imagePrompt) return { ok: false, question, reason: 'Image requests can’t be compared side by side.' };
  if (question.codeExecution) return { ok: false, question, reason: 'Data analysis can’t be compared side by side.' };
  const files = question.files || [];
  if (files.some((f) => f.videoUri)) return { ok: false, question, reason: 'Questions with a video can’t be compared side by side.' };
  const missing = files.filter((f) => !f.data && !f.text).map((f) => f.name);
  if (missing.length) return { ok: false, question, reason: `${missing.join(', ')} ${missing.length === 1 ? 'isn’t' : 'aren’t'} on this device, so the question can’t be repeated as it was asked.` };
  if (!question.text.trim() && !files.length) return { ok: false, question, reason: 'The question this reply answers is empty.' };
  return { ok: true, question, prompt: question.text, files };
}

export interface AnswerFacts {
  status?: string;
  privacy?: string;
  memory?: string;
  research?: string;
}

/** Status, privacy, memory and research lines, from what the reply and its question recorded. */
export function answerFacts(reply: Message, question?: Message): AnswerFacts {
  const facts: AnswerFacts = {};
  if (reply.status === 'stopped') facts.status = 'Stopped before it finished.';
  else if (reply.error) facts.status = 'Didn’t finish. The error is shown with the reply.';
  else if (reply.notices?.some((n) => /length limit/.test(n))) facts.status = 'Cut off at the model’s length limit.';
  const privacy = question?.role === 'user' ? question.privacy : undefined;
  if (privacy) facts.privacy = privacy.unmasked ? 'Your question was sent without masking.' : `${plural(privacy.masked, 'personal detail')} hidden from the model.`;
  const saved = reply.memory?.saved?.length || 0, forgotten = reply.memory?.forgotten?.length || 0;
  if (saved || forgotten) facts.memory = [saved && `${plural(saved, 'memory', 'memories')} saved`, forgotten && `${forgotten} removed`].filter(Boolean).join(', ') + '.';
  const searches = reply.research?.steps.filter((s) => s.status === 'done').length || 0;
  if (reply.research) facts.research = `Deep research: ${plural(searches, 'search', 'searches')} completed.`;
  return facts;
}

/** "Compare with…": the composer owns the Compare sheet, so a reply asks it to open one for its own question. */
export const COMPARE_FROM = 'lumen:compare-from';
export const requestCompareFrom = (chatId: string, messageId: string) =>
  window.dispatchEvent(new CustomEvent(COMPARE_FROM, { detail: { chatId, messageId } }));
