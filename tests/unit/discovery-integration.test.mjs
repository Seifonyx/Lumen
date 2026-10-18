import assert from 'node:assert/strict';
import { catalog, modelCapabilities, setKeys } from '../../src/lib/ai/providers.js';
const gemini = name=>({name:`models/${name}`,displayName:name,inputTokenLimit:64000,outputTokenLimit:8192,supportedGenerationMethods:['generateContent']});
let status=200,calls=0;
globalThis.fetch=async()=>{calls++;return status===200?Response.json({models:[gemini('gemini-flash-latest')]}):Response.json({error:{message:'Temporary service failure'}},{status});};
setKeys({gemini:'synthetic-first'});
let [a,b]=await Promise.all([catalog({refresh:true}),catalog({refresh:true})]);
assert.equal(calls,1);assert.deepEqual(a,b);
assert.equal(a.models[0].outputLimit,8192);
assert.equal(a.models[0].metadata.fields.vision,'inferred');
status=503;a=await catalog({refresh:true});
assert.equal(a.models.length,1);assert.equal(a.models[0].metadata.stale,true);
assert.equal(a.providerStatus.gemini.state,'stale');
status=401;a=await catalog({refresh:true});
assert.equal(a.models.length,0);assert.equal(modelCapabilities('gemini:gemini-flash-latest'),undefined);
status=200;await catalog({refresh:true});
setKeys({gemini:'synthetic-replacement'});status=503;a=await catalog({refresh:true});
assert.equal(a.models.length,0,'new credentials cannot inherit old accessible metadata');

// Native Anthropic lists use cursor pagination and type=model, not a chat-specific type.
setKeys({anthropic:'synthetic-claude',providerAccess:{anthropic:true}});calls=0;
globalThis.fetch=async(url,init)=>{calls++;assert.equal(new Headers(init.headers).get('x-api-key'),'synthetic-claude');
 if(calls===1)return Response.json({data:[{id:'claude-first',type:'model',display_name:'First'}],has_more:true,last_id:'claude-first'});
 assert(String(url).includes('after_id=claude-first'));
 return Response.json({data:[{id:'claude-second',type:'model'}],has_more:false});};
a=await catalog();assert.deepEqual(a.models.map(m=>m.id),['anthropic:claude-first','anthropic:claude-second']);assert.equal(calls,2);

// Explicit API negatives outrank a suggestive family name; retain provenance and limits.
setKeys({groq:'synthetic-groq'});
globalThis.fetch=async()=>Response.json({data:[{id:'qwen3-vision-thinking',context_window:128000,max_output_tokens:4096,reasoning:false,capabilities:{vision:false,function_calling:true,json_schema:false}}]});
a=await catalog();assert.equal(a.models[0].thinking,false);assert.equal(a.models[0].vision,false);
assert.equal(a.models[0].metadata.fields.vision,'api');assert.equal(a.models[0].metadata.fields.thinking,'api');
assert.equal(a.models[0].tools,true);assert.equal(a.models[0].structuredOutput,false);assert.equal(a.models[0].outputLimit,4096);

setKeys({gemini:'synthetic-secret-do-not-display'});
globalThis.fetch=async()=>Response.json({error:{message:'Rejected key synthetic-secret-do-not-display'}},{status:401});
a=await catalog();assert(!JSON.stringify(a).includes('synthetic-secret-do-not-display'));
setKeys({});
console.log('PASS adapter dedupe, stale/failed-key eviction, credential replacement, native pagination, authoritative negatives and secret redaction');
