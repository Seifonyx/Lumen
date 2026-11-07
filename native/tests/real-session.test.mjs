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
