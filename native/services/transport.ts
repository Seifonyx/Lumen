import aiApproval from 'lumen:native-ai-approval';
import {FreeNativeProvider} from './free-provider';
import {accountScope} from '../integration/runtime';
import config from 'lumen:service-config';
import {requestAllowed} from './config.mjs';
const nativeFetch=globalThis.fetch.bind(globalThis);
const ai=new FreeNativeProvider(accountScope,aiApproval,nativeFetch);
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
for(const name of ['WebSocket','EventSource','SharedWorker','Worker'] as const){
 Object.defineProperty(globalThis,name,{configurable:true,value:class{constructor(){throw new Error('This network/runtime facility is not enabled in the test build.');}}});
}
navigator.sendBeacon=()=>false;
window.open=()=>null;
document.addEventListener('click',e=>{const a=(e.target as Element)?.closest?.('a[href]');if(a&&!(a as HTMLAnchorElement).download&&!allowed(new URL((a as HTMLAnchorElement).href,location.href))){e.preventDefault();e.stopImmediatePropagation();}},true);
