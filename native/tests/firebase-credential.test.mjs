import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {nativeFirebaseCredential} from '../services/google-credential.ts';
test('Firebase SDK credential retains the validated raw nonce and Google provider',async()=>{
 const rawNonce='ABCDEF12-1234-1234-1234-ABCDEF123456'.repeat(2),client='123456789-web.apps.googleusercontent.com',now=Math.floor(Date.now()/1000);
 const payload={iss:'https://accounts.google.com',aud:client,iat:now,exp:now+3600,nonce:createHash('sha256').update(rawNonce).digest('hex')};
 const idToken='eyJhbGciOiJSUzI1NiJ9.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.c2ln';
 const credential=await nativeFirebaseCredential({signedIn:true,idToken,rawNonce},client),data=credential.toJSON();
 assert.equal(data.providerId,'google.com');assert.equal(data.nonce,rawNonce);assert.equal(data.idToken,idToken);
 await assert.rejects(nativeFirebaseCredential({signedIn:true,idToken,rawNonce:'ABCDEF99-1234-1234-1234-ABCDEF123456'.repeat(2)},client),{code:'AUTH_NONCE'});
});
