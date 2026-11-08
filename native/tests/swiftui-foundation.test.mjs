import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const swift=readFileSync(new URL('../SwiftUIFoundation.swift',import.meta.url),'utf8');
const project=readFileSync(new URL('../scripts/project.mjs',import.meta.url),'utf8');
const prepare=readFileSync(new URL('../scripts/prepare-ios.mjs',import.meta.url),'utf8');
const smoke=readFileSync(new URL('../scripts/simulator-smoke.sh',import.meta.url),'utf8');

test('Phase 0 uses real native SwiftUI chrome and Apple Liquid Glass API',()=>{
  for(const token of ['TabView(selection:', 'NavigationStack', '.buttonStyle(.glassProminent)', '.buttonStyle(.glass)', '#available(iOS 26.0, *)']){
    assert.ok(swift.includes(token),token);
  }
});
test('Native shell embeds one existing protected account-connected bridge',()=>{
  assert.match(swift,/UIViewControllerRepresentable/);
  assert.match(swift,/let controller = DemoViewController\(\)/);
  assert.match(prepare,/SwiftUIFoundation.swift/);
  assert.match(project,/rootViewController = UIHostingController\(rootView: LumenRootView\(\)\)/);
  assert.match(project,/LumenHandleGoogleURL/);
  assert.doesNotMatch(swift,/signOut|FirebaseApp|setDoc|deleteDoc/);
});
test('Simulator captures both existing Lumen flow and native home',()=>{
  assert.match(smoke,/--demo-smoke/);
  assert.match(smoke,/--native-shell-smoke/);
  assert.match(smoke,/native-home\.png/);
});
