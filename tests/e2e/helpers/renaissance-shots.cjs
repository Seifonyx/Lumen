/*
 * Renaissance composition review: real React app, synthetic fixture, same
 * source/viewport/theme; three modes (current, Atelier, Workbench). No live
 * AI calls. This is screenshot evidence, NOT aesthetic acceptance.
 */
const { webkit } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { profile, seed } = require('./preview-profile.cjs');

const out = path.resolve('tests/e2e/out/renaissance');
const base = process.env.MR_TEST_URL || 'http://localhost:5192/';
const configs = [
  [390,844,'dark'],
  [320,740,'light'],
  [430,932,'black'],
  [1280,820,'light'],
  [1440,900,'dark'],
];
const views = ['current','atelier','workbench'];
const data = [];
const files = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function fakeChat() {
  const now = Date.now();
  return [{
    id:'renaissance-conversation', title:'Designing the Lumen workspace', createdAt:now-76000, updatedAt:now-1000,
    messages: [
      {id:'u1',role:'user',text:'How can we build a distinctive native-feeling workspace without losing the advanced model tools?',createdAt:now-76000},
      {id:'a1',role:'assistant',model:'gemini:gemini-flash-latest',status:'done',createdAt:now-75000,
      text:[
        '## Designing an intentional workspace',
        'A beautiful interface is more than surface polish. The **content and controls** should have a clear relationship without making real capabilities disappear.',
        '',
        '### What to preserve',
        '- Auto model selection, custom layouts, and real routing feedback.',
        '- Attachments, projects, connected repositories, and analysis tools.',
        '- Readable conversations and convenient keyboard actions.',
        '',
        '### What to improve',
        'Give the main task spatial focus. Make navigation predictable, let detail surfaces feel connected to their owners, and adapt to the input method.',
      ].join('\n')}
    ],
  }];
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await webkit.launch();
 try{
  for(const [width,height,theme] of configs){
   for(const mode of views){
    const phone=width<900;
    const uid='renaissance-'+width+'-'+theme+'-'+mode;
    const ctx=await browser.newContext({
     viewport:{width,height},isMobile:phone,hasTouch:phone,serviceWorkers:'block',
     reducedMotion:'reduce',
     ...(phone?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})
    });
    await profile(ctx,uid,theme);
    await ctx.route('**/firestore.googleapis.com/**',r=>r.fulfill({status:403,headers:{'access-control-allow-origin':'*'},json:{error:'Fixture only'}}));
    await ctx.addInitScript(()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register=()=>Promise.reject(new Error('Fixture only'))});
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>{if(!/Fixture only|firestore/.test(e.message))errors.push(e.message)});
    const url=new URL(phone?'?glass':'?',base);
    if(mode!=='current')url.searchParams.set('renaissance',mode);
    await page.goto(url.toString());
    await page.locator('.composer textarea').waitFor({timeout:20000});
    await page.evaluate(()=>document.fonts.ready);
    await wait(230);
    if(mode==='current'&&await page.locator('html[class*="renaissance-"]').count())throw Error('Current view carries candidate class');
    if(mode!=='current'&&!await page.locator('html.renaissance-'+mode).count())throw Error('Candidate not enabled');
    const prefix=width+'-'+theme+'-'+mode;
    const shot=async label=>{
      const file=path.join(out,prefix+'-'+label+'.png');
      await page.screenshot({path:file,animations:'disabled'});
      files.push(path.basename(file));
      const layout=await page.evaluate(()=>{
        const html=document.documentElement;const main=document.querySelector('.main');const side=document.querySelector('.sidebar');
        const b=main?.getBoundingClientRect();const s=side?.getBoundingClientRect();
        return{w:innerWidth,scrollW:html.scrollWidth,main:b?{x:b.x,y:b.y,width:b.width,height:b.height}:null,sidebar:s?{x:s.x,width:s.width}:null};
      });
      data.push({viewport:width,theme,mode,label,...layout});
      if(layout.scrollW>layout.w+1)throw Error('Horizontal overflow in '+prefix+' / '+label);
    };
    await shot('welcome');
    const input=page.locator('.composer textarea');
    await input.fill('PRESERVED_DRAFT');
    await page.locator('.composer .model-button').click();
    await page.locator('.models-pop').waitFor();
    await shot('model-picker');
    await page.keyboard.press('Escape');
    const add=page.getByRole('button',{name:/^Add (?:photos, )?files or a repository$/});
    await add.click();
    await page.locator('.attach-menu').waitFor();
    await shot('add-sheet');
    if(await page.locator('.attach-menu .sheet-row').count()<10)throw Error('Add controls disappeared');
    await page.keyboard.press('Escape');
    if(await input.inputValue()!=='PRESERVED_DRAFT')throw Error('Draft lost after sheet');
    await input.fill('');
    await seed(page,uid,fakeChat());
    await page.reload();
    await page.locator('.composer textarea').waitFor();
    if(phone)await page.locator('.menu-btn').click();
    await shot('sidebar');
    await page.locator('.chat-row').filter({hasText:'Designing the Lumen workspace'}).first().click();
    await wait(230);
    await shot('conversation');
    // An actual feature hub, not a fabricated placeholder page.
    if(phone)await page.locator('.menu-btn').click();
    await page.getByRole('button',{name:'Library',exact:true}).first().click();
    await wait(300);
    await shot('library');
    if(errors.length)throw Error('Page errors: '+errors.slice(0,3).join(' | '));
    await ctx.close();
    console.log('RENAISSANCE PASS '+prefix);
   }
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(out,'diagnostics.json'),JSON.stringify({
  provenance:'Real Lumen React application on WebKit with mocked user/provider calls',
  modes:views,viewportCases:configs,files,observations:data,
 },null,2));
 console.log('RENAISSANCE CAPTURED '+files.length+' complete-screen screenshots');
})().catch(e=>{console.error(e);process.exitCode=1});
