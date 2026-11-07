import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {patchFirebase} from '../services/patches.mjs';
test('isolated native Firebase reuses canonical account code without production initialization or disk keys',()=>{
 const source=readFileSync('src/lib/firebase.ts','utf8'),code=patchFirebase(source);
 assert(code.includes('initializeAuth(app, {persistence: inMemoryPersistence})'));
 for(const unsafe of ["../firebase-config.json",'const SAME_SITE_AUTH_HOSTS','browserLocalPersistence','signInWithPopup(auth','signInWithRedirect(auth','__testSignIn','localStorage.setItem(PREVIEW_KEY','localStorage.setItem(localKey'])assert(!code.includes(unsafe),unsafe);
 for(const contract of ['createAccountSettingsPersistence','permission-denied','captureRead','readNativeAccount','writeNativeAccount','watchNativeUser','signOutNative','saveKeys'])assert(code.includes(contract),contract);
 assert.throws(()=>patchFirebase(source.replace('const SAME_SITE_AUTH_HOSTS','const changed')),/Unknown canonical/);
});
