import type {AccountScope} from '../integration/scope.ts';
import {validateAiApproval,type AiApproval} from './free-provider.ts';
export const consentKey=(uid:string,project='lumen-ios-test')=>'lumen.native.free-ai.'+(project==='lumen-ios-test'?'':encodeURIComponent(project)+'.')+encodeURIComponent(uid);
const permittedProject=(project:string):project is AiApproval['projectId']=>['lumen-ios-test','the-model-router'].includes(project);
export {zeroBudgetAccount} from './free-provider.ts';
export class NativeAiConsent {
 private scope:AccountScope;private storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>;private project:string;private listeners=new Set<()=>void>();
 constructor(scope:AccountScope,storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,project:string){this.scope=scope;this.storage=storage;this.project=project;}
 subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
 private changed(){for(const fn of this.listeners)fn();}
 current():AiApproval|null{
  const uid=this.scope.uid;if(!uid||!permittedProject(this.project))return null;
  try{const a=validateAiApproval(JSON.parse(this.storage.getItem(consentKey(uid,this.project))||'null'));return a?.uid===uid&&a.projectId===this.project?a:null;}catch{return null;}
 }
 async enable(key:string,confirmed:boolean){
  if(!confirmed||!permittedProject(this.project))throw Error('Confirm free-only OpenRouter use for this account.');
  const lease=this.scope.capture();
  if(!/^sk-or-\S{8,512}$/.test(key))throw Error('Enter a valid OpenRouter test key.');
  if(!globalThis.crypto?.subtle)throw Error('Secure key verification is unavailable.');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),n=>n.toString(16).padStart(2,'0')).join('');
  if(!lease.valid())throw Error('The account changed. Try again.');
  this.storage.setItem(consentKey(lease.uid,this.project),JSON.stringify({approved:true,provider:'openrouter',projectId:this.project,uid:lease.uid,policy:'free-variants-only',noByok:true,keySha256:digest}));this.changed();
 }
 revoke(uid=this.scope.uid){if(uid){this.storage.removeItem(consentKey(uid,this.project));if(this.scope.uid===uid)this.changed();}}
}
