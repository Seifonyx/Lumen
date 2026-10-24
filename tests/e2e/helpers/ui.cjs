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
  const back = page.locator('.settings-page .phone-navigation button[aria-label="Back"]');
  if (await back.isVisible()) return back.click();
  throw new Error('Settings subsection has no Back control');
};

exports.openSettingsSection = async (page, name) => {
  // Settings mounts asynchronously; checking a locator before the page exists misidentifies loading as nesting.
  await page.locator('.settings-page').waitFor({ state: 'visible' });
  const list = page.locator('.settings-page .settings-tabs');
  if (!(await list.isVisible())) {
    await exports.backSettingsSection(page);
    if (!(await page.locator('.settings-page').isVisible())) {
      const menu = page.locator('.menu-btn');
      if (await menu.isVisible()) await menu.click();
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
    }
  }
  await list.waitFor({ state: 'visible' });
  await list.getByRole('button', { name: new RegExp('^' + name + '(?:\\s|$)') }).click();
};

exports.closeSettings = async (page) => {
  const root = page.locator('.settings-page');
  for (let i = 0; i < 5 && await root.isVisible(); i++) {
    const close = root.locator('[aria-label="Close"]');
    if (await close.isVisible()) { await close.click(); break; }
    const back = root.locator('.phone-navigation button[aria-label="Back"]');
    if (await back.isVisible()) await back.click();
    else await page.keyboard.press('Escape');
  }
  await root.waitFor({ state: 'hidden' });
};

/** Canvas documents use the screen Back control on iPhone, the original Close on desktop/ordinary. */
exports.closeCanvas = async (page) => {
  const legacy = page.getByRole('button', { name: 'Close canvas', exact: true });
  if (await legacy.isVisible()) return legacy.click();
  const back = page.locator('.canvas-panel .phone-navigation button[aria-label="Back"]');
  await back.waitFor({ state: 'visible' });
  await back.click();
};
