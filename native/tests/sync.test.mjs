import test from 'node:test';import assert from 'node:assert/strict';
import {AccountScope} from '../integration/scope.ts';
import {AccountSync,Connectivity,MemoryReplica,ReplicaDriver} from '../integration/sync.ts';
const chat=(id,text,rev=1)=>({id,title:text,createdAt:1,updatedAt:rev,rev,messages:[{id:'m',role:'user',text,createdAt:1}]});
const tick=()=>new Promise(r=>setTimeout(r,0));
function client(scope,replica,owner,items){return new AccountSync(owner,scope,{local:id=>items.get(id),allLocal:()=>[...items.values()],apply:c=>items.set(c.id,c),remove:id=>items.delete(id),error:e=>{throw Error(e);}},(uid,h)=>new ReplicaDriver(uid,h,replica));}
test('two synthetic clients sync/replay local changes, deletes and ignore incognito',async()=>{
 const r=new MemoryReplica(),a=new AccountScope(),b=new AccountScope();a.set('a');b.set('a');const one=new Map(),two=new Map();
 const x=client(a,r,'a',one),y=client(b,r,'a',two);x.start();y.start();one.set('c',chat('c','first'));x.push(one.get('c'));await tick();assert.equal(two.get('c').title,'first');
 a.pause();one.set('c',chat('c','offline edit',2));x.push(one.get('c'));assert.equal(two.get('c').title,'first');a.resume();await tick();assert.equal(two.get('c').title,'offline edit');
 x.push(chat('temporary-private','never sync',3));await tick();assert(!two.has('temporary-private'));
 a.pause();one.delete('c');x.remove('c');a.resume();await tick();assert(!two.has('c'));assert(!one.has('c'));x.stop();y.stop();
});
test('account/driver stop drops delayed callbacks and never pulls another owner',async()=>{
 const scope=new AccountScope();scope.set('a');let captured;const items=new Map();
 const sync=new AccountSync('a',scope,{local:id=>items.get(id),allLocal:()=>[],apply:c=>items.set(c.id,c),remove:()=>{},error:()=>{}},(_u,h)=>{captured=h;return{start(){},stop(){},push(){},remove(){}};});
 sync.start();const old=captured;scope.set('b');old.apply(chat('secret','A'));assert.equal(items.size,0);
 scope.set('a');sync.stop();captured.apply(chat('late','A'));assert.equal(items.size,0);
 const r=new MemoryReplica(),other=new Map();const scoped=client(scope,r,'a',other);scoped.start();r.put('b',chat('foreign','B'));await tick();assert.equal(other.size,0);scoped.stop();
});

import {MemoryAccountSettings} from '../integration/settings.ts';
test('synthetic project/settings port is account-bound and rejects stale leases',async()=>{
 const scope=new AccountScope(),settings=new MemoryAccountSettings();scope.set('a');const lease=scope.capture();
 await settings.write('a',{projects:[{id:'p',name:'sample'}]},lease);assert.equal((await settings.read('a',lease)).projects[0].id,'p');
 scope.set('b');await assert.rejects(settings.write('a',{projects:[]},lease),{name:'AbortError'});assert.equal(await settings.read('b',scope.capture()),null);
});
test('offline deletion survives a synthetic account client restart',async()=>{
 const scope=new AccountScope(),r=new MemoryReplica(),items=new Map([['c',chat('c','old')]]),outbox=new Set();scope.set('a');
 const h={local:id=>items.get(id),allLocal:()=>[...items.values()],apply:c=>items.set(c.id,c),remove:id=>items.delete(id),error:()=>{}};
 const make=()=>new AccountSync('a',scope,h,(uid,handlers)=>new ReplicaDriver(uid,handlers,r),outbox);
 const first=make();first.start();scope.pause();items.delete('c');first.remove('c');first.stop();scope.set('b');scope.set('a');scope.resume();
 const reopened=make();reopened.start();await tick();assert(!items.has('c'));assert(r.list('a').some(row=>row.id==='c'&&row.chat===null));reopened.stop();
});

test('foreground offline sync defers writes/deletes and incoming rows until online replay',async()=>{
 const scope=new AccountScope(),r=new MemoryReplica(),online=new Connectivity(),items=new Map([['c',chat('c','local')]]);scope.set('a');
 const h={local:id=>items.get(id),allLocal:()=>[...items.values()],apply:c=>items.set(c.id,c),remove:id=>items.delete(id),error:()=>{}};
 const sync=new AccountSync('a',scope,h,(uid,handlers)=>new ReplicaDriver(uid,handlers,r),new Set(),online);sync.start();
 online.set(false);assert(scope.active,'offline must not disable the local provider');
 items.set('c',chat('c','offline edit',2));sync.push(items.get('c'));r.put('a',chat('remote','other client',3));await tick();
 assert.equal(r.list('a').find(row=>row.id==='c').chat.title,'local');assert(!items.has('remote'));
 online.set(true);await tick();assert.equal(items.get('remote').title,'other client');assert.equal(r.list('a').find(row=>row.id==='c').chat.title,'offline edit');
 online.set(false);items.delete('c');sync.remove('c');online.set(true);await tick();assert(!items.has('c'));assert(r.list('a').find(row=>row.id==='c').chat===null);sync.stop();
});
