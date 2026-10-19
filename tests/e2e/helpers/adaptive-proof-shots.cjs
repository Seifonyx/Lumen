// Lumen Adaptive Native: screenshots of ACTUAL app before/after opt-in style.
// Same build, same synthetic fixtures. No provider usage or account data.
const { webkit } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { profile, seed } = require('./preview-profile.cjs');
const base = process.env.MR_TEST_URL || 'http://localhost:5192/';
const out = path.resolve('tests/e2e/out');
const cases = [
  { width: 320, height: 720, theme: 'light', glass: true },
  { width: 390, height: 844, theme: 'dark', glass: true },
  { width: 430, height: 932, theme: 'black', glass: true },
  { width: 1280, height: 820, theme: 'light', glass: false },
  { width: 1280, height: 820, theme: 'dark', glass: false },
];
const shots = [], diagnostics = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await webkit.launch();
  try {
    for (const c of cases) {
      for (const experiment of ['before', 'after']) {
        const phone = c.width < 900;
        const ctx = await browser.newContext({
          viewport: { width: c.width, height: c.height },
          isMobile: phone, hasTouch: phone, serviceWorkers: 'block',
          reducedMotion: 'reduce',
          ...(phone ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } : {}),
        });
        await profile(ctx, 'native-proof-' + c.width + '-' + c.theme + '-' + experiment, c.theme);
        // No Firestore writes or actual model requests.
        await ctx.route('**/firestore.googleapis.com/**', r => r.fulfill({ status: 403, headers: { 'access-control-allow-origin': '*' }, json: { error: 'Fixture only' } }));
        await ctx.addInitScript(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register = () => Promise.reject(new Error('Fixture only')); });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => { if (!/Fixture only|firestore/.test(e.message)) errors.push(e.message); });
        const q = c.glass ? '?glass' : '?';
        const url = new URL(q + (experiment === 'after' ? (c.glass ? '&' : '') + 'native-proof=1' : ''), base);
        await page.goto(url.toString());
        await page.locator('.composer textarea').waitFor({ timeout: 20000 });
        await page.evaluate(() => document.fonts.ready);
        await sleep(220);
        if (experiment === 'after' && !await page.locator('html.adaptive-native-proof').count()) throw new Error('Proof flag not set');
        if (experiment === 'before' && await page.locator('html.adaptive-native-proof').count()) throw new Error('Unexpected proof flag');
        const name = suffix => 'webkit-adaptive-' + c.width + '-' + c.theme + '-' + experiment + '-' + suffix + '.png';
        const screenshot = async suffix => {
          const file = path.join(out, name(suffix));
          await page.screenshot({ path: file, animations: 'disabled' });
          shots.push(file);
        };
        const record = async surface => {
          const result = await page.evaluate(() => {
            const root = document.documentElement;
            const panel = document.querySelector('.models-pop.sheet,.attach-menu');
            const layouts = document.querySelector('.mp-layouts');
            const options = [...document.querySelectorAll('.models-pop.sheet .mp-layout')];
            const box = panel?.getBoundingClientRect();
            const clipped = box ? options.filter(opt => {
              const r = opt.getBoundingClientRect();
              return r.left < box.left - 2 || r.right > box.right + 2;
            }).length : 0;
            return {
              width: innerWidth, scrollWidth: root.scrollWidth, glass: root.classList.contains('glass'),
              proof: root.classList.contains('adaptive-native-proof'),
              panelBackground: panel ? getComputedStyle(panel).backgroundImage : null,
              layoutColumns: layouts ? getComputedStyle(layouts).gridTemplateColumns : null,
              optionCount: options.length, horizontallyClippedOptions: clipped,
            };
          });
          diagnostics.push({ ...c, experiment, surface, ...result });
          if (result.scrollWidth > result.width + 1) throw new Error('Page overflow at ' + c.width + ' ' + c.theme + '/' + surface);
          if (experiment === 'after' && c.width === 320 && surface === 'picker' && result.horizontallyClippedOptions) {
            throw new Error(result.horizontallyClippedOptions + ' model layouts still clipped at 320px');
          }
        };
        await screenshot('welcome');
        await record('welcome');
        const picker = page.locator('.composer .model-button').first();
        await picker.click();
        await page.locator('.models-pop').waitFor();
        await sleep(200);
        await screenshot('picker');
        await record('picker');
        const count = await page.locator('.models-pop .mp-layout').count();
        if (count < 2) throw new Error('Layouts missing: ' + count);
        await page.keyboard.press('Escape');
        const add = page.getByRole('button', { name: /^Add (?:photos, )?files or a repository$/ });
        await add.click();
        await page.locator('.attach-menu').waitFor();
        await sleep(200);
        await screenshot('add');
        await record('add');
        if (await page.locator('.attach-menu .sheet-row').count() < 10) throw new Error('Add menu actions missing');
        await page.keyboard.press('Escape');
        if (!phone) {
          await page.locator('.composer textarea').focus();
          await screenshot('desktop-focused');
          await record('desktop-focused');
        }
        // Matched populated conversation: show real message typography and desktop active sidebar.
        const uid = 'native-proof-' + c.width + '-' + c.theme + '-' + experiment;
        const now = Date.now();
        await seed(page, uid, [{
          id: 'visual-review',
          title: 'Architecture review',
          createdAt: now - 60000,
          updatedAt: now - 1000,
          model: 'auto',
          messages: [
            { id: 'u1', role: 'user', text: 'Can we make the model picker easier to use on a small phone?', createdAt: now - 60000 },
            { id: 'a1', role: 'assistant', model: 'gemini:gemini-flash-latest', status: 'done', text: '## A more considered experience\\n\\nKeep the model choices visible, readable and easy to select. Preserve **Auto**, layout choices and clear availability labels.\\n\\n- Avoid clipping long layout names.\\n- Keep sheets legible over conversation text.\\n- Make every action reachable by touch or keyboard.', createdAt: now - 59000 },
          ],
        }]);
        await page.reload();
        await page.locator('.composer textarea').waitFor();
        if (phone) await page.locator('.menu-btn').click();
        await page.locator('.chat-row').filter({ hasText: 'Architecture review' }).first().click();
        await sleep(280);
        await screenshot('conversation');
        await record('conversation');
        if (errors.length) throw new Error('Page errors: ' + errors.slice(0,3).join('; '));
        await ctx.close();
        console.log('Captured real ' + c.width + 'px ' + c.theme + ' ' + experiment + ', model options ' + count);
      }
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out, 'webkit-adaptive-diagnostics.json'), JSON.stringify({ source: 'Real Lumen app, synthetic fixture; before/after same build', shots: shots.map(p => path.basename(p)), diagnostics }, null, 2));
  console.log('CAPTURED ' + shots.length + ' matched real-app screenshots in WebKit');
})().catch(e => { console.error(e); process.exitCode = 1; });
