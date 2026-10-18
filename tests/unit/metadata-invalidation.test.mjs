import assert from 'node:assert/strict';
import * as providers from '../../src/lib/ai/providers.js';
assert.equal(typeof providers.invalidateModelMetadata,'function','runtime failures need scoped metadata invalidation');
const original=Date.now;let now=1800000000000;Date.now=()=>now;
const calls={gemini:0,openrouter:0};globalThis.window=new EventTarget();const events=[];window.addEventListener('mr:model-metadata-invalidated',event=>events.push(event.detail));
globalThis.fetch=async url=>{const gemini=String(url).includes('generativelanguage');calls[gemini?'gemini':'openrouter']++;return Response.json(gemini?{models:[{name:'models/gemini-fixture',inputTokenLimit:128000,supportedGenerationMethods:['generateContent']}]}:{data:[{id:'vendor/model:free',pricing:{prompt:'0',completion:'0'},context_length:128000}]});};
try {
 providers.setKeys({gemini:'invalidate-google',openrouter:'invalidate-openrouter'});await providers.catalog();assert.deepEqual(calls,{gemini:1,openrouter:1});
 assert.equal(providers.invalidateModelMetadata('gemini:gemini-fixture'),true);assert.deepEqual(events,[{provider:'gemini'}]);
 await providers.catalog();assert.deepEqual(calls,{gemini:2,openrouter:1},'only invalidated provider bypasses its current TTL');
 now+=1000;assert.equal(providers.invalidateModelMetadata('gemini:gemini-fixture'),false);await providers.catalog();assert.equal(calls.gemini,2,'repeated failures do not create a discovery loop');
 now+=60001;assert.equal(providers.invalidateModelMetadata('gemini:gemini-fixture'),true);await providers.catalog();assert.equal(calls.gemini,3);
 providers.setKeys({gemini:'replacement-google'});assert.equal(providers.invalidateModelMetadata('openrouter:vendor/model:free'),false,'disconnected old providers cannot trigger refresh');
}finally{providers.setKeys({});Date.now=original;delete globalThis.window;}
console.log('PASS targeted runtime metadata expiry, TTL reconciliation, repeated-failure throttle and disconnected scope guard');
