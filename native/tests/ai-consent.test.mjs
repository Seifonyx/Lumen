import test from 'node:test';import assert from 'node:assert/strict';
import {AccountScope} from '../integration/scope.ts';import {NativeAiConsent,zeroBudgetAccount} from '../services/ai-consent.ts';
const setup=()=>{const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};const scope=new AccountScope();scope.set('a');return{map,scope,c:new NativeAiConsent(scope,storage,'lumen-ios-test')};};
const key='sk-or-synthetic-rc-key';
test('in-app consent requires explicit confirmation and stores only a scoped fingerprint',async()=>{
 const {c,map,scope}=setup();assert.equal(c.current(),null);await assert.rejects(c.enable(key,false));
 await c.enable(key,true);assert.equal(c.current().uid,'a');assert(!JSON.stringify([...map]).includes(key));scope.set('b');assert.equal(c.current(),null);scope.set('a');assert(c.current());c.revoke();assert.equal(c.current(),null);
});
test('zero budget verification rejects paid, BYOK, missing and unknown account states',()=>{
 assert(zeroBudgetAccount({limit:0,is_free_tier:true,byok_usage:0}));
 for(const d of [{},{limit:null,is_free_tier:true,byok_usage:0},{limit:1,is_free_tier:true,byok_usage:0},{limit:0,is_free_tier:false,byok_usage:0},{limit:0,is_free_tier:true,byok_usage:1},{limit:0,is_free_tier:true}])assert(!zeroBudgetAccount(d));
});
test('account changes while hashing cannot grant another account; revoke notifies provider cancellation without restarting cloud scope',async()=>{
 const {c,scope}=setup();const pending=c.enable(key,true);scope.set('b');await assert.rejects(pending);assert.equal(c.current(),null);
 scope.set('a');await c.enable(key,true);let invalidated=false;c.subscribe(()=>invalidated=true);const lease=scope.capture();c.revoke();assert(invalidated);assert(lease.valid());
});
