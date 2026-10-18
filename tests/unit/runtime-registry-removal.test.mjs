import assert from 'node:assert/strict';
import {catalog,setKeys} from '../../src/lib/ai/providers.js';
import {runChat,summarize,makeTitle} from '../../src/lib/ai/chat.js';
setKeys({gemini:'registry-removal-credential'});let removed=false;const calls=[];
globalThis.fetch=async url=>{
 if(String(url).includes('/models?'))return Response.json({models:(removed?['gemini-primary']:['gemini-primary','gemini-backup']).map(name=>({name:`models/${name}`,inputTokenLimit:128000,supportedGenerationMethods:['generateContent']}))});
 const name=/models\/([^:]+):/.exec(String(url))[1];calls.push(name);
 if(name==='gemini-primary') {removed=true;await catalog({refresh:true});return Response.json({error:{message:'Overloaded'}},{status:503});}
 return new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Removed backup must never run'}]},finishReason:'STOP'}]})+'\n\n');
};
const original=await catalog();const events=[];
for await(const event of runChat({model:'gemini:gemini-primary',fallbacks:['gemini:gemini-backup'],messages:[{role:'user',text:'Hello'}],options:{modelCapabilities:Object.fromEntries(original.models.map(model=>[model.id,model]))}},new AbortController().signal))events.push(event);
assert.deepEqual(calls,['gemini-primary'],'request snapshots cannot resurrect a removed current registry entry');assert(!events.some(event=>event.t==='text'));assert(events.some(event=>event.t==='error'));
for(const mode of ['summary','title']) {
 setKeys({gemini:`helper-removal-${mode}`});removed=false;calls.length=0;
 await catalog();
 const result=mode==='summary'?await summarize('Original private source',['gemini:gemini-primary','gemini:gemini-backup']):await makeTitle('Original private source','gemini:gemini-primary',()=>false,['gemini:gemini-primary','gemini:gemini-backup']);
 assert.equal(result,null);
 assert.deepEqual(calls,['gemini-primary'],`${mode} cannot send a frozen helper source to a removed backup`);
}
setKeys({});console.log('PASS live registry removal outranks older chat, summary and title candidate snapshots');
