import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
import {validateServiceConfig} from '../services/config.mjs';import {patchServiceProject} from '../scripts/service-project.mjs';
const python=process.platform==='win32'?'python':'python3';
test('native free-provider capability is build-scoped; runtime consent remains separate',()=>{
 const dir=mkdtempSync(join(tmpdir(),'lumen-native-ai-gate-'));
 try{
  execFileSync(python,['-c',"import plistlib,sys;plistlib.dump({},open(sys.argv[1],'wb'))",join(dir,'Info.plist')]);
  const c=validateServiceConfig({mode:'isolated-test',projectId:'lumen-ios-test',projectNumber:'123456789',apiKey:'synthetic',appId:'1:123456789:web:abc',iosClientId:'123456789-ios.apps.googleusercontent.com',webClientId:'123456789-web.apps.googleusercontent.com',bundleId:'io.github.seifonyx.lumen.demo',approvedTestEnvironment:true});
  const read=()=>JSON.parse(execFileSync(python,['-c',"import json,plistlib,sys;print(json.dumps(plistlib.load(open(sys.argv[1],'rb'))))",join(dir,'Info.plist')],{encoding:'utf8'}));
  patchServiceProject(dir,c);assert.equal(read().LumenTestServices.aiProvider,'openrouter');
  const prod={...c,mode:'account-connected',projectId:'the-model-router',approvedExistingAccounts:true};delete prod.approvedTestEnvironment;delete prod.authDomain;delete prod.callbackScheme;
  patchServiceProject(dir,validateServiceConfig(prod));assert.equal(read().LumenTestServices.mode,'account-connected');assert.equal(read().CFBundleDisplayName,'Lumen');
  patchServiceProject(dir,null);assert.equal(read().LumenTestServices,undefined);
  patchServiceProject(dir,c);assert.equal(read().LumenTestServices.aiProvider,'openrouter');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
