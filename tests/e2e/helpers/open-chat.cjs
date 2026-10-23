// Opens a chat from the sidebar in either presentation. Canvas files project chats inside folders that start
// closed (and inert), so the folder is opened first, as a person would.
exports.openChat = async (page, title) => {
  const row = page.locator('.chat-open', { hasText: title }).first();
  await row.waitFor({ state: 'attached' });
  const folded = await row.evaluate((el) => el.closest('.cv-fold:not([data-open])')?.id || null);
  if (folded) await page.locator(`[aria-controls="${folded}"]`).first().click();
  await row.click();
};
