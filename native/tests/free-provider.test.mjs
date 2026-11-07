import {createHash} from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';
import {AccountScope} from '../integration/scope.ts';
import {FreeNativeProvider,validateAiApproval} from '../services/free-provider.ts';
import {openStream,setKeys} from '../../src/lib/ai/providers.js';
const approved=()=>({approved:true,provider:'openrouter',projectId:'lumen-ios-test',uid:'test-a',policy:'free-variants-only',noByok:true,keySha256:createHash('sha256').update('synthetic-test-key').digest('hex')});
const url='https://openrouter.ai/api/v1/chat/completions';
const payload=(extra={})=>({method:'POST',headers:{authorization:'Bearer synthetic-test-key'},body:JSON.stringify({model:'fixture/text:free',stream:true,messages:[{role:'user',content:'Synthetic sample'}],...extra})});
const setup=(fetcher,approval=approved())=>{const scope=new AccountScope();scope.set('test-a');return {scope,p:new FreeNativeProvider(scope,approval,(url,init)=>url.endsWith('/key')?Promise.resolve(Response.json({data:{limit:0,is_free_tier:true,byok_usage:0}})):fetcher(url,init))};};
const sse=v=>'data: '+JSON.stringify(v)+'\n\n';
test('consent is absent by default and is account/test-project scoped',async()=>{
 assert.equal(validateAiApproval(null),null);assert.throws(()=>validateAiApproval({...approved(),projectId:'lumen-chat'}));
 let calls=0;const {p}=setup(async()=>{calls++;return Response.json({});},null);
 await assert.rejects(p.request(url,payload()),/Enable free-only/);assert.equal(calls,0);
 const mismatch=setup(async()=>{calls++;return Response.json({});});
 await assert.rejects(mismatch.p.request(url,{...payload(),headers:{authorization:'Bearer wrong-test-key'}}),/credential/);assert.equal(calls,0);
 const other=setup(async()=>{calls++;return Response.json({});});other.scope.set('test-b');
 await assert.rejects(other.p.request(url,payload()),/approved account/);assert.equal(calls,0);
});
test('paid/unknown/plugin/alternate requests never reach IO; free request carries hard zero price ceilings',async()=>{
 let seen,calls=0;const {p}=setup(async(_url,init)=>{calls++;seen=JSON.parse(init.body);return new Response(sse({choices:[{delta:{content:'ok'},finish_reason:'stop'}]})+'data: [DONE]\n\n');});
 for(const extra of [{model:'fixture/paid'},{models:['fixture/text:free','paid/x']},{plugins:[{id:'web'}]},{provider:{allow_fallbacks:true}},{messages:[{role:'user',content:[{type:'image_url',image_url:{url:'https://evil.test/x'}}]}]}])await assert.rejects(p.request(url,payload(extra)));
 await assert.rejects(p.request('https://openrouter.ai.evil.test/api/v1/chat/completions',payload()));assert.equal(calls,0);
 const response=await p.request(url,payload());await response.text();
 assert.deepEqual(seen.provider.max_price,{prompt:0,completion:0,request:0,image:0});assert.equal(seen.provider.allow_fallbacks,false);
});
test('catalog exposes only explicit free variants with wholly zero known pricing',async()=>{
 const {p}=setup(async()=>Response.json({data:[{id:'a/yes:free',pricing:{prompt:'0',completion:'0'}},{id:'a/no',pricing:{prompt:'0',completion:'0'}},{id:'a/fee:free',pricing:{prompt:'0',completion:'0',request:'0.1'}},{id:'a/unknown:free',pricing:{prompt:null,completion:'0'}}]}));
 const response=await p.request('https://openrouter.ai/api/v1/models',{headers:{authorization:'Bearer synthetic-test-key'}});
 assert.deepEqual((await response.json()).data.map(x=>x.id),['a/yes:free']);
});
test('canonical OpenRouter adapter handles actual SSE framing, partial errors and redacts keys',async()=>{
 globalThis.location={origin:'capacitor://localhost'};setKeys({openrouter:'synthetic-test-key'});
 const {p}=setup(async()=>new Response(sse({choices:[{delta:{content:'First '}}]})+sse({choices:[{delta:{content:'second'}}]})+sse({error:{code:429,message:'Quota synthetic-test-key'},choices:[{finish_reason:'error',delta:{}}]})+'data: [DONE]\n\n'));
 const original=globalThis.fetch;globalThis.fetch=p.request.bind(p);
 try{const result=await openStream({provider:'openrouter',name:'fixture/text:free'},[{role:'user',text:'Synthetic sample'}],{instructions:'',signal:new AbortController().signal});
 assert(result.ok);const events=[];for await(const event of result.events)events.push(event);
 assert.equal(events.filter(x=>x.t==='text').map(x=>x.text).join(''),'First second');
 assert.equal(events.find(x=>x.t==='error').status,429);assert(!JSON.stringify(events).includes('synthetic-test-key'));
 }finally{globalThis.fetch=original;setKeys({});}
});
test('Stop, account switch and background interrupt pending reads without stale output',async()=>{
 for(const action of ['stop','switch','background']){
 let canceled=false;const {p,scope}=setup(async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('first'));},cancel(){canceled=true;}})));
 const controller=new AbortController();const response=await p.request(url,{...payload(),signal:controller.signal});const reader=response.body.getReader();assert.equal(new TextDecoder().decode((await reader.read()).value),'first');
 const waiting=reader.read();if(action==='stop')controller.abort();else if(action==='switch')scope.set('test-b');else scope.pause();
 await assert.rejects(waiting,{name:'AbortError'});assert(canceled);assert.equal(p.inFlight,0);
 }
});
test('HTTP 401/429/503 survive canonical error handling; no adapter retries',async()=>{
 globalThis.location={origin:'capacitor://localhost'};setKeys({openrouter:'synthetic-test-key'});const original=globalThis.fetch;
 try{for(const status of [401,429,503]){let calls=0;const {p}=setup(async()=>{calls++;return Response.json({error:{message:'Synthetic failure',code:status}},{status});});globalThis.fetch=p.request.bind(p);
 const result=await openStream({provider:'openrouter',name:'fixture/text:free'},[{role:'user',text:'Sample'}],{instructions:'',signal:new AbortController().signal});assert.equal(result.status,status);assert.equal(calls,1);}}
 finally{globalThis.fetch=original;setKeys({});}
});

test('account generation cannot change while a request body is being read',async()=>{
 let controller,calls=0;const {p,scope}=setup(async()=>{calls++;return new Response('never');});
 const req=new Request(url,{...payload(),body:new ReadableStream({start(c){controller=c;}}),duplex:'half'});
 const work=p.request(req);scope.set('test-b');scope.set('test-a');controller.enqueue(new TextEncoder().encode(payload().body));controller.close();
 await assert.rejects(work,{name:'AbortError'});assert.equal(calls,0);
});
test('stalled headers cancel promptly; a late uncooperative response body is discarded',async()=>{
 let resolve,entered,canceled=false;const delayed=new Promise(r=>resolve=r),started=new Promise(r=>entered=r);
 const {p,scope}=setup(()=>{entered();return delayed;});const work=p.request(url,payload());
 await started;scope.pause();await assert.rejects(work,{name:'AbortError'});assert.equal(p.inFlight,0);
 resolve(new Response(new ReadableStream({cancel(){canceled=true;}})));await new Promise(r=>setImmediate(r));assert(canceled);
});

test('fresh zero-budget check blocks changed or unknown metadata before inference',async()=>{
 for(const data of [{limit:1,is_free_tier:true,byok_usage:0},{limit:0,is_free_tier:false,byok_usage:0},{limit:0,is_free_tier:true,byok_usage:1},{}]){
  const scope=new AccountScope();scope.set('test-a');let calls=0;
  const p=new FreeNativeProvider(scope,approved(),async path=>{if(path.endsWith('/key'))return Response.json({data});calls++;return new Response('must not send');});
  assert.equal((await p.request(url,payload())).status,403);assert.equal(calls,0);
 }
});
test('consent revocation cancels pending provider IO without rotating the cloud account',async()=>{
 const scope=new AccountScope();scope.set('test-a');const cloud=scope.capture();let approval=approved(),entered;
 const started=new Promise(r=>entered=r);const p=new FreeNativeProvider(scope,()=>approval,async path=>{if(path.endsWith('/key'))return Response.json({data:{limit:0,is_free_tier:true,byok_usage:0}});entered();return new Promise(()=>{});});
 const work=p.request(url,payload());await started;approval=null;p.invalidate();await assert.rejects(work,{name:'AbortError'});assert(cloud.valid());assert.equal(p.inFlight,0);
 await assert.rejects(p.request(url,payload()),/Enable free-only/);
});
