import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const marker='// LUMEN NATIVE FOUNDATION (generated; source: native/DemoViewController.swift)';
/** Only edits the generated app. No identifiers, origins, UIDs or database versions change. */
export function patchProject(app,swift) {
 const read=name=>readFileSync(join(app,name),'utf8').replaceAll('\r\n','\n');
 const write=(name,text)=>writeFileSync(join(app,name),text);
 // Capacitor 8's SceneDelegate creates its controller directly; storyboard changes alone are ignored.
 let scene=read('SceneDelegate.swift').replace('rootViewController = CAPBridgeViewController()', 'rootViewController = UIHostingController(rootView: LumenRootView())');
 if(!scene.includes('rootViewController = UIHostingController(rootView: LumenRootView())')) throw new Error('Unknown Capacitor scene template; native protection cannot be installed safely.');
 if(!scene.includes('LumenHandleGoogleURL')) {
  scene=scene.replace('SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)', 'let remaining = Set(URLContexts.filter { !LumenHandleGoogleURL($0.url) })\n        if !remaining.isEmpty { SceneDelegateProxy.shared.scene(scene, openURLContexts: remaining) }');
  scene=scene.replace('SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)', 'if !connectionOptions.urlContexts.contains(where: { LumenHandleGoogleURL($0.url) }) {\n            SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)\n        }');
 }
 if (!scene.includes('import SwiftUI')) scene = 'import SwiftUI\n' + scene;
 write('SceneDelegate.swift',scene);
 const delegate=read('AppDelegate.swift');
 const clean=delegate.split(marker)[0].split('\nimport UIKit\nimport WebKit\nimport Capacitor')[0].trimEnd();
 write('AppDelegate.swift',clean+'\n\n'+marker+'\n'+swift.replaceAll('\r\n','\n'));
 const storyboard=read('Base.lproj/Main.storyboard').replace('customClass="CAPBridgeViewController" customModule="Capacitor"','customClass="DemoViewController" customModule="App"');
 write('Base.lproj/Main.storyboard',storyboard);
 let plist=read('Info.plist').replace('<string>armv7</string>','<string>arm64</string>');
 if(!plist.includes('<key>UIFileSharingEnabled</key>')) plist=plist.replace('</dict>\n</plist>','<key>UIFileSharingEnabled</key><true/><key>LSSupportsOpeningDocumentsInPlace</key><true/></dict>\n</plist>');
 write('Info.plist',plist);
}
