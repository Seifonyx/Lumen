import assert from 'node:assert/strict';
import { providerPresentation } from '../../src/lib/provider-presentation';
const base={keySaved:true,enabled:true,modelCount:2};
assert.equal(providerPresentation({...base}).catalogLabel,'Not checked');
assert.equal(providerPresentation({...base,keySaved:false}).setupLabel,'No key saved');
assert.equal(providerPresentation({...base,enabled:false}).setupLabel,'Permission off');
for(const kind of ['auth','network','timeout','rate-limit','provider','invalid'] as const){const p=providerPresentation({...base,status:{state:'error',errorKind:kind,lastAttempt:1,lastSuccess:null,nextRefresh:2}});assert(p.attention);assert(p.guidance.length>20);assert(!/verified|healthy|working|free/i.test(p.catalogLabel));}
const ready=providerPresentation({...base,status:{state:'ready',lastSuccess:1,lastAttempt:1,nextRefresh:2}});
assert.equal(ready.catalogLabel,'Catalog ready');assert.equal(ready.attention,false);assert.equal(ready.replyLabel,'Not verified by discovery');
const stale=providerPresentation({...base,status:{state:'stale',errorKind:'network',lastSuccess:1,lastAttempt:2,nextRefresh:3}});
assert.equal(stale.catalogLabel,'Cached catalog');assert(stale.guidance.includes('network'));assert(stale.attention);
assert(!providerPresentation({...base,enabled:false,status:{state:'error',errorKind:'auth',lastSuccess:null,lastAttempt:1,nextRefresh:2}}).attention);
console.log('PASS saved/enabled/catalog/reply distinction and six failure recoveries; no secrets/raw error text');
const cached=providerPresentation({...base,status:{state:'stale',lastSuccess:1,lastAttempt:0,nextRefresh:0}});
assert.match(cached.guidance,/cached/i);
assert.doesNotMatch(cached.guidance,/No discovery result/);
