// In-memory storage with the conditional-write semantics the gate's control plane requires. Used by the
// tests and by the single-process Codespaces review server (nothing persists; restarting starts clean).

import { createHash, randomUUID } from 'node:crypto';

export class MemoryStorage {
  constructor() {
    this.objects = new Map();
    this.failGet = null; // (key) => boolean: simulate an unavailable read
    this.gets = [];
  }
  async get(key) {
    this.gets.push(key);
    if (this.failGet?.(key)) throw new Error('storage unavailable');
    const object = this.objects.get(key);
    return object ? { bytes: object.bytes.slice(), etag: object.etag } : null;
  }
  async put(key, bytes, { onlyIf } = {}) {
    const current = this.objects.get(key);
    if (onlyIf?.etagDoesNotMatch === '*' && current) return null;
    if (onlyIf?.etagMatches !== undefined && current?.etag !== onlyIf.etagMatches) return null;
    const etag = `"${createHash('sha256').update(bytes).update(randomUUID()).digest('hex').slice(0, 16)}"`;
    this.objects.set(key, { bytes: Uint8Array.from(bytes), etag });
    return { etag };
  }
  /** Out-of-band tampering, as a compromised or buggy writer would do. */
  overwrite(key, bytes) { this.objects.set(key, { bytes: Uint8Array.from(bytes), etag: `"tampered-${randomUUID()}"` }); }
  keys(prefix = '') { return [...this.objects.keys()].filter((k) => k.startsWith(prefix)); }
}
