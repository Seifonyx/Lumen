import { issueToken, safeEqual } from './_lib/auth.js';
import { json, readJson } from './_lib/http.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!process.env.APP_PASSWORD) {
    return json({ error: 'APP_PASSWORD is not set in Vercel. Add it under Settings → Environment Variables and redeploy.' }, 500);
  }
  const body = await readJson(request);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!(await safeEqual(password, process.env.APP_PASSWORD))) {
    // Slow down password guessing.
    await new Promise((r) => setTimeout(r, 800));
    return json({ error: 'Wrong password.' }, 401);
  }
  return json({ token: await issueToken() });
}
