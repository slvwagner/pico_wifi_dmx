const { test, expect } = require('@playwright/test');

const DISCOVERED_URL = 'http://192.0.2.55/';
const STALE_SETUP_URL = 'http://192.0.2.24/';

async function routeSavedSetupsWithStaleBaseUrl(page) {
  const json = body => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  const ok = { ok: true };
  const posts = { fixture: [], chaser: [], motion: [], gpio: [] };

  await page.route('**/fixture_setup.php**', async route => {
    const url = route.request().url();
    if (route.request().method() !== 'GET') {
      posts.fixture.push(route.request().postDataJSON());
      return route.fulfill(json(ok));
    }
    if (url.includes('livevalues')) return route.fulfill(json({ ok: true, values: {} }));
    return route.fulfill(json({
      ok: true,
      exists: true,
      setup: { baseUrl: STALE_SETUP_URL, profiles: [], fixtures: [], values: {} }
    }));
  });

  await page.route('**/group_setup.php**', async route => {
    if (route.request().method() !== 'GET') return route.fulfill(json(ok));
    return route.fulfill(json({ ok: true, exists: true, baseUrl: STALE_SETUP_URL, groups: [] }));
  });

  await page.route('**/scene_setup.php**', async route => {
    if (route.request().method() !== 'GET') return route.fulfill(json(ok));
    return route.fulfill(json({ ok: true, exists: true, baseUrl: STALE_SETUP_URL, scenes: [], slotCols: 4, slotRows: 4 }));
  });

  await page.route('**/palette_setup.php**', async route => {
    if (route.request().method() !== 'GET') return route.fulfill(json(ok));
    return route.fulfill(json({ ok: true, exists: true, baseUrl: STALE_SETUP_URL, palettes: [], paletteCols: 4, paletteRows: 4 }));
  });

  await page.route('**/chaser_setup.php**', async route => {
    const url = route.request().url();
    if (route.request().method() !== 'GET') {
      posts.chaser.push(route.request().postDataJSON());
      return route.fulfill(json(ok));
    }
    if (url.includes('slots')) return route.fulfill(json({ ok: true, pico_url: STALE_SETUP_URL, pico_slots: Array(32).fill(null) }));
    return route.fulfill(json({ ok: true, exists: true, baseUrl: STALE_SETUP_URL, chases: [], chaseSlotCols: 4, chaseSlotRows: 4 }));
  });

  await page.route('**/motion_setup.php**', async route => {
    const url = route.request().url();
    if (route.request().method() !== 'GET') {
      posts.motion.push(route.request().postDataJSON());
      return route.fulfill(json(ok));
    }
    if (url.includes('slots')) return route.fulfill(json({ ok: true, pico_url: STALE_SETUP_URL, pico_slots: Array(64).fill(null) }));
    return route.fulfill(json({ ok: true, exists: true, baseUrl: STALE_SETUP_URL, effects: [], effectCols: 4, effectRows: 4, pico_slots: [] }));
  });

  await page.route('**/gpio_setup.php**', async route => {
    if (route.request().method() !== 'GET') {
      posts.gpio.push(route.request().postDataJSON());
      return route.fulfill(json(ok));
    }
    return route.fulfill(json({
      ok: true,
      exists: true,
      baseUrl: STALE_SETUP_URL,
      enabled: true,
      mappings: [],
      adcMappings: []
    }));
  });

  await page.route('**/ui_state.php**', async route => {
    if (route.request().method() !== 'GET') return route.fulfill(json(ok));
    return route.fulfill(json({ ok: true, exists: true, state: { toolboxes: { selectedGroupIds: [] } } }));
  });

  return posts;
}

async function routePicoDiscovery(page) {
  await page.route('**/pico_discovery.php**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        devices: [{ id: 'test-pico', name: 'pico-wifi-dmx', ip: '192.0.2.55', http: 80, url: DISCOVERED_URL }]
      })
    });
  });
  await page.route('http://192.0.2.55/status.json', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ dmx: { channels: 512, frame_count: 42 } })
    });
  });
}

async function clearPicoUrl(page) {
  await page.goto(`VERSION?test=${Date.now()}`);
  await page.evaluate(() => {
    localStorage.removeItem('dmxPicoBaseUrl');
    localStorage.removeItem('dmxGPIOConfig');
  });
}

for (const source of [
  { name: 'Controller', path: '', link: 'GPIO', saveKey: 'fixture' },
  { name: 'Chaser', path: 'dmx_chaser.html', link: 'GPIO', saveKey: 'chaser' },
  { name: 'Effects', path: 'dmx_motion.html', link: 'GPIO', saveKey: 'motion' }
]) {
  test(`keeps discovered Pico URL when navigating from ${source.name} to GPIO`, async ({ page }) => {
    const posts = await routeSavedSetupsWithStaleBaseUrl(page);
    await routePicoDiscovery(page);
    await clearPicoUrl(page);

    await page.goto(`${source.path}?test=${Date.now()}`);
    await expect(page.locator('header h1')).toBeVisible();
    await expect(page.locator('#baseUrl')).toHaveValue(STALE_SETUP_URL);

    await page.getByRole('button', { name: 'Find Pico' }).click();
    await expect(page.locator('#baseUrl')).toHaveValue(DISCOVERED_URL);
    await expect.poll(() => posts[source.saveKey].some(body => body?.baseUrl === DISCOVERED_URL || body?.setup?.baseUrl === DISCOVERED_URL))
      .toBe(true);

    await page.getByRole('link', { name: source.link }).click();
    await expect(page.locator('header h1')).toContainText('GPIO Control');
    await expect(page.locator('#baseUrl')).toHaveValue(DISCOVERED_URL);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('dmxPicoBaseUrl')))
      .toBe(DISCOVERED_URL);
  });
}

test('saves the discovered Pico URL to GPIO setup when Find Pico is used on GPIO', async ({ page }) => {
  const posts = await routeSavedSetupsWithStaleBaseUrl(page);
  await routePicoDiscovery(page);
  await clearPicoUrl(page);

  await page.goto(`dmx_gpio.html?test=${Date.now()}`);
  await expect(page.locator('header h1')).toContainText('GPIO Control');
  await expect(page.locator('#baseUrl')).toHaveValue(STALE_SETUP_URL);

  await page.getByRole('button', { name: 'Find Pico' }).click();
  await expect(page.locator('#baseUrl')).toHaveValue(DISCOVERED_URL);
  await expect.poll(() => posts.gpio.some(body => body?.baseUrl === DISCOVERED_URL))
    .toBe(true);
});
