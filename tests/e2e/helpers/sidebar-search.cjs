exports.openSidebarSearch = async page => {
  const button = page.locator('.cv-search-button');
  if (await button.count()) await button.click();
};
exports.closeSidebar = async page => {
  if (await page.locator('.cv-search:visible').count()) await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
};
