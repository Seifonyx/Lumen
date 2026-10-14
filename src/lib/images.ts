// Image generation with free tiers: Cloudflare Workers AI (FLUX.1 [schnell], through the app's relay) or
// Hugging Face Inference Providers (FLUX.1 [schnell]). Both are opt-in providers in Settings → API keys.
import { DEFAULT_PROVIDER_RELAY_URL, providerEnabled, validRelayUrl } from './ai/provider-config.js';
import type { ApiKeys } from './firebase';

export type ImageProvider = 'cloudflare' | 'huggingface';
export type GeneratedImage = { data: string; mime: string; thumb: string; provider: ImageProvider; model: string };

export const IMAGE_MODEL_LABEL: Record<ImageProvider, string> = { cloudflare: 'FLUX.1 schnell · Cloudflare', huggingface: 'FLUX.1 schnell · Hugging Face' };

/** Which connected provider will make images (Cloudflare first: its free daily allowance is larger). */
export function imageProvider(keys: ApiKeys): ImageProvider | null {
  const k = keys as unknown as Record<string, unknown>;
  if (providerEnabled('cloudflare', k) && /^[a-f0-9]{32}$/i.test(keys.cloudflareAccountId || '')) return 'cloudflare';
  if (providerEnabled('huggingface', k)) return 'huggingface';
  return null;
}

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Re-encodes as JPEG (max side `size`) so images stay small enough to sync. */
async function shrink(blob: Blob, size: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t read the image.'))), 'image/jpeg', quality));
}

async function failure(res: Response, label: string): Promise<Error> {
  let detail = '';
  try { const j = await res.json(); detail = j?.errors?.[0]?.message || j?.error?.message || j?.error || ''; } catch { /* not JSON */ }
  if (res.status === 401 || res.status === 403) return new Error(`${label} rejected the key. Check it in Settings → API keys.`);
  if (res.status === 429) return new Error(`${label}’s free image allowance is used up for now. Try again later.`);
  if (res.status === 404 && label === 'Cloudflare') return new Error('The relay doesn’t support images yet. Redeploy it (Actions → Deploy provider relay) or use Hugging Face.');
  return new Error(`${label} couldn’t make the image${detail ? `: ${String(detail).slice(0, 160)}` : ` (${res.status})`}.`);
}

export async function generateImage(prompt: string, keys: ApiKeys, signal?: AbortSignal): Promise<GeneratedImage> {
  const provider = imageProvider(keys);
  if (!provider) throw new Error('To create images, connect Cloudflare Workers AI or Hugging Face in Settings → API keys (both have free allowances).');
  let raw: Blob;
  if (provider === 'cloudflare') {
    const relay = keys.providerRelayUrl || DEFAULT_PROVIDER_RELAY_URL;
    if (!validRelayUrl(relay)) throw new Error('Cloudflare: use a valid HTTPS relay in API keys settings.');
    const res = await fetch(`${relay}/cloudflare/image`, { method: 'POST', signal, headers: { authorization: `Bearer ${keys.cloudflare}`, 'content-type': 'application/json', 'x-mr-account-id': keys.cloudflareAccountId || '' }, body: JSON.stringify({ prompt, steps: 4 }) });
    if (!res.ok) throw await failure(res, 'Cloudflare');
    const json = await res.json();
    const image = json?.result?.image || json?.image;
    if (typeof image !== 'string') throw new Error('Cloudflare returned no image.');
    raw = new Blob([Uint8Array.from(atob(image), (c) => c.charCodeAt(0))], { type: 'image/jpeg' });
  } else {
    const res = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', { method: 'POST', signal, headers: { authorization: `Bearer ${keys.huggingface}`, 'content-type': 'application/json', accept: 'image/jpeg' }, body: JSON.stringify({ inputs: prompt }) });
    if (!res.ok) throw await failure(res, 'Hugging Face');
    raw = await res.blob();
    if (!raw.type.startsWith('image/')) throw new Error('Hugging Face returned no image.');
  }
  const [full, small] = await Promise.all([shrink(raw, 1024, 0.86), shrink(raw, 320, 0.7)]);
  return { data: await toBase64(full), mime: 'image/jpeg', thumb: `data:image/jpeg;base64,${await toBase64(small)}`, provider, model: IMAGE_MODEL_LABEL[provider] };
}
