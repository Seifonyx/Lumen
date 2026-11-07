import test from 'node:test';import assert from 'node:assert/strict';
import {acceptReport,allowRequest,withDeadline} from '../authorization/security.mjs';
test('consent listener is loopback-origin and one-session scoped',()=>{
 const session='a'.repeat(48),origin='http://localhost:5213';
 assert(allowRequest({host:'localhost:5213',origin},session,'/'+session+'/result'));
 assert(!allowRequest({host:'evil.test',origin},session,'/'+session+'/result'));
 assert(!allowRequest({host:'localhost:5213',origin:'https://evil.test'},session,'/'+session+'/result'));
 assert(!allowRequest({host:'localhost:5213',origin},session,'/wrong/result'));
});
test('only non-secret result booleans can leave browser',()=>{
 assert(acceptReport({flow:'google-popup',authorized:true,cloudRoundtrip:true,cleaned:true}));
 assert(!acceptReport({flow:'google-popup',authorized:true,cloudRoundtrip:true,cleaned:true,idToken:'never'}));
 assert(!acceptReport({flow:'google-popup',authorized:true,cloudRoundtrip:false,cleaned:true}));
});

test('cloud operation deadline settles stalled work and preserves normal success/error',async()=>{
 assert.equal(await withDeadline(Promise.resolve('ok'),100),'ok');
 await assert.rejects(withDeadline(Promise.reject(Error('denied')),100),/denied/);
 await assert.rejects(withDeadline(new Promise(()=>{}),10),/timed out/);
});
