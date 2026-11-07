import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
import {validateServiceConfig} from '../services/config.mjs';import {patchServiceProject} from '../scripts/service-project.mjs';
const python=process.platform==='win32'?'python':'python3';
test('native provider host requires explicit compiled approval and is removed when approval is absent',()=>{
 const dir=mkdtempSync(join(tmpdir(),'lumen-native-ai-gate-'));
 try{
  execFileSync(python,['-c',"import plistlib,sys;plistlib.dump({},open(sys.argv[1],'wb'))",join(dir,'Info.plist')]);
  const c=validateServiceConfig({mode:'isolated-test',projectId:'lumen-ios-test',projectNumber:'123456789',apiKey:'synthetic',appId:'1:123456789:web:abc',iosClientId:'123456789-ios.apps.googleusercontent.com',webClientId:'123456789-web.apps.googleusercontent.com',bundleId:'io.github.seifonyx.lumen.demo',approvedTestEnvironment:true});
  const read=()=>JSON.parse(execFileSync(python,['-c',"import json,plistlib,sys;print(json.dumps(plistlib.load(open(sys.argv[1],'rb'))))",join(dir,'Info.plist')],{encoding:'utf8'}));
  patchServiceProject(dir,c);assert.equal(read().LumenTestServices.aiProvider,undefined);
  const a={approved:true,provider:'openrouter',projectId:'lumen-ios-test',uid:'synthetic',policy:'free-variants-only',noByok:true,keySha256:'a'.repeat(64)};
  patchServiceProject(dir,c,a);assert.equal(read().LumenTestServices.aiProvider,'openrouter');
  patchServiceProject(dir,c);assert.equal(read().LumenTestServices.aiProvider,undefined);
  assert.throws(()=>patchServiceProject(dir,null,a));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
