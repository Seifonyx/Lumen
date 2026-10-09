const { test, expect } = require('@playwright/test');

test.describe('Settings Navigation', () => {
  test('desktop displays 8 settings sections in sidebar', async ({ page }) => {
    await page.goto('/');
    await page.click('[aria-label="Settings"]');

    const tabs = page.locator('.settings-tabs .tab-button');
    await expect(tabs).toHaveCount(8);

    const expectedTabs = [
      'General',
      'API keys',
      'Models',
      'Usage',
      'Personalization',
      'Memory',
      'Privacy',
      'Data'
    ];

    for (let i = 0; i < expectedTabs.length; i++) {
      await expect(tabs.nth(i)).toHaveText(expectedTabs[i]);
    }
  });

  test('phone displays section menu with 8 sections', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.click('[aria-label="Settings"]');

    const menuItems = page.locator('.mobile-settings-menu .menu-item');
    await expect(menuItems).toHaveCount(8);

    const expectedSections = [
      'General',
      'API keys',
      'Models',
      'Usage',
      'Personalization',
      'Memory',
      'Privacy',
      'Data'
    ];

    for (let i = 0; i < expectedSections.length; i++) {
      await expect(menuItems.nth(i)).toContainText(expectedSections[i]);
    }
  });
});
