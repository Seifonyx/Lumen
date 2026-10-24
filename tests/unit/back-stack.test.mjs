import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transform } from 'sucrase';
test('nested presentations reconcile to their real parent and account cleanup closes every layer',()=>{
 const cleanups=[],closed=[];
 const source=transform(readFileSync('src/lib/back-stack.ts','utf8').replace(/^import .*;$/gm,'').replace(/export /g,''),{transforms:['typescript']}).code;
 const context=vm.createContext({useRef:value=>({current:value}),useEffect:fn=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup)},Map,Set,Symbol});
 vm.runInContext(source+';globalThis.api={useBackLayer,backLayerIdentity,backLayerRestore,backLayerOpen,reconcileBackLayers};',context);
 const {api}=context;const restoreEditor=()=>{};
 api.useBackLayer(true,()=>closed.push('editor'),restoreEditor,'editor');
 api.useBackLayer(true,()=>closed.push('tool'),()=>{},'tool');
 assert.equal(api.backLayerIdentity(),'tool');assert.equal(api.reconcileBackLayers('editor'),true);
 assert.deepEqual(closed,['tool']);assert.equal(api.backLayerRestore(),restoreEditor);
 cleanups[1]();assert.equal(api.backLayerIdentity(),'editor','late cleanup for dismissed sheet cannot remove its parent');
 assert.equal(api.reconcileBackLayers(null),false);assert.deepEqual(closed,['tool','editor']);assert.equal(api.backLayerOpen(),false);
 for(const cleanup of cleanups)cleanup();assert.equal(api.backLayerOpen(),false);
});
