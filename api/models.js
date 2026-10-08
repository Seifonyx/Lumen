import { requireAuth } from './_lib/auth.js';
import { json } from './_lib/http.js';
import { catalog } from './_lib/providers.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  const denied = await requireAuth(request);
  if (denied) return denied;
  const data = await catalog();
  if (!data.providers.google && !data.providers.openrouter) {
    return json({ error: 'No API keys found. Add GEMINI_API_KEY and/or OPENROUTER_API_KEY in Vercel and redeploy.' }, 500);
  }
  return json(data);
}
