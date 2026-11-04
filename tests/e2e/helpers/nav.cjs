// One way for suites to reach the app's places, so moving a control changes this file instead of every suite.
// Suites that test the navigation itself (drawer, rail, focus return) keep their own explicit clicks.
const { openTools, plusItem, isCanvas } = require('./plus.cjs');

const isPhone = (page) => page.evaluate(() => matchMedia('(max-width: 899px)').matches);

/** Opens a sidebar place by its label: 'Library', 'Router', 'All projects', 'Settings'. On phones it opens the drawer
 *  first when it is closed (from the chat, or from the menu button of a place chosen in the drawer). */
async function openPlace(page, name) {
  const canvas = await isCanvas(page);
  const nav = page.locator(canvas ? 'aside.cv-nav' : '.sidebar').first();
  if (await isPhone(page) && !(await nav.evaluate((el) => el.classList.contains('open')))) {
    await page.locator('.menu-btn:visible, [aria-label="Open chats"]:visible, .phone-navigation button[aria-label="Open navigation"]:visible').first().click();
    await page.waitForFunction((el) => el.classList.contains('open'), await nav.elementHandle(), { timeout: 2000 }).catch(() => {});
  }
  await nav.getByRole('button', { name, exact: true }).first().click();
}

/** The phone screen's leading Back (a pushed screen): 'Back', 'Back to Settings', or the older 'Return to …'. */
const UP = '.phone-navigation:visible > button:is([aria-label="Back"], [aria-label^="Back to "], [aria-label^="Return to "])';
/** Phones: leaves the place on screen (`selector`) for the screen it was opened from. Canvas follows iOS chat apps
 *  (2026-11-04): drill-downs go up with Back; a place chosen in the drawer is a root (its control opens the drawer), so
 *  browser Back returns to the screen it replaced. */
async function leavePlace(page, selector) {
  const screen = typeof selector === 'string' ? page.locator(selector).first() : selector;
  for (let i = 0; i < 10 && await screen.isVisible(); i++) {
    const up = page.locator(UP).first();
    if (await up.isVisible()) await up.click();
    // The session's first screen (a first-run key save opens Router) has nothing behind it: the drawer's New chat.
    else if (!await page.evaluate(() => history.state?.lumenScreen?.id)) {
      await page.locator('.phone-navigation:visible > button[aria-label="Open navigation"]').first().click();
      await page.locator('aside.cv-nav.open').waitFor();
      await page.locator('aside.cv-nav').getByRole('button', { name: 'New chat', exact: true }).click();
    } else await page.goBack();
    await screen.waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {});
  }
  await screen.waitFor({ state: 'hidden' });
}

module.exports = { openPlace, openTools, plusItem, isCanvas, isPhone, leavePlace, UP };
