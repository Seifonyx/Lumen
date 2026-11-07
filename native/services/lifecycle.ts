import {disableNetwork,enableNetwork} from 'firebase/firestore';
import {auth,db} from '../../src/lib/firebase';
import {useStore} from '../../src/store';
import {accountScope} from '../integration/runtime';
import {signOutNative} from './account';
export function installServiceLifecycle(){
 let active=(window as unknown as {__lumenNativeActive?:boolean}).__lumenNativeActive!==false,epoch=0;
 const pause=()=>{epoch++;accountScope.pause();useStore.getState().stop();void disableNetwork(db).catch(()=>{});};
 const resume=async()=>{
  const ticket=++epoch,user=auth.currentUser;
  if(!user){accountScope.resume();return;}
  if(!navigator.onLine){accountScope.resume();await disableNetwork(db);return;}
  try{
   await user.getIdToken(true);
   if(ticket!==epoch||!active||document.hidden||auth.currentUser?.uid!==user.uid)return;
   await enableNetwork(db);
   if(ticket===epoch&&active&&!document.hidden)accountScope.resume();else await disableNetwork(db);
  }catch(error){
   if(ticket!==epoch)return;
   const code=(error as {code?:string}).code;
   if(['auth/user-disabled','auth/user-token-expired','auth/invalid-user-token'].includes(code||''))await signOutNative(auth).catch(()=>{});
   else {accountScope.resume();useStore.getState().toast('Cloud connection unavailable. Reopen Lumen or reconnect to retry.');}
  }
 };
 const reconcile=()=>{if(active&&!document.hidden)void resume();else pause();};
 const native=(event:Event)=>{const d=(event as CustomEvent<{active?:unknown}>).detail;if(typeof d?.active!=='boolean')return;active=d.active;reconcile();};
 document.addEventListener('visibilitychange',reconcile);window.addEventListener('pagehide',pause);window.addEventListener('pageshow',reconcile);
 window.addEventListener('online',reconcile);window.addEventListener('offline',reconcile);window.addEventListener('lumen:native-lifecycle',native);reconcile();
 return()=>{epoch++;document.removeEventListener('visibilitychange',reconcile);window.removeEventListener('pagehide',pause);window.removeEventListener('pageshow',reconcile);window.removeEventListener('online',reconcile);window.removeEventListener('offline',reconcile);window.removeEventListener('lumen:native-lifecycle',native);};
}
