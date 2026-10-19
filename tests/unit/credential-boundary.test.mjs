import assert from 'node:assert/strict';
import {setKeys,openStream,complete,embed,openRouterKeyInfo,geminiKeyLock} from '../../src/lib/ai/providers.js';
import {runChat,summarize} from '../../src/lib/ai/chat.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const user=[{role:'user',text:'Original account context'}];
const reset=()=>setKeys({gemini:Math.random().toString(36),openrouter:'synthetic-or'});

// A late header response cannot trigger Gemini's parameter retry with new keys.
let pending=deferred(),calls=0;
reset();globalThis.fetch=async()=>{calls++;return pending.promise;};
let work=openStream({provider:'gemini',name:'gemini-2.5-flash'},user,{instructions:'',signal:new AbortController().signal});
const caught=assert.rejects(work,{name:'AbortError'});
reset();await caught;assert.equal(calls,1);
pending.resolve(Response.json({error:{message:'Unsupported thinking options'}},{status:400}));
await new Promise(r=>setTimeout(r,0));assert.equal(calls,1);

// Credential changes while reading a parameter rejection also stop its second fetch.
reset();let cancelling=deferred(),entered=deferred();calls=0;
globalThis.fetch=async()=>{calls++;return {ok:false,status:400,text:()=>{entered.resolve();return cancelling.promise;}};};
work=openStream({provider:'gemini',name:'gemini-2.5-flash'},user,{instructions:'',signal:new AbortController().signal});
const adjusted=assert.rejects(work,{name:'AbortError'});await entered.promise;reset();cancelling.resolve(JSON.stringify({error:{message:'Unsupported thinking options'}}));await adjusted;assert.equal(calls,1);

// No fallback model may inherit a replacement configuration after an old request is cancelled.
reset();pending=deferred();calls=0;
globalThis.fetch=async()=>{calls++;return pending.promise;};
const events=[];
work=(async()=>{for await(const event of runChat({model:'gemini:gemini-2.5-flash',fallbacks:['openrouter:other:free'],messages:user},new AbortController().signal))events.push(event);})();
await new Promise(r=>setTimeout(r,0));reset();await work;assert.equal(calls,1);assert(!events.some(e=>e.t==='text'));
pending.resolve(new Response('',{status:503}));

// One-shot helpers cancel during body reading, without depending on cooperative JSON IO.
for(const provider of ['gemini','openrouter']) {
 reset();const body=deferred();entered=deferred();
 globalThis.fetch=async()=>({ok:true,json:()=>{entered.resolve();return body.promise;}});
 work=complete({provider,name:provider==='gemini'?'gemini-2.5-flash':'other:free'},'Original context',{signal:new AbortController().signal});
 const rejected=assert.rejects(work,{name:'AbortError'});await entered.promise;reset();await rejected;body.resolve({});
}

reset();pending=deferred();globalThis.fetch=async()=>pending.promise;
work=embed(['Original context'],'RETRIEVAL_DOCUMENT',new AbortController().signal);
const embedded=assert.rejects(work,{name:'AbortError'});reset();await embedded;pending.resolve(Response.json({embeddings:[]}));

// Cancelling between yielded events cannot forward the old answer.
reset();globalThis.fetch=async()=>new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Old scope answer'}]},finishReason:'STOP'}]})+'\n\n',{headers:{'content-type':'text/event-stream'}});
const until=async(iterator,type)=>{for(;;){const item=await iterator.next();if(item.done||item.value.t===type)return item;}};
let iterator=runChat({model:'gemini:gemini-2.5-flash',messages:user},new AbortController().signal);
assert.equal((await until(iterator,'request')).value.t,'request');assert.equal((await iterator.next()).value.t,'model');reset();assert.equal((await iterator.next()).done,true,'old deltas are suppressed after a yielded announcement');

// Closing an iterator while suspended cancels the active connection.
reset();let connectionSignal;
globalThis.fetch=async(_url,init)=>{connectionSignal=init.signal;return new Response('data: [DONE]\n\n');};
iterator=runChat({model:'gemini:gemini-2.5-flash',messages:user},new AbortController().signal);
assert.equal((await until(iterator,'request')).value.t,'request');await iterator.return();assert(connectionSignal.aborted,'early consumer exit closes provider attempt');

// A summary operation owns one credential scope across every candidate.
reset();pending=deferred();calls=0;const reports=[];
globalThis.fetch=async()=>{calls++;return calls===1?pending.promise:Response.json({candidates:[{content:{parts:[{text:'Replacement key must never see this prompt'}]}}]});};
work=summarize('Original private summary',['gemini:first','gemini:second'],{report:(...v)=>reports.push(v)});
await new Promise(r=>setTimeout(r,0));reset();
assert.equal(await work,null);assert.equal(calls,1,'summary fallback cannot use replacement keys');assert.deepEqual(reports,[],'old scope cannot publish usage');pending.resolve(Response.json({}));

// Diagnostic bodies cannot publish old key details after a connection changes.
for(const check of [openRouterKeyInfo,geminiKeyLock]) {
 reset();const body=deferred();entered=deferred();
 globalThis.fetch=async()=>({ok:check===openRouterKeyInfo,status:401,json:()=>{entered.resolve();return body.promise;},text:()=>{entered.resolve();return body.promise;}});
 work=check();await entered.promise;reset();assert.equal(await work,null);body.resolve({data:{limit:123,usage:77}});
}

// Embedding cancellation also bounds a stalled JSON body.
reset();entered=deferred();const embeddingBody=deferred();
globalThis.fetch=async()=>({ok:true,json:()=>{entered.resolve();return embeddingBody.promise;}});
work=embed(['Original context'],'RETRIEVAL_DOCUMENT',new AbortController().signal);
const embeddingCancelled=assert.rejects(work,{name:'AbortError'});await entered.promise;reset();await embeddingCancelled;embeddingBody.resolve({embeddings:[]});

// Provider calls omit ambient cookies and reject redirects before credentials can be forwarded.
reset();let options;
globalThis.fetch=async(url,init)=>{options=init;return Response.json({candidates:[{content:{parts:[{text:'OK'}]}}]});};
assert.equal(await complete({provider:'gemini',name:'gemini-2.5-flash'},'Hello'),'OK');
assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
setKeys({});
console.log('PASS key-boundary cancellation before/during retries, no cross-scope fallback, bounded helper/body cancellation and credential-safe fetch options');
