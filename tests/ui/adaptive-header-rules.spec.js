const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

const fleetSetup = {
  baseUrl: 'http://pico-one.invalid/',
  dmxOutputs: [
    { id: 'output-one', name: 'Stage Left', universe: 1, baseUrl: 'http://pico-one.invalid/' },
    { id: 'output-two', name: 'Stage Right', universe: 2, baseUrl: 'http://pico-two.invalid/' }
  ],
  profiles: [],
  fixtures: [
    { id: 1, name: 'Left fixture', outputId: 'output-one' },
    { id: 2, name: 'Right fixture', outputId: 'output-two' }
  ],
  values: {}
};

async function routeFleet(page) {
  await page.route('**/fixture_setup.php**', async route => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, exists: true, setup: fleetSetup })
    });
  });
  await page.route('http://pico-one.invalid/status.json', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ dmx: { channels: 512, frame_count: 10 } })
  }));
  await page.route('http://pico-two.invalid/status.json', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: '{}'
  }));
}

test.describe('Adaptive sticky application header', () => {
  test.beforeEach(async ({ page }) => {
    await routeFleet(page);
  });

  test('keeps every Chaser navigation button visible with a two-thirds toolbox rail', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDmxPage(page, 'dmx_chaser.html');
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--toolbox-rail-width', '66vw');
      window.dispatchEvent(new Event('resize'));
    });

    const layout = await page.locator('header').evaluate(header => {
      const headerRect = header.getBoundingClientRect();
      return [...header.querySelectorAll('a.nav')].map(link => {
        const rect = link.getBoundingClientRect();
        return {
          text: link.textContent.trim(),
          visible: rect.width > 0 && rect.height > 0,
          inside: rect.left >= headerRect.left - 1 && rect.right <= headerRect.right + 1
        };
      });
    });

    expect(layout.length).toBeGreaterThanOrEqual(6);
    expect(layout.every(link => link.visible && link.inside), JSON.stringify(layout)).toBe(true);
  });

  test('replaces the single Pico URL controls with show-wide output health', async ({ page }) => {
    await openDmxPage(page, 'dmx_chaser.html');

    await expect(page.locator('header #baseUrl')).toBeHidden();
    await expect(page.locator('header .pico-discovery-btn')).toHaveCount(0);
    await expect(page.locator('header [data-pico-fleet-status]')).toHaveText('1/2 Picos online');
    await expect(page.locator('header [data-pico-fleet-status]')).toHaveAttribute('data-state', 'partial');
    await expect(page.locator('header [data-pico-fleet-status]')).toHaveAttribute('title', /Stage Right.*offline/i);
  });
});
