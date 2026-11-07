import type {AccountScope} from '../integration/scope.ts';
import {waitFor} from '../../src/lib/ai/abort.js';

export type AiApproval={approved:true;provider:'openrouter';projectId:'lumen-ios-test';uid:string;policy:'free-variants-only';noByok:true;keySha256:string};
export function validateAiApproval(value:unknown):AiApproval|null {
 if(value===null||value===undefined)return null;
 const a=value as AiApproval;
 if(Object.keys(a).sort().join(',')!=='approved,keySha256,noByok,policy,projectId,provider,uid'||a.approved!==true||a.provider!=='openrouter'||a.projectId!=='lumen-ios-test'||a.policy!=='free-variants-only'||typeof a.uid!=='string'||!a.uid||a.uid.length>128||a.noByok!==true||typeof a.keySha256!=='string'||!/^[a-f0-9]{64}$/.test(a.keySha256))throw Error('Explicit isolated test AI approval required');
 return Object.freeze({...a});
}
const freeId=(id:unknown):id is string=>typeof id==='string'&&id.length<200&&/^[\w.-]+\/[\w.-]+:free$/.test(id)&&!id.includes('..');
const zero=(n:unknown)=>(typeof n==='number'||typeof n==='string'&&n.trim()!=='')&&Number.isFinite(Number(n))&&Number(n)===0;
const abort=()=>new DOMException('Provider request stopped','AbortError');
const denied=(message:string)=>Object.assign(Error(message),{status:403,code:'NATIVE_AI_DISABLED'});

/** Uses the canonical provider's HTTP/SSE implementation; adds native consent, cost and lifecycle boundaries. */
export class FreeNativeProvider {
 private scope:AccountScope;private approval:AiApproval|null;private io:typeof fetch;private pending=0;
 constructor(scope:AccountScope,approval:AiApproval|null,io:typeof fetch){this.scope=scope;this.approval=validateAiApproval(approval);this.io=io;}
 get inFlight(){return this.pending;}
 async request(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
  if(!this.approval)throw denied('Real AI requires owner approval. No provider request was sent.');
  if(this.scope.uid!==this.approval.uid)throw denied('AI is limited to the approved account.');
  const originLease=this.scope.capture();
  const url=new URL(input instanceof Request?input.url:String(input));
  if(url.origin!=='https://openrouter.ai'||url.username||url.password||url.search||url.hash)throw denied('Provider destination denied.');
  const req=new Request(url,input instanceof Request?new Request(input,init):init);
  const catalog=req.method==='GET'&&url.pathname==='/api/v1/models';
  const keyInfo=req.method==='GET'&&url.pathname==='/api/v1/key';
  const chat=req.method==='POST'&&url.pathname==='/api/v1/chat/completions';
  if(!catalog&&!keyInfo&&!chat)throw denied('Only free chat and its catalogue are enabled.');
  if(!/^Bearer \S+$/.test(req.headers.get('authorization')||''))throw denied('An approved test provider key is required.');
  if(!globalThis.crypto?.subtle)throw denied('Secure provider key verification is unavailable. No request was sent.');
  const key=(req.headers.get('authorization')||'').slice(7);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),n=>n.toString(16).padStart(2,'0')).join('');
  if(digest!==this.approval.keySha256)throw denied('Provider key does not match the approved free test credential.');
  let body:string|undefined;
  if(chat){
   let b;try{b=JSON.parse(await req.text());}catch{throw denied('Invalid free chat request.');}
   if(!b||typeof b!=='object')throw denied('Invalid free chat request.');
   const permitted=new Set(['model','stream','messages','usage','max_tokens']);
   if(Object.keys(b).some(k=>!permitted.has(k))||!freeId(b.model)||b.stream!==true||!Array.isArray(b.messages)||!b.messages.length)throw denied('Only explicit free streaming text models are enabled; paid fallbacks and plugins are blocked.');
   for(const m of b.messages){
    if(!['system','user','assistant'].includes(m.role)||!(typeof m.content==='string'||Array.isArray(m.content)&&m.content.every((p:{type?:string;text?:unknown})=>p.type==='text'&&typeof p.text==='string'&&Object.keys(p).every(k=>['type','text'].includes(k)))))throw denied('This free-only path accepts text. Attachments remain unchanged; file/image requests are not enabled.');
   }
   b.provider={allow_fallbacks:false,data_collection:'deny',max_price:{prompt:0,completion:0,request:0,image:0}};
   body=JSON.stringify(b);
  }
  if(!originLease.valid())throw abort();
  const lease=this.scope.request(req.signal);this.pending++;
  let released=false,streaming=false;
  const release=()=>{if(released)return;released=true;this.pending--;lease.dispose();};
  try{
   lease.signal.throwIfAborted();
   const work=this.io(url.href,{method:req.method,headers:req.headers,body,signal:lease.signal,credentials:'omit',redirect:'error'}).then(response=>{if(!lease.valid()){void response.body?.cancel().catch(()=>{});throw abort();}return response;});
   const response=await waitFor(work,lease.signal);
   if(!lease.valid()){void response.body?.cancel().catch(()=>{});throw abort();}
   if(catalog&&response.ok){
    const data=await waitFor(response.json(),lease.signal);if(!lease.valid())throw abort();
    if(!Array.isArray(data.data))throw Error('OpenRouter catalogue unavailable.');
    return Response.json({data:data.data.filter((m:{id?:unknown;pricing?:Record<string,unknown>})=>freeId(m.id)&&m.pricing&&zero(m.pricing.prompt)&&zero(m.pricing.completion)&&Object.values(m.pricing).every(zero))});
   }
   if(!response.body)return response;
   const reader=response.body.getReader();let finished=false,controller:ReadableStreamDefaultController<Uint8Array>;
   const finish=()=>{if(finished)return;finished=true;lease.signal.removeEventListener('abort',stop);release();};
   const stop=()=>{if(finished)return;controller.error(abort());finish();void reader.cancel().catch(()=>{});};
   const stream=new ReadableStream<Uint8Array>({
    start(c){controller=c;lease.signal.addEventListener('abort',stop,{once:true});if(lease.signal.aborted)stop();},
    async pull(c){try{const next=await waitFor(reader.read(),lease.signal);if(finished)return;if(!lease.valid())throw abort();if(next.done){c.close();finish();}else c.enqueue(next.value);}catch(error){if(!finished)c.error(error);finish();void reader.cancel().catch(()=>{});}},
    cancel(){finish();return reader.cancel();}
   });
   streaming=true;return new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});
  }finally{if(!streaming)release();}
 }
}
