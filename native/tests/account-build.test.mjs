import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {loadServiceConfig} from '../services/build-config.mjs';
test('existing-account packaging pins canonical web project/config and cannot change test mode silently',()=>{
 const d=mkdtempSync(join(tmpdir(),'lumen-account-config-'));try{
  const prod=JSON.parse(readFileSync('src/firebase-config.json','utf8'));
  const c={mode:'account-connected',projectId:prod.projectId,projectNumber:prod.projectNumber,apiKey:prod.apiKey,appId:prod.appId,iosClientId:prod.projectNumber+'-synthetic-ios.apps.googleusercontent.com',webClientId:prod.projectNumber+'-synthetic-web.apps.googleusercontent.com',bundleId:'io.github.seifonyx.lumen.demo',approvedExistingAccounts:true};
  const f=join(d,'config.json'),env={LUMEN_NATIVE_MODE:'account-connected',LUMEN_NATIVE_SERVICE_CONFIG:f};writeFileSync(f,JSON.stringify(c));
  assert.equal(loadServiceConfig(env).mode,'account-connected');
  assert.throws(()=>loadServiceConfig({...env,LUMEN_NATIVE_MODE:'isolated-test'}));
  writeFileSync(f,JSON.stringify({...c,apiKey:'different-key'}));assert.throws(()=>loadServiceConfig(env));
  assert.equal(loadServiceConfig({LUMEN_NATIVE_MODE:'offline-demo'}),null);
 }finally{rmSync(d,{recursive:true,force:true});}
});
