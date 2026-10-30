const {chromium}=require('playwright');const {profile,seed}=require('./helpers/preview-profile.cjs');
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const base='http://127.0.0.1:5193/';
await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());await profile(c,'preview-tw','light',{});
const p=await c.newPage();await p.goto(base);await p.locator('.composer textarea').waitFor();
const t='| When | Focus | Something finished |\n|---|---|---|\n| Monday | Define the offer | One clear project page |\n| Tuesday–Wednesday | Start conversations | Five personal introductions |';
await seed(p,'preview-tw',[{id:'t1',title:'Table',createdAt:1,updatedAt:Date.now(),messages:[{id:'u',role:'user',text:'x',createdAt:1},{id:'a',role:'assistant',text:t,model:'gemini:gemini-flash-latest',status:'done',createdAt:2}]}]);
await p.reload();await p.locator('.composer textarea').waitFor();await p.getByRole('button',{name:'Open chats'}).first().click();await p.getByRole('button',{name:/^Table/}).first().click();await p.waitForTimeout(800);
console.log(await p.evaluate(()=>{const w=document.querySelector('.table-wrap');const s=getComputedStyle(w);return [s.backgroundImage.slice(0,200),s.overflowX,w.scrollWidth,w.clientWidth, getComputedStyle(w.querySelector('table')).backgroundColor, getComputedStyle(w.querySelector('td')).backgroundColor];}));
await p.locator('.table-wrap').screenshot({path:'tests/e2e/out/tw.png'});await b.close();})();
