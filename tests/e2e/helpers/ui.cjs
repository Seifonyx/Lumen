// Shared steps for the in-app tests.

/** Opens Settings (from the sidebar; on phones through the menu) and, optionally, one section. */
exports.openSettings = async (page, tab) => {
  if (await page.locator('.menu-btn').isVisible()) await page.click('.menu-btn');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  if (!tab) return;
  if (await page.locator('.settings-back').isVisible()) await page.locator('.settings-back').click();
  await page.locator('.settings-tabs .tab-label').getByText(tab, { exact: true }).click();
};

/** Runs one of a reply's less-used actions from its ⋯ menu (Read aloud, Share, Save as Word, Edit in canvas, Select text). */
exports.replyAction = async (page, label, which = 'last') => {
  const more = page.locator('.msg.assistant').getByRole('button', { name: 'More actions', exact: true });
  await (which === 'first' ? more.first() : more.last()).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
};
