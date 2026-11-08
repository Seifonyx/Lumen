import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const read=rel=>readFileSync(fileURLToPath(new URL(rel,import.meta.url)),'utf8');

test('native sign-in exchanges only checked Google ID token with Firebase',()=>{
 const source=read('../services/account.ts');
 assert.match(source,/await nativeFirebaseCredential\(c,config\.webClientId\)/);
 assert.match(source,/signInWithCredential\(auth,credential\)/);
 const helper=read('../services/google-credential.ts');
 assert.match(helper,/await verifyNativeGoogleToken\(input,client\)/);
 assert.match(helper,/new OAuthProvider\('google\.com'\)\.credential\(\{idToken,rawNonce:input\.rawNonce\}\)/);
 assert(helper.indexOf('await verifyNativeGoogleToken')<helper.indexOf("new OAuthProvider"),'validate before constructing Firebase credential');
 assert.doesNotMatch(source,/GoogleAuthProvider\.credential\(idToken\)/,'must not drop the verified nonce');
});

test('Google SDK bridge supplies hashed nonce and keeps only its raw counterpart in the vault',()=>{
 const source=read('../GoogleAuthPlugin.swift');
 assert.match(source,/SHA256\.hash\(data: Data\(nonce\.utf8\)\)/);
 assert.match(source,/nonce: hash/);
 assert.match(source,/vault\.store\(owner: owner, data: Data\(nonce\.utf8\)\)/);
 assert.match(source,/\["rawNonce"\] = raw/);
});

test('native authentication bridge credentials cannot be logged by Capacitor',()=>{
 const config=JSON.parse(read('../capacitor.config.json'));
 assert.equal(config.loggingBehavior,'none');
 assert.equal(config.ios.loggingBehavior,undefined,'do not override the global no-logging policy');
});
