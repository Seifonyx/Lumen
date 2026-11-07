import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchProject} from '../scripts/project.mjs';

test('real pinned Capacitor template uses custom scene controller and preparation is idempotent',()=>{
 const dir=mkdtempSync(join(tmpdir(),'lumen-ios-project-'));
 try {
  execFileSync('tar',['-xzf','native/node_modules/@capacitor/cli/assets/ios-spm-template.tar.gz','-C',dir]);
  const app=join(dir,'App/App'), swift=readFileSync('native/DemoViewController.swift','utf8')+'\n'+readFileSync('native/NativeSessionVault.swift','utf8')+'\n'+readFileSync('native/GoogleAuthPlugin.swift','utf8');
  assert.match(readFileSync(join(app,'SceneDelegate.swift'),'utf8'),/rootViewController = CAPBridgeViewController\(\)/);
  patchProject(app,swift);
  const once=['AppDelegate.swift','SceneDelegate.swift','Info.plist','Base.lproj/Main.storyboard'].map(n=>readFileSync(join(app,n),'utf8'));
  assert.match(once[1],/LumenHandleGoogleURL/);
  assert.match(once[1],/rootViewController = DemoViewController\(\)/);
  assert.doesNotMatch(once[1],/rootViewController = CAPBridgeViewController/);
  assert.equal(once[0].match(/final class DemoViewController/g).length,1);
  assert.equal(once[0].match(/final class NativeSessionVault/g).length,1);
  assert.doesNotMatch(once[2],/CFBundleURLTypes|NSCameraUsageDescription|NSMicrophoneUsageDescription/);
  assert.match(once[2],/<string>arm64<\/string>/);
  patchProject(app,swift.replaceAll('\n','\r\n'));
  const twice=['AppDelegate.swift','SceneDelegate.swift','Info.plist','Base.lproj/Main.storyboard'].map(n=>readFileSync(join(app,n),'utf8'));
  assert.deepEqual(twice,once);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
