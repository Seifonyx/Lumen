import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(fileURLToPath(new URL('..', import.meta.url))).replaceAll(String.fromCharCode(92), '/');
const at = (p: string) => resolve(root, p).replaceAll(String.fromCharCode(92), '/');
const replacements: Record<string,string> = {
  [at('src/lib/firebase.ts')]: at('native/demo/account.ts'),
  [at('src/lib/sync.ts')]: at('qa/iphone/adapters/sync.ts'),
  [at('src/pwa/register.ts')]: at('qa/iphone/adapters/pwa-register.ts'),
  [at('src/lib/status-bar.ts')]: at('native/demo/status-bar.ts'),
  [at('src/lib/device.ts')]: at('native/demo/device.ts'),
  [at('src/lib/canvas-presentation.ts')]: at('src/lib/canvas-presentation.on.ts'),
  [at('src/components/Login.tsx')]: at('native/demo/Login.tsx'),
};
const strip = (id: string) => id.split('?')[0].replaceAll(String.fromCharCode(92), '/');
function demoIsolation(): Plugin {
  return {
    name:'lumen-native-offline-demo', enforce:'pre',
    async resolveId(source, importer, options) {
      if (/^(?:firebase|@firebase)(?:\/|$)/.test(source)) {
        if (['firebase/app','firebase/auth','firebase/firestore'].includes(source)) return at('qa/iphone/adapters/firebase-sdk.ts');
        this.error('Unreviewed Firebase import in offline demo');
      }
      if (!importer || source.startsWith('\0')) return null;
      const found = await this.resolve(source,importer,{...options,skipSelf:true});
      return found && replacements[strip(found.id)] || null;
    },
    load(id) {
      if (/\/(?:tests|server)\/|\/qa\/iphone\/(?:fixtures|main)|\/src\/firebase-config.json|\/node_modules\/(?:@firebase|firebase)\//.test(strip(id))) this.error('Forbidden native demo module '+id);
    },
    transform(code,id) {
      if (!strip(id).startsWith(at('src/'))) return null;
      if (/\bnew\s+(?:XMLHttpRequest|WebSocket|EventSource|SharedWorker)\b|\.sendBeacon\s*\(/.test(code)) this.error('Unreviewed network primitive '+id);
      let next=code.replace(/(?<![\w$.])fetch\s*\(/g,'__demoFetch(');
      const imports=[];
      if(next!==code) imports.push('import { demoFetch as __demoFetch } from '+JSON.stringify(at('native/demo/transport.ts'))+';');
      if (/\bnew\s+Worker\s*\(/.test(next)) {
        next=next.replace(/\bnew\s+Worker\s*\(\s*new\s+URL\s*\(\s*(['"`])[^'"`]+\1\s*,\s*import\.meta\.url\s*\)/g,'__demoWorker(null').replace(/\bnew\s+Worker\s*\(/g,'__demoWorker(');
        imports.push('import { disabledWorker as __demoWorker } from '+JSON.stringify(at('qa/iphone/adapters/worker-disabled.ts'))+';');
      }
      return imports.length ? {code:imports.join('\n')+'\n'+next,map:null}:null;
    },
    generateBundle() {
      const modules=[...this.getModuleIds()].map(strip);
      for(const target of Object.keys(replacements)) if(modules.includes(target)) this.error('Canonical module escaped replacement '+target);
      // The Canvas mark (Logo renders /icon.svg). publicDir is off, so the one approved Crease file is packaged here;
      // without it the demo's first screen showed a broken image in the Simulator.
      this.emitFile({type:'asset',fileName:'icon.svg',source:readFileSync(at('public-canvas/icon.svg'))});
      this.emitFile({type:'asset',fileName:'demo-build.json',source:JSON.stringify({presentation:'canvas',mode:'offline-demo',modules:modules.filter(p=>p.startsWith(root)).map(p=>p.slice(root.length+1))},null,2)});
    }
  };
}
export default defineConfig({
  root:at('native'), base:'./', publicDir:false,
  plugins:[demoIsolation(),react()],
  build:{outDir:at('native/www'),emptyOutDir:true,target:'es2020',sourcemap:false,assetsInlineLimit:0,modulePreload:{polyfill:false},chunkSizeWarningLimit:4000},
  server:{host:'127.0.0.1',port:5206,strictPort:true}
});
