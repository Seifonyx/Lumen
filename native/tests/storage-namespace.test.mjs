import test from 'node:test';import assert from 'node:assert/strict';
import {namespacedStorage} from '../integration/storage-namespace.ts';
test('real-account local storage cannot adopt or delete legacy Demo/test data',()=>{
 const data=new Map([['mr.account.same-uid','legacy-test-settings']]);
 const raw={get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear()};
 const scoped=namespacedStorage(raw,'lumen.account.the-model-router.');
 assert.equal(scoped.getItem('mr.account.same-uid'),null);scoped.setItem('mr.account.same-uid','real-settings');
 assert.equal(raw.getItem('mr.account.same-uid'),'legacy-test-settings');assert.equal(scoped.getItem('mr.account.same-uid'),'real-settings');
 assert.deepEqual(Object.keys(scoped),['mr.account.same-uid']);assert.equal(scoped.length,1);assert.equal(scoped.key(0),'mr.account.same-uid');
 scoped.clear();assert.equal(raw.getItem('mr.account.same-uid'),'legacy-test-settings');assert.equal(scoped.length,0);
});
