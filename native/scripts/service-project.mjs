import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {validateServiceConfig} from '../services/config.mjs';
export function patchServiceProject(app,config){
 let clean=null;
 if(config){const {callbackScheme,authDomain,...input}=config;clean=validateServiceConfig(input);if(callbackScheme!==clean.callbackScheme||authDomain!==clean.authDomain)throw Error('Invalid compiled service configuration');}
 // stdlib plist parser: no pbxproj editing, signing material or platform dependencies on Windows.
 execFileSync(process.platform==='win32'?'python':'python3',['-c',`
import json,plistlib,sys
path=sys.argv[1]
with open(path,'rb') as f: p=plistlib.load(f)
c=json.loads(sys.argv[2])
p.pop('LumenTestServices',None)
p.pop('CFBundleURLTypes',None)
if c:
 p['LumenTestServices']={k:str(c[k]) for k in ['mode','projectId','bundleId','iosClientId','webClientId','callbackScheme','signedBundleId']}
 p['CFBundleURLTypes']=[{'CFBundleURLSchemes':[c['callbackScheme']]}]
with open(path,'wb') as f: plistlib.dump(p,f,sort_keys=False)
`,join(app,'Info.plist'),JSON.stringify(clean)],{stdio:'pipe'});
}
