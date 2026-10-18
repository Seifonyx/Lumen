import assert from 'node:assert/strict';
import {planLayout} from '../../src/lib/layout-policy';
import {catalog,setKeys} from '../../src/lib/ai/providers.js';
import {runChat} from '../../src/lib/ai/chat.js';
setKeys({gemini:'synthetic-review-key'});
let downgraded=false; const calls:string[]=[];
globalThis.fetch=async(url:any,init:any)=>{
 if(String(url).includes('/models?')) return Response.json({models:['gemini-2.5-pro','gemini-2.5-flash'].map(name=>({name:`models/${name}`,displayName:name,inputTokenLimit:downgraded && name.endsWith('flash')?16000:262144,supportedGenerationMethods:['generateContent']}))});
 const name=/models\/([^:]+):/.exec(String(url))![1];calls.push(name);
 if(name==='gemini-2.5-pro') {downgraded=true; await catalog({refresh:true}); return Response.json({error:{message:'Temporary outage'}},{status:503});}
 return new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Incompatible backup answered'}]},finishReason:'STOP'}]})+'\n\n');
};
const registry=await catalog();
const layout={id:'saved',name:'Saved',icon:'layers',description:'',mode:'order',models:registry.models.map(m=>m.id),fallback:'layout',requirements:{minContext:200000}} as any;
layout.models=['gemini:gemini-2.5-pro','gemini:gemini-2.5-flash'];
const plan=planLayout(layout,{selected:'layout:saved',enabled:layout.models,catalog:registry.models,text:'Hello',files:[],conversationTokens:100,search:false,blocked:()=>false,left:()=>null},true);
const events=[];
for await(const event of runChat({model:plan.model,fallbacks:plan.fallbacks,messages:[{role:'user',text:'Hello'}],options:{modelRequirements:layout.requirements,preserveOrder:true,preferredModels:layout.models,modelCapabilities:Object.fromEntries(registry.models.map(m=>[m.id,m]))}},new AbortController().signal))events.push(event);
assert.deepEqual(calls,['gemini-2.5-pro'],'refreshed backup must still satisfy immutable layout requirements');
assert(!events.some(e=>e.t==='text'));assert(events.some(e=>e.t==='error'));
console.log('PASS runtime fallback revalidates persisted layout requirements after a metadata downgrade');
setKeys({});
