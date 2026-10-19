import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';

// Exercise the actual settings caller during cached-account startup, with the
// real durability coordinator. DOM/storage/SDK boundaries stay isolated.
const source=readFileSync('src/store.ts','utf8');
const start=source.indexOf('    updateSettings(patch) {');
const end=source.indexOf('\n    toast(text,',start);
assert(start>=0 && end>start,'exercise the current updateSettings caller');
const method=source.slice(start,end).trim().replace(/,$/,'');
const fixtureId='\0account-settings-startup.ts';
const output='node_modules/.cache/unit-tests/account-settings-startup-fixture.mjs';
mkdirSync('node_modules/.cache/unit-tests',{recursive:true});
const entry=`
import { createAccountSettingsPersistence } from ${JSON.stringify(resolve('src/lib/account-settings-persistence.ts'))};
export function startup({authed=true,accessDenied=null,ready=false}={}) {
  const owner='cached-account',local=new Map(),sends=[],stages=[],globalSaves=[],timers=new Map();
  let revision=0,settingsReady=ready,settingsTimer,rawCatalogValue=null,derivedCatalogSettings='';
  const state={user:{uid:owner},authed,accessDenied,settings:{theme:'dark',layouts:[],voiceLang:'en'},toasts:[]};
  const coordinator=createAccountSettingsPersistence({
    readLocal:uid=>local.get(uid)||null,
    writeLocal:(uid,patch)=>{local.set(uid,structuredClone({...local.get(uid),...patch}));return true;},
    enqueueRemote:(uid,settings)=>{sends.push({uid,settings});return new Promise(()=>{});},
    currentUid:()=>state.user?.uid||null,currentSession:()=>1,
    isDenied:()=>Boolean(state.accessDenied),isPreview:()=>false,revision:()=>String(++revision),
  });
  local.set(owner,{settings:{theme:'dark',layouts:[]},settingsRevision:'seed',pendingSettingsRevision:null});
  const get=()=>state,set=patch=>Object.assign(state,patch);
  const saveSettings=value=>globalSaves.push(structuredClone(value));
  const applyAppearance=()=>{},pageTransition=()=>{},navigator={};
  const cacheAccountSettings=(uid,value)=>{
    stages.push({uid,value:structuredClone(value)});
    try {coordinator.stage(uid,value);return true;}catch{return false;}
  };
  const saveRemoteSettings=async(uid,value)=>{coordinator.stage(uid,value);coordinator.flush(uid);};
  const setTimeout=callback=>{const id=Symbol();timers.set(id,callback);return id;};
  const clearTimeout=id=>timers.delete(id);
  const store={${method},toast:text=>state.toasts.push({text})};
  return {store,state,sends,stages,globalSaves,coordinator,
    cache:()=>local.get(owner),
    ready:()=>{settingsReady=true;},
    flushTimers:()=>{for(const [id,callback]of timers){timers.delete(id);callback();}},
  };
}
`;
await build({input:fixtureId,output:{file:output,format:'esm'},logLevel:'silent',plugins:[{
  name:'actual-startup-settings-caller',resolveId:id=>id===fixtureId?id:undefined,
  load:id=>id===fixtureId?entry:undefined,
}]});
const {startup}=await import(pathToFileURL(resolve(output)).href);
const layout={id:'created-during-startup',name:'Saved before refresh',models:['groq:chat']};

test('a genuine cached-startup edit is durable before remote refresh, without dispatching before readiness',()=>{
  const h=startup(),input={layouts:[structuredClone(layout)]};
  h.store.updateSettings(input);
  assert.deepEqual(h.cache().settings.layouts,[layout],
    'the visible startup editor must stage account settings before its slow account read completes');
  assert.equal(h.cache().pendingSettingsRevision,h.cache().settingsRevision);
  assert.equal('voiceLang' in h.cache().settings,false,'device voice language remains outside shared settings');
  input.layouts[0].name='mutated after edit';
  assert.deepEqual(h.cache().settings.layouts,[layout],'the pending account snapshot must be immutable to later caller edits');
  h.flushTimers();assert.deepEqual(h.sends,[],'startup durability must not bypass the verified account-read boundary');
});

test('empty cached hydration cannot stage stale local defaults before the remote refresh',()=>{
  const h=startup(),initial=structuredClone(h.cache());
  h.store.updateSettings({});h.flushTimers();
  assert.deepEqual(h.cache(),initial);assert.deepEqual(h.stages,[]);assert.deepEqual(h.sends,[]);
});

for(const state of [{authed:null},{authed:false},{accessDenied:'denied@example.invalid'}])
  test(`startup edits cannot stage or dispatch without an allowed visible account: ${JSON.stringify(state)}`,()=>{
    const h=startup(state),initial=structuredClone(h.cache());
    h.store.updateSettings({layouts:[layout]});h.flushTimers();
    assert.deepEqual(h.cache(),initial);assert.deepEqual(h.stages,[]);assert.deepEqual(h.sends,[]);
  });

test('a startup edit wins a previously captured stale account read and replays only the latest revision',()=>{
  const h=startup(),read=h.coordinator.captureRead('cached-account');
  h.store.updateSettings({layouts:[layout]});
  const chosen=h.coordinator.reconcileRead('cached-account',read,{theme:'light',layouts:[]});
  assert.deepEqual(chosen,{theme:'dark',layouts:[layout]},'fresh remote settings cannot erase an edit made after reading began');
  h.ready();assert.equal(h.coordinator.resume('cached-account'),true);
  assert.equal(h.coordinator.resume('cached-account'),false);
  assert.equal(h.sends.length,1);assert.deepEqual(h.sends[0].settings,chosen);
});

test('once settings are ready, the existing debounce dispatches only the latest durable edit',()=>{
  const h=startup({ready:true});
  h.store.updateSettings({layouts:[layout]});
  h.store.updateSettings({layouts:[{...layout,name:'Latest before debounce'}]});
  assert.equal(h.sends.length,0);h.flushTimers();
  assert.equal(h.sends.length,1);assert.equal(h.sends[0].settings.layouts[0].name,'Latest before debounce');
});
