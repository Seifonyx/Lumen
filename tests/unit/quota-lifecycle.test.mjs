import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'rolldown';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const output=mkdtempSync(join(tmpdir(),'lumen-quota-lifecycle-'));
const file=join(output,'quota-fixture.mjs');
await build({input:'src/lib/quota.ts',output:{file,format:'esm'},logLevel:'silent',plugins:[{
  name:'isolated-quota-lifecycle',
  resolveId(source,importer) {
    if (source === 'firebase/firestore') return '\0firestore';
    if (importer?.endsWith('quota.ts') && source === './firebase') return '\0firebase';
    if (importer?.endsWith('quota.ts') && source === './usage') return '\0usage';
  },
  load(id) {
    if (id === '\0firebase') return 'export const db={};';
    if (id === '\0usage') return 'export const nextReset=()=>globalThis.__quotaLifecycle.now+86400000;';
    if (id === '\0firestore') return `
      export const doc=(db,...parts)=>parts.join('/');
      export const increment=value=>value;
      export const getDoc=path=>new Promise((resolve,reject)=>globalThis.__quotaLifecycle.reads.push({path,reject,resolve:data=>resolve({data:()=>data})}));
      export const setDoc=(path,data)=>new Promise((resolve,reject)=>globalThis.__quotaLifecycle.writes.push({path,data,resolve,reject}));`;
  },
}]});
let imports=0;
async function fixture(t) {
  const original={Date:globalThis.Date,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,
    setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,document:globalThis.document};
  const state=globalThis.__quotaLifecycle={now:Date.parse('2026-10-19T12:00:00Z'),reads:[],writes:[],timers:new Map(),intervals:new Map(),events:new Set()};
  class ClockDate extends original.Date {
    constructor(...args) {super(...(args.length ? args : [state.now]));}
    static now() {return state.now;}
  }
  let timer=0;
  globalThis.Date=ClockDate;
  globalThis.setTimeout=(callback,ms)=>{const id=++timer;state.timers.set(id,{callback,ms});return id;};
  globalThis.clearTimeout=id=>state.timers.delete(id);
  globalThis.setInterval=(callback,ms)=>{const id=++timer;state.intervals.set(id,{callback,ms});return id;};
  globalThis.clearInterval=id=>state.intervals.delete(id);
  globalThis.document={visibilityState:'visible',addEventListener:(name,callback)=>state.events.add(callback),removeEventListener:(name,callback)=>state.events.delete(callback)};
  const {quota,quotaDay}=await import(`${pathToFileURL(file).href}?instance=${++imports}`);
  t.after(()=>{quota.stop();Object.assign(globalThis,original);delete globalThis.__quotaLifecycle;});
  return {quota,quotaDay,...state,state};
}

test('stopping during initial refresh prevents late timers, listeners and stale quota publication', async t => {
  const f=await fixture(t),views=[];f.quota.subscribe(view=>views.push(view));
  const starting=f.quota.start();assert.equal(f.reads.length,1);
  f.quota.stop();f.reads[0].resolve({reads:49000,writes:18000});await starting;
  assert.equal(f.intervals.size,0,'late start must not reinstall the periodic writer');
  assert.equal(f.events.size,0,'late start must not reinstall visibility listeners');
  assert.equal(f.timers.size,0,'late start must not install a reset timer');
  assert.deepEqual(f.quota.used(),{reads:0,writes:0,deletes:0});
  assert.equal(views.length,1,'stopped refresh cannot emit another session view');
});

test('an older start cannot overwrite a newer session or install a second timer', async t => {
  const f=await fixture(t);
  const older=f.quota.start(), newer=f.quota.start();
  assert.equal(f.reads.length,2);
  f.reads[1].resolve({reads:123,writes:4});await newer;
  f.reads[0].resolve({reads:49000,writes:18000});await older;
  assert.deepEqual(f.quota.used(),{reads:124,writes:4,deletes:0});
  assert.equal(f.intervals.size,1);assert.equal(f.events.size,1);assert.equal(f.timers.size,1);
});

test('stop invalidates a pending debounced count notification', async t => {
  const f=await fixture(t),views=[];f.quota.subscribe(view=>views.push(view));
  f.quota.count('writes',1);assert.equal(f.timers.size,1);
  f.quota.stop();assert.equal(f.timers.size,0,'stopped account must not publish a delayed quota view');
  assert.equal(views.length,1);
  assert.equal(f.quota.local().writes,1,'shared project counts themselves remain available for the next session');
});

test('an old flush acknowledgement does not begin a refresh under the replacement session', async t => {
  const f=await fixture(t);
  const starting=f.quota.start();f.reads[0].resolve({reads:10});await starting;
  f.quota.count('writes',2);const flushing=f.quota.flush();
  assert.equal(f.writes.length,1);
  const restarting=f.quota.start();f.reads[1].resolve({reads:20,writes:2});await restarting;
  f.writes[0].resolve();await Promise.resolve();
  assert.equal(f.reads.length,2,'stale write must not query or publish the new session');
  await flushing;
  assert.deepEqual(f.quota.used(),{reads:21,writes:2,deletes:0});
});

test('same-day failed flush costs survive stop/start without publishing the old session', async t => {
  const f=await fixture(t),views=[];f.quota.subscribe(view=>views.push(view));
  const starting=f.quota.start();f.reads[0].resolve({reads:100});await starting;
  f.quota.count('writes',5);const flushing=f.quota.flush();
  const restarting=f.quota.start();f.reads[1].resolve({reads:100});await restarting;
  const emitted=views.length;
  f.writes[0].reject(new Error('offline'));await flushing;
  assert.deepEqual(f.quota.local(),{reads:2,writes:5,deletes:0},'both session reads and the unsent project operations remain counted');
  assert.equal(views.length,emitted,'late failure only retains project costs internally');
  assert.equal(f.intervals.size,1);assert.equal(f.events.size,1);
});

test('a rejected flush from yesterday never restores old counts into the Pacific reset day', async t => {
  const f=await fixture(t);
  const starting=f.quota.start();f.reads[0].resolve({reads:100});await starting;
  f.quota.count('writes',7);const flushing=f.quota.flush();
  const oldDay=f.quotaDay();assert(f.writes[0].path.endsWith(`quota-${oldDay}`));
  f.state.now+=86400000;f.quota.count('writes',2);
  f.writes[0].reject(new Error('offline'));await flushing;
  assert.deepEqual(f.quota.local(),{reads:0,writes:2,deletes:0});
  const todayFlush=f.quota.flush();assert(f.writes[1].path.endsWith(`quota-${f.quotaDay()}`));
  assert.equal(f.writes[1].data.writes,3,'today includes only two operations and the existing flush write cost');
  f.quota.stop();f.writes[1].resolve();await Promise.resolve();
  if (f.reads.length>1) f.reads.at(-1).resolve({});
  await todayFlush;
});

test('a pre-reset refresh cannot publish yesterday totals after the day rolls over', async t => {
  const f=await fixture(t),starting=f.quota.start();
  f.state.now+=86400000;f.quota.count('writes',3);
  f.reads[0].resolve({reads:49000,writes:19000});await starting;
  assert.deepEqual(f.quota.used(),{reads:0,writes:3,deletes:0});
});

test('normal same-day failed flush keeps pending operations and existing flush accounting', async t => {
  const f=await fixture(t),starting=f.quota.start();f.reads[0].resolve({reads:100,writes:20});await starting;
  f.quota.count('writes',4);const failed=f.quota.flush();f.writes[0].reject(new Error('offline'));await failed;
  assert.deepEqual(f.quota.local(),{reads:1,writes:4,deletes:0});
  const successful=f.quota.flush();assert.equal(f.writes[1].data.reads,2);assert.equal(f.writes[1].data.writes,5);
  f.writes[1].resolve();await Promise.resolve();f.reads[1].resolve({reads:102,writes:25});await successful;
  assert.deepEqual(f.quota.used(),{reads:102,writes:25,deletes:0});
});

process.on('exit',()=>rmSync(output,{recursive:true,force:true}));
