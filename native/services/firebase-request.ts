import {requestAllowed} from './config.mjs';

type NativeConfig={mode:string;projectId:string;apiKey:string;nativeApiKey?:string;nativeApiKeyBundleId?:string;signedBundleId:string};
const header='X-Ios-Bundle-Identifier';
const absolute=(input:RequestInfo|URL)=>new URL(input instanceof Request?input.url:String(input),globalThis.location?.href||'capacitor://localhost/');
const needsIdentity=(config:NativeConfig,url:string)=>config.mode==='account-connected'&&Boolean(config.nativeApiKey)&&config.nativeApiKeyBundleId===config.signedBundleId&&requestAllowed(config,url);

/** The native Firebase key has iOS restrictions, rather than the website key's referrer restrictions. */
export function nativeFirebaseFetch(config:NativeConfig,io:typeof fetch):typeof fetch {
 return (input,init)=>{
  if(!needsIdentity(config,absolute(input).href))return io(input,init);
  const headers=new Headers(init?.headers??(input instanceof Request?input.headers:undefined));
  headers.set(header,config.nativeApiKeyBundleId!);
  return io(input,{...init,headers});
 };
}

/** Firestore's WebChannel uses XHR; retain the same destination guard installed by transport.ts. */
export function installNativeFirebaseXHR(config:NativeConfig,prototype:XMLHttpRequest=XMLHttpRequest.prototype){
 if(!config.nativeApiKey)return;
 const approved=new WeakSet<XMLHttpRequest>(),open=prototype.open,setHeader=prototype.setRequestHeader,send=prototype.send;
 prototype.open=function(method:string,url:string|URL,async:boolean=true,user?:string|null,password?:string|null){
  approved.delete(this);
  open.call(this,method,url,async,user,password);
  if(needsIdentity(config,absolute(String(url)).href))approved.add(this);
 };
 prototype.setRequestHeader=function(name:string,value:string){
  if(approved.has(this)&&name.toLowerCase()===header.toLowerCase()){
   if(value!==config.nativeApiKeyBundleId)throw new TypeError('Native Firebase identity cannot be overridden.');
   return; // send() inserts the trusted value exactly once.
  }
  setHeader.call(this,name,value);
 };
 prototype.send=function(body?:Document|XMLHttpRequestBodyInit|null){
  if(approved.has(this))setHeader.call(this,header,config.nativeApiKeyBundleId!);
  send.call(this,body);
 };
}
