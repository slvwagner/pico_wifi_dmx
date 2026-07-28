const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const appVersion = fs.readFileSync(path.join(__dirname, '..', '..', 'VERSION'), 'utf8').trim();

const OUTPUTS = [
  { id: 'front-pico', name: 'Front truss', universe: 1, baseUrl: 'http://192.0.2.54/' },
  { id: 'rear-pico', name: 'Rear truss', universe: 2, baseUrl: 'http://192.0.2.55/' }
];

async function routeMultiPicoShow(page) {
  const json = body => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  const ok = { ok: true };
  const fixtureSetup = {
    baseUrl: OUTPUTS[0].baseUrl,
    dmxOutputs: OUTPUTS,
    profiles: [],
    fixtures: [
      { id: 1, name: 'Front fixture', outputId: OUTPUTS[0].id },
      { id: 2, name: 'Rear fixture', outputId: OUTPUTS[1].id }
    ],
    values: {}
  };

  await page.route('**/fixture_setup.php**', async route => {
    if (route.request().method() !== 'GET') return route.fulfill(json(ok));
    if (route.request().url().includes('livevalues')) return route.fulfill(json({ ok: true, values: {} }));
    return route.fulfill(json({ ok: true, exists: true, setup: fixtureSetup }));
  });
  await page.route('**/group_setup.php**', route => route.fulfill(json({ ok: true, exists: true, groups: [] })));
  await page.route('**/scene_setup.php**', route => route.fulfill(json({ ok: true, exists: true, scenes: [], slotCols: 4, slotRows: 4 })));
  await page.route('**/palette_setup.php**', route => route.fulfill(json({ ok: true, exists: true, palettes: [], paletteCols: 4, paletteRows: 4 })));
  await page.route('**/chaser_setup.php**', route => route.fulfill(json({ ok: true, exists: true, chases: [], chaseSlotCols: 4, chaseSlotRows: 4 })));
  await page.route('**/motion_setup.php**', route => route.fulfill(json({ ok: true, exists: true, effects: [], effectCols: 4, effectRows: 4 })));
  await page.route('**/gpio_setup.php**', route => route.fulfill(json({ ok: true, exists: true, enabled: true, mappings: [], adcMappings: [] })));
  await page.route('**/ui_state.php**', route => route.fulfill(json({ ok: true, exists: true, state: { toolboxes: { selectedGroupIds: [] } } })));
  for (const output of OUTPUTS) {
    await page.route(output.baseUrl + 'status.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ firmware_version: appVersion, dmx: { channels: 512, frame_count: 42 } })
    }));
  }
}

for (const source of [
  { name: 'Controller', path: '' },
  { name: 'Chaser', path: 'dmx_chaser.html' },
  { name: 'Effects', path: 'dmx_motion.html' }
]) {
  test(`keeps multi-Pico health visible when navigating from ${source.name} to GPIO`, async ({ page }) => {
    await routeMultiPicoShow(page);
    await page.goto(`${source.path}?test=${Date.now()}`);
    await expect(page.locator('header h1')).toBeVisible();
    await expect(page.locator('header [data-pico-fleet-status]')).toHaveText(`2/2 Picos online · firmware ${appVersion}`);
    await expect(page.locator('header #baseUrl')).toBeHidden();
    await expect(page.locator('header .pico-discovery-btn')).toHaveCount(0);

    await page.getByRole('link', { name: 'GPIO' }).click();
    await expect(page.locator('header h1')).toContainText('GPIO Control');
    await expect(page.locator('header [data-pico-fleet-status]')).toHaveText(`2/2 Picos online · firmware ${appVersion}`);
    await expect(page.locator('header #baseUrl')).toBeHidden();
  });
}

test('Controller keeps Pico discovery inside the multi-output editor', async ({ page }) => {
  await routeMultiPicoShow(page);
  await page.goto(`?test=${Date.now()}`);

  await expect(page.locator('header .pico-discovery-btn')).toHaveCount(0);
  await page.getByRole('button', { name: 'DMX Outputs' }).click();
  await expect(page.locator('#dmxOutputsModal')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find Picos' })).toBeVisible();
  await expect(page.locator('#dmxOutputsList [data-dmx-output-row]')).toHaveCount(2);
});
