const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

const APP_PAGES = [
  { path: '', manualHref: 'user-manual.html?v=0.9.12#1-fixture-controller', manualText: 'Fixture Controller' },
  { path: 'dmx_show.html', manualHref: 'user-manual.html?v=0.9.12#4-show-run', manualText: 'Show Run' },
  { path: 'dmx_midi_emulator.html', manualHref: 'user-manual.html?v=0.9.12#midi-controller-card', manualText: 'MIDI Emulator' },
  { path: 'dmx_chaser.html', manualHref: 'user-manual.html?v=0.9.12#5-chaser', manualText: 'Chaser' },
  { path: 'dmx_motion.html', manualHref: 'user-manual.html?v=0.9.12#6-effects', manualText: 'Effects' },
  { path: 'dmx_gpio.html', manualHref: 'user-manual.html?v=0.9.12#7-gpio-control', manualText: 'GPIO Control' },
  { path: 'test/', manualHref: '../user-manual.html?v=0.9.12#8-pico-performance-test', manualText: 'Pico Performance Test' },
  { path: 'dmx_monitor.html', manualHref: 'user-manual.html?v=0.9.12#9-dmx-buffer-monitor', manualText: 'DMX Buffer Monitor' },
  { path: 'dmx_room_plane.html', manualHref: 'user-manual.html?v=0.9.12#10-room-plane', manualText: 'Room Plane' }
];

test.describe('Page link rules', () => {
  test('main pages link to Show Run', async ({ page }) => {
    for (const path of ['', 'dmx_show.html', 'dmx_chaser.html', 'dmx_motion.html', 'dmx_gpio.html', 'dmx_monitor.html', 'dmx_room_plane.html']) {
      await openDmxPage(page, path);
      await expect(page.locator('header a.nav[href="dmx_show.html"]')).toHaveText('Show');
    }

    await openDmxPage(page, 'test/');
    await expect(page.locator('header a.nav[href="../dmx_show.html"]')).toHaveText('Show');
  });

  test('main pages label the effects page consistently', async ({ page }) => {
    for (const path of ['', 'dmx_show.html', 'dmx_chaser.html', 'dmx_gpio.html', 'dmx_monitor.html', 'dmx_room_plane.html']) {
      await openDmxPage(page, path);
      await expect(page.locator('header a.nav[href="dmx_motion.html"]')).toHaveText('Effects');
    }

    await openDmxPage(page, 'test/');
    await expect(page.locator('header a.nav[href="../dmx_motion.html"]')).toHaveText('Effects');
  });

  test('GPIO and Pico Performance pages link to the DMX Buffer Monitor', async ({ page }) => {
    await openDmxPage(page, 'dmx_gpio.html');
    await expect(page.locator('header a.nav[href="dmx_monitor.html"]')).toHaveText('Monitor');

    await openDmxPage(page, 'test/');
    await expect(page.locator('header a.nav[href="../dmx_monitor.html"]')).toHaveText('Monitor');
  });

  test('main pages link to the Room Plane page', async ({ page }) => {
    for (const path of ['', 'dmx_show.html', 'dmx_chaser.html', 'dmx_motion.html', 'dmx_gpio.html', 'dmx_monitor.html', 'dmx_room_plane.html']) {
      await openDmxPage(page, path);
      await expect(page.locator('header a.nav[href="dmx_room_plane.html"]')).toHaveText('Plane');
    }

    await openDmxPage(page, 'test/');
    await expect(page.locator('header a.nav[href="../dmx_room_plane.html"]')).toHaveText('Plane');
  });

  test('page manual links jump to the matching manual section', async ({ page }) => {
    for (const link of APP_PAGES) {
      await openDmxPage(page, link.path);
      await expect(page.locator(`header a.nav[href="${link.manualHref}"]`)).toHaveText('Manual');
    }
  });

  test('manual main-page overview links to each dedicated page section', async ({ page }) => {
    await page.goto(`user-manual.html?test=${Date.now()}`);
    await expect(page.locator('h1')).toBeVisible();
    for (const section of APP_PAGES) {
      const hash = new URL(section.manualHref, 'http://localhost/dmx/').hash;
      await expect(page.locator(`a[href="${hash}"]`, { hasText: section.manualText })).toBeVisible();
      await expect(page.locator(`[id="${hash.slice(1)}"]`)).toBeVisible();
    }
  });

  test('each page Manual button targets an existing manual anchor', async ({ page }) => {
    const manualPage = await page.context().newPage();
    await manualPage.goto(`user-manual.html?test=${Date.now()}`);
    await expect(manualPage.locator('h1')).toBeVisible();

    for (const appPage of APP_PAGES) {
      await openDmxPage(page, appPage.path);
      const href = await page.locator('header a.nav', { hasText: 'Manual' }).getAttribute('href');
      expect(href, `${appPage.path || 'index.html'} Manual link must include a section hash`).toContain('#');
      const hash = new URL(href, 'http://localhost/dmx/').hash;
      await expect(manualPage.locator(`[id="${hash.slice(1)}"]`), `${href} must exist in user-manual.html`).toBeVisible();
    }
  });

  test('pressing each Manual button opens the matching manual section', async ({ page }) => {
    for (const appPage of APP_PAGES) {
      await openDmxPage(page, appPage.path);
      const [manualPage] = await Promise.all([
        page.waitForEvent('popup'),
        page.locator('header a.nav', { hasText: 'Manual' }).click()
      ]);
      await manualPage.waitForLoadState('domcontentloaded');
      const expectedHash = new URL(appPage.manualHref, 'http://localhost/dmx/').hash;
      await expect.poll(() => manualPage.evaluate(() => location.hash), `${appPage.path || 'index.html'} should open ${expectedHash}`)
        .toBe(expectedHash);
      await expect(manualPage.locator(`[id="${expectedHash.slice(1)}"]`)).toBeInViewport();
      await manualPage.close();
    }
  });
});
