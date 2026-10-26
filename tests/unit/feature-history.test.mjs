// Real history adapter, with deterministic browser/store IO. Browser journeys separately
// cover rendered controls. Starting inside a feature must not become its own Exit origin.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'rolldown';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const state={user:{uid:'synthetic-owner'},chats:[{id:'origin'},{id:'source'}],currentId:'origin',activeProjectId:null,settings:{projects:[]},page:null,pageArg:undefined,runner:null,canvasOpen:false,canvasDocumentId:null,settingsOpen:false,settingsTab:'',projectWorkspaceOpen:false};
const listeners=new Set();
globalThis.__featureHistoryStore={getState:()=>state,setState:patch=>{Object.assign(state,patch);listeners.forEach(fn=>fn())},subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};
const events=new EventTarget();globalThis.window={addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),matchMedia:()=>({matches:false})};
globalThis.document={activeElement:null,querySelector:()=>null};globalThis.HTMLElement=class{};globalThis.requestAnimationFrame=()=>0;
let stack,cursor;
globalThis.history={get state(){return stack[cursor]},replaceState(value){stack[cursor]=value},pushState(value){stack.splice(++cursor);stack[cursor]=value},back(){this.go(-1)},go(delta){const target=cursor+delta;if(target<0||target>=stack.length)return;cursor=target;events.dispatchEvent(new Event('popstate'))}};
const file='node_modules/.cache/unit-tests/feature-history.mjs';
await build({input:'src/lib/screen-history.ts',output:{file,format:'esm'},logLevel:'silent',plugins:[{name:'feature-history-io',resolveId(source,importer){if(source==='react-dom')return '\0flush';if(importer?.replaceAll('\\','/').endsWith('/screen-history.ts')&&source==='../store'||importer?.replaceAll('\\','/').endsWith('/screen-memory.ts')&&source==='../store')return '\0store'},load(id){if(id==='\0flush')return 'export const flushSync=run=>run();';if(id==='\0store')return 'export const useStore=globalThis.__featureHistoryStore;'}}]});
const api=await import(pathToFileURL(resolve(file)));
for(const direct of [false,true])test(`${direct?'direct-start':'chat-origin'} Library document exits without a duplicate route`,()=>{
 Object.assign(state,{page:direct?'collection':null,currentId:'origin',canvasOpen:false});stack=[{}];cursor=0;const stop=api.installScreenHistory();
 if(!direct)globalThis.__featureHistoryStore.setState({page:'collection'});
 api.navigateScreen(()=>globalThis.__featureHistoryStore.setState({page:null,currentId:'source',canvasOpen:true,canvasDocumentId:'doc'}));
 const length=stack.length;api.exitFeature();assert.equal(state.page,null);assert.equal(state.canvasOpen,false);assert.equal(state.currentId,'origin');assert.equal(cursor,0);assert.equal(stack.length,length,'Exit traverses/replaces, never pushes a chat');
 stop();
});
test('Library exits to the originating project screen, not its internal predecessor',()=>{
 Object.assign(state,{page:'projects',currentId:'origin',canvasOpen:false});stack=[{}];cursor=0;const stop=api.installScreenHistory();
 globalThis.__featureHistoryStore.setState({page:'collection'});assert.equal(api.featureExitLabel(),'Return to previous screen');api.exitFeature();assert.equal(state.page,'projects');stop();
});
