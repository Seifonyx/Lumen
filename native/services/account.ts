import {onIdTokenChanged,signInWithCredential,signOut,GoogleAuthProvider,type Auth,type User} from 'firebase/auth';
import {registerPlugin} from '@capacitor/core';
import {RealSession,type NativeCredential} from '../integration/real-session';
import {verifyNativeGoogleToken} from '../integration/google-token';
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
   return (await signInWithCredential(auth,GoogleAuthProvider.credential(idToken))).user;
  },
  signOut:()=>signOut(auth)},
  {credential:restore=>restore?google.restore():google.signIn(),signOut:()=>google.signOut(),cancel:()=>google.cancel()});
 return session;
}
let restored=false;
export function watchNativeUser(auth:Auth,callback:(user:User|null)=>void){
 const c=coordinator(auth),off=c.watch(user=>{const next=user?.uid||null;if(accountScope.uid!==next){accounts.clear();accountScope.set(next);}callback(user);});
 if(!restored){restored=true;void c.signIn(true).catch(()=>{/* signed out, never a demo fallback */});}
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
export function clearNativeAccount(uid:string){accounts.delete(uid);}
