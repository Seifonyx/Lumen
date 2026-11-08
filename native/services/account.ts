import {doc,setDoc,type Firestore} from 'firebase/firestore';
import {NativeAiConsent,consentKey} from './ai-consent';
import {onIdTokenChanged,signInWithCredential,signOut,GoogleAuthProvider,type Auth,type User} from 'firebase/auth';
import {registerPlugin} from '@capacitor/core';
import {RealSession,type NativeCredential} from '../integration/real-session';
import {verifyNativeGoogleToken} from '../integration/google-token';
import {authFailure} from '../integration/auth-errors';
import config from 'lumen:service-config';
import {accountScope} from '../integration/runtime';
import type {AccountKeyCache} from '../../src/lib/account-key-persistence';
interface GoogleBridge {signIn():Promise<NativeCredential>;restore():Promise<NativeCredential>;signOut():Promise<void>;cancel():Promise<void>}
const google=registerPlugin<GoogleBridge>('LumenGoogleAuth');
let session:RealSession<User>|null=null;
const accounts=new Map<string,AccountKeyCache>();
function coordinator(auth:Auth){
 if(!session)session=new RealSession<User>({current:()=>auth.currentUser,watch:fn=>onIdTokenChanged(auth,fn),
  signIn:async c=>{
   const idToken=await verifyNativeGoogleToken(c,config.webClientId);
   try{return (await signInWithCredential(auth,GoogleAuthProvider.credential(idToken))).user;}
   catch(error){throw authFailure('firebase',error);}
  },
  signOut:()=>signOut(auth)},
  {credential:async restore=>{try{return await (restore?google.restore():google.signIn());}catch(error){throw authFailure('google',error);}},signOut:()=>google.signOut(),cancel:()=>google.cancel()});
 return session;
}
let restored=false;
export function watchNativeUser(auth:Auth,callback:(user:User|null)=>void){
 const c=coordinator(auth),off=c.watch(user=>{const next=user?.uid||null;if(accountScope.uid!==next){if(accountScope.uid)localStorage.removeItem(consentKey(accountScope.uid,config.projectId));accounts.clear();accountScope.set(next);}callback(user);});
 if(!restored){restored=true;void c.restore().catch(()=>{/* signed out, never a demo fallback */});}
 return off;
}
export const signInNative=(auth:Auth)=>coordinator(auth).signIn();
export const signOutNative=(auth:Auth)=>coordinator(auth).signOut();
export const cancelNative=(auth:Auth)=>coordinator(auth).cancel();
export function readNativeAccount(uid:string):AccountKeyCache|null {
 if(accountScope.uid!==uid)return null;
 if(accounts.has(uid))return accounts.get(uid)!;
 try{const d=JSON.parse(localStorage.getItem('mr.account.'+uid)||'null');return d?.settings?{settings:d.settings,settingsRevision:d.settingsRevision,pendingSettingsRevision:d.pendingSettingsRevision}:null;}catch{return null;}
}
export function writeNativeAccount(uid:string,patch:AccountKeyCache):boolean{
 if(accountScope.uid!==uid)return false;
 const current={...readNativeAccount(uid),...patch};accounts.set(uid,current);
 // Only settings and retry metadata may reach disk. Provider keys/connection objects stay in memory.
 const disk={settings:current.settings,settingsRevision:current.settingsRevision,pendingSettingsRevision:current.pendingSettingsRevision};
 try{localStorage.setItem('mr.account.'+uid,JSON.stringify(disk));return true;}catch{return false;}
}
export function clearNativeAccount(uid:string){accounts.delete(uid);localStorage.removeItem(consentKey(uid,config.projectId));}

/** Same canonical private account field; raw keys never enter native localStorage or the app bundle. */
export async function saveNativeProviderKeys(db:Firestore,uid:string,keys:{openrouter?:string}){
 const lease=accountScope.capture();
 if(uid!==lease.uid||!['lumen-ios-test','the-model-router'].includes(config.projectId))throw Error('Provider setup requires the current Lumen account.');
 const key=(keys.openrouter||'').trim();
 if(key){
  const permission=new NativeAiConsent(accountScope,localStorage,config.projectId).current();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),n=>n.toString(16).padStart(2,'0')).join('');
  if(!lease.valid()||permission?.keySha256!==hash||new NativeAiConsent(accountScope,localStorage,config.projectId).current()?.keySha256!==hash)throw Error('Confirm free-only consent before saving this key.');
 }
 let timer:ReturnType<typeof setTimeout>;
 try{await Promise.race([setDoc(doc(db,'modelRouter',uid),{openrouterKey:key},{merge:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Key sync could not be confirmed. Reconnect and retry.')),15000);})]);}
 finally{clearTimeout(timer!);}
 if(!lease.valid())throw Error('The account changed.');
 writeNativeAccount(uid,{openrouterKey:key});
}
