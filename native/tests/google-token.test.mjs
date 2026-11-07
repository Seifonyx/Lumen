import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyNativeGoogleToken} from '../integration/google-token.ts';

const nonce='ABCDEF12-1234-1234-1234-ABCDEF123456ABCDEF12-1234-1234-1234-ABCDEF123456';
const client='123456789012-synthetic-web.apps.googleusercontent.com';
const jwt=(claims)=>'eyJhbGciOiJSUzI1NiJ9.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.c2lnbmF0dXJl';
const now=Math.floor(Date.now()/1000);
const claims=()=>({iss:'https://accounts.google.com',aud:client,iat:now,exp:now+3600,nonce:createHash('sha256').update(nonce).digest('hex')});

test('native Google ID token is nonce-bound to the configured test web client',async()=>{
 const idToken=jwt(claims());
 assert.equal(await verifyNativeGoogleToken({signedIn:true,idToken,rawNonce:nonce},client),idToken);
});
test('reject tokens for a different Firebase OAuth client and stale or missing nonces',async()=>{
 for(const overrides of [{aud:'123456789012-other.apps.googleusercontent.com'},{nonce:'wrong'},{exp:now-1},{iss:'https://attacker.test'},{iat:now+3600}]){
  await assert.rejects(verifyNativeGoogleToken({signedIn:true,idToken:jwt({...claims(),...overrides}),rawNonce:nonce},client));
 }
 await assert.rejects(verifyNativeGoogleToken({signedIn:true,idToken:jwt(claims())},client));
 await assert.rejects(verifyNativeGoogleToken({signedIn:false,idToken:jwt(claims()),rawNonce:nonce},client));
 await assert.rejects(verifyNativeGoogleToken({signedIn:true,idToken:'not.a.jwt',rawNonce:nonce},client));
});

test('rejected token stages are actionable while nonce, client and expiry validation stay strict',async()=>{
 for(const [overrides,code] of [[{nonce:'wrong'},'AUTH_NONCE'],[{aud:'foreign'},'AUTH_TOKEN_CLIENT'],[{exp:now-1},'AUTH_TOKEN_EXPIRED']])
  await assert.rejects(verifyNativeGoogleToken({signedIn:true,idToken:jwt({...claims(),...overrides}),rawNonce:nonce},client),{code});
});
