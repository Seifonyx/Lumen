// Local-only identity studies using the real built Lumen app and synthetic data.
// No product entry point imports this script or the accompanying styles.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const AxeBuilder=require('@axe-core/playwright').default;
const {profile,seed}=require('../../../tests/e2e/helpers/preview-profile.cjs');
const root=path.resolve(__dirname,'../../..');
const out=process.env.BLACKOUT_OUT||path.join(__dirname,'screens');
const concept=process.env.BLACKOUT_CONCEPT||'baseline';
const theme=process.env.BLACKOUT_THEME||'dark';
const width=Number(process.env.BLACKOUT_WIDTH)||1440;
const height=width<900?844:960;
const engine=process.env.MR_WEBKIT?webkit:chromium;
const now=1792497600000;
const chats=[{id:'launch',title:'A launch worth remembering',createdAt:now-100000,updatedAt:now,model:'auto',messages:[
 {id:'question',role:'user',text:'I’m launching a small design studio. Help me make a focused first-week plan — something I can actually follow.',createdAt:now-90000},
 {id:'answer',role:'assistant',model:'gemini:gemini-flash-latest',route:'writing · balanced',status:'done',createdAt:now-80000,text:'## Make the first week count.\n\nYou don’t need a louder launch. You need a clear offer, a small audience, and a reason for them to come back.\n\n### Lead with one strong idea\nDescribe the problem you solve in one sentence. Pair it with **one excellent piece of work**, rather than an entire portfolio.\n\n### A week with a little structure\n\n| When | Focus | Something finished |\n|---|---|---|\n| Monday | Define the offer | One clear project page |\n| Tuesday–Wednesday | Start conversations | Five personal introductions |\n| Thursday–Friday | Listen and refine | A stronger second version |\n\nKeep the work small enough to finish. The goal is **five useful conversations**, not five hundred impressions.\n\nWould you like to turn Monday into a checklist?'}]},
 ...['Notes for a quieter workspace','Research: independent studios','Fix the Safari sign-in flow','A better project brief','Reading list — October'].map((title,i)=>({id:'history-'+i,title,createdAt:now-(i+1)*86400000,updatedAt:now-(i+1)*86400000,pinned:i===2,messages:[{id:'m-'+i,role:'user',text:title,createdAt:now-100000}]}))];
if(process.env.BLACKOUT_LIBRARY_ONLY)chats[0].documents=[
 {id:'brief',name:'The studio launch brief.md',content:'# The studio launch brief\n\nA clear offer. A small audience. Work worth returning to.\n\n## First week\n- Define one useful service\n- Show one excellent project\n- Start five conversations',updatedAt:now},
 {id:'notes',name:'Conversations and observations.md',content:'# Conversations and observations\n\nListen before adding more.\n\n## Questions to ask\nWhat is slowing your team down?\nWhat would a better first week look like?',updatedAt:now-60000},
 {id:'reading',name:'Reading for a quieter workspace.md',content:'# Reading for a quieter workspace\n\nKeep a short shelf of useful ideas.\n\n## This month\nClarity in writing\nA practical project rhythm\nDesigning for attention',updatedAt:now-120000}
];
const marks=require('./marks.cjs');

(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await engine.launch();
 try {
  const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block',reducedMotion:'reduce'});
  const owner=`preview-blackout-${width}-${theme}`;
  await profile(context,owner,theme,{enabledModels:['gemini:gemini-flash-latest','gemini:gemini-2.5-pro'],defaultModel:'auto',messageNavigator:false});
  let inferenceRequests=0;
  await context.route('**/generativelanguage.googleapis.com/**',route=>{
   if(!route.request().url().includes('/models?')){inferenceRequests++;return route.abort();}
   return route.fulfill({json:{models:['gemini-flash-latest','gemini-2.5-pro'].map(name=>({name:'models/'+name,displayName:name.includes('pro')?'Gemini 2.5 Pro':'Gemini Flash',inputTokenLimit:128000,supportedGenerationMethods:['generateContent']}))}});
  });
  await context.route('**/__blackout-font/archivo.ttf',route=>route.fulfill({path:path.join(__dirname,'assets/Archivo.ttf'),contentType:'font/ttf'}));
  const page=await context.newPage(),errors=[],accessibility={};
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5190/');
  await page.locator('.composer textarea').waitFor();
  await seed(page,owner,chats);await page.reload();await page.locator('.composer textarea').waitFor();
  const apply=async()=>{
   if(concept==='baseline')return;
   await page.evaluate(c=>document.documentElement.dataset.blackout=c,concept);
   await page.addStyleTag({content:fs.readFileSync(path.join(__dirname,'identity-studies.css'),'utf8')});
   await page.evaluate(mark=>{for(const logo of document.querySelectorAll('svg.logo')){logo.setAttribute('viewBox','0 0 64 64');logo.innerHTML=mark;}},marks[concept]);
  };
  await apply();
  const capture=async state=>{
   await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   assert(!overflow,`${concept} ${width} ${state}: no horizontal overflow`);
   if(concept!=='baseline') {
    const signal=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--signal').trim());
    assert(!/c2ef3a|b3e324|d0f75a/i.test(signal),'the study overrides the actual inherited lime brand token');
    if(state==='chat') {
     const heading=await page.locator('.markdown h2').first().evaluate(node=>({size:parseFloat(getComputedStyle(node).fontSize),font:getComputedStyle(node).fontFamily}));
     assert(heading.size>=27 && heading.font.includes('Archivo'),'identity typography is rendered on the actual message heading');
    }
   }
   const name=`${concept}-${width}-${theme}-${engine.name()}-${state}.png`;
   await page.screenshot({path:path.join(out,name)});console.log(name);
   const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
   accessibility[state]=a11y.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
  };
  if(process.env.BLACKOUT_LIBRARY_ONLY){
   if(width<900)await page.locator('.menu-btn').click();
   await page.getByRole('button',{name:'Library',exact:true}).click();
   await page.getByRole('button',{name:'Open The studio launch brief.md',exact:true}).waitFor();
   await capture('library');
   await page.getByRole('searchbox',{name:'Search your library'}).fill('no-such-document-987');
   await page.getByText('Nothing matches.',{exact:true}).waitFor();
   await page.getByRole('searchbox',{name:'Search your library'}).fill('');
   await page.getByRole('button',{name:'Open The studio launch brief.md',exact:true}).waitFor();
   assert.equal(inferenceRequests,0);assert.deepEqual(errors,[]);
   fs.writeFileSync(path.join(out,`${concept}-${width}-${theme}-${engine.name()}-library.json`),JSON.stringify({concept,theme,width,height,engine:engine.name(),syntheticData:true,inferenceRequests,pageErrors:errors,accessibility},null,2)+'\n');
   assert.deepEqual(accessibility.library,[],'populated Library accessibility');
   await context.close();return;
  }
  await capture('welcome');
  if(width<900)await page.locator('.menu-btn').click();
  await page.getByRole('button',{name:'A launch worth remembering',exact:true}).click();
  await page.getByText('Make the first week count.',{exact:true}).waitFor();
  await page.locator('.composer textarea').fill('Turn Monday into a practical checklist.');
  await apply();
  await page.locator('.messages').evaluate(el=>el.scrollTop=0);
  await capture('chat');
  await page.locator('.model-button').click();
  await page.getByRole('searchbox',{name:'Search models',exact:true}).waitFor();
  await capture('picker');
  const search=page.getByRole('searchbox',{name:'Search models',exact:true});
  await search.fill('no-such-blackout-model-987');
  await page.getByText('Nothing matches “no-such-blackout-model-987”.',{exact:true}).waitFor();
  await search.fill('');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.composer textarea').inputValue(),'Turn Monday into a practical checklist.');
  if(width<900)await page.locator('.menu-btn').click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.locator('.settings-tabs').getByRole('button',{name:'API keys',exact:true}).click();
  await capture('providers');
  assert.equal(inferenceRequests,0,'visual studies must never execute inference');
  fs.writeFileSync(path.join(out,`${concept}-${width}-${theme}-${engine.name()}.json`),JSON.stringify({concept,theme,width,height,engine:engine.name(),source:'real Lumen components; local CSS/mark study only',syntheticData:true,inferenceRequests,pageErrors:errors,accessibility},null,2)+'\n');
  for(const [state,violations] of Object.entries(accessibility))assert.deepEqual(violations,[],`${state}: preserve accessibility contrast and semantics`);
  assert.deepEqual(errors,[],'preserve browser error checks');
  await context.close();
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
