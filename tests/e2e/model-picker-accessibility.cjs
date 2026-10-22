const {chromium,webkit}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
const assert=require('node:assert/strict');
const {profile}=require('./helpers/preview-profile.cjs');
(async()=>{
 const engine=process.env.MR_WEBKIT?webkit:chromium,browser=await engine.launch();
 try {for(const width of [390,1280])for(const theme of ['light','dark']) {
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<900,hasTouch:width<900,reducedMotion:'reduce',serviceWorkers:'block'});
  await profile(ctx,`preview-model-a11y-${engine.name()}-${width}-${theme}`,theme,{enabledModels:['gemini:gemini-flash-latest','gemini:gemini-2.5-pro']});
  let lists=0;
  await ctx.route('**/generativelanguage.googleapis.com/**',route=>{
   assert(route.request().url().includes('/models?'),`unexpected selection request ${route.request().method()} ${new URL(route.request().url()).pathname}`);lists++;
   return route.fulfill({json:{models:['gemini-flash-latest','gemini-2.5-pro'].map(name=>({name:`models/${name}`,displayName:name,inputTokenLimit:128000,supportedGenerationMethods:['generateContent']}))}});
  });
  await ctx.addInitScript(()=>localStorage.setItem('mr.modelCheck.background',JSON.stringify(Date.now())));
  const page=await ctx.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const base=new URL(process.env.MR_TEST_URL||'http://localhost:5190/');if(width<900)base.searchParams.set('glass','1');
  await page.clock.install();await page.goto(base.href);await page.locator('.composer textarea').waitFor();
  const scan=async name=>{
   const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
   assert.deepEqual(result.violations.map(item=>({id:item.id,targets:item.nodes.map(node=>node.target)})),[],`${name} ${width}px ${theme}`);
  };
  await page.locator('.model-button').click();const search=page.getByRole('searchbox',{name:'Search models',exact:true});await search.fill('flash');
  const before=lists;await page.clock.fastForward(12*60_000);await page.waitForFunction(()=>document.querySelector('.models-pop input')?.value==='flash');
  await page.waitForFunction(()=>document.activeElement===document.querySelector('.models-pop input'));
  assert(lists>before,'TTL refresh actually requested updated metadata while the picker stayed open');
  await scan('open searchable picker');await search.press('ArrowDown');assert.equal(await page.locator('[role="option"]:focus').count(),1);
  await page.keyboard.press('Escape');assert.equal(await page.locator('.model-button').evaluate(node=>document.activeElement===node),true,'picker restores focus to its trigger');
  if(width<900)await page.locator('.menu-btn').click();await page.locator('.sidebar-foot, .cv-account').click();await page.locator('.settings-tabs').getByRole('button',{name:'Models',exact:true}).click();
  await page.getByRole('button',{name:'Add custom model',exact:true}).click();await page.getByLabel('Model ID',{exact:true}).fill('gemini-custom-a11y');
  if(width<900) {
   const provider=page.locator('.declared-model-editor select').first();await provider.press('Space');
   const menu=page.locator('.glass-select-menu:not(.closing)');await menu.waitFor();
   assert.equal(await menu.getAttribute('aria-label'),'Provider','glass control retains its field label');
   await page.keyboard.press('Escape');await menu.waitFor({state:'detached'});
   assert.equal(await page.getByRole('form',{name:'Add custom model',exact:true}).count(),1,'Escape closes only the dropdown');
   assert.equal(await provider.evaluate(node=>document.activeElement===node),true);
   await provider.press('Space');await page.locator('.glass-select-menu:not(.closing)').waitFor();await page.keyboard.press('Tab');
   assert.equal(await page.getByLabel('Model ID',{exact:true}).evaluate(node=>document.activeElement===node),true,'Tab dismisses the dropdown and continues through the form');
  }
  await page.getByLabel('Context limit (tokens)',{exact:true}).fill('0');await page.getByRole('button',{name:'Save model',exact:true}).click();
  assert.equal(await page.getByLabel('Context limit (tokens)',{exact:true}).getAttribute('aria-invalid'),'true');await scan('invalid custom-model editor');
  const numeric=await page.getByLabel('Context limit (tokens)',{exact:true}).evaluate(node=>({radius:parseFloat(getComputedStyle(node).borderRadius),height:node.getBoundingClientRect().height}));
  assert(numeric.radius>0 && numeric.height>=(width<900?44:38),'numeric limits use the shared field styling and touch geometry');
  await page.screenshot({path:`tests/e2e/out/model-picker-a11y-${engine.name()}-${width}-${theme}.png`});
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Add custom model',exact:true}).evaluate(node=>document.activeElement===node),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(errors,[]);console.log(`PASS model selection accessibility ${engine.name()} ${width}px ${theme}: refresh stability, labels, focus, validation and keyboard`);await ctx.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
