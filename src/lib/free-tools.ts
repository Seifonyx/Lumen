import type { Attachment } from '../types';
import { uid } from './util';

// Leave room for the source URL within the existing 100k-character attachment sync allowance.
export const READER_LIMIT = 95_000;

/** Strip tracking and reject private/network-local destinations before sending a URL to a reader. */
export function publicPageUrl(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a complete http or https link.'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
      !host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal') ||
      host.startsWith('[') || /^\d+(?:\.\d+){3}$/.test(host) || /^(?:localhost|.*\.localhost)$/.test(host)) {
    throw new Error('Use a public website link without a login, IP address or custom port.');
  }
  url.hash = '';
  if (url.href.length > 4096) throw new Error('This link is too long. Use a public page link without tracking parameters.');
  return url.href;
}

export function youtubeUrl(value: string): string {
  const url = new URL(publicPageUrl(value));
  const host = url.hostname.toLowerCase();
  let id = '';
  if (host === 'youtu.be') id = url.pathname.slice(1);
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
    else id = /^\/(?:shorts|live|embed)\/([^/]+)\/?$/.exec(url.pathname)?.[1] || '';
  }
  if (!/^[\w-]{11}$/.test(id)) throw new Error('Enter a link to one YouTube video.');
  return `https://www.youtube.com/watch?v=${id}`;
}

export function videoAttachment(value: string): Attachment {
  const videoUri = youtubeUrl(value);
  return { id: uid(), kind: 'text', name: 'YouTube video', mime: 'text/plain', size: videoUri.length, text: `Public YouTube video: ${videoUri}`, videoUri };
}

export async function readWebPage(value: string, signal: AbortSignal): Promise<{ url: string; text: string }> {
  const url = publicPageUrl(value);
  const response = await fetch(`https://r.jina.ai/${url}`, { signal, credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'text/plain' } });
  if (!response.ok) throw new Error(response.status === 429 ? 'The reader reached its free limit. Try again later.' : `The reader could not open this page (${response.status}).`);
  if (!response.body) throw new Error('The reader returned an empty page.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let text = '', bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      text += decoder.decode(chunk.value, { stream: true });
      if (bytes > READER_LIMIT * 4 || text.length > READER_LIMIT) throw new Error('This page is too large. Use a shorter page or upload the document.');
    }
    text += decoder.decode();
    if (text.length > READER_LIMIT) throw new Error('This page is too large. Use a shorter page or upload the document.');
  } finally { await reader.cancel().catch(() => {}); }
  if (!text.trim()) throw new Error('The reader returned an empty page.');
  return { url, text };
}

export function pageAttachment(page: { url: string; text: string }): Attachment {
  return { id: uid(), kind: 'text', name: `${new URL(page.url).hostname}.md`, mime: 'text/markdown', size: new TextEncoder().encode(page.text).length, text: `Source: ${page.url}\n\n${page.text}` };
}
