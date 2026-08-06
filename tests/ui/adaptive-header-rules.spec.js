const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');
const fs = require('fs');
const path = require('path');

const appVersion = fs.readFileSync(path.join(__dirname, '..', '..', 'VERSION'), 'utf8').trim();

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
    body: JSON.stringify({ firmware_version: appVersion, dmx: { channels: 512, frame_count: 10 } })
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
    await expect(page.locator('header [data-pico-fleet-status]')).toHaveText(`1/2 Picos online · firmware ${appVersion}`);
    await expect(page.locator('header [data-pico-fleet-status]')).toHaveAttribute('data-state', 'partial');
    await expect(page.locator('header [data-pico-fleet-status]')).toHaveAttribute('title', /Stage Right.*offline/i);
  });

  test('keeps the Controller DMX Outputs button anchored at the right of the status row', async ({ page }) => {
    await openDmxPage(page, '');

    const toolbar = page.locator('header .toolbar');
    const outputsButton = page.locator('header #openDmxOutputs');

    await expect(toolbar).toBeVisible();
    expect(await outputsButton.evaluate(button => button.parentElement?.classList.contains('toolbar'))).toBe(true);
    const positions = await page.locator('header').evaluate(header => {
      const headerRect = header.getBoundingClientRect();
      const outputsRect = header.querySelector('#openDmxOutputs').getBoundingClientRect();
      const fleetRect = header.querySelector('[data-pico-fleet-status]').getBoundingClientRect();
      return {
        headerRight: headerRect.right,
        outputsRight: outputsRect.right,
        outputsCenter: outputsRect.top + outputsRect.height / 2,
        fleetRight: fleetRect.right,
        fleetCenter: fleetRect.top + fleetRect.height / 2
      };
    });

    expect(Math.abs(positions.outputsRight - positions.headerRight)).toBeLessThanOrEqual(1);
    expect(positions.fleetRight).toBeLessThan(positions.outputsRight);
    expect(Math.abs(positions.fleetCenter - positions.outputsCenter)).toBeLessThanOrEqual(1);
  });

  test('documentation captures show current firmware without contacting configured Picos', async ({ page }) => {
    let picoStatusRequests = 0;
    await page.unroute('http://pico-one.invalid/status.json');
    await page.unroute('http://pico-two.invalid/status.json');
    await page.route('http://pico-one.invalid/status.json', route => {
      picoStatusRequests++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ firmware_version: '0.1.0', dmx: { channels: 512, frame_count: 10 } })
      });
    });
    await page.route('http://pico-two.invalid/status.json', route => {
      picoStatusRequests++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ firmware_version: '0.1.0', dmx: { channels: 512, frame_count: 11 } })
      });
    });

    await openDmxPage(page, 'dmx_chaser.html?docshot=firmware-regression');

    const fleet = page.locator('header [data-pico-fleet-status]');
    await expect(fleet).toHaveText(`2/2 Picos online · firmware ${appVersion}`);
    await expect(fleet).toHaveAttribute('data-state', 'online');
    await expect(page.locator('style[data-dmx-docshot-stability]')).toHaveCount(1);
    expect(picoStatusRequests).toBe(0);
  });

  test('warns in the Controller header when an online Pico firmware version is not current', async ({ page }) => {
    await page.unroute('http://pico-one.invalid/status.json');
    await page.unroute('http://pico-two.invalid/status.json');
    await page.route('http://pico-one.invalid/status.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ firmware_version: '1.0.0', dmx: { channels: 512, frame_count: 10 } })
    }));
    await page.route('http://pico-two.invalid/status.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ firmware_version: appVersion, dmx: { channels: 512, frame_count: 11 } })
    }));

    await openDmxPage(page, '');

    const fleet = page.locator('header [data-pico-fleet-status]');
    await expect(fleet).toHaveText(`2/2 Picos online · 1/2 on firmware ${appVersion}`);
    await expect(fleet).toHaveAttribute('data-state', 'version');
    await expect(fleet).toHaveAttribute('title', new RegExp(`Stage Left.*firmware 1\\.0\\.0, expected ${appVersion.replaceAll('.', '\\.')}`, 'is'));
  });

  test('identifies old firmware that does not report its version', async ({ page }) => {
    await page.unroute('http://pico-one.invalid/status.json');
    await page.unroute('http://pico-two.invalid/status.json');
    await page.route('http://pico-one.invalid/status.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ dmx: { channels: 512, frame_count: 10 } })
    }));
    await page.route('http://pico-two.invalid/status.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ firmware_version: appVersion, dmx: { channels: 512, frame_count: 11 } })
    }));

    await openDmxPage(page, '');

    const fleet = page.locator('header [data-pico-fleet-status]');
    await expect(fleet).toHaveText(`2/2 Picos online · 1/2 on firmware ${appVersion}`);
    await expect(fleet).toHaveAttribute('data-state', 'version');
    await expect(fleet).toHaveAttribute('title', new RegExp(`Stage Left.*firmware version not reported, expected ${appVersion.replaceAll('.', '\\.')}`, 'is'));
  });
});
