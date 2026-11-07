import test from 'node:test';import assert from 'node:assert/strict';
import {pendingDeletions,queueDeletion} from '../integration/pending-deletions.ts';
import {patchSync} from '../services/patches.mjs';import {readFileSync} from 'node:fs';
test('native pending deletes survive fresh readers, isolate owners and reject corrupt state',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 queueDeletion('a','one',storage);queueDeletion('a','one',storage);queueDeletion('b','other',storage);
 assert.deepEqual(pendingDeletions('a',storage),['one']);assert.deepEqual(pendingDeletions('b',storage),['other']);
 queueDeletion('a','temporary-private',storage);queueDeletion('preview-native-demo-a','demo',storage);assert.deepEqual(pendingDeletions('preview-native-demo-a',storage),[]);
 values.set('mr.sync.deletes.a','[1]');assert.throws(()=>queueDeletion('a','two',storage));assert.equal(values.get('mr.sync.deletes.a'),'[1]');
});
test('canonical sync adaptation fails closed when upstream acknowledgment/snapshot contracts change',()=>{
 const code=readFileSync('src/lib/sync.ts','utf8'),patched=patchSync(code);
 assert(patched.includes('if (snap.metadata.fromCache) return;'));assert(patched.includes('{includeMetadataChanges:true}'));
 assert(!patched.includes('save(`mr.sync.deletes.${this.uid}`, []);'));
 assert.throws(()=>patchSync(code.replace('private async removeNow','private async changed')),/Unknown canonical sync/);
});
