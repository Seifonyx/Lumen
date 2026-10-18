import assert from 'node:assert/strict';
import {catalog,setKeys,complete} from '../../src/lib/ai/providers.js';
import {runChat} from '../../src/lib/ai/chat.js';
setKeys({gemini:'budget-google',groq:'budget-groq',openrouter:'budget-openrouter'});const bodies=[];let googleRejected=false;
globalThis.fetch=async(url,options={})=>{
 const google=String(url).includes('googleapis');
 if(String(url).includes('/models?'))return Response.json({models:[{name:'models/gemini-2.5-flash',inputTokenLimit:128000,outputTokenLimit:500,supportedGenerationMethods:['generateContent']}]});
 if(String(url).endsWith('/models'))return Response.json({data:google?[]:String(url).includes('groq')?[{id:'budget-chat',context_window:128000,max_output_tokens:500}]:[{id:'budget/chat:free',context_length:128000,top_provider:{max_completion_tokens:500},pricing:{prompt:'0',completion:'0'}}]});
 const body=JSON.parse(options.body);bodies.push(body);
 if(google&&!googleRejected) {googleRejected=true;return Response.json({error:{message:'Unsupported thinking configuration'}},{status:400});}
 if(!body.stream&&!String(url).includes('streamGenerate'))return Response.json({candidates:[{content:{parts:[{text:'One shot'}]}}]});
 return new Response('data: '+JSON.stringify(google?{candidates:[{content:{parts:[{text:'Budgeted answer'}]},finishReason:'STOP'}]}:{choices:[{delta:{content:'Budgeted answer'},finish_reason:'stop'}]})+'\n\n');
};
await catalog();
for(const id of ['gemini:gemini-2.5-flash','groq:budget-chat','openrouter:budget/chat:free']) {
 bodies.length=0;for await(const _event of runChat({model:id,messages:[{role:'user',text:'Hello'}],options:{maxTokens:8192}},new AbortController().signal)){}
 assert(bodies.length>0);for(const body of bodies)assert.equal(id.startsWith('gemini')?body.generationConfig?.maxOutputTokens:body.max_tokens,500,'the declared output allowance survives every provider call and safe thinking retry');
}
bodies.length=0;await complete({provider:'gemini',name:'gemini-2.5-flash'},'Hello',{maxTokens:8192});assert.equal(bodies[0].generationConfig.maxOutputTokens,500,'one-shot helpers honor reported output maxima');
setKeys({});console.log('PASS explicit output budgets and provider output limits survive streaming and safe parameter adjustment');
