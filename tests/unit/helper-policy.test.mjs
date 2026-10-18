import assert from 'node:assert/strict';
import {catalog,setKeys} from '../../src/lib/ai/providers.js';
import {summarize} from '../../src/lib/ai/chat.js';

for(const requirement of [{minContext:100000},{capabilities:['vision']},{noReasoning:true}]) {
 setKeys({groq:`helper-policy-${JSON.stringify(requirement)}`});let downgraded=false;const calls=[];
 globalThis.fetch=async url=>{
  if(String(url).endsWith('/models'))return Response.json({data:['primary','fixture-r1'].map(id=>({id,context_window:downgraded?32000:128000,input_modalities:downgraded?['text']:['text','image'],reasoning:downgraded}))});
  calls.push(String(url));downgraded=true;await catalog({refresh:true});
  return Response.json({error:{message:'Overloaded'}},{status:503});
 };
 await catalog();
 await summarize('Original source',['groq:primary','groq:fixture-r1'],{modelRequirements:requirement});
 assert.equal(calls.length,1,'every summary fallback must recheck saved context/capability/reasoning requirements');
}
setKeys({});console.log('PASS helper saved requirements survive metadata downgrades between attempts');
