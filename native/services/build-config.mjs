import {readFileSync} from 'node:fs';
import {validateServiceConfig} from './config.mjs';
export function loadServiceConfig(env=process.env){
 const mode=env.LUMEN_NATIVE_MODE||'offline-demo';
 if(mode==='offline-demo')return null;
 if(!['isolated-test','account-connected'].includes(mode))throw Error('Unknown native service mode');
 if(!env.LUMEN_NATIVE_SERVICE_CONFIG)throw Error('Missing owner-approved isolated test SDK config. Offline demo remains the default.');
 const text=readFileSync(env.LUMEN_NATIVE_SERVICE_CONFIG,'utf8');if(text.length>32000)throw Error('Unexpected test config size');
 const c=validateServiceConfig(JSON.parse(text));
 if(c.mode!==mode)throw Error('Native build and approved configuration modes do not match');
 const prod=JSON.parse(readFileSync(new URL('../../src/firebase-config.json',import.meta.url),'utf8'));
 if(mode==='account-connected'){
  for(const field of ['projectId','projectNumber','apiKey','appId'])if(c[field]!==prod[field])throw Error('Existing-account build must match canonical web configuration');
 }else if(c.projectId===prod.projectId||c.apiKey===prod.apiKey||c.appId===prod.appId)throw Error('Production Firebase configuration refused');
 return c;
}
