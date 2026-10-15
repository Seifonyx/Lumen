// Writing tools: quick changes to a piece of text you selected (in a reply, or in Select text).

export interface WritingAction { id: string; label: string; ask: string }

export const WRITING_ACTIONS: WritingAction[] = [
  { id: 'improve', label: 'Improve', ask: 'Rewrite it so it reads clearly and naturally. Fix grammar and awkward phrasing; keep the meaning, tone and length.' },
  { id: 'shorter', label: 'Shorter', ask: 'Make it noticeably shorter (about half the length) while keeping every important point.' },
  { id: 'simpler', label: 'Simpler', ask: 'Rewrite it in plain, simple words that anyone can follow. Short sentences, no jargon.' },
  { id: 'formal', label: 'More formal', ask: 'Rewrite it in a polished, professional tone.' },
  { id: 'friendly', label: 'Friendlier', ask: 'Rewrite it in a warm, friendly, conversational tone.' },
  { id: 'bullets', label: 'As bullet points', ask: 'Turn it into a clear list of short bullet points (Markdown "- ").' },
];

/** Languages offered by Translate: the device's own first, then common ones. */
export function translateTargets(): string[] {
  const names = new Intl.DisplayNames(['en'], { type: 'language' });
  const own = (navigator.languages || [navigator.language]).map((l) => { try { return names.of(l.split('-')[0]) || ''; } catch { return ''; } });
  return [...new Set([...own, 'English', 'Arabic', 'French', 'Spanish', 'German', 'Turkish', 'Chinese', 'Hindi', 'Portuguese', 'Japanese'].filter(Boolean))].slice(0, 10);
}

export function writingPrompt(text: string, ask: string) {
  return `${ask}

Reply with the rewritten text only: no introduction, no quotes around it, no explanation. Keep any Markdown formatting that's there. Unless asked to translate, write in the same language as the text.

Text:
${text}`;
}

/** Cleans a model's reply: drops wrapping quotes or a "Here is…" line. */
export function cleanRewrite(out: string) {
  return out.trim().replace(/^(?:here(?:'s| is)[^\n]*:\s*\n+)/i, '').replace(/^"([\s\S]*)"$/, '$1').replace(/^```(?:\w+)?\n([\s\S]*)\n```$/, '$1').trim();
}
