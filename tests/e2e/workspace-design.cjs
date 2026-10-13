// Task 2: actual project workflows, responsive composition, keyboard access and all themes.
const { chromium, webkit } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { profile } = require('./helpers/preview-profile.cjs');
const url = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const matrix = [[1280,844,'light'],[320,740,'light'],[390,844,'dark'],[430,932,'black'],[844,390,'dark']];
(async()=>{
 const engine = process.env.MR_WEBKIT ? webkit : chromium;
 const browser = await engine.launch(); fs.mkdirSync('.impeccable/review',{recursive:true});
 try { for(const [width,height,theme] of matrix){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,serviceWorkers:'block',reducedMotion:'reduce'});
  await profile(ctx,`preview-workspace-${width}`,theme);
  // Denying real Firestore in the fixture must not create WebKit transport page errors.
  await ctx.route('**/firestore.googleapis.com/**',r=>r.fulfill({status:403,headers:{'access-control-allow-origin':'*'},json:{error:{code:403,message:'Isolated fixture'}}}));
  await ctx.addInitScript(()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register=()=>Promise.reject(new Error('Disabled in isolated fixture'));});
  const page=await ctx.newPage();const errors=[];const requests=[];
  page.on('pageerror',e=>{if(e.message.includes('firestore.googleapis.com')&&e.message.includes('due to access control checks'))return;errors.push(e.message)});
  page.on('request',r=>{if(r.url().includes(':streamGenerateContent'))requests.push(r.postDataJSON())});
  await page.goto(url);await page.locator('.composer textarea').waitFor();
  const capture=async name=>{await page.waitForTimeout(150);await page.screenshot({path:`.impeccable/review/${process.env.MR_WEBKIT?'webkit':'chromium'}-${width}-${theme}-${name}.png`})};
  const fits=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow');
  const scan=async name=>{const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();assert.deepEqual(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${width}/${theme} ${name}`)};
  await fits();await capture('chat');await scan('chat');
  if(width<900)await page.locator('.menu-btn').click();
  await page.getByRole('button',{name:'New project',exact:true}).first().click();
  await page.getByLabel('Project name',{exact:true}).fill('Hospital reports & study');
  await page.getByLabel('Project description',{exact:true}).fill('Protocols, analysis and careful reporting.');
  await page.getByLabel('Project instructions',{exact:true}).fill('PROJECT_DESIGN_INSTRUCTIONS: Keep answers concise.');
  await page.locator('.project-edit-form input[type=file]').setInputFiles({name:'protocol.txt',mimeType:'text/plain',buffer:Buffer.from('PROJECT_DESIGN_REFERENCE: Review oxygen trends.')});
  await page.locator('.project-file').waitFor();await page.getByLabel('Project name',{exact:true}).scrollIntoViewIfNeeded();await fits();await capture('project-editor');await scan('project editor');
  assert.ok(await page.locator('.project-color-choices').evaluate(e=>{const p=e.getBoundingClientRect();return [...e.children].every(c=>{const r=c.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1})}),'Color choices must all fit');
  assert.ok(await page.locator('.project-form-actions').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Project actions overflow');
  await page.getByRole('button',{name:'Create workspace',exact:true}).click();await page.locator('.claude-project-title').waitFor();
  await fits();await capture('project');await scan('project');
  const toggle=page.locator('.project-context-toggle');
  if(width<=960){assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await page.locator('.project-context-content').isVisible(),false);await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true')}
  await page.getByLabel('Project instructions',{exact:true}).fill('PROJECT_DESIGN_INSTRUCTIONS: Use short reports.');
  await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Saved',exact:true}).waitFor();
  await page.getByRole('button',{name:'Preview text',exact:true}).click();await page.locator('.project-doc-preview-body').waitFor();assert.match(await page.locator('.project-doc-preview-body').textContent(),/PROJECT_DESIGN_REFERENCE/);await page.locator('.modal [aria-label=Close]').click();
  await fits();await capture('project-context');await scan('project context');
  if(width<=960)await toggle.click();
  // New chat must open an ordinary composer rather than returning to the workspace.
  await page.locator('.claude-project-top-actions').getByRole('button',{name:'New chat',exact:true}).click();
  await page.locator('.composer textarea').waitFor();assert.equal(await page.locator('.claude-project-view').count(),0);
  await page.locator('.composer textarea').fill('Summarize our protocol.');await page.locator('.send-btn').click();await page.locator('.msg.assistant .model-tag').waitFor();
  assert.equal(requests.length,1);assert.match(JSON.stringify(requests[0]),/PROJECT_DESIGN_REFERENCE/);assert.match(JSON.stringify(requests[0]),/PROJECT_DESIGN_INSTRUCTIONS/);
  await fits();await capture('conversation');await scan('conversation');
  assert.ok(await page.locator('.topbar .model-name-text').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Short model name must be readable');
  await page.locator('.project-topbar-pill').click();await page.locator('.claude-chat-row-title').waitFor();await capture('project-populated');
  const title=page.locator('.claude-chat-row-title').first();await title.focus();await page.keyboard.press('Enter');await page.locator('.composer textarea').waitFor();
  await page.locator('.project-topbar-pill').click();
  // Prompt path must retain context and send exactly once.
  await page.getByLabel('Start a project conversation',{exact:true}).fill('Write another brief report.');await page.getByRole('button',{name:'Send message (Enter)',exact:true}).click();await page.locator('.msg.assistant .model-tag').waitFor();assert.equal(requests.length,2);
  if(width<900)await page.locator('.menu-btn').click();await capture('sidebar');await page.getByRole('button',{name:'Settings',exact:true}).click();
  await capture('settings');await fits();await scan('settings');
  assert.deepEqual(errors,[],'Unexpected app errors');console.log(`PASS workspace ${engine.name()} ${width}x${height} ${theme}`);await ctx.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
