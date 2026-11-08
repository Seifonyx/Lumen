import test from 'node:test';import assert from 'node:assert/strict';
import {authFailure,signInProblem} from '../integration/auth-errors.ts';
test('stage-specific messages never reveal SDK descriptions, tokens or callback data',()=>{
 const secret='private-token https://callback.invalid/?code=secret synthetic@identity.invalid';
 for(const [stage,code,expected] of [['google','AUTH_SIGNING','AUTH_SIGNING'],['google','AUTH_STORAGE','AUTH_STORAGE'],['google','AUTH_CALLBACK_CONFIG','AUTH_CALLBACK_CONFIG'],['google','AUTH_GOOGLE_NETWORK','AUTH_GOOGLE_NETWORK'],['google','UNIMPLEMENTED','AUTH_BRIDGE'],['firebase','auth/network-request-failed','AUTH_FIREBASE_NETWORK'],['firebase','auth/invalid-credential','AUTH_FIREBASE_CREDENTIAL'],['firebase','auth/user-disabled','AUTH_ACCOUNT_DISABLED'],['google','UNRECOGNIZED','AUTH_GOOGLE'],['firebase','UNRECOGNIZED','AUTH_FIREBASE']]){
  const failure=authFailure(stage,{code,message:secret,userInfo:{token:secret}}),shown=signInProblem(failure);
  assert.equal(shown.code,expected);assert(!JSON.stringify(shown).includes(secret));assert(!failure.message.includes(secret));assert(!('cause' in failure));
 }
 assert.equal(signInProblem(new Error(secret)).code,'AUTH_UNKNOWN');
 assert.equal(signInProblem(new DOMException(secret,'AbortError')).code,'AUTH_CANCELED');
 assert.equal(signInProblem({code:'__proto__',message:secret}).code,'AUTH_UNKNOWN');
});

test('Firebase application-key policy errors never expose a referrer or installed identity',()=>{
 for(const code of ['auth/requests-from-referer-https://private.invalid/token-are-blocked.','auth/requests-from-this-ios-client-application-private-id-are-blocked.','auth/api-key-http-referrer-blocked']){
  const out=signInProblem(authFailure('firebase',{code,message:'private token details'}));assert.equal(out.code,'AUTH_FIREBASE_KEY_POLICY');assert(!JSON.stringify(out).includes('private'));
 }
});
