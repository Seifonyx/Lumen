import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {loadServiceConfig} from './services/build-config.mjs';
import {patchFirebase,patchSync} from './services/patches.mjs';
const services=loadServiceConfig();
const freeAi=Boolean(services&&['lumen-ios-test','the-model-router'].includes(services.projectId));
const output=process.env.LUMEN_NATIVE_OUT_DIR||'native/www';
if(!['native/www','native/service-qa'].includes(output))throw Error('Native build output must stay in its isolated workspace');
const root = resolve(fileURLToPath(new URL('..', import.meta.url))).replaceAll(String.fromCharCode(92), '/');
const at = (p: string) => resolve(root, p).replaceAll(String.fromCharCode(92), '/');
const replacements: Record<string,string> = {
  [at('src/lib/firebase.ts')]: at('native/demo/account.ts'),
  [at('src/lib/sync.ts')]: at('native/demo/sync.ts'),
  [at('src/pwa/register.ts')]: at('qa/iphone/adapters/pwa-register.ts'),
  [at('src/lib/status-bar.ts')]: at('native/demo/status-bar.ts'),
  [at('src/lib/device.ts')]: at('native/demo/device.ts'),
  [at('src/lib/canvas-presentation.ts')]: at('src/lib/canvas-presentation.on.ts'),
  [at('src/components/Login.tsx')]: at('native/demo/Login.tsx'),
};
if(services){replacements[at('src/components/KeysPanel.tsx')]=at('native/services/KeysPanel.tsx');delete replacements[at('src/lib/firebase.ts')];replacements[at('src/lib/sync.ts')]=at('native/services/sync.ts');replacements[at('src/components/Login.tsx')]=at('native/services/Login.tsx');}
const strip = (id: string) => id.split('?')[0].replaceAll(String.fromCharCode(92), '/');
function demoIsolation(): Plugin {
  return {
    name:'lumen-native-isolation', enforce:'pre',
    transformIndexHtml:{order:'pre',handler(html){
      if(!services)return html;
      return (freeAi?html.replace("connect-src 'self' data: blob:","connect-src 'self' data: blob: https://openrouter.ai"):html).replace('./demo/main.ts','./services/main.ts').replace("connect-src 'self' data: blob:", "connect-src 'self' data: blob: https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com").replace('<title>Lumen Demo</title>',services.mode==='account-connected'?'<title>Lumen</title>':'<title>Lumen Test</title>');
    }},
    async resolveId(source, importer, options) {
      if(services){
        if(source==='lumen:test-config'||source==='lumen:service-config')return '\0'+source;
        if(source==='lumen:native-account')return at('native/services/account.ts');
        if(source==='lumen:canonical-sync')return at('src/lib/sync.ts')+'?lumen-real';
      }
      if (!services && /^(?:firebase|@firebase)(?:\/|$)/.test(source)) {
        if (['firebase/app','firebase/auth','firebase/firestore'].includes(source)) return at('qa/iphone/adapters/firebase-sdk.ts');
        this.error('Unreviewed Firebase import in offline demo');
      }
      if (!importer || source.startsWith('\0')) return null;
      const found = await this.resolve(source,importer,{...options,skipSelf:true});
      return found && replacements[strip(found.id)] || null;
    },
    load(id) {
      if(services&&id==='\0lumen:test-config')return 'export default '+JSON.stringify({projectId:services.projectId,apiKey:services.apiKey,appId:services.appId,authDomain:services.authDomain});
      if(services&&id==='\0lumen:service-config')return 'export default '+JSON.stringify(services);
      if(services&&/\/node_modules\/(?:@firebase|firebase)\//.test(strip(id)))return null;
      if (/\/native\/authorization\/|\/(?:tests|server)\/|\/qa\/iphone\/(?:fixtures|main)|\/src\/firebase-config.json|\/node_modules\/(?:@firebase|firebase)\//.test(strip(id))) this.error('Forbidden native demo module '+id);
    },
    transform(code,id) {
      if (!strip(id).startsWith(at('src/'))) return null;
      const changedPermission=Boolean(services&&strip(id)===at('src/lib/ai/provider-config.js'));
      if(changedPermission){const start='export function providerEnabled(provider, config) {';if(!code.includes(start))this.error('Unknown provider permission boundary');code="import {nativeAiConsent} from "+JSON.stringify(at('native/services/transport.ts'))+";\n"+code.replace(start,start+"\n  if(provider==='openrouter'&&!nativeAiConsent.current())return false;");}
      const changedProvider=Boolean(services&&strip(id)===at('src/lib/ai/providers.js'));
      if(changedProvider){const pdf="pdf: true, // OpenRouter turns PDFs into text for models that can't read them";if(!code.includes(pdf))this.error('Unknown OpenRouter capability boundary');code=code.replace(pdf,'pdf: false, // Native free-only text path does not enable PDF plugins');}
      const changedFirebase=Boolean(services&&strip(id)===at('src/lib/firebase.ts'));
      if(changedFirebase)code=patchFirebase(code);
      const changedSync=Boolean(services&&strip(id)===at('src/lib/sync.ts'));
      if(changedSync)code=patchSync(code);
      if (/\bnew\s+(?:XMLHttpRequest|WebSocket|EventSource|SharedWorker)\b|\.sendBeacon\s*\(/.test(code)) this.error('Unreviewed network primitive '+id);
      let next=code.replace(/(?<![\w$.])fetch\s*\(/g,'__demoFetch(');
      const imports=[];
      if(next!==code) imports.push('import { '+(services?'testFetch':'demoFetch')+' as __demoFetch } from '+JSON.stringify(at(services?'native/services/transport.ts':'native/demo/transport.ts'))+';');
      if (/\bnew\s+Worker\s*\(/.test(next)) {
        next=next.replace(/\bnew\s+Worker\s*\(\s*new\s+URL\s*\(\s*(['"`])[^'"`]+\1\s*,\s*import\.meta\.url\s*\)/g,'__demoWorker(null').replace(/\bnew\s+Worker\s*\(/g,'__demoWorker(');
        imports.push('import { disabledWorker as __demoWorker } from '+JSON.stringify(at('qa/iphone/adapters/worker-disabled.ts'))+';');
      }
      return imports.length||changedFirebase||changedSync||changedProvider||changedPermission ? {code:imports.join('\n')+'\n'+next,map:null}:null;
    },
    generateBundle() {
      const modules=[...this.getModuleIds()].map(strip);
      for(const target of Object.keys(replacements)) if(modules.includes(target)&&!(services&&target===at('src/lib/sync.ts'))) this.error('Canonical module escaped replacement '+target);
      // The Canvas mark (Logo renders /icon.svg). publicDir is off, so the one approved Crease file is packaged here;
      // without it the demo's first screen showed a broken image in the Simulator.
      this.emitFile({type:'asset',fileName:'icon.svg',source:readFileSync(at('public-canvas/icon.svg'))});
      this.emitFile({type:'asset',fileName:'demo-build.json',source:JSON.stringify({presentation:'canvas',mode:services?'isolated-test':'offline-demo',freeAi,serviceConfig:services||undefined,modules:modules.filter(p=>p.startsWith(root)).map(p=>p.slice(root.length+1))},null,2)});
    }
  };
}
export default defineConfig({
  root:at('native'), base:'./', publicDir:false,
  plugins:[demoIsolation(),react()],
  build:{outDir:at(output),emptyOutDir:true,target:'es2020',sourcemap:false,assetsInlineLimit:0,modulePreload:{polyfill:false},chunkSizeWarningLimit:4000},
  server:{host:'127.0.0.1',port:5206,strictPort:true}
});
