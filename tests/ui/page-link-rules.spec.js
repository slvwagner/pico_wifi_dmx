const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Page link rules', () => {
  test('main pages link to Show Run', async ({ page }) => {
    for (const path of ['', 'dmx_show.html', 'dmx_chaser.html', 'dmx_motion.html', 'dmx_gpio.html', 'dmx_monitor.html']) {
      await openDmxPage(page, path);
      await expect(page.locator('header a.nav[href="dmx_show.html"]')).toHaveText('Show');
    }

    await openDmxPage(page, 'test/');
    await expect(page.locator('header a.nav[href="../dmx_show.html"]')).toHaveText('Show');
  });

  test('GPIO and Pico Performance pages link to the DMX Buffer Monitor', async ({ page }) => {
    await openDmxPage(page, 'dmx_gpio.html');
    await expect(page.locator('header a.nav[href="dmx_monitor.html"]')).toHaveText('Monitor');

    await openDmxPage(page, 'test/');
    await expect(page.locator('header a.nav[href="../dmx_monitor.html"]')).toHaveText('Monitor');
  });
});
