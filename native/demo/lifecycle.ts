import {useStore} from '../../src/store';
import {accountScope,sessionLifetime} from '../integration/runtime';
/** Browser visibility + native background events, without a second application state owner. */
export function installAppLifecycle(){
 let nativeActive=(window as unknown as {__lumenNativeActive?:boolean}).__lumenNativeActive!==false;
 const reconcile=()=>{
  if(nativeActive&&!document.hidden){sessionLifetime.check();accountScope.resume();}
  else{accountScope.pause();useStore.getState().stop();}
 };
 const native=(event:Event)=>{
  const value=(event as CustomEvent<unknown>).detail;
  if(!value||typeof value!=='object'||typeof (value as {active?:unknown}).active!=='boolean')return;
  nativeActive=(value as {active:boolean}).active;reconcile();
 };
 const hide=()=>{accountScope.pause();useStore.getState().stop();};
 document.addEventListener('visibilitychange',reconcile);window.addEventListener('pagehide',hide);
 window.addEventListener('pageshow',reconcile);window.addEventListener('lumen:native-lifecycle',native);reconcile();
 return ()=>{document.removeEventListener('visibilitychange',reconcile);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',reconcile);window.removeEventListener('lumen:native-lifecycle',native);};
}
