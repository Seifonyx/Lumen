import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

for(const plugin of ['DisabledGoogleAuthPlugin.swift','GoogleAuthPlugin.swift']){
 test(`${plugin} exposes nonoptional Capacitor bridged methods`,()=>{
  const content=readFileSync(fileURLToPath(new URL('../'+plugin,import.meta.url)),'utf8');
  // CAPPluginMethod(name:returnType:) is failable; `.map` would produce
  // [CAPPluginMethod?] and fail a real arm64 Swift compile.
  assert.match(content,/let pluginMethods:\s*\[CAPPluginMethod\]\s*=\s*\[/);
  assert.match(content,/\]\.compactMap\s*\{/);
  for(const name of ['signIn','restore','signOut','revoke','cancel'])
   assert.ok(content.includes('\"'+name+'\"'),`missing bridged ${name}`);
  assert.doesNotMatch(content,/\]\.map\s*\{\s*CAPPluginMethod/);
 });
}
