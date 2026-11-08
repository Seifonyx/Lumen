import { fileURLToPath } from 'node:url';
import { patchProject } from './project.mjs';
import {patchServiceProject} from './service-project.mjs';
import {linkGoogleSignIn} from './google-spm.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const cap='node_modules/@capacitor/cli/bin/capacitor';
if(!existsSync('ios/App')) execFileSync(process.execPath,[cap,'add','ios'],{stdio:'inherit'});
execFileSync(process.execPath,[cap,'sync','ios'],{stdio:'inherit'});
const app='ios/App/App/';
const built=JSON.parse(readFileSync('www/demo-build.json','utf8'));
if(!['offline-demo','isolated-test','account-connected'].includes(built.mode))throw Error('Unreviewed native mode refused');
const isolated=built.mode!=='offline-demo';
const authSource=isolated?'GoogleAuthPlugin.swift':'DisabledGoogleAuthPlugin.swift';
patchProject(app,readFileSync('DemoViewController.swift','utf8')+'\n'+readFileSync('NativeSessionVault.swift','utf8')+'\n'+readFileSync(authSource,'utf8'));
// A normal offline build must not depend on the Google SDK or fetch external Swift packages.
// Only a reviewed, explicitly configured test build links GoogleSignIn.
if(isolated){
 const packagePath='ios/App/CapApp-SPM/Package.swift';
 let manifest=readFileSync(packagePath,'utf8');
 manifest=linkGoogleSignIn(manifest,true);
 writeFileSync(packagePath,manifest);
}
patchServiceProject(app,isolated?built.serviceConfig:null);
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
console.log(built.mode==='account-connected'?'Prepared existing-account iOS app. No deployment, signing or inference performed.':isolated?'Prepared isolated iOS test. No production services, signing or live inference.':'Prepared isolated iOS demo. Signing and native authentication remain disabled.');
