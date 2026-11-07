// Offline native demo account adapter. No Firebase SDK, OAuth or remote account IO.
import {accountScope,authFlow,sessionLifetime,onSessionExpired} from '../integration/runtime';
import {MemoryAccountSettings} from '../integration/settings';
import {SyntheticAuthPort} from '../integration/auth';
import { normalizeKeys } from '../../src/lib/ai/provider-config.js';
import type { ApiKeys as CanonicalApiKeys } from '../../src/lib/firebase';

export type ApiKeys = CanonicalApiKeys;
export interface PreviewUser { uid: string; email: string; displayName: string; photoURL: string }

/** Not a credential: a fixed label the synthetic transport accepts and no real provider would. */
export const SYNTHETIC_KEY = 'native-demo-not-a-real-key';
const PREVIEW_KEY = 'mr.preview_user';
export const syntheticSettings=new MemoryAccountSettings();

let session: PreviewUser | null = null;
/** Select one of the two public local demo profiles. */
export function selectDemo(namespace: string): PreviewUser {
  if (!['a','b'].includes(namespace)) throw new Error('Unknown demo profile');
  session = { uid: `preview-native-demo-${namespace}`, email: `demo-${namespace}@synthetic.invalid`, displayName: `Demo ${namespace.toUpperCase()}`, photoURL: '' };
  return session;
}

try {
  const prior = JSON.parse(localStorage.getItem(PREVIEW_KEY) || 'null');
  if (prior?.uid === 'preview-native-demo-a') selectDemo('a');
  if (prior?.uid === 'preview-native-demo-b') selectDemo('b');
} catch { /* no saved demo */ }

export const auth = Object.freeze({ currentUser: null });
export const db = Object.freeze({ type: 'native-demo' });

export function isPreviewUser(uid?: string | null): boolean {
  return Boolean(uid && uid.startsWith('preview-'));
}

export function getStoredPreviewUser(): PreviewUser | null {
  try {
    const stored = JSON.parse(localStorage.getItem(PREVIEW_KEY) || 'null') as PreviewUser | null;
    return stored && session && stored.uid === session.uid ? session : null;
  } catch {
    return null;
  }
}

let listeners: Array<(user: PreviewUser | null) => void> = [];
const notify = (user: PreviewUser | null) => listeners.forEach((fn) => fn(user));

/** The sandbox button signs back in as this review's synthetic account, whatever email it passes. */
export function signInPreview(_email?: string, _name?: string): PreviewUser {
  if (!session) throw new Error('This review build has not been authorised.');
  try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(session)); } catch { /* private mode */ }
  authFlow.cancel();
  sessionLifetime.adopt(session.uid);
  notify(session);
  return session;
}

export function watchUser(cb: (user: PreviewUser | null) => void) {
  listeners.push(cb);
  const timer=setTimeout(()=>{
    const user=getStoredPreviewUser();
    if(user&&accountScope.uid!==user.uid)sessionLifetime.adopt(user.uid);
    cb(user);
  },0);
  return () => { clearTimeout(timer);listeners = listeners.filter((l) => l !== cb); };
}

export const takeRedirectError = () => '';

export async function signInWithGoogle(): Promise<void> {
  throw new Error('Google sign-in is disabled in this offline native demo. Use the synthetic account.');
}

export const signOutUser = async () => {
  cancelDemoLogin();sessionLifetime.end();
  try { localStorage.removeItem(PREVIEW_KEY); } catch { /* private mode */ }
  notify(null);
};

export function watchAccountAccessDenied(_listener: (uid: string) => void): void {}
export function resumePendingAccountWrites(_uid: string): void {}
export function resumePendingAccountKeys(_uid: string): void {}

const localKey = (uid: string) => `mr.account.${uid}`;
function local(uid: string): { settings?: Record<string, unknown> } {
  try { return JSON.parse(localStorage.getItem(localKey(uid)) || '{}') || {}; } catch { return {}; }
}

export function forgetLocalAccount(uid: string) {
  // No credentials live here. Keep this demo account's authoritative project/settings data on logout.
  void uid;
}

/** Like canonical preview accounts: no instant-open copy. */
export function savedAccount(_uid: string): { keys: ApiKeys; settings: Record<string, unknown> | null } | null {
  return null;
}

export async function loadKeys(_uid: string): Promise<ApiKeys> {
  return normalizeKeys({ gemini: SYNTHETIC_KEY, openrouter: '', groq: '', cerebras: '', github: '' }) as unknown as ApiKeys;
}

export function cacheAccountSettings(uid: string, settings: object): boolean {
  if(accountScope.uid!==uid)return false;
  try { localStorage.setItem(localKey(uid), JSON.stringify({ ...local(uid), settings })); return true; } catch { return false; }
}

export async function loadRemoteSettings(uid: string): Promise<Record<string, unknown> | null> {
  if(accountScope.uid!==uid)throw new DOMException('Account changed','AbortError');
  return local(uid).settings || null;
}

export async function saveRemoteSettings(uid: string, settings: object): Promise<void> {
  if(!cacheAccountSettings(uid, settings))throw new Error('Could not save this account on the device.');
  if(accountScope.active)await syntheticSettings.write(uid,settings as Record<string,unknown>,accountScope.capture());
}

export async function saveKeys(_uid: string, _keys: ApiKeys): Promise<void> {
  throw new Error('Saving provider keys is disabled in this offline native demo. No real keys are used here.');
}

let loginGeneration=0;
let loginController:AbortController|null=null;
export function cancelDemoLogin(){loginGeneration++;loginController?.abort();loginController=null;authFlow.cancel();}
/** System-browser-shaped flow with a local synthetic provider. No OAuth URL is opened. */
export async function beginDemoLogin(id:string):Promise<void>{
  await signOutUser();selectDemo(id);const generation=++loginGeneration;
  const controller=new AbortController();loginController=controller;
  try {
    const result=await authFlow.authorize(new SyntheticAuthPort(session!.uid));
    if(!accountScope.isForeground)await new Promise<void>((resolve,reject)=>{
      const off=accountScope.subscribe(()=>{if(accountScope.isForeground){cleanup();resolve();}});
      const abort=()=>{cleanup();reject(new DOMException('Sign-in canceled','AbortError'));};
      const cleanup=()=>{off();controller.signal.removeEventListener('abort',abort);};
      controller.signal.addEventListener('abort',abort,{once:true});if(controller.signal.aborted)abort();
    });
    if(generation!==loginGeneration||controller.signal.aborted||result.uid!==session?.uid)throw new DOMException('Sign-in canceled','AbortError');
    signInPreview();
  }finally{if(loginController===controller)loginController=null;}
}
onSessionExpired(()=>{
  cancelDemoLogin();try{localStorage.removeItem(PREVIEW_KEY);}catch{/* unavailable storage */}
  notify(null);
});
