import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'sucrase';

test('screen history restores canonical nested UI, context, layers and account boundaries with opaque markers', () => {
 const listeners=new Set(), routingListeners=new Set(), layerListeners=new Set(), events=new Map();
 let state={user:{uid:'owner-a'},currentId:'chat-a',activeProjectId:'project-a',page:null,pageArg:undefined,settingsOpen:false,settingsTab:'',settings:{projects:[{id:'project-a'},{id:'project-b'}]},chats:[{id:'chat-a'},{id:'chat-b'}],projectWorkspaceOpen:false};
 let route={open:false,section:'overview'}, layer=false, restored=0, cleared=0;
 const store={getState:()=>state,setState:patch=>{state={...state,...patch};listeners.forEach(fn=>fn())},subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};
 const states=[],history={state:null,pushState(value){this.state=value;states.push(value)},replaceState(value){this.state=value;if(states.length)states[states.length-1]=value;else states.push(value)},back(){this.state=states[0];events.get('popstate')?.()}};
 const mock={configureBackLayerContext:()=>{},flushSync:fn=>fn(),useStore:store,getRoutingScreen:()=>route,restoreRoutingScreen:next=>{route=next;routingListeners.forEach(fn=>fn())},subscribeRoutingCenter:fn=>{routingListeners.add(fn);return()=>routingListeners.delete(fn)},reconcileBackLayers:key=>{if(!key)layer=false;return layer},backLayerOpen:()=>layer,backLayerIdentity:()=> 'all-chats',backLayerRestore:()=>()=>{layer=true;restored++},clearBackLayerRestore:()=>{},closeTopBackLayer:()=>{layer=false;layerListeners.forEach(fn=>fn())},subscribeBackLayers:fn=>{layerListeners.add(fn);return()=>layerListeners.delete(fn)},clearScreenMemory:()=>cleared++};
 const source=readFileSync('src/lib/screen-history.ts','utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
 const js=transform(source,{transforms:['typescript']}).code;
 const context=vm.createContext({...mock,history,window:{addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)},document:{activeElement:null,querySelector:()=>null},HTMLElement:class{},requestAnimationFrame:fn=>fn(),Math,Map,JSON});
 vm.runInContext(js+';globalThis.install=installScreenHistory;',context);
 const cleanup=context.install();
 store.setState({page:'collection'});const library=history.state;
 store.setState({settingsOpen:true,settingsTab:'keys',page:null});const settings=history.state;
 const pop=entry=>{history.state=entry;events.get('popstate')()};
 pop(library);assert.equal(state.page,'collection');assert.equal(state.settingsOpen,false);
 pop(settings);assert.equal(state.settingsOpen,true);assert.equal(state.settingsTab,'keys');
 store.setState({activeProjectId:'project-b',currentId:'chat-b'});pop(library);assert.equal(state.activeProjectId,'project-a');assert.equal(state.currentId,'chat-a');
 layer=true;layerListeners.forEach(fn=>fn());const layerEntry=history.state;
 pop(library);assert.equal(layer,false);pop(layerEntry);assert.equal(restored,1);assert.equal(layer,true);
 for(const marker of states){assert.deepEqual(Object.keys(marker),['lumenScreen']);assert.deepEqual(Object.keys(marker.lumenScreen).sort(),['id','session']);}
 store.setState({user:{uid:'owner-b'}});assert.equal(state.page,null);assert.equal(state.settingsOpen,false);assert.equal(route.open,false);assert.equal(cleared,1);
 pop(settings);assert.equal(state.settingsOpen,false,'old account history cannot reopen its UI');
 cleanup();assert.equal(listeners.size,0);assert.equal(routingListeners.size,0);assert.equal(layerListeners.size,0);
});
