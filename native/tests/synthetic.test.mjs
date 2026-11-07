import test from 'node:test';
import assert from 'node:assert/strict';
import {replyText,replyStream,DEMO_MODELS} from '../demo/synthetic.ts';

test('catalog preserves installed selections and labels both models as local',()=>{
 assert.equal(DEMO_MODELS[0].name,'models/gemini-flash-latest');
 assert.equal(DEMO_MODELS.length,2);
 assert(DEMO_MODELS.every(m=>m.displayName.startsWith('Local demo')));
});
test('Study produces explicitly artificial sample content, never claims source analysis',()=>{
 const text=replyText(JSON.stringify({contents:[{parts:[{text:'Make study material from the material below ("demo").'}]}]}));
 const deck=JSON.parse(text);assert.match(deck.title,/sample/i);
 assert(deck.cards.length>=3&&deck.quiz.length>=2);assert.match(deck.cards[0].a,/not.*source/i);
 assert.match(replyText('{}'),/Offline demonstration/);
 assert.match(replyText('{invalid'),/Offline demonstration/);
});
test('stream emits incremental SSE text and a final finish reason',async()=>{
 const response=new Response(replyStream('A sample reply long enough for multiple chunks.',undefined,1));
 const text=await response.text(),events=text.trim().split('\n\n').map(s=>JSON.parse(s.slice(6)));
 assert(events.length>2);assert.equal(events.at(-1).candidates[0].finishReason,'STOP');
 assert.equal(events.slice(0,-1).map(e=>e.candidates[0].content.parts[0].text).join(''),'A sample reply long enough for multiple chunks.');
});
test('aborted and canceled streams stop without late output',async()=>{
 const abort=new AbortController(),reader=replyStream('A sample reply with enough text to cancel.',abort.signal,1).getReader();
 assert.equal((await reader.read()).done,false);abort.abort();
 await assert.rejects(reader.read(),{name:'AbortError'});
 const prior=new AbortController();prior.abort();
 await assert.rejects(new Response(replyStream('x',prior.signal)).text(),{name:'AbortError'});
 const canceled=replyStream('x',undefined,1).getReader();await canceled.cancel();assert.equal((await canceled.read()).done,true);
});
