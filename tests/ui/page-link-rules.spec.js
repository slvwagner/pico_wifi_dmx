const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

const APP_PAGES = [
  { path: '', manualHref: 'user-manual.html?v=1.3.0#fixture-controller', manualText: 'Fixture Controller' },
  { path: 'dmx_show.html', manualHref: 'user-manual.html?v=1.3.0#show-run', manualText: 'Show Run' },
  { path: 'dmx_midi_emulator.html', manualHref: 'user-manual.html?v=1.3.0#midi-controller-card', manualText: 'MIDI Emulator' },
  { path: 'dmx_chaser.html', manualHref: 'user-manual.html?v=1.3.0#chaser', manualText: 'Chaser' },
  { path: 'dmx_motion.html', manualHref: 'user-manual.html?v=1.3.0#effects', manualText: 'Effects' },
  { path: 'dmx_gpio.html', manualHref: 'user-manual.html?v=1.3.0#gpio-control', manualText: 'GPIO Control' },
  { path: 'test/', manualHref: '../user-manual.html?v=1.3.0#pico-performance-test', manualText: 'Pico Performance Test' },
  { path: 'dmx_monitor.html', manualHref: 'user-manual.html?v=1.3.0#dmx-buffer-monitor', manualText: 'DMX Buffer Monitor' },
  { path: 'dmx_room_plane.html', manualHref: 'user-manual.html?v=1.3.0#room-plane', manualText: 'Room Plane' }
];

test.describe('Page link rules', () => {
  test('Controller exposes the DMX Controller Home Screen name and app icons', async ({ page }) => {
    await openDmxPage(page, '');

    await expect(page).toHaveTitle('DMX Controller');
    await expect(page.locator('meta[name="application-name"]')).toHaveAttribute('content', 'DMX Controller');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'DMX Controller');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', 'assets/favicon.ico?v=1.3.0');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'assets/app-icon-180.png?v=1.3.0');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'assets/manifest.webmanifest?v=1.3.0');

    const manifest = await page.evaluate(async () => {
      const response = await fetch('assets/manifest.webmanifest?v=1.3.0');
      return response.json();
    });
    expect(manifest).toMatchObject({
      name: 'DMX Controller',
      short_name: 'DMX Controller',
      start_url: '../',
      scope: '../',
      display: 'standalone'
    });
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: 'app-icon-192.png', sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ src: 'app-icon-512.png', sizes: '512x512', type: 'image/png' })
    ]));
  });

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
    const workflowTable = page.locator('#choose-a-workflow ~ table').first();
    for (const section of APP_PAGES) {
      const hash = new URL(section.manualHref, 'http://localhost/dmx/').hash;
      const overviewLink = workflowTable.getByRole('link', { name: section.manualText, exact: true });
      await expect(overviewLink).toHaveAttribute('href', hash);
      await expect(overviewLink).toBeVisible();
      await expect(page.locator(`[id="${hash.slice(1)}"]`)).toBeVisible();
    }
  });

  test('manual keeps its desktop sidebar sticky and provides responsive section navigation', async ({ page }) => {
    await page.goto(`user-manual.html?test=${Date.now()}`);
    const sidebar = page.locator('#manual-nav');
    const toggle = page.locator('.manual-nav-toggle');
    const sectionHeadings = page.locator('#manual-content > h2:not(#table-of-contents)');

    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('#manual-current-location')).toHaveText('Table of Contents');
    const showGroup = sidebar.locator('.manual-nav-group[data-section-id="create-and-program-a-show"]');
    await expect(showGroup.locator('.manual-nav-group-toggle')).toHaveAttribute('aria-expanded', 'false');
    await showGroup.locator('.manual-nav-group-toggle').click();
    await expect(showGroup.locator('.manual-nav-submenu')).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Chaser', exact: true })).toHaveAttribute('href', '#chaser');
    const controllerPage = showGroup.locator('.manual-nav-page[data-page-id="fixture-controller"]');
    await controllerPage.locator('.manual-nav-page-toggle').click();
    await expect(controllerPage.getByRole('link', {
      name: 'Fixture Controller Tools and Toolboxes',
      exact: true
    })).toHaveAttribute('href', '#fixture-controller-tools-and-toolboxes');
    const runGroup = sidebar.locator('.manual-nav-group[data-section-id="run-show"]');
    await runGroup.locator('.manual-nav-group-toggle').click();
    await expect(runGroup.getByRole('link', { name: 'Show Run', exact: true })).toHaveAttribute('href', '#show-run');
    await expect(page.locator('.section-pager')).toHaveCount(await sectionHeadings.count());
    await page.evaluate(() => window.scrollTo(0, 1800));
    await expect.poll(async () => Math.round((await sidebar.boundingBox())?.y ?? -1)).toBe(28);
    await page.evaluate(() => window.scrollTo(0, 0));

    await page.setViewportSize({ width: 900, height: 1100 });
    await expect(toggle).toBeVisible();
    await expect.poll(async () => {
      const box = await sidebar.boundingBox();
      return box ? box.x + box.width : 0;
    }).toBeLessThanOrEqual(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(async () => (await sidebar.boundingBox())?.x).toBeGreaterThanOrEqual(0);

    await sidebar.getByRole('link', { name: 'Chaser', exact: true }).click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#chaser');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => {
      const box = await sidebar.boundingBox();
      return box ? box.x + box.width : 0;
    }).toBeLessThanOrEqual(0);
    await expect(sidebar.getByRole('link', { name: 'Chaser', exact: true })).toHaveClass(/is-active/);
    await expect(sidebar.locator('#manual-current-location')).toContainText('Create and Program a Show');
    await expect(sidebar.locator('#manual-current-location')).toContainText('Chaser');

    await toggle.click();
    await page.keyboard.press('Escape');
    await expect.poll(async () => {
      const box = await sidebar.boundingBox();
      return box ? box.x + box.width : 0;
    }).toBeLessThanOrEqual(0);

    await page.emulateMedia({ media: 'print' });
    await expect(toggle).toBeHidden();
    await expect(page.locator('.manual-back-to-contents')).toBeHidden();
    await expect(page.locator('.section-pager').first()).toBeHidden();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('.manual-nav-submenu').first()).toBeVisible();
    await expect(sidebar.locator('.manual-nav-topic-list').first()).toBeVisible();
    await expect(page.locator('#table-of-contents + ul > li > ul')).toHaveCount(6);
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
      await test.step(appPage.path || 'index.html', async () => {
        await openDmxPage(page, appPage.path);
        if (appPage.path === 'dmx_show.html') {
          await page.waitForFunction(() => showLoadPromise === null);
        }
        const openDialog = page.locator('[role="dialog"]:visible');
        if (await openDialog.count()) {
          await openDialog.first().getByRole('button', { name: 'Close' }).first().click();
        }
        const [manualPage] = await Promise.all([
          page.context().waitForEvent('page'),
          page.locator('header a.nav', { hasText: 'Manual' }).click()
        ]);
        await manualPage.waitForLoadState('domcontentloaded');
        const expectedHash = new URL(appPage.manualHref, 'http://localhost/dmx/').hash;
        await expect.poll(() => manualPage.evaluate(() => location.hash), `${appPage.path || 'index.html'} should open ${expectedHash}`)
          .toBe(expectedHash);
        await expect(manualPage.locator(`[id="${expectedHash.slice(1)}"]`)).toBeInViewport();
        await manualPage.close();
      });
    }
  });
});
