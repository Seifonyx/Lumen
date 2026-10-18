import assert from 'node:assert/strict';
import {setKeys,openStream} from '../../src/lib/ai/providers.js';
setKeys({gemini:'parameter-recovery-fixture'});
const request=()=>openStream({provider:'gemini',name:'gemini-2.5-flash'},[{role:'user',text:'Original request'}],{instructions:'',search:true,maxTokens:512,signal:new AbortController().signal});
for(const message of ['The input token count (194873) exceeds the maximum number of tokens allowed (131072).','Invalid JSON payload: bad schema','Unsupported generation configuration','Unsupported parameter response_format','Unsupported modality audio']) {
 let calls=0;
 globalThis.fetch=async()=>{calls++;return calls===1?Response.json({error:{status:'INVALID_ARGUMENT',message}},{status:400}):new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'A repeated invalid request must not run'}]},finishReason:'STOP'}]})+'\n\n');};
 const result=await request();assert.equal(calls,1,'only an identified thinking-parameter incompatibility authorizes parameter adjustment');assert.equal(result.ok,false);assert.equal(result.message,message);
}
for(const message of ['Unknown name "thinkingConfig" at "generation_config": Cannot find field.','includeThoughts is not supported for this model']) {
const bodies=[];
globalThis.fetch=async(_url,options)=>{bodies.push(JSON.parse(options.body));return bodies.length===1?Response.json({error:{message}},{status:400}):new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Recovered'}]},finishReason:'STOP'}]})+'\n\n');};
const recovered=await request();assert.equal(recovered.ok,true);assert.equal(bodies.length,2);assert(bodies[0].generationConfig.thinkingConfig);assert.equal(bodies[1].generationConfig.thinkingConfig,undefined);assert.equal(bodies[1].generationConfig.maxOutputTokens,512);assert.deepEqual(bodies[1].tools,bodies[0].tools,'safe adjustment preserves search consent and tools');
for await(const _event of recovered.events){}
}
setKeys({});console.log('PASS Gemini only retries identified thinking incompatibility, preserving output/tool consent');
