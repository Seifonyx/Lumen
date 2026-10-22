const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const AxeBuilder=require('@axe-core/playwright').default;
const path=require('node:path');
(async()=>{
 const browser=await (process.env.MR_WEBKIT?webkit:chromium).launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),remote=[],errors=[];
  context.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await context.setOffline(true);
  const file=path.join(__dirname,'provider-review.html');
  await page.setContent(fs.readFileSync(file,'utf8')); // Managed browsers do not support file:// here; render exact saved bytes offline.
  const downloadEvent=page.waitForEvent('download');await page.getByRole('link',{name:'Save offline review',exact:true}).click();const downloaded=await downloadEvent;assert.equal(downloaded.suggestedFilename(),'Lumen-provider-review.html');assert(fs.readFileSync(await downloaded.path(),'utf8').includes('data:image/png;base64,'));
  for(const direction of ['Index','Studio'])for(const state of ['Overview','Browse providers','Provider detail','Keyboard focus evidence']){
   await page.getByRole('button',{name:direction,exact:true}).click();await page.getByRole('button',{name:state,exact:true}).click();
   await page.waitForFunction(()=>[1440,390].every(width=>{const img=document.getElementById('shot-'+width);return img.complete&&img.naturalWidth===width&&img.naturalHeight===(width===1440?960:844);}));
   for(const width of [1440,390])assert((await page.locator('#download-'+width).getAttribute('href')).startsWith('data:image/png;base64,'));
  }
  await page.getByRole('button',{name:'Inspect full-size phone capture',exact:true}).click();
  await page.getByRole('dialog',{name:'Full-size screenshot',exact:true}).waitFor();await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button',{name:'Inspect full-size phone capture',exact:true}).evaluate(n=>n===document.activeElement),true);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();assert.deepEqual(scan.violations.map(v=>v.id),[]);
  }
  assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);
  console.log('PASS portable review: sixteen full-resolution images, all controls, download links, dialog focus, offline self-contained document, 2 axe scans, zero remote requests.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
