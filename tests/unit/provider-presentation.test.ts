import assert from 'node:assert/strict';
import { providerPresentation } from '../../src/lib/provider-presentation';
const base={keySaved:true,enabled:true,modelCount:2};
assert.equal(providerPresentation({...base}).catalogLabel,'Not checked');
assert.equal(providerPresentation({...base,keySaved:false}).setupLabel,'No key saved');
assert.equal(providerPresentation({...base,enabled:false}).setupLabel,'Permission off');
for(const kind of ['auth','network','timeout','rate-limit','provider','invalid'] as const){const p=providerPresentation({...base,status:{state:'error',errorKind:kind,lastAttempt:1,lastSuccess:null,nextRefresh:2}});assert(p.attention);assert(p.guidance.length>20);assert(!/verified|healthy|working|free/i.test(p.catalogLabel));}
const ready=providerPresentation({...base,status:{state:'ready',lastSuccess:1,lastAttempt:1,nextRefresh:2}});
assert.equal(ready.catalogLabel,'Catalog ready');assert.equal(ready.attention,false);assert.equal(ready.replyLabel,'Not tested by model listing');
const stale=providerPresentation({...base,status:{state:'stale',errorKind:'network',lastSuccess:1,lastAttempt:2,nextRefresh:3}});
assert.equal(stale.catalogLabel,'Cached catalog');assert(stale.guidance.includes('network'));assert(stale.attention);
assert(!providerPresentation({...base,enabled:false,status:{state:'error',errorKind:'auth',lastSuccess:null,lastAttempt:1,nextRefresh:2}}).attention);
console.log('PASS saved/enabled/catalog/reply distinction and six failure recoveries; no secrets/raw error text');
const cached=providerPresentation({...base,status:{state:'stale',lastSuccess:1,lastAttempt:0,nextRefresh:0}});
assert.match(cached.guidance,/cached/i);
assert.doesNotMatch(cached.guidance,/No model list yet/);
// One canonical presentation verdict drives both the directory and detail; never inference health.
assert.equal(providerPresentation({...base,keySaved:false}).verdict, 'No key saved');
assert.equal(providerPresentation({...base,enabled:false}).verdict, 'Permission off');
assert.equal(providerPresentation({...base}).verdict, 'Not checked');
assert.equal(providerPresentation({...base}).nextStep, 'Refresh model list');
assert.equal(providerPresentation({...base}).attention, true, 'enabled unchecked provider needs a check');
const empty = providerPresentation({...base,modelCount:0,status:{state:'ready',lastAttempt:1,lastSuccess:1,nextRefresh:2}});
assert.equal(empty.verdict,'No compatible models');assert.equal(empty.tone,'attention');
const auth = providerPresentation({...base,status:{state:'stale',errorKind:'auth',lastAttempt:1,lastSuccess:1,nextRefresh:2}});
assert.equal(auth.verdict,'Key needs attention');assert.equal(auth.nextStep,'Review key');
assert.equal(ready.verdict,'Catalog ready');assert.equal(ready.nextStep,'View models');
assert.doesNotMatch(ready.guidance,/connection verified|inference verified|operational/i);
