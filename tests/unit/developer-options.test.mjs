import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'rolldown';

// Render the actual settings component, not a copied permission predicate.
// All currently invited Firebase accounts are developers, so ordinary-user
// visibility must be covered independently of the explicit preview browser.
const settings=readFileSync('src/components/SettingsModal.tsx','utf8');
const firebase=readFileSync('src/lib/firebase.ts','utf8');
const start=settings.indexOf('function AboutSection() {');
const end=settings.indexOf('\nconst PRESET_INSTRUCTIONS',start);
const developers=settings.match(/const DEVELOPERS = .*;/)?.[0];
const preview=firebase.match(/export function isPreviewUser\([^]*?\n}/)?.[0];
assert(start>=0 && end>start && developers && preview,'use the current rendered component and identity policy');
const id='\0developer-options-fixture.tsx';
const output=resolve('node_modules/.cache/unit-tests/developer-options-fixture.mjs');
mkdirSync('node_modules/.cache/unit-tests',{recursive:true});
const entry=`
import React, {useState} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const APP_VERSION='test',SUPPORT_EMAIL='support@example.invalid',navigator={userAgent:'unit-test'};
${developers}
${preview}
let state;
const useStore=selector=>selector(state);
const PreviewTools=()=>null,RefreshCw=()=>null;
${settings.slice(start,end)}
export function render(user) {state={user,updateReady:null};return renderToStaticMarkup(<AboutSection/>);}
`;
await build({input:id,external:['react','react-dom/server','react/jsx-runtime'],output:{file:output,format:'esm'},logLevel:'silent',plugins:[{
  name:'actual-about-section',resolveId:source=>source===id?id:null,load:source=>source===id?entry:null,
}]});
const {render}=await import(pathToFileURL(output).href);
test('ordinary and missing users cannot render developer controls',()=>{
  for(const user of [null,{}, {uid:'ordinary',email:'reader@example.invalid'},
    {uid:'ordinary',email:'fixture@local.invalid',displayName:'Developer'},
    {uid:'ordinary-preview-user',email:'reader@example.invalid'}]) {
    const markup=render(user);
    assert.match(markup,/Privacy Policy/,'the real settings section rendered');
    assert.doesNotMatch(markup,/Developer options|For developers and testing only/);
  }
});
test('only configured developers and explicit preview identities render the controls',()=>{
  for(const user of [{uid:'ordinary',email:'hebaghoneim8@gmail.com'},
    {uid:'ordinary',email:'SEIFELDINGAMAL2021@GMAIL.COM'},
    {uid:'preview-browser-test',email:'fixture@local.invalid'}]) {
    assert.match(render(user),/Developer options/);
  }
});
