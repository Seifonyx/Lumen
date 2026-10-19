import { EXTRA_PROVIDERS, normalizeKeys } from './ai/provider-config.js';
import type { ApiKeys } from './firebase';

/** The existing account-document shape. Revision markers never leave this device. */
export type AccountKeyFields = {
  geminiKey: string;
  openrouterKey: string;
  groqKey: string;
  cerebrasKey: string;
  githubKey: string;
  providerConnections: Partial<ApiKeys>;
};
export type AccountKeyCache = Partial<AccountKeyFields> & {
  keyRevision?: string | null;
  pendingKeyRevision?: string | null;
  settings?: Record<string,unknown>;
  [field: string]: unknown;
};
export type AccountKeyRead = Readonly<{uid:string;revision:string | null;pending:string | null;session:number}>;
type Dependencies = {
  readLocal(uid: string): AccountKeyCache | null;
  /** Merge this patch into the existing account cache; false means no durable save. */
  writeLocal(uid: string,patch: AccountKeyCache): boolean;
  /** Invoke the SDK write now. Its promise resolves only on server acknowledgement. */
  enqueueRemote(uid: string,fields: Readonly<AccountKeyFields>): Promise<void>;
  onRemoteDenied?(uid: string): void;
  currentSession?(): number;
  currentUid(): string | null;
  isPreview(uid: string): boolean;
  revision?(): string;
};
const marker = (value: unknown): string | null => typeof value === 'string' && value ? value : null;
const cleanKeys = (keys: Partial<ApiKeys>): ApiKeys => normalizeKeys(keys) as unknown as ApiKeys;
const cachedKeys = (value: AccountKeyCache): ApiKeys => cleanKeys({...value.providerConnections,
  gemini:value.geminiKey || '',openrouter:value.openrouterKey || '',groq:value.groqKey || '',
  cerebras:value.cerebrasKey || '',github:value.githubKey || ''});
function keyFields(keys: ApiKeys): AccountKeyFields {
  const clean=cleanKeys(keys);
  return {geminiKey:clean.gemini,openrouterKey:clean.openrouter,groqKey:clean.groq,cerebrasKey:clean.cerebras,githubKey:clean.github,
    providerConnections:{...Object.fromEntries(Object.keys(EXTRA_PROVIDERS).map(id => [id,clean[id as keyof typeof EXTRA_PROVIDERS]])),
      providerAccess:{...clean.providerAccess},cloudflareAccountId:clean.cloudflareAccountId,
      alibabaBaseUrl:clean.alibabaBaseUrl,providerRelayUrl:clean.providerRelayUrl}};
}
function immutableFields(keys: ApiKeys): Readonly<AccountKeyFields> {
  const fields=keyFields(keys);
  Object.freeze(fields.providerConnections.providerAccess);
  Object.freeze(fields.providerConnections);
  return Object.freeze(fields);
}

/**
 * Local durability is the save boundary. SDK writes are invoked in save order,
 * independently of acknowledgements: a stalled old write cannot block a new key.
 * The SDK owns transport ordering/retry; this coordinator only replays persisted
 * pending keys when explicitly resumed for the current authenticated account.
 */
export function createAccountKeyPersistence(dependencies: Dependencies) {
  const {readLocal,writeLocal,enqueueRemote,currentUid,isPreview}=dependencies;
  const nextRevision=dependencies.revision || (() => globalThis.crypto.randomUUID());
  const currentSession=dependencies.currentSession || (()=>0);
  const inFlight=new Map<string,Set<string>>();
  const assertCurrent = (uid: string) => {
    if (!uid || currentUid() !== uid) throw new Error('The account changed. Open API keys again before saving.');
  };
  const persist = (uid: string,patch: AccountKeyCache) => {
    try { if (writeLocal(uid,patch)) return; } catch { /* expose durability failure without credentials */ }
    throw new Error('Could not save API keys on this device. Check local storage and try again.');
  };
  function enqueue(uid: string,revision: string,keys: ApiKeys): boolean {
    if (currentUid() !== uid || isPreview(uid) || inFlight.get(uid)?.has(revision)) return false;
    const session=currentSession();
    const active=inFlight.get(uid) || new Set<string>();
    active.add(revision);inFlight.set(uid,active);
    const finish = () => {active.delete(revision);if (!active.size && inFlight.get(uid) === active) inFlight.delete(uid);};
    const rejected = (error: unknown) => {
      const local=readLocal(uid);
      if ((error as {code?:string})?.code === 'permission-denied' && currentUid() === uid && currentSession() === session
        && local?.keyRevision === revision && local.pendingKeyRevision === revision) dependencies.onRemoteDenied?.(uid);
    };
    // No promise chain in front of this call: SDK invocation order is save order.
    let acknowledgement: Promise<void>;
    try { acknowledgement=enqueueRemote(uid,immutableFields(keys)); }
    catch (error) { rejected(error);finish();return true; }
    void Promise.resolve(acknowledgement).then(() => {
      if (currentUid() !== uid) return;
      const local=readLocal(uid);
      // Never recreate a cache cleared on logout, nor acknowledge a newer save.
      if (!local || local.keyRevision !== revision || local.pendingKeyRevision !== revision) return;
      persist(uid,{pendingKeyRevision:null});
    }).catch(rejected).finally(finish);
    return true;
  }
  return {
    /** Returns immediately after local durability + SDK enqueue, never remote ACK. */
    save(uid: string,keys: ApiKeys): ApiKeys {
      assertCurrent(uid);
      const clean=cleanKeys(keys), revision=nextRevision();
      persist(uid,{...keyFields(clean),keyRevision:revision,pendingKeyRevision:isPreview(uid) ? null : revision});
      enqueue(uid,revision,clean);
      return cleanKeys(clean);
    },
    captureRead(uid: string): AccountKeyRead {
      const local=readLocal(uid);
      return Object.freeze({uid,session:currentSession(),revision:marker(local?.keyRevision),pending:marker(local?.pendingKeyRevision)});
    },
    /** Caller handles authorization failures before accepting remote/fallback data. */
    reconcileRead(uid: string,start: AccountKeyRead,remote: AccountKeyCache): AccountKeyCache {
      assertCurrent(uid);
      if (start.uid !== uid || start.session !== currentSession()) throw new Error('The account changed during this read.');
      const local=readLocal(uid);
      if (!local && (start.revision || start.pending)) throw new Error('The account cache was cleared during this read.');
      const revision=marker(local?.keyRevision),pending=marker(local?.pendingKeyRevision);
      const protect=Boolean(local && (start.pending || pending || start.revision !== revision));
      const fields=keyFields(cachedKeys(protect ? local! : remote));
      const changed=!local || JSON.stringify(fields) !== JSON.stringify(keyFields(cachedKeys(local)));
      const result: AccountKeyCache={...remote,...fields,
        keyRevision:!revision || (!protect && changed) ? nextRevision() : revision,
        pendingKeyRevision:protect ? pending : null};
      persist(uid,result);
      return result;
    },
    /** Auth/online callers may resume; concurrent triggers never replay one revision twice. */
    resume(uid: string): boolean {
      if (currentUid() !== uid || isPreview(uid)) return false;
      const local=readLocal(uid),pending=marker(local?.pendingKeyRevision);
      if (!local || !pending || local.keyRevision !== pending) return false;
      return enqueue(uid,pending,cachedKeys(local));
    },
  };
}
