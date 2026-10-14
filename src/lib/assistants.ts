import type { SavedAssistant, SavedPrompt } from '../types';
import { AUTO } from './routing';

export const BUILTIN_ASSISTANTS: SavedAssistant[] = [
  { id: 'builtin-email', name: 'Email writer', description: 'Clear, polite emails from a few notes.', model: AUTO, instructions: 'Write clear, polite emails from the notes the user gives. Match the tone they ask for (formal, friendly or firm), keep it short, give a subject line, and never invent facts, names or dates. If something important is missing, ask one short question first.' },
  { id: 'builtin-excel', name: 'Excel formula helper', description: 'Formulas, cleaning steps and clear explanations.', model: AUTO, instructions: 'Help with Excel formulas and spreadsheet structure. Ask for column names, sample rows and Excel version when needed. Give a working formula, explain it briefly, and cover blanks and errors. Do not invent input data or claim to have calculated values you have not calculated.' },
  { id: 'builtin-study', name: 'Study partner', description: 'Explain concepts, quiz you and review answers.', model: AUTO, instructions: 'Explain concepts clearly at the requested level. Use examples, then offer short practice questions. When quizzing, wait for the learner to answer before revealing the solution. Identify uncertainty and avoid invented references.' },
  { id: 'builtin-code', name: 'Code reviewer', description: 'Find bugs and suggest focused improvements.', model: AUTO, instructions: 'Review supplied code for correctness, edge cases and maintainability. Prioritize concrete bugs with file and line references when provided. Explain impact and suggest small fixes. Distinguish observed defects from assumptions; do not claim tests were run unless they were.' },
];

export const BUILTIN_PROMPTS: SavedPrompt[] = [
  { id: 'builtin-summary', title: 'Summarize a document', text: 'Summarize the attached document. Give the main points, decisions, action items and unanswered questions. Use only the document and cite page numbers when available.' },
  { id: 'builtin-report', title: 'Draft a professional report', text: 'Turn the following notes into a professional report with an executive summary, findings and action items. Flag missing information rather than inventing it.\n\nNotes:\n' },
  { id: 'builtin-translate', title: 'Translate into Egyptian Arabic', text: 'Translate the following into clear Egyptian Arabic while preserving meaning, names, numbers and professional terminology.\n\nText:\n' },
  { id: 'builtin-clean', title: 'Plan a data cleanup', text: 'Review the attached spreadsheet. Identify missing values, duplicates, inconsistent types and suspicious values. Explain the cleaning steps and ask before removing or changing ambiguous data.' },
];

export function normalizeAssistant(value: SavedAssistant): SavedAssistant | null {
  if (!value || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.instructions !== 'string') return null;
  const result = { id: value.id.slice(0, 100), name: value.name.trim().slice(0, 60), description: typeof value.description === 'string' ? value.description.trim().slice(0, 160) : '', instructions: value.instructions.trim().slice(0, 8000), model: typeof value.model === 'string' ? value.model.slice(0, 160) : AUTO };
  return result.name && result.instructions ? result : null;
}

export function normalizePrompt(value: SavedPrompt): SavedPrompt | null {
  if (!value || typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.text !== 'string') return null;
  const result = { id: value.id.slice(0, 100), title: value.title.trim().slice(0, 60), text: value.text.trim().slice(0, 8000) };
  return result.title && result.text ? result : null;
}

export function libraryFits(assistants: SavedAssistant[], prompts: SavedPrompt[]) {
  return assistants.length <= 25 && prompts.length <= 50 && JSON.stringify({ assistants, prompts }).length <= 100000;
}
