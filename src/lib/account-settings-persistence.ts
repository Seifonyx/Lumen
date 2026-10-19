/** Complete JSON settings snapshots; edits/removals replace the previous snapshot. */
export type SettingsSnapshot = Record<string,unknown>;
export type AccountSettingsPatch = {
  settings?: SettingsSnapshot;
  settingsRevision?: string | null;
  pendingSettingsRevision?: string | null;
};
export type AccountSettingsCache = AccountSettingsPatch & {[field: string]: unknown};
export type AccountSettingsRead = Readonly<{uid:string;session:number;revision:string | null;pending:string | null}>;
type Dependencies = {
  readLocal(uid: string): AccountSettingsCache | null;
  /** Merge this settings-only patch with the cached account; false means no durable save. */
  writeLocal(uid: string,patch: AccountSettingsPatch): boolean;
  enqueueRemote(uid: string,settings: Readonly<SettingsSnapshot>): Promise<void>;
  currentUid(): string | null;
  currentSession(): number;
  isDenied(uid: string): boolean;
  isPreview(uid: string): boolean;
  onRemoteDenied?(uid: string): void;
  revision?(): string;
};
const marker = (value: unknown): string | null => typeof value === 'string' && value ? value : null;
function snapshot(value: object): SettingsSnapshot {
  try {
    const copy: unknown=JSON.parse(JSON.stringify(value));
    if (copy && typeof copy === 'object' && !Array.isArray(copy)) return copy as SettingsSnapshot;
  } catch { /* report serialization failure without including private settings */ }
  throw new Error('Settings must be a serializable JSON object.');
}
// Match JSON storage semantics without treating object insertion order as an edit.
const comparable = (value: SettingsSnapshot | null) => JSON.stringify(value,(_key,item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key,(item as SettingsSnapshot)[key]])) : item);
function freezeSnapshot(value: SettingsSnapshot): Readonly<SettingsSnapshot> {
  const freeze = (item: unknown) => {
    if (!item || typeof item !== 'object') return;
    Object.values(item).forEach(freeze);Object.freeze(item);
  };
  freeze(value);return value;
}

/** Durability lives here; the caller retains its existing settings-save debounce. */
export function createAccountSettingsPersistence(dependencies: Dependencies) {
  const {readLocal,writeLocal,enqueueRemote,currentUid,currentSession,isDenied,isPreview}=dependencies;
  const nextRevision=dependencies.revision || (() => globalThis.crypto.randomUUID());
  const inFlight=new Set<string>();
  const assertCurrent = (uid: string) => {
    if (!uid || currentUid() !== uid) throw new Error('The account changed. Open settings again before saving.');
    if (isDenied(uid)) throw new Error('Account access was denied. Sign in again before saving settings.');
  };
  const persist = (uid: string,patch: AccountSettingsPatch) => {
    try {if (writeLocal(uid,patch)) return;} catch { /* do not claim a durable edit */ }
    throw new Error('Could not save settings on this device. Check local storage and try again.');
  };
  const localSettings = (local: AccountSettingsCache | null): SettingsSnapshot | null => local?.settings ? snapshot(local.settings) : null;
  function dispatch(uid: string): boolean {
    if (currentUid() !== uid || isDenied(uid) || isPreview(uid)) return false;
    const local=readLocal(uid),revision=marker(local?.pendingSettingsRevision),session=currentSession();
    if (!local?.settings || !revision || local.settingsRevision !== revision) return false;
    const identity=JSON.stringify([uid,session,revision]);
    if (inFlight.has(identity)) return false;
    const payload=freezeSnapshot(snapshot(local.settings));
    inFlight.add(identity);
    const matches = () => {
      if (currentUid() !== uid || currentSession() !== session || isDenied(uid)) return false;
      const latest=readLocal(uid);
      return latest?.settingsRevision === revision && latest.pendingSettingsRevision === revision;
    };
    const rejected = (error: unknown) => {
      if ((error as {code?:string})?.code === 'permission-denied' && matches()) {
        try {dependencies.onRemoteDenied?.(uid);} catch { /* never start an automatic retry */ }
      }
    };
    let acknowledgement: Promise<void>;
    try {acknowledgement=enqueueRemote(uid,payload);}
    catch (error) {rejected(error);inFlight.delete(identity);return true;}
    void Promise.resolve(acknowledgement).then(() => {
      // No stale session/revision or deleted logout cache can be acknowledged.
      if (matches()) persist(uid,{pendingSettingsRevision:null});
    }).catch(rejected).finally(() => inFlight.delete(identity));
    return true;
  }
  return {
    /** Persist now; no-op updates never create a new pending revision or SDK write. */
    stage(uid: string,settings: object): SettingsSnapshot {
      assertCurrent(uid);
      const clean=snapshot(settings),local=readLocal(uid);
      if (comparable(clean) === comparable(localSettings(local))) return clean;
      const revision=nextRevision();
      persist(uid,{settings:clean,settingsRevision:revision,pendingSettingsRevision:isPreview(uid) ? null : revision});
      return snapshot(clean);
    },
    flush:dispatch,
    resume:dispatch,
    captureRead(uid: string): AccountSettingsRead {
      const local=readLocal(uid);
      return Object.freeze({uid,session:currentSession(),revision:marker(local?.settingsRevision),pending:marker(local?.pendingSettingsRevision)});
    },
    /** Only settings are persisted here; account key reconciliation remains independent. */
    reconcileRead(uid: string,start: AccountSettingsRead,remoteSettings: object | null | undefined): SettingsSnapshot | null {
      assertCurrent(uid);
      if (start.uid !== uid || start.session !== currentSession()) throw new Error('The account session changed during this read.');
      const local=readLocal(uid);
      if (!local && (start.revision || start.pending)) throw new Error('The account cache was cleared during this read.');
      const revision=marker(local?.settingsRevision),pending=marker(local?.pendingSettingsRevision);
      const protect=Boolean(local && (start.pending || pending || start.revision !== revision));
      const cached=localSettings(local),chosen=protect ? cached : remoteSettings == null ? null : snapshot(remoteSettings);
      const changed=comparable(chosen) !== comparable(cached);
      persist(uid,{settings:chosen || undefined,
        settingsRevision:!revision || (!protect && changed) ? nextRevision() : revision,
        pendingSettingsRevision:protect ? pending : null});
      return chosen ? snapshot(chosen) : null;
    },
  };
}
