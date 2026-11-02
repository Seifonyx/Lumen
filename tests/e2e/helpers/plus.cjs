// The message box's + menu in either presentation. On Canvas (since 2026-11-02) the first layer holds attach, this
// chat's context and three quick tools; everything else is in Browse all tools, a searchable picker over the chat.
const ADD = /^Add (?:photos, )?files or a repository$/;
const isCanvas = async (page) => (await page.locator('[data-lumen-canvas-shell]').count()) > 0;
/** Opens + and chooses `name` (going through Browse all tools on Canvas when it is not on the first layer).
 *  `pickerName` is the picker's name for it when that differs ("Create image" is "Create an image" there). */
exports.plusItem = async (page, name, pickerName = name) => {
  await page.getByRole('button', { name: ADD }).click();
  const menu = page.getByRole('dialog', { name: 'Add to your message' });
  await menu.waitFor();
  if ((await isCanvas(page)) && !(await menu.getByRole('button', { name, exact: true }).count())) {
    await menu.getByRole('button', { name: 'Browse all tools', exact: true }).click();
    await page.getByRole('dialog', { name: 'Tools', exact: true }).getByRole('button', { name: pickerName, exact: true }).first().click();
  } else await menu.getByRole('button', { name, exact: true }).click();
};
/** Opens Browse all tools on Canvas (the Tools page on the ordinary build) through its app event. */
exports.openTools = async (page) => {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'tools-page' })));
  await page.locator((await isCanvas(page)) ? '.tool-picker' : '.hub-page').first().waitFor();
};
exports.isCanvas = isCanvas;
