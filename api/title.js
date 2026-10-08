import { requireAuth } from './_lib/auth.js';
import { json, readJson } from './_lib/http.js';
import { complete, hasGemini, hasOpenRouter, parseModelId } from './_lib/providers.js';

export const config = { runtime: 'edge' };

// Writes a short chat title from the first message, using a light model so it barely touches limits.
export default async function handler(request) {
  const denied = await requireAuth(request);
  if (denied) return denied;
  const body = await readJson(request);
  const text = String(body?.text || '').slice(0, 2000);
  if (!text.trim()) return json({ title: null });

  const candidates = [];
  if (hasGemini()) candidates.push('gemini:gemini-flash-lite-latest', 'gemini:gemini-2.5-flash-lite');
  const preferred = parseModelId(body?.model);
  if (preferred && (preferred.provider === 'gemini' ? hasGemini() : hasOpenRouter())) candidates.push(body.model);

  const prompt = `Write a short title (2 to 6 words) for a chat that starts with the message below. Use the same language as the message. Reply with the title only, no quotes or punctuation at the end.\n\nMessage:\n${text}`;
  for (const id of candidates) {
    try {
      const out = await complete(parseModelId(id), prompt);
      const title = (out || '').split('\n').find((l) => l.trim())?.replace(/^["'#*\s]+|["'*.\s]+$/g, '').slice(0, 80);
      if (title) return json({ title });
    } catch {
      // Try the next model.
    }
  }
  return json({ title: null });
}
