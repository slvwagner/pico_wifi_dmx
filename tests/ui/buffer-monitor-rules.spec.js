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

  test('Clear all sends the Pico clear command and resets the displayed buffer', async ({ page }) => {
    let clearCalled = false;
    let cleared = false;
    await page.route('http://192.0.2.24/dmx/output.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        channels: 512,
        frame_count: 42,
        values: cleared ? Array(512).fill(0) : [12, 34, ...Array(510).fill(0)]
      })
    }));
    await page.route('http://192.0.2.24/dmx/clear', route => {
      clearCalled = true;
      cleared = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await openDmxPage(page, 'dmx_monitor.html');
    await page.locator('#baseUrl').fill('http://192.0.2.24/');
    await page.locator('#refreshBtn').click();
    await expect(page.locator('.dmx-val').first()).toHaveText('12');

    await page.locator('#clearAllBtn').click();

    await expect(page.locator('.dmx-val').first()).toHaveText('0');
    await expect(page.locator('#changedCount')).toHaveText('0');
    expect(clearCalled).toBe(true);
  });
});
