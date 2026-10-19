// A matching tool stays mounted while search/section state updates during a press.
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const {profile}=require('./helpers/preview-profile.cjs');
(async()=>{
 const browser=await(process.env.MR_WEBKIT?webkit:chromium).launch();
 try {for(const name of ['Study','Compare models']) {
  const context=await browser.newContext({viewport:{width:1280,height:844},serviceWorkers:'block'});
  await profile(context,`preview-tool-card-${name.replace(/ /g,'-')}`,'light');
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.MR_TEST_URL||'http://localhost:5190/');
  await page.locator('.composer textarea').waitFor();
  await page.getByRole('button',{name:'Tools',exact:true}).click();
  const search=page.getByRole('searchbox',{name:'Search tools',exact:true});
  await search.fill(name);
  const card=page.locator('button.tool-card').filter({has:page.locator('strong',{hasText:new RegExp(`^${name}$`)})});
  await card.scrollIntoViewIfNeeded();
  const held=await card.elementHandle(),box=await card.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  // The filter result is unchanged, but ToolsPage rerenders just as it does
  // when its scroll observer publishes a section or connection state changes.
  await search.fill(name+' ');
  assert.equal(await held.evaluate(element=>element.isConnected),true,'a matching tool button cannot be replaced during a held press');
  await page.mouse.up();
  if(name==='Study')await page.getByRole('button',{name:'Make your first deck',exact:true}).waitFor();
  else await page.getByRole('dialog',{name:'Compare models',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log(`PASS ${process.env.MR_WEBKIT?'webkit':'chromium'} ${name}: matching tool retains DOM identity and release action across parent updates`);
  await context.close();
 }} finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
