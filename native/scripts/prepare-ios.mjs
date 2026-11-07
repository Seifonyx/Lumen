import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const cap='node_modules/@capacitor/cli/bin/capacitor';
if(!existsSync('ios/App')) execFileSync(process.execPath,[cap,'add','ios'],{stdio:'inherit'});
execFileSync(process.execPath,[cap,'sync','ios'],{stdio:'inherit'});
const app='ios/App/App/';
const delegate=readFileSync(app+'AppDelegate.swift','utf8');
const extra=readFileSync('DemoViewController.swift','utf8');
const base=delegate.split('\nimport UIKit\nimport WebKit\nimport Capacitor')[0];
writeFileSync(app+'AppDelegate.swift',base+'\n'+extra);
const storyboard=app+'Base.lproj/Main.storyboard';
writeFileSync(storyboard,readFileSync(storyboard,'utf8').replace('customClass="CAPBridgeViewController" customModule="Capacitor"','customClass="DemoViewController" customModule="App"'));
const plist=app+'Info.plist';
let text=readFileSync(plist,'utf8').replace('<string>armv7</string>','<string>arm64</string>');
text=text.replace('</dict>\n</plist>','<key>UIFileSharingEnabled</key><true/><key>LSSupportsOpeningDocumentsInPlace</key><true/></dict>\n</plist>');
writeFileSync(plist,text);
const assets=app+'Assets.xcassets/';
if(process.platform==='darwin') {
  execFileSync('sips',['-z','1024','1024','../public-canvas/icon-512.png','--out',assets+'AppIcon.appiconset/AppIcon-512@2x.png']);
}
const splash=assets+'Splash.imageset/';
copyFileSync('../public-canvas/splash/light-1170x2532.png',splash+'lumen-light.png');
copyFileSync('../public-canvas/splash/dark-1170x2532.png',splash+'lumen-dark.png');
writeFileSync(splash+'Contents.json',JSON.stringify({images:[
 {idiom:'universal',filename:'lumen-light.png'},
 {idiom:'universal',filename:'lumen-dark.png',appearances:[{appearance:'luminosity',value:'dark'}]}
],info:{version:1,author:'xcode'}},null,2));
console.log('Prepared isolated iOS demo. Signing and native authentication remain disabled.');
