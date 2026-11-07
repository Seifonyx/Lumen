import {readFileSync} from 'node:fs';
import {validateServiceConfig} from './config.mjs';
export function loadServiceConfig(env=process.env){
 const mode=env.LUMEN_NATIVE_MODE||'offline-demo';
 if(mode==='offline-demo')return null;
 if(mode!=='isolated-test')throw Error('Production-connected native builds are not authorized');
 if(!env.LUMEN_NATIVE_SERVICE_CONFIG)throw Error('Missing owner-approved isolated test SDK config. Offline demo remains the default.');
 const text=readFileSync(env.LUMEN_NATIVE_SERVICE_CONFIG,'utf8');if(text.length>32000)throw Error('Unexpected test config size');
 const c=validateServiceConfig(JSON.parse(text));
 const prod=JSON.parse(readFileSync(new URL('../../src/firebase-config.json',import.meta.url),'utf8'));
 if(c.projectId===prod.projectId||c.apiKey===prod.apiKey||c.appId===prod.appId)throw Error('Production Firebase configuration refused');
 return c;
}
