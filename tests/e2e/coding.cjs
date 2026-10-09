const { test, expect } = require('@playwright/test');

async function openTab(page, tabName) {
  const tabs = page.locator('.settings-tabs');
  await tabs.locator(`text=${tabName}`).click();
}

test.describe('Coding & Layout Settings', () => {
  test('configures custom layouts inside Models tab', async ({ page }) => {
    await page.goto('/');

    // Open settings and navigate to Models tab
    await page.click('[aria-label="Settings"]');
    await openTab(page, 'Models');

    // Verify layout options exist within Models section
    await expect(page.locator('.models-settings')).toBeVisible();
    await expect(page.locator('text=Layouts')).toBeVisible();
  });
});
