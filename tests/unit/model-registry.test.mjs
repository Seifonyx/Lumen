import assert from 'node:assert/strict';
import { createModelRegistry } from '../../src/lib/ai/registry.js';

const row = (provider, name, context = 64000) => ({id:`${provider}:${name}`,name,context});
const deferred = () => { let resolve; const promise = new Promise(r => {resolve=r;}); return {promise,resolve}; };
const error = status => Object.assign(new Error(`upstream ${status}`), {status});
const config = {providers:['a','b'],enabled:()=>true,random:()=>0.5,sleep:async()=>{},ttl:()=>1000};

// Direct callers (not just the Zustand store) share one bounded discovery pass.
let pending=deferred(), calls=0;
let registry=createModelRegistry({...config,load:async p=>{calls++;await pending.promise;return [row(p,'one')];}});
const first=registry.read({refresh:true}), simultaneous=registry.read({refresh:true});
pending.resolve();
assert.deepEqual(await first,await simultaneous);
assert.equal(calls,2);
await registry.read(); assert.equal(calls,2,'fresh registry does not poll providers');

// Provider work is bounded even with a large set of configured connections.
let active=0,peak=0;
registry=createModelRegistry({...config,providers:Array.from({length:20},(_,i)=>`p${i}`),concurrency:3,
 load:async p=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;return [row(p,'new')];}});
assert.equal((await registry.read()).models.length,20); assert.equal(peak,3);

// Per-provider expiration, reconciliation and backoff preserve healthy catalogues.
let clock=100,fail=null,version=1; calls=0;
registry=createModelRegistry({...config,now:()=>clock,load:async p=>{calls++;if(p==='a'&&fail)throw error(fail);return [row(p,`v${version}`),row(p,`v${version}`)];}});
let result=await registry.read(); assert.equal(result.models.length,2,'deduplicate stable IDs');
assert.equal(result.providerStatus.a.lastSuccess,100);
clock=1101;version=2;fail=503;
result=await registry.read();
assert.deepEqual(result.models.map(m=>m.id),['a:v1','b:v2']);
assert.equal(result.providerStatus.a.state,'stale');
assert.equal(result.providerStatus.a.lastSuccess,100);
assert.equal(result.providerStatus.a.errorKind,'provider');
assert.equal(calls,5,'one bounded retry only for transient provider failure');
const count=calls; await registry.read(); assert.equal(calls,count,'error cooldown prevents request loops');
fail=401; result=await registry.read({refresh:true});
assert.deepEqual(result.models.map(m=>m.id),['b:v2'],'rejected credentials never retain accessible models');
assert.equal(result.providerStatus.a.state,'error');
assert.equal(result.providerStatus.a.errorKind,'auth');
assert.equal(calls,count+2,'authentication is not retried');
fail=null;version=3; result=await registry.read({refresh:true});
assert.deepEqual(result.models.map(m=>m.id),['a:v3','b:v3'],'successful list removes absent models');

// Credential changes cancel in-flight work and prevent late publication, even with uncooperative IO.
pending=deferred();
registry=createModelRegistry({...config,providers:['a'],load:()=>pending.promise});
const stale=registry.read(); registry.invalidate(); pending.resolve([row('a','old-secret-scope')]);
await assert.rejects(stale,/settings changed/i);
assert.equal(registry.snapshot().models.length,0);

// Discovery that ignores its cancellation signal still has a hard deadline.
registry=createModelRegistry({...config,providers:['a'],attemptMs:20,maxRetries:0,load:()=>new Promise(()=>{})});
const started=Date.now(); result=await registry.read();
assert.equal(result.providerStatus.a.errorKind,'timeout'); assert(Date.now()-started<1000);

// Last-known-good hydration is explicitly scoped by the caller and never grants a fresh TTL.
clock=5000;
registry=createModelRegistry({...config,providers:['a'],now:()=>clock,load:async()=>{throw error(503);}});
registry.seed({models:[row('a','saved')],providerStatus:{a:{lastSuccess:3000}}});
result=await registry.read(); assert.equal(result.models[0].id,'a:saved');
assert.equal(result.providerStatus.a.state,'stale');assert.equal(result.providerStatus.a.lastSuccess,3000);

// A provider cannot register an unrelated provider's identity through returned metadata.
registry=createModelRegistry({...config,providers:['a'],load:async()=>[row('b','spoof'),row('a','valid')]});
assert.deepEqual((await registry.read()).models.map(m=>m.id),['a:valid']);

// Only expired providers are fetched; a long-lived documented list is not polled with short-lived APIs.
clock=100;const fetched=[];
registry=createModelRegistry({...config,now:()=>clock,ttl:p=>p==='a'?1000:5000,load:async p=>{fetched.push(p);return [row(p,'current')];}});
await registry.read();clock=1200;await registry.read();assert.deepEqual(fetched,['a','b','a']);

clock=100;
registry=createModelRegistry({...config,providers:['a'],now:()=>clock,load:async()=>{throw Object.assign(error(429),{retryAfterMs:120000});}});
result=await registry.read();assert.equal(result.providerStatus.a.nextRefresh,120100,'honor Retry-After without immediate retry');
console.log('PASS registry dedupe, concurrency, TTL, reconciliation, retry budget, auth eviction, cancellation, deadline and scoped hydration');
