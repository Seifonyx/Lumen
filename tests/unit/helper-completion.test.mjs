import assert from 'node:assert/strict';
import {setKeys,probeModel} from '../../src/lib/ai/providers.js';
import {summarize} from '../../src/lib/ai/chat.js';
for(const provider of ['gemini','groq']) {
 setKeys({[provider]:`helper-completion-${provider}`});const budgets=[];
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);budgets.push(body.generationConfig?.maxOutputTokens || body.max_tokens);
  const text=budgets.length===1?'This incomplete replacement context stopped in the middle of a sentence':'Complete authorized replacement context preserves the original facts.';
  return Response.json(provider==='gemini'?{candidates:[{content:{parts:[{text}]},finishReason:budgets.length===1?'MAX_TOKENS':'STOP'}]}:{choices:[{message:{content:text},finish_reason:budgets.length===1?'length':'stop'}]});
 };
 const result=await summarize('Source',[`${provider}:first`,`${provider}:second`],{maxTokens:128});
 assert.equal(result?.model,`${provider}:second`,'truncated helper output must not replace complete source context');
 assert.deepEqual(budgets,[128,128],'recovery preserves the authorized output budget');
 budgets.length=0;
 const first=await probeModel(`${provider}:first`,new AbortController().signal);
 assert.equal(first.status,200,'a tiny truncated diagnostic remains a numeric successful HTTP response with no completed text');
 assert.equal(first.text,'');
 const second=await probeModel(`${provider}:first`,new AbortController().signal,{maxTokens:512});
 assert(second.text,'the existing authorized larger diagnostic can verify a reasoning model');
 assert.deepEqual(budgets,[48,512]);
}
setKeys({});console.log('PASS helpers reject provider-declared truncation and use only authorized budgeted backups');
