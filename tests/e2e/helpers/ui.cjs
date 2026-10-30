// Shared steps for the in-app tests.

/** Opens Settings (from the sidebar; on phones through the menu) and, optionally, one section. */
exports.openSettings = async (page, tab) => {
  if (!(await page.locator('.settings-page').isVisible())) {
    if (await page.locator('.menu-btn').isVisible()) await page.click('.menu-btn');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
  if (tab) await exports.openSettingsSection(page, tab);
};

/** Runs one of a reply's less-used actions from its ⋯ menu (Read aloud, Share, Save as Word, Edit in canvas, Select text). */
exports.replyAction = async (page, label, which = 'last') => {
  const more = page.locator('.msg.assistant').getByRole('button', { name: 'More actions', exact: true });
  await (which === 'first' ? more.first() : more.last()).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
};

/** Use the visible Settings hierarchy across ordinary and Canvas iPhone builds. */
exports.backSettingsSection = async (page) => {
  const legacy = page.locator('.settings-page .settings-back');
  if (await legacy.isVisible()) return legacy.click();
  const back = page.locator('.settings-page .phone-navigation button[aria-label^="Return to "]');
  // The chevron exits a feature. Inspect internal sections with actual browser
  // Back; a direct-start section has no ancestor and uses Exit instead.
  await back.waitFor({ state: 'visible', timeout: 6000 });
  for (let step=0;step<18;step++) {
    if (await page.locator('.settings-page :is(.settings-tabs, .si)').isVisible() || !await page.locator('.settings-page:not(.exit-ghost)').isVisible()) return;
    if (await page.evaluate(()=>Boolean(history.state?.lumenScreen?.id))) await page.goBack();
    else await back.click();
    await page.waitForFunction(()=>!document.querySelector('.settings-page:not(.exit-ghost)') || Boolean(document.querySelector('.settings-page :is(.settings-tabs, .si)')?.getClientRects().length));
  }
};

exports.openSettingsSection = async (page, name) => {
  // Canvas: after a first-run key save the screen is Router, not Settings. Leave it and open Settings.
  if (!(await page.locator('.settings-page').isVisible()) && await page.locator('.rc-page:not([hidden])').isVisible()) {
    await exports.closeSettings(page);
    const menu = page.locator('.menu-btn');
    if (await menu.isVisible()) await menu.click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
  // Settings mounts asynchronously; checking a locator before the page exists misidentifies loading as nesting.
  await page.locator('.settings-page').waitFor({ state: 'visible' });
  // Canvas phones show the grouped index (.si); its General row is the account card.
  const list = page.locator('.settings-page :is(.settings-tabs, .si)');
  await list.waitFor({ state: 'attached' });
  if (!(await list.isVisible())) {
    await exports.backSettingsSection(page);
    if (!(await page.locator('.settings-page').isVisible())) {
      const menu = page.locator('.menu-btn');
      await page.locator('.composer textarea').waitFor({state:'visible'});
      if (await menu.isVisible()) await menu.click();
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
    }
  }
  await list.waitFor({ state: 'visible' });
  await list.getByRole('button', { name: name === 'General' ? /^(General|Account:)/ : new RegExp('^' + name + '(?:\\s|$)') }).first().click();
};

exports.closeSettings = async (page) => {
  const root = page.locator('.settings-page');
  // Canvas: API keys, models and usage open in Router instead; leaving it is its Exit control.
  const router = page.locator('.rc-page:not([hidden])');
  if (!(await root.isVisible()) && await router.isVisible()) {
    await router.locator(':is(.rc-head .feature-exit, .phone-navigation > button)').first().click();
    await router.waitFor({ state: 'hidden' });
    return;
  }
  if (!(await root.isVisible())) return;
  // Desktop/ordinary Settings has an explicit Close. Canvas iPhone has a real
  // hierarchical Back button. Exercise whichever control is visible rather than
  // assuming a single Escape dismisses both a nested section and its parent.
  for (let step = 0; step < 18 && await root.isVisible(); step++) {
    const close = root.locator('.settings-top button[aria-label="Close"]');
    const back = root.locator('.phone-navigation button[aria-label^="Return to "]');
    if (await close.isVisible()) await close.click();
    else if (await back.isVisible()) await back.click();
    else { await root.focus(); await page.keyboard.press('Escape'); }
    if (!(await root.isVisible())) break;
    await root.waitFor({ state: 'hidden', timeout: 900 }).catch(() => {});
  }
  if (await root.isVisible()) throw new Error('Settings did not close after traversing its visible navigation hierarchy');
};

/** Canvas documents use the screen Back control on iPhone, the original Close on desktop/ordinary. */
exports.closeCanvas = async (page) => {
  const legacy = page.getByRole('button', { name: 'Close canvas', exact: true });
  if (await legacy.isVisible()) return legacy.click();
  const back = page.locator('.canvas-panel .phone-navigation button[aria-label^="Return to "]');
  await back.waitFor({ state: 'visible' });
  await back.click();
};

/** Library's phone content tabs and desktop type selector share the same canonical filter. */
exports.selectLibraryType = async (page, label) => {
  const phoneLabel = { 'Searchable':'Knowledge', 'Files':'Attached files', 'Generated images':'Made by Lumen' }[label] || label;
  const tab = page.getByRole('tablist', { name:'Library content types' }).getByRole('tab', { name:phoneLabel, exact:true });
  if (await tab.isVisible()) { await tab.click(); return; }
  await page.getByRole('button', { name:/^Content type:/ }).click();
  await page.getByRole('menu', { name:'Content type' }).getByRole('menuitemradio', { name:new RegExp('^'+label+'(?:\\s|$)') }).click();
};
