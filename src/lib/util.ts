export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;

/** True when the first strong character is right-to-left (Arabic, Hebrew, Persian…). */
export function isRtl(text: string): boolean {
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) return true;
    if (LTR_CHAR.test(ch)) return false;
  }
  return false;
}

export const hasRtl = (text: string) => RTL_CHAR.test(text);

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function safeFileName(name: string, fallback = 'file'): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || fallback;
}

export const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches;

/** Saves a file: share sheet on phones (Save to Files / send), normal download elsewhere. */
export async function saveBlob(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  if (isTouch() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function dayGroup(ts: number, now = Date.now()): string {
  const day = 86400000;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const t = start.getTime();
  if (ts >= t) return 'Today';
  if (ts >= t - day) return 'Yesterday';
  if (ts >= t - 7 * day) return 'Previous 7 days';
  if (ts >= t - 30 * day) return 'Previous 30 days';
  return new Date(ts).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export const modelShortName = (id?: string) => (id ? id.split(':').slice(1).join(':') : '');

/** Apple keyboards show ⌘, others Ctrl. */
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl ';

/** Display names for model providers, in the order they're shown. */
export const PROVIDER_NAMES = { google: 'Google', openrouter: 'OpenRouter', groq: 'Groq', cerebras: 'Cerebras', mistral: 'Mistral', cohere: 'Cohere', nvidia: 'NVIDIA NIM', huggingface: 'Hugging Face', deepseek: 'DeepSeek', alibaba: 'Alibaba Cloud', cloudflare: 'Cloudflare Workers AI', aion: 'Aion Labs', openai: 'OpenAI', anthropic: 'Anthropic', xai: 'xAI', perplexity: 'Perplexity', together: 'Together AI', fireworks: 'Fireworks AI', deepinfra: 'DeepInfra', sambanova: 'SambaNova', novita: 'Novita AI', hyperbolic: 'Hyperbolic', nebius: 'Nebius AI Studio', scaleway: 'Scaleway', ovh: 'OVHcloud', siliconflow: 'SiliconFlow', chutes: 'Chutes', featherless: 'Featherless', zai: 'Z.ai', moonshot: 'Moonshot AI', venice: 'Venice AI', baseten: 'Baseten' } as const;
export type ProviderId = keyof typeof PROVIDER_NAMES;
/** Provider of a model id like "groq:llama-3.3-70b-versatile". */
export const providerOfId = (id: string): ProviderId => {
  const p = id.split(':')[0];
  return p === 'gemini' ? 'google' : Object.hasOwn(PROVIDER_NAMES, p) ? p as ProviderId : 'openrouter';
};
