const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Page link rules', () => {
  test('GPIO and Pico Performance pages link to the DMX Buffer Monitor', async ({ page }) => {
    await openDmxPage(page, 'dmx_gpio.html');
    await expect(page.locator('header a.nav[href="dmx_monitor.html"]')).toHaveText('Monitor');

    await openDmxPage(page, 'test/');
    await expect(page.locator('header a.nav[href="../dmx_monitor.html"]')).toHaveText('Monitor');
  });
});
