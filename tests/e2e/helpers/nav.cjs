// One way for suites to reach the app's places, so moving a control changes this file instead of every suite.
// Suites that test the navigation itself (drawer, rail, focus return) keep their own explicit clicks.
const { openTools, plusItem, isCanvas } = require('./plus.cjs');

const isPhone = (page) => page.evaluate(() => matchMedia('(max-width: 899px)').matches);

/** Opens a sidebar place by its label: 'Library', 'Router', 'All projects', 'Settings'. On phones it opens the drawer
 *  first when it is closed. */
async function openPlace(page, name) {
  const canvas = await isCanvas(page);
  const nav = page.locator(canvas ? 'aside.cv-nav' : '.sidebar').first();
  if (await isPhone(page) && !(await nav.evaluate((el) => el.classList.contains('open')))) {
    await page.locator('.menu-btn:visible, [aria-label="Open chats"]:visible').first().click();
    await page.waitForFunction((el) => el.classList.contains('open'), await nav.elementHandle(), { timeout: 2000 }).catch(() => {});
  }
  await nav.getByRole('button', { name, exact: true }).first().click();
}

module.exports = { openPlace, openTools, plusItem, isCanvas, isPhone };
