import assert from 'node:assert/strict';
import {setKeys,probeModel} from '../../src/lib/ai/providers.js';
import {summarize,makeTitle} from '../../src/lib/ai/chat.js';
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
setKeys({groq:'title-attempt-usage'});let calls=0;const reports=[];
globalThis.fetch=async()=>++calls===1?Response.json({error:{message:'Overloaded'}},{status:503}):Response.json({choices:[{message:{content:'Clear chat title'},finish_reason:'stop'}],usage:{prompt_tokens:12,completion_tokens:3}});
const titled=await makeTitle('Original request','groq:first',()=>false,['groq:first','groq:second'],(id,info)=>reports.push({id,...info}));
assert.equal(titled?.title,'Clear chat title');assert.equal(reports.length,2,'every attempted title completion, including a failed attempt, must report usage');
assert.equal(reports[0].status,503);assert.equal(reports[1].input,12);assert.equal(reports[1].output,3);
const aborter=new AbortController(),cancelReports=[];let entered;
const started=new Promise(resolve=>{entered=resolve;});
globalThis.fetch=async()=>{entered();return new Promise(()=>{});};
const cancelled=summarize('Original request',['groq:first'],{signal:aborter.signal,report:(id,info)=>cancelReports.push({id,...info})});
await started;aborter.abort();assert.equal(await cancelled,null);
assert.equal(cancelReports.length,1,'a started helper request still counts once when stopped before a response');
setKeys({});console.log('PASS helpers reject truncation, preserve budgets and report every title attempt');
