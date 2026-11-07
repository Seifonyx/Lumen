import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountScope} from '../integration/scope.ts';
import {AuthFlow,SessionLifetime,SyntheticAuthPort} from '../integration/auth.ts';

test('account switch and background invalidate leases and linked provider requests',()=>{
 const s=new AccountScope();s.set('a');const a=s.request();s.set('b');assert(a.signal.aborted);assert(!a.valid());a.dispose();
 const b=s.request();s.pause();assert(b.signal.aborted);assert.throws(()=>s.capture());s.resume();assert.equal(s.capture().uid,'b');s.set(null);assert.throws(()=>s.capture());
});
test('auth success, failure and cancel/replay never accept stale callbacks',async()=>{
 const f=new AuthFlow();let release;const p=f.authorize({open:request=>new Promise(r=>{release=()=>r({uid:'a',state:request.state,attemptId:request.attemptId,callback:request.callback,expiresAt:Date.now()+1000});})});
 f.cancel();release();await assert.rejects(p,{name:'AbortError'});
 const result=await f.authorize(new SyntheticAuthPort('preview-native-demo-a'));assert.equal(result.uid,'preview-native-demo-a');
 await assert.rejects(f.authorize({open:async()=>{throw Error('Synthetic sign-in failed');}}),/Synthetic sign-in failed/);
 const good={open:async q=>({uid:'a',state:q.state,attemptId:q.attemptId,callback:q.callback,expiresAt:Date.now()+1000})};
 const done=await f.authorize(good);assert(done);assert.equal(f.acceptCallback('lumen-demo-auth://callback/complete?state=foreign'),false);
});
test('callback validation rejects mismatched state, target, duplicate parameters, expiry and replay',async()=>{
 for(const mutate of [q=>({...q,state:'wrong'}),q=>({...q,callback:'evil://callback/complete'}),q=>({...q,expiresAt:1}),q=>({...q,attemptId:'old'})]){
  const f=new AuthFlow();await assert.rejects(f.authorize({open:async q=>mutate({uid:'a',state:q.state,attemptId:q.attemptId,callback:q.callback,expiresAt:Date.now()+1000})}));
 }
 const f=new AuthFlow();let request,finish;const pending=f.authorize({open:q=>{request=q;return new Promise(r=>{finish=r;});}});
 assert.equal(f.acceptCallback(request.callback+'?state='+request.state+'&state='+request.state),false);
 assert.equal(f.acceptCallback(request.callback+'?state='+request.state),true);assert.equal(f.acceptCallback(request.callback+'?state='+request.state),false);
 finish({uid:'a',state:request.state,attemptId:request.attemptId,callback:request.callback,expiresAt:Date.now()+1000});await pending;
});
test('session expiry is owner-bound, resume checks elapsed wall time, no default demo expiry',()=>{
 const scope=new AccountScope();let now=10,expired=0;const life=new SessionLifetime(scope,()=>expired++,()=>now);
 life.adopt('a',20);now=21;life.check();assert.equal(expired,1);assert.equal(scope.uid,null);
 life.adopt('b');now=999999;life.check();assert.equal(scope.uid,'b');life.end();assert.equal(scope.uid,null);
});
