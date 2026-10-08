import { checkAuth, json, listModels } from './_shared.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  const denied = checkAuth(request);
  if (denied) return denied;
  const models = listModels();
  if (models.length === 0) {
    return json({ error: 'No API keys found. Add GEMINI_API_KEY and/or OPENROUTER_API_KEY in Vercel and redeploy.' }, 500);
  }
  return json({ models });
}
