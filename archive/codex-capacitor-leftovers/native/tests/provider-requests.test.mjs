import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountScope} from '../integration/scope.ts';
import {normalizeKeys} from '../../src/lib/ai/provider-config.js';
import {
 NativeProviderRequests,providerForRequest,PROVIDER_ORIGINS,PROVIDER_HOSTS,
 PROVIDER_CONNECT_SOURCES,PROVIDER_HOST_PATTERNS,PROVIDER_SETUP_URLS,
} from '../services/provider-requests.ts';

const relay='https://model-router-provider-relay.model-router.workers.dev';
const account='0123456789abcdef0123456789abcdef';
const catalogues=[
 ['gemini','https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000'],
 ['openrouter','https://openrouter.ai/api/v1/models'],
 ['groq','https://api.groq.com/openai/v1/models'],
 ['cerebras','https://api.cerebras.ai/v1/models'],
 ['mistral','https://api.mistral.ai/v1/models'],
 ['cohere','https://api.cohere.ai/v1/models?endpoint=chat'],
 ['nvidia',relay+'/nvidia/models'],
 ['huggingface','https://router.huggingface.co/v1/models'],
 ['deepseek','https://api.deepseek.com/models'],
 ['alibaba','https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models'],
 ['cloudflare',relay+'/cloudflare/models?per_page=100&page=1'],
 ['aion','https://api.aionlabs.ai/v1/models'],
 ['openai','https://api.openai.com/v1/models'],
 ['anthropic','https://api.anthropic.com/v1/models?limit=100'],
 ['xai','https://api.x.ai/v1/models'],
 ['together','https://api.together.xyz/v1/models'],
 ['fireworks','https://api.fireworks.ai/inference/v1/models'],
 ['deepinfra','https://api.deepinfra.com/v1/openai/models'],
 ['sambanova','https://api.sambanova.ai/v1/models'],
 ['novita','https://api.novita.ai/v3/openai/models'],
 ['hyperbolic','https://api.hyperbolic.xyz/v1/models'],
 ['nebius','https://api.studio.nebius.com/v1/models'],
 ['scaleway','https://api.scaleway.ai/v1/models'],
 ['ovh','https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models'],
 ['siliconflow','https://api.siliconflow.com/v1/models'],
 ['chutes','https://llm.chutes.ai/v1/models'],
 ['featherless','https://api.featherless.ai/v1/models'],
 ['zai','https://api.z.ai/api/paas/v4/models'],
 ['moonshot','https://api.moonshot.ai/v1/models'],
 ['venice','https://api.venice.ai/api/v1/models'],
 ['baseten','https://inference.baseten.co/v1/models'],
];
const allKeys=()=>normalizeKeys({
 ...Object.fromEntries([...catalogues.map(([p])=>p),'perplexity'].map(p=>[p,'synthetic-'+p+'-key'])),
 providerAccess:Object.fromEntries([...catalogues.map(([p])=>p),'perplexity'].map(p=>[p,true])),
 cloudflareAccountId:account,
});
const headers=(provider,extra={})=>({
 ...(provider==='gemini'?{'x-goog-api-key':'synthetic-gemini-key'}:{authorization:'Bearer synthetic-'+provider+'-key'}),
 ...(provider==='anthropic'?{'x-api-key':'synthetic-anthropic-key','anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}:{}),
 ...(provider==='cloudflare'?{'x-mr-account-id':account}:{}),...extra,
});
function setup(io=async()=>new Response('synthetic'),initial=allKeys()){
 const scope=new AccountScope();scope.set('account-a');let keys=initial;
 const boundary=new NativeProviderRequests(scope,()=>keys,io);
 return {scope,boundary,setKeys:next=>{keys=next;}};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('canonical catalogue endpoints retain exact provider credentials without cookies or Firebase identity',async()=>{
 const seen=[];
 const {boundary}=setup(async request=>{seen.push(request);return new Response('synthetic');});
 for(const [provider,url] of catalogues){
  assert.equal(providerForRequest(url,'GET',allKeys()),provider);
  const response=await boundary.request(url,{headers:headers(provider),credentials:'include',redirect:'follow'});
  assert.equal(await response.text(),'synthetic');
 }
 assert.equal(seen.length,catalogues.length);
 for(const request of seen){
  assert.equal(request.credentials,'omit');assert.equal(request.redirect,'error');
  assert.equal(request.headers.has('x-ios-bundle-identifier'),false);
 }
 assert.equal(boundary.inFlight,0);
});

test('unapproved hosts, methods, paths and query parameters never reach provider IO',async()=>{
 let calls=0;const {boundary}=setup(async()=>{calls++;return new Response('unexpected');});
 const denied=[
  ['GET','https://api.openai.com.evil.test/v1/models'],
  ['GET','http://api.openai.com/v1/models'],
  ['GET','https://someone:secret@api.openai.com/v1/models'],
  ['GET','https://api.openai.com:8443/v1/models'],
  ['GET','https://api.openai.com/v1/models#fragment'],
  ['DELETE','https://api.openai.com/v1/models'],
  ['POST','https://api.openai.com/v1/models'],
  ['GET','https://api.openai.com/v1/chat/completions'],
  ['GET','https://api.openai.com/v1/models?key=secret'],
  ['GET','https://api.openai.com/v1/models/unknown'],
  ['GET','https://integrate.api.nvidia.com/v1/models'],
  ['GET','https://api.cloudflare.com/client/v4/accounts/'+account+'/ai/models/search'],
  ['GET','https://api.perplexity.ai/models'],
  ['GET','https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&pageSize=1000'],
  ['GET','https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=secret'],
  ['GET','https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&pageToken='],
  ['POST','https://generativelanguage.googleapis.com/v1beta/models/gemini-test:streamGenerateContent?alt=json'],
  ['POST','https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?alt=sse'],
  ['POST','https://generativelanguage.googleapis.com/v1beta/models/other-embedding:batchEmbedContents'],
  ['GET','https://api.cohere.ai/v1/models?endpoint=embed'],
  ['GET','https://api.anthropic.com/v1/models?limit=100&after_id=a&after_id=b'],
  ['GET',relay+'/cloudflare/models?per_page=100&page=101'],
  ['GET',relay+'/cloudflare/models?per_page=100&page=0'],
  ['GET',relay+'/openai/models'],
  ['GET',relay+'/perplexity/models'],
  ['POST',relay+'/nvidia/image'],
  ['GET','https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=synthetic'],
 ];
 for(const [method,url] of denied){
  assert.equal(providerForRequest(url,method,allKeys()),null,url);
  await assert.rejects(boundary.request(url,{method,headers:headers('openai')}),{code:'NATIVE_PROVIDER_DENIED'});
 }
 assert.equal(calls,0);
});

test('current saved keys and explicit extra-provider permission are both required',async()=>{
 let calls=0;const keys=allKeys();keys.providerAccess.openai=false;
 const {boundary,setKeys}=setup(async()=>{calls++;return new Response('synthetic');},keys);
 const url='https://api.openai.com/v1/models';
 await assert.rejects(boundary.request(url,{headers:headers('openai')}),{code:'NATIVE_PROVIDER_DENIED'});
 assert.equal(keys.providerAccess.openai,false,'request cannot activate consent');
 setKeys(allKeys());
 for(const credential of ['Bearer another-account-key','Bearer synthetic-groq-key','Bearer synthetic-openai-key ']){
  if(credential.endsWith(' '))continue; // Fetch trims boundary whitespace before policy sees it.
  await assert.rejects(boundary.request(url,{headers:{authorization:credential}}),{code:'NATIVE_PROVIDER_DENIED'});
 }
 for(const extra of [{'x-goog-api-key':'synthetic-gemini-key'},{cookie:'session=synthetic'},{'x-ios-bundle-identifier':'a.bundle'}]){
  await assert.rejects(boundary.request(url,{headers:headers('openai',extra)}),{code:'NATIVE_PROVIDER_DENIED'});
 }
 await assert.rejects(boundary.request('https://api.anthropic.com/v1/models?limit=100',{headers:{authorization:'Bearer synthetic-anthropic-key'}}),{code:'NATIVE_PROVIDER_DENIED'});
 await assert.rejects(boundary.request(relay+'/cloudflare/models?per_page=100&page=1',{headers:headers('cloudflare',{'x-mr-account-id':'f'.repeat(32)})}),{code:'NATIVE_PROVIDER_DENIED'});
 assert.equal(calls,0);
});

test('official selected Alibaba endpoints work while custom relay and other workspace destinations remain denied',async()=>{
 const keys=allKeys();keys.alibabaBaseUrl='https://workspace-a.us-east-1.maas.aliyuncs.com/compatible-mode/v1';
 const {boundary,setKeys}=setup(async()=>new Response('synthetic'),keys);
 const url=keys.alibabaBaseUrl+'/models';assert.equal(providerForRequest(url,'GET',keys),'alibaba');
 assert.equal(await (await boundary.request(url,{headers:headers('alibaba')})).text(),'synthetic');
 for(const other of ['https://workspace-b.us-east-1.maas.aliyuncs.com/compatible-mode/v1/models','https://workspace-a.invalid-region.maas.aliyuncs.com/compatible-mode/v1/models','https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models']){
  await assert.rejects(boundary.request(other,{headers:headers('alibaba')}),{code:'NATIVE_PROVIDER_DENIED'});
 }
 setKeys({...keys,providerRelayUrl:'https://custom-relay.example.test'});
 await assert.rejects(boundary.request(relay+'/nvidia/models',{headers:headers('nvidia')}),{code:'NATIVE_PROVIDER_DENIED'});
 await assert.rejects(boundary.request('https://custom-relay.example.test/nvidia/models',{headers:headers('nvidia')}),{code:'NATIVE_PROVIDER_DENIED'});
});

test('canonical PDF, image, nonstreaming helper and embedding payloads pass through without rewriting',async()=>{
 const cases=[
  ['openrouter','https://openrouter.ai/api/v1/chat/completions',{model:'fixture/free:free',stream:true,messages:[{role:'user',content:[{type:'file',file:{filename:'sample.pdf',file_data:'data:application/pdf;base64,c3ludGhldGlj'}}]}],plugins:[{id:'file-parser',pdf:{engine:'pdf-text'}}]}],
  ['openrouter','https://openrouter.ai/api/v1/chat/completions',{model:'fixture/free:free',max_tokens:256,messages:[{role:'user',content:'Synthetic title prompt'}]}],
  ['gemini','https://generativelanguage.googleapis.com/v1beta/models/gemini-test:streamGenerateContent?alt=sse',{contents:[{role:'user',parts:[{inlineData:{mimeType:'image/png',data:'c3ludGhldGlj'}}]}],tools:[{google_search:{}}]}],
  ['gemini','https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',{contents:[{role:'user',parts:[{text:'Synthetic helper'}]}],generationConfig:{maxOutputTokens:256}}],
  ['gemini','https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents',{requests:[{model:'models/gemini-embedding-001',content:{parts:[{text:'Synthetic document'}]},taskType:'RETRIEVAL_DOCUMENT',outputDimensionality:256}]}],
  ['anthropic','https://api.anthropic.com/v1/chat/completions',{model:'claude-test',stream:true,max_tokens:16000,messages:[{role:'user',content:'Synthetic message'}]}],
  ['cloudflare',relay+'/cloudflare/chat/completions',{model:'@cf/synthetic/model',stream:true,options:{rejectIfBusy:true},messages:[{role:'user',content:'Synthetic message'}]}],
  ['cloudflare',relay+'/cloudflare/image',{prompt:'Synthetic image',steps:4}],
  ['huggingface','https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',{inputs:'Synthetic image'}],
  ['perplexity','https://api.perplexity.ai/chat/completions',{model:'sonar',messages:[{role:'user',content:'Synthetic question'}]}],
 ];
 const seen=[];const {boundary}=setup(async request=>{seen.push([request.url,await request.text()]);return new Response('synthetic');});
 for(const [provider,url,body] of cases){
  assert.equal(providerForRequest(url,'POST',allKeys()),provider);
  const payload=JSON.stringify(body,null,1);
  const input=new Request(url,{method:'POST',headers:headers(provider,{'content-type':'application/json'}),body:payload,cache:'no-store',referrerPolicy:'no-referrer'});
  assert.equal(await (await boundary.request(input)).text(),'synthetic');
  assert.deepEqual(seen.at(-1),[url,payload]);
 }
});

test('pagination and key-safety requests retain their allowed canonical query forms',async()=>{
 const accepted=[
  ['gemini','https://generativelanguage.googleapis.com/v1beta/models?pageSize=1'],
  ['gemini','https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&pageToken=next%2Fpage'],
  ['openrouter','https://openrouter.ai/api/v1/key'],
  ['cohere','https://api.cohere.ai/v1/models?endpoint=chat&page_token=next%2Fpage'],
  ['anthropic','https://api.anthropic.com/v1/models?limit=100&after_id=next%2Fpage'],
  ['cloudflare',relay+'/cloudflare/models?per_page=100&page=100'],
  ['xai',relay+'/xai/models'],
 ];
 const {boundary}=setup();
 for(const [provider,url] of accepted){
  assert.equal(providerForRequest(url,'GET',allKeys()),provider);
  assert.equal(await (await boundary.request(url,{headers:headers(provider)})).text(),'synthetic');
 }
});

test('no account and account generation changes before dispatch cannot send requests',async()=>{
 let calls=0;const {scope,boundary}=setup(async()=>{calls++;return new Response('unexpected');});
 scope.set(null);await assert.rejects(boundary.request('https://api.groq.com/openai/v1/models',{headers:headers('groq')}),{name:'AbortError'});
 scope.set('account-a');const pending=boundary.request('https://api.groq.com/openai/v1/models',{headers:headers('groq')});scope.set('account-b');scope.set('account-a');
 await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,0);assert.equal(boundary.inFlight,0);
});

test('stalled headers stop promptly and late response bodies are canceled',async()=>{
 const entered=deferred(),late=deferred();let canceled=false;
 const {scope,boundary}=setup(async()=>{entered.resolve();return late.promise;});
 const pending=boundary.request('https://api.groq.com/openai/v1/models',{headers:headers('groq')});await entered.promise;
 scope.pause();await assert.rejects(pending,{name:'AbortError'});assert.equal(boundary.inFlight,0);
 late.resolve(new Response(new ReadableStream({cancel(){canceled=true;}})));
 await new Promise(resolve=>setImmediate(resolve));assert(canceled);
});

test('Stop, account switch, background and key invalidation cancel pending response reads',async t=>{
 for(const action of ['stop','switch','background','invalidate'])await t.test(action,async()=>{
  let canceled=false;const {scope,boundary}=setup(async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('synthetic'));},cancel(){canceled=true;}})));
  const cloudLease=scope.capture(),stop=new AbortController();
  const response=await boundary.request('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:headers('openrouter'),body:'{"model":"fixture/free:free","messages":[]}',signal:stop.signal});
  const reader=response.body.getReader();assert.equal(new TextDecoder().decode((await reader.read()).value),'synthetic');
  const waiting=reader.read();
  if(action==='stop')stop.abort();else if(action==='switch')scope.set('account-b');else if(action==='background')scope.pause();else boundary.invalidate();
  await assert.rejects(waiting,{name:'AbortError'});assert(canceled);assert.equal(boundary.inFlight,0);
  if(action==='stop'||action==='invalidate')assert(cloudLease.valid());
 });
});

test('response cancellation releases the request without waiting for uncooperative upstream cancellation',async()=>{
 let canceled=false;const {boundary}=setup(async()=>new Response(new ReadableStream({cancel(){canceled=true;return new Promise(()=>{});}})));
 const response=await boundary.request('https://api.groq.com/openai/v1/models',{headers:headers('groq')});
 await response.body.cancel();assert(canceled);assert.equal(boundary.inFlight,0);
});

test('a changed credential or revoked permission cannot publish delayed response data',async()=>{
 for(const change of ['credential','permission']){
  const entered=deferred(),late=deferred();let canceled=false;
  const {boundary,setKeys}=setup(async()=>{entered.resolve();return late.promise;});
  const pending=boundary.request('https://api.openai.com/v1/models',{headers:headers('openai')});await entered.promise;
  const changed=allKeys();if(change==='credential')changed.openai='synthetic-replacement-key';else changed.providerAccess.openai=false;setKeys(changed);
  late.resolve(new Response(new ReadableStream({cancel(){canceled=true;}})));
  await assert.rejects(pending,{name:'AbortError'});assert(canceled);assert.equal(boundary.inFlight,0);
 }
});

test('exported shell policy covers canonical hosts and reviewed workspace patterns without arbitrary destinations',()=>{
 for(const url of [
  'https://api.openai.com/v1/models','https://api.cohere.ai/v1/models?endpoint=chat',
  relay+'/nvidia/models','https://dashscope-us.aliyuncs.com/compatible-mode/v1/models',
 ]){
  const parsed=new URL(url);assert(PROVIDER_ORIGINS.includes(parsed.origin));assert(PROVIDER_HOSTS.includes(parsed.hostname));
  assert(PROVIDER_HOST_PATTERNS.some(pattern=>new RegExp('^(?:'+pattern+')$').test(parsed.hostname)));
 }
 assert(PROVIDER_CONNECT_SOURCES.includes('https://*.us-east-1.maas.aliyuncs.com'));
 assert(PROVIDER_HOST_PATTERNS.some(pattern=>new RegExp('^(?:'+pattern+')$').test('workspace-a.us-east-1.maas.aliyuncs.com')));
 for(const host of ['api.openai.com.evil.test','evil.example.test','workspace-a.evil.maas.aliyuncs.com']){
  assert(!PROVIDER_HOST_PATTERNS.some(pattern=>new RegExp('^(?:'+pattern+')$').test(host)));
 }
 for(const url of ['https://openrouter.ai/keys','https://aistudio.google.com/apikey','https://platform.openai.com/api-keys'])assert(PROVIDER_SETUP_URLS.includes(new URL(url).href));
 assert(!PROVIDER_SETUP_URLS.includes('https://example.test/keys'));
});
