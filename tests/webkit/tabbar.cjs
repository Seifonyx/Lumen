const {webkit}=require('playwright');
const assert=require('node:assert/strict');
const {profile}=require('../e2e/helpers/preview-profile.cjs');
(async()=>{
  const browser=await webkit.launch(process.env.WEBKIT_EXECUTABLE_PATH ? {executablePath:process.env.WEBKIT_EXECUTABLE_PATH} : {});
  try {
    for(const [width,height,theme,target] of [[390,844,'dark','tools-page'],[320,740,'light','collection'],[430,932,'black','tools-page'],[844,390,'dark','collection']]) {
      const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1'});
      await profile(ctx,'webkit-check-'+width,theme);
      const page=await ctx.newPage();
      await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
      await page.locator('.composer textarea').waitFor();
      await page.evaluate(detail=>window.dispatchEvent(new CustomEvent('mr:library',{detail})),target);
      const nav=page.locator('.glass-tabbar'); await nav.waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('glass')),true);
      await nav.evaluate(el => el.addEventListener('pointerdown', e => { el.dataset.testPointerId=String(e.pointerId); }));
      await nav.locator('button').nth(3).tap();
      assert.equal((await nav.locator('[aria-current="page"]').innerText()).trim(),target==='collection'?'Files':'Learn');
      const points=await nav.locator('button').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}}));
      const committed=(await nav.locator('[aria-current="page"]').innerText()).trim();
      await page.mouse.move(points[3].x,points[3].y); await page.mouse.down();
      for(const index of [4,0,3,1,4,2]) {
        await page.mouse.move(points[index].x,points[index].y,{steps:5});
        await page.waitForFunction(i=>document.querySelector('.glass-tabbar').style.getPropertyValue('--i')===String(i),index);
        assert.equal(await nav.locator('button svg').count(),points.length);
        assert.equal(await nav.locator('.glass-lens svg').count(),0);
        assert.equal((await nav.locator('[aria-current="page"]').innerText()).trim(),committed);
        const centres=await nav.locator('button svg').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.x+r.width/2}));
        assert.ok(centres.every((x,i)=>Math.abs(x-points[i].x)<1),'Icons stay anchored');
      }
      await page.waitForTimeout(180);
      require('node:fs').mkdirSync('tests/e2e/out',{recursive:true});
      await page.screenshot({path:`tests/e2e/out/webkit-tab-${width}-${theme}.png`});
      assert.ok(await nav.locator('.glass-lens').evaluate(e=>(getComputedStyle(e).backdropFilter||getComputedStyle(e).webkitBackdropFilter).includes('blur')));
      await page.mouse.up();
      assert.equal((await nav.locator('[aria-current="page"]').innerText()).trim(),target==='collection'?'Docs':'Analyze');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      for (const cancel of ['outside','capture']) {
        const before=(await nav.locator('[aria-current="page"]').innerText()).trim();
        await page.mouse.move(points[2].x,points[2].y); await page.mouse.down();
        await page.mouse.move(points[0].x,points[0].y,{steps:4});
        if(cancel==='outside') await page.mouse.move(points[0].x,points[0].y-100);
        else await nav.evaluate(el=>el.releasePointerCapture(Number(el.dataset.testPointerId)));
        await page.mouse.up();
        assert.equal((await nav.locator('[aria-current="page"]').innerText()).trim(),before,'Cancelled drag keeps selection');
        assert.equal(await nav.evaluate(e=>e.classList.contains('held')),false);
      }
      await nav.locator('button').nth(1).focus(); await page.keyboard.press('Enter');
      assert.equal((await nav.locator('[aria-current="page"]').innerText()).trim(),target==='collection'?'Photos':'Create');
      console.log('PASS WebKit',browser.version(),width,theme,'iPhone layout, touch tap, pointer scrubbing, blur and release selection');
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
