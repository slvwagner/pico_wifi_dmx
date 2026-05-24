const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Project versioning rules', () => {
  test('shared UI shows the app version and JSON exports include version metadata', async ({ page }) => {
    await openDmxPage(page, '');

    await expect(page.locator('header h1 .app-version')).toHaveText('v0.8.0');

    const payload = await page.evaluate(() => DmxCommon.versionedPayload({ baseUrl: 'http://example.test/' }));
    expect(payload).toMatchObject({
      appVersion: '0.8.0',
      schemaVersion: 1,
      baseUrl: 'http://example.test/'
    });
  });
});
