import assert from 'node:assert/strict';
import { messageStops, overviewStops, stopAtIndex } from '../../src/lib/message-navigation';
import type { Message } from '../../src/types';
const messages: Message[] = [
  { id:'a', role:'user',text:'First\nquestion',createdAt:1 },
  { id:'b', role:'assistant',text:'Reply',createdAt:2 },
  { id:'c', role:'user',auto:'files',text:'Automatic context',createdAt:3 },
  { id:'d', role:'user',text:'',files:[{id:'f',name:'protocol.pdf',kind:'pdf',size:1,mime:'application/pdf'}],createdAt:4 },
  { id:'e', role:'user',auto:'repository',text:'Repository change',createdAt:5 },
];
assert.deepEqual(messageStops(messages),[
  {id:'a',index:0,ordinal:1,preview:'First question'},
  {id:'d',index:3,ordinal:2,preview:'protocol.pdf'},
]);
assert.equal(stopAtIndex(messageStops(messages),2),'a');
assert.equal(stopAtIndex(messageStops(messages),4),'d');
assert.equal(stopAtIndex([],42),null);
const many=messageStops(Array.from({length:1000},(_,i)=>({id:String(i),role:'user',text:'Question '+i,createdAt:i})));
for(const capacity of [0,1,2,3,5,8]){
 const sampled=overviewStops(many,capacity,'541');
 assert.ok(sampled.length<=capacity);assert.equal(new Set(sampled.map(s=>s.id)).size,sampled.length);
 assert.ok(sampled.every((s,i)=>!i||s.index>sampled[i-1].index));
 if(capacity>=2){assert.equal(sampled[0].id,'0');assert.equal(sampled.at(-1)?.id,'999')}
 if(capacity>=3)assert.ok(sampled.some(s=>s.id==='541'));
}
assert.equal(messageStops([{...messages[0],text:'x'.repeat(100000)}])[0].preview.length,120);
assert.equal(overviewStops(messageStops(messages),8,null).length,2);
console.log('PASS sent-turn filtering, attachment previews, bounded overview, active stop inclusion and index lookup');
