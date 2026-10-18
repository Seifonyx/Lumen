import { normalizeKeys } from './provider-config.js';

// High-entropy provider secrets are hashed only to bind metadata to an exact
// configuration. Neither credentials nor the hash input are persisted here.
export async function catalogScope(account, keys) {
  const {github:_,...providers}=normalizeKeys(keys);
  const bytes=new TextEncoder().encode(JSON.stringify([account,providers]));
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
const cacheKey = account => `mr.catalog.v2.${encodeURIComponent(account)}`;
export function readCatalogCache(storage,account,scope,now=Date.now()) {
  try {
    const entry=JSON.parse(storage.getItem(cacheKey(account)) || 'null');
    if(entry?.version!==2 || entry.scope!==scope || !Number.isFinite(entry.at) || now<entry.at || now-entry.at>24*3600_000) return null;
    const value=entry.value;
    if(!Array.isArray(value?.models)||!Array.isArray(value.defaults)||!Array.isArray(value.errors)||!value.providers) return null;
    return value;
  } catch {return null;}
}
export function writeCatalogCache(storage,account,scope,value,now=Date.now()) {
  try {storage.setItem(cacheKey(account),JSON.stringify({version:2,scope,at:now,value}));} catch { /* optional offline cache */ }
}
