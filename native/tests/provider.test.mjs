import test from 'node:test';import assert from 'node:assert/strict';
import {AccountScope} from '../integration/scope.ts';import {SyntheticProvider} from '../integration/provider.ts';
test('provider leases stop on account/background, unavailable errors recover without a network',async()=>{
 const scope=new AccountScope();scope.set('a');const p=new SyntheticProvider(scope);
 p.available=false;assert.equal((await p.request('/v1beta/models/gemini-flash-latest:streamGenerateContent','{}')).status,503);
 p.available=true;const response=await p.request('/v1beta/models/gemini-flash-latest:streamGenerateContent','{}');
 const reader=response.body.getReader();assert.equal((await reader.read()).done,false);scope.pause();await assert.rejects(reader.read(),{name:'AbortError'});
 scope.resume();const next=await p.request('/v1beta/models/gemini-flash-latest:streamGenerateContent','{}');const pending=next.body.getReader();scope.set('b');await assert.rejects(pending.read(),{name:'AbortError'});
 assert.equal(p.inFlight,0);scope.set(null);await assert.rejects(p.request('/v1beta/models',''),{name:'AbortError'});
});
