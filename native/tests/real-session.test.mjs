import test from 'node:test';import assert from 'node:assert/strict';
import {RealSession} from '../integration/real-session.ts';
function harness(){let user=null,listen=()=>{},release;const changes=[],nativeCalls=[];
 const firebase={current:()=>user,watch:fn=>{listen=fn;fn(user);return()=>{};},signIn:async()=>{await new Promise(r=>{release=r;});user={uid:'test-a'};listen(user);return user;},signOut:async()=>{user=null;listen(null);}};
 const native={credential:async()=>({signedIn:true,idToken:'synthetic-credential'}),signOut:async()=>{nativeCalls.push('out');},cancel:async()=>{}};
 const session=new RealSession(firebase,native);session.watch(u=>changes.push(u?.uid||null));return{session,changes,nativeCalls,release:()=>release(),firebase};}
test('real session suppresses intermediate Firebase login and canceled late completions',async()=>{
 const h=harness(),p=h.session.signIn();await new Promise(r=>setTimeout(r,0));await h.session.signOut();h.release();await assert.rejects(p,{name:'AbortError'});assert(!h.changes.includes('test-a'));assert.equal(h.firebase.current(),null);
});
test('real session publishes verified credential result once and logout clears it',async()=>{
 const h=harness(),p=h.session.signIn();await new Promise(r=>setTimeout(r,0));h.release();await p;assert.deepEqual(h.changes,[null,'test-a']);await h.session.signOut();assert.equal(h.changes.at(-1),null);
});
test('failed real authentication has no synthetic fallback and can retry',async()=>{
 let fail=true;const changes=[];const session=new RealSession({current:()=>null,watch:()=>()=>{},signIn:async()=>({uid:'test-only'}),signOut:async()=>{}},{credential:async()=>{if(fail)throw Error('test failure');return{signedIn:true,idToken:'synthetic'};},signOut:async()=>{},cancel:async()=>{}});
 session.watch(u=>changes.push(u));await assert.rejects(session.signIn(),/test failure/);assert(!changes.some(Boolean));fail=false;await session.signIn();assert.equal(changes.at(-1).uid,'test-only');
});

// A real app startup begins restoration while Login is already visible.
test('interactive login waits for startup restore instead of failing before Google opens',async()=>{
 let finishRestore;const calls=[];
 const session=new RealSession({current:()=>null,watch:()=>()=>{},signIn:async()=>({uid:'test-a'}),signOut:async()=>{}},
  {credential:async restore=>{calls.push(restore?'restore':'interactive');if(restore)return new Promise(r=>{finishRestore=r;});return{signedIn:true,idToken:'synthetic'};},signOut:async()=>{},cancel:async()=>{}});
 const startup=session.restore();await new Promise(r=>setTimeout(r,0));
 const login=session.signIn();await new Promise(r=>setTimeout(r,0));assert.deepEqual(calls,['restore']);
 finishRestore({signedIn:false});await startup;await login;assert.deepEqual(calls,['restore','interactive']);
});
test('cancel during startup restore cannot open a queued Google chooser',async()=>{
 let finishRestore;const calls=[];
 const session=new RealSession({current:()=>null,watch:()=>()=>{},signIn:async()=>({uid:'test-a'}),signOut:async()=>{}},
  {credential:async restore=>{calls.push(restore);return new Promise(r=>{finishRestore=r;});},signOut:async()=>{},cancel:async()=>{}});
 const startup=session.restore();const ignored=startup.catch(()=>{});await new Promise(r=>setTimeout(r,0));
 const login=session.signIn();const rejected=assert.rejects(login,{name:'AbortError'});
 await session.cancel();finishRestore({signedIn:false});await ignored;await rejected;assert.deepEqual(calls,[true]);
});

test('a successful startup restore satisfies a queued login without signing the account out again',async()=>{
 let finishRestore,signouts=0;const calls=[],seen=[];
 const session=new RealSession({current:()=>null,watch:()=>()=>{},signIn:async()=>({uid:'restored-account'}),signOut:async()=>{signouts++;}},
 {credential:async restore=>{calls.push(restore);return new Promise(r=>{finishRestore=r;});},signOut:async()=>{},cancel:async()=>{}});
 session.watch(user=>seen.push(user?.uid||null));const startup=session.restore();await new Promise(r=>setTimeout(r,0));const login=session.signIn();
 finishRestore({signedIn:true,idToken:'synthetic'});await startup;await login;assert.deepEqual(calls,[true]);assert.equal(signouts,1);assert.deepEqual(seen,[null,'restored-account']);
});
test('failed cleanup never replaces the original safe stage or publishes an account',async()=>{
 const {NativeAuthError}=await import('../integration/auth-errors.ts');let count=0;const seen=[];
 const session=new RealSession({current:()=>null,watch:()=>()=>{},signIn:async()=>({uid:'unused'}),signOut:async()=>{if(count++)throw Error('private cleanup detail');}},
 {credential:async()=>{throw new NativeAuthError('AUTH_SIGNING');},signOut:async()=>{throw Error('private SDK detail');},cancel:async()=>{}});
 session.watch(u=>seen.push(u));await assert.rejects(session.signIn(),{code:'AUTH_SIGNING'});assert.deepEqual(seen,[null]);
});
