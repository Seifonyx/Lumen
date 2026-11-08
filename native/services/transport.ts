import {NativeAiConsent,zeroBudgetAccount} from './ai-consent';
import {FreeNativeProvider} from './free-provider';
import {accountScope} from '../integration/runtime';
import config from 'lumen:service-config';
import {requestAllowed,freeAiProject} from './config.mjs';
import {nativeFirebaseFetch,installNativeFirebaseXHR} from './firebase-request';
const nativeFetch=nativeFirebaseFetch(config,globalThis.fetch.bind(globalThis));
export const nativeAiConsent=new NativeAiConsent(accountScope,localStorage,config.projectId);
const ai=new FreeNativeProvider(accountScope,()=>nativeAiConsent.current(),nativeFetch);
nativeAiConsent.subscribe(()=>ai.invalidate());
export async function enableFreeOpenRouter(key:string,confirmed:boolean){
 if(!confirmed||!freeAiProject(config.projectId))throw Error('Confirm free-only OpenRouter use.');
 if(!/^sk-or-\S{8,512}$/.test(key))throw Error('Enter an OpenRouter test key.');
 const lease=accountScope.request(AbortSignal.timeout(15000));
 try{
  const response=await nativeFetch('https://openrouter.ai/api/v1/key',{headers:{authorization:'Bearer '+key},signal:lease.signal,credentials:'omit',redirect:'error'});
  if(!response.ok)throw Error(response.status===429?'OpenRouter is rate limited. Try later.':'OpenRouter could not verify this key.');
  const data=await response.json();if(!lease.valid())throw Error('The account changed.');
  if(!zeroBudgetAccount(data.data))throw Error('Use a free account, set the key credit limit to $0, and remove BYOK usage.');
  await nativeAiConsent.enable(key,true);
 }finally{lease.dispose();}
}
function allowed(url:URL){return url.origin===location.origin||url.protocol==='data:'||url.protocol==='blob:'||requestAllowed(config,url.href);}
export const testFetch:typeof fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 if(url.origin==='https://openrouter.ai')return ai.request(input,init);
 if(!allowed(url))throw new Error('This service is not enabled in the isolated test build.');
 return nativeFetch(input,init);
};
globalThis.fetch=testFetch;
const open=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method:string,url:string|URL,async:boolean=true,user?:string|null,password?:string|null){
 if(user||password||!allowed(new URL(String(url),location.href)))throw new Error('Test network destination denied.');
 open.call(this,method,url,async,user,password);
};
installNativeFirebaseXHR(config);
for(const name of ['WebSocket','EventSource','SharedWorker','Worker'] as const){
 Object.defineProperty(globalThis,name,{configurable:true,value:class{constructor(){throw new Error('This network/runtime facility is not enabled in the test build.');}}});
}
navigator.sendBeacon=()=>false;
window.open=()=>null;
document.addEventListener('click',e=>{
 const a=(e.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;
 if(a?.href==='https://openrouter.ai/keys'&&e.isTrusted&&freeAiProject(config.projectId)){
  e.preventDefault();e.stopImmediatePropagation();
  (window as unknown as {webkit?:{messageHandlers?:{nativeProviderSetup?:{postMessage:(data:object)=>void}}}}).webkit?.messageHandlers?.nativeProviderSetup?.postMessage({open:true});return;
 }
 if(a&&!a.download&&!allowed(new URL(a.href,location.href))){e.preventDefault();e.stopImmediatePropagation();}
},true);
