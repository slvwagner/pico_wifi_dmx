const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('DMX Buffer Monitor established rules', () => {
  test('Refresh ms and Refresh Hz stay synchronized both ways', async ({ page }) => {
    await openDmxPage(page, 'dmx_monitor.html');

    await expect(page.locator('#refreshMs')).toHaveValue('50');
    await expect(page.locator('#refreshHz')).toHaveValue('20');

    await page.locator('#refreshMs').fill('250');
    await page.locator('#refreshMs').dispatchEvent('change');
    await expect(page.locator('#refreshHz')).toHaveValue('4');

    await page.locator('#refreshHz').fill('2');
    await page.locator('#refreshHz').dispatchEvent('change');
    await expect(page.locator('#refreshMs')).toHaveValue('500');
  });
});
