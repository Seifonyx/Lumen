import assert from 'node:assert/strict';
import { test } from 'node:test';
import { libraryItems, discoverItems, availability } from '../../src/lib/library-items';
import type { Chat, Attachment } from '../../src/types';
const file: Attachment = { id:'file', name:'Budget.csv', kind:'text', mime:'text/csv', size:120, text:'month,total\nMay,10' };
const chats = [{ id:'one',title:'Research',projectId:'p',documents:[{id:'doc',name:'Plan.md',content:'Find this passage',updatedAt:20}],messages:[{id:'m1',role:'user',createdAt:10,files:[file,{...file,id:'auto',auto:true},{...file,id:'video',videoUri:'https://youtu.be/fixture'}]},{id:'m2',role:'assistant',createdAt:30,files:[file,{...file,id:'made',name:'Report.txt'}]}]},{id:'two',title:'Second',messages:[{id:'m',role:'user',createdAt:40,files:[file]}]},{id:'temporary-secret',title:'Private',messages:[{id:'m',role:'user',createdAt:50,files:[file]}]}] as unknown as Chat[];
test('Library excludes private/automatic/video context, deduplicates within a chat and retains separate owners',()=>{
 const items=libraryItems(chats);assert.equal(items.length,4);assert.equal(items.filter(i=>i.kind==='generated').length,1);assert.equal(items.filter(i=>i.kind==='files').length,2);
});
test('Discovery scopes full document text, chat title and project, with deterministic sort',()=>{
 const items=libraryItems(chats);assert.equal(discoverItems(items,{kind:'all',query:'passage',project:'p',sort:'newest'})[0].kind,'documents');assert.equal(discoverItems(items,{kind:'all',query:'Second',project:'p',sort:'name'}).length,0);assert.equal(discoverItems(items,{kind:'all',query:'',project:'',sort:'oldest'})[0].at,10);
});
test('Availability distinguishes extracted text, thumbnail and saved original without promising sync',()=>{
 assert.equal(availability(file),'Extracted text available');assert.equal(availability({...file,text:undefined,thumb:'data:image/png;base64,AA=='}),'Preview only · original unavailable here');assert.equal(availability({...file,text:undefined,stored:true}),'Saved original · open to retrieve');assert.equal(availability({...file,text:undefined}),'Original not loaded on this device');
});
