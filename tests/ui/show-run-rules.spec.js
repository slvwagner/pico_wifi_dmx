const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

const profiles = [
  {
    id: 1,
    name: 'Spot',
    mode: '8ch',
    channels: 8,
    controls: [
      { id: 11, type: 'slider8', label: 'Dimmer', channel: 1, blackoutValue: 0 },
      { id: 12, type: 'rgb', label: 'Color', a: 2, b: 3, c: 4, blackoutValue: { a: 0, b: 0, c: 0 } }
    ]
  }
];

const fixtures = [
  { id: 101, name: 'Spot 1', profileId: 1, start: 1 },
  { id: 102, name: 'Spot 2', profileId: 1, start: 11 }
];

async function routeShowSetup(page, calls) {
  await page.route('**/fixture_setup.php**', async route => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes('livevalues')) {
      if (method === 'POST') {
        calls.liveValues.push(JSON.parse(route.request().postData() || '{}'));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, exists: true, values: {} }) });
      return;
    }
    if (method !== 'GET') {
      calls.setupWrites += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        exists: true,
        setup: {
          baseUrl: 'http://pico.test',
          profiles,
          fixtures,
          values: {}
        }
      })
    });
  });

  await page.route('**/group_setup.php**', async route => {
    if (route.request().method() !== 'GET') {
      calls.setupWrites += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        exists: true,
        groups: [
          { id: 'front', name: 'Front Spots', fixtureIds: [101], values: {} },
          { id: 'back', name: 'Back Spots', fixtureIds: [102], values: {} }
        ]
      })
    });
  });

  await page.route('**/scene_setup.php**', async route => {
    if (route.request().method() !== 'GET') {
      calls.setupWrites += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        exists: true,
        slotCols: 2,
        slotRows: 1,
        scenes: [
          {
            id: 'scene_1',
            name: 'Both On',
            slot: 0,
            values: { '101:11': 100, '102:11': 200 }
          }
        ]
      })
    });
  });

  await page.route('**/palette_setup.php**', async route => {
    if (route.request().method() !== 'GET') {
      calls.setupWrites += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        exists: true,
        paletteCols: 1,
        paletteRows: 1,
        palettes: [
          {
            id: 'palette_1',
            name: 'Red',
            slot: 0,
            scope: 'Color',
            values: { '101:12': { a: 255, b: 0, c: 0 }, '102:12': { a: 64, b: 0, c: 0 } }
          }
        ]
      })
    });
  });

  await page.route('**/chaser_setup.php**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, pico_slots: calls.mirroredChaserSlots ?? ['{"name":"Chase One"}'], pico_url: 'http://pico.test' })
    });
  });

  await page.route('**/motion_setup.php**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, pico_slots: ['{"name":"Circle"}'], pico_url: 'http://pico.test' })
    });
  });

  await page.route('http://pico.test/**', async route => {
    const url = route.request().url();
    calls.pico.push({ url, method: route.request().method(), body: route.request().postData() || '' });
    if (url === 'http://pico.test/chaser/slots') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, slots: calls.liveChaserSlots || [] })
      });
      return;
    }
    if (url === 'http://pico.test/motion/slots') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, slots: calls.liveMotionSlots || [] })
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
}

test.describe('Show Run page', () => {
  test('recalls scenes only to the selected group and does not save setup data', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('h1')).toContainText('Show Run');
    await page.getByRole('button', { name: /Front Spots/ }).click();
    await page.getByRole('button', { name: /Both On/ }).click();

    await expect(page.locator('#status')).toContainText('Scene "Both On" recalled');
    expect(calls.liveValues.at(-1)).toEqual({ '101:11': 100 });
    expect(calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body === '1:100')).toBe(true);
    expect(calls.setupWrites).toBe(0);
  });

  test('keeps primary show actions on a second sticky header line', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    const actionBar = page.locator('.header-actions');
    await expect(actionBar).toBeVisible();
    await expect(actionBar.getByRole('button', { name: 'Reload Show' })).toBeVisible();
    await expect(actionBar.getByRole('button', { name: 'Stop All Playback' })).toBeVisible();
    await expect(actionBar.getByRole('button', { name: 'Blackout Target' })).toBeVisible();
    await expect(actionBar.getByRole('button', { name: 'Show All Fixtures' })).toBeVisible();

    const mainBox = await page.locator('.header-main').boundingBox();
    const actionBox = await actionBar.boundingBox();
    expect(actionBox.y).toBeGreaterThan(mainBox.y + mainBox.height - 1);

    const headerBox = await page.locator('header').boundingBox();
    const lastButtonBox = await actionBar.getByRole('button', { name: 'Show All Fixtures' }).boundingBox();
    expect(Math.abs((headerBox.x + headerBox.width - 14) - (lastButtonBox.x + lastButtonBox.width))).toBeLessThanOrEqual(2);
  });

  test('starts and stops saved Pico playback slots', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('[data-chaser-play="0"]').click();
    await page.locator('[data-motion-play="0"]').click();
    await page.getByRole('button', { name: 'Stop All Playback' }).click();

    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/chaser/load/0');
    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/chaser/play/0');
    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/motion/load/0');
    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/motion/start/0');
    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/chaser/stop');
    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/motion/stop');
  });

  test('shows live Pico chaser slots when the XAMPP mirror is empty', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      mirroredChaserSlots: Array(32).fill(null),
      liveChaserSlots: Array.from({ length: 32 }, (_, slot) => ({
        slot,
        loaded: slot === 1 || slot === 31,
        active: false,
        paused: false,
        step_count: slot === 1 ? 3 : slot === 31 ? 2 : 0,
        mode: 1,
        direction: 0,
        speed_mult: 1
      }))
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('#chaserSlots')).toContainText('Pico slot 1');
    await expect(page.locator('#chaserSlots')).toContainText('3 steps · live Pico');
    await expect(page.locator('#chaserSlots')).toContainText('Pico slot 31');
    await expect(page.locator('#chaserSlots')).toContainText('2 steps · live Pico');

    await page.locator('[data-chaser-play="1"]').click();
    expect(calls.pico.map(call => call.url)).not.toContain('http://pico.test/chaser/load/1');
    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/chaser/play/1');
  });

  test('offers Pico chaser and effects playback controls on Show Run', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#chaserControlSpeed').fill('1.5');
    await expect(page.locator('#chaserControlPause')).toHaveCount(0);
    await expect(page.locator('#chaserControlResume')).toHaveCount(0);
    await expect(page.locator('#chaserControlPauseResume')).toHaveText('Pause');
    await page.locator('#chaserControlPlay').click();
    await expect(page.locator('#chaserControlPauseResume')).toHaveText('Pause');
    await page.locator('#chaserControlPauseResume').click();
    await expect(page.locator('#chaserControlPauseResume')).toHaveText('Resume');
    await page.locator('#chaserControlPauseResume').click();
    await expect(page.locator('#chaserControlPauseResume')).toHaveText('Pause');
    await page.locator('#chaserControlSetSpeed').click();
    await page.locator('#chaserControlStopSlot').click();

    await page.locator('#motionControlBpm').fill('45');
    await page.locator('#motionControlStart').click();
    await page.locator('#motionControlSetBpm').click();
    await page.locator('#motionControlStopSlot').click();

    const urls = calls.pico.map(call => call.url);
    expect(urls).toContain('http://pico.test/chaser/play/0');
    expect(urls).toContain('http://pico.test/chaser/pause/0');
    expect(urls).toContain('http://pico.test/chaser/resume/0');
    expect(urls).toContain('http://pico.test/chaser/speed/0/150');
    expect(urls).toContain('http://pico.test/chaser/stop/0');
    expect(urls).toContain('http://pico.test/chaser/load/0');
    expect(urls).toContain('http://pico.test/motion/start/0');
    expect(urls).toContain('http://pico.test/motion/bpm/0/450');
    expect(urls).toContain('http://pico.test/motion/stop/0');
    expect(urls).toContain('http://pico.test/motion/load/0');
    await expect(page.locator('#chaserControlRestore')).toHaveCount(0);
    await expect(page.locator('#motionControlRestore')).toHaveCount(0);
  });

  test('lets the operator adjust tile matrix layouts without saving setup data', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('#sceneCols')).not.toBeVisible();
    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('#sceneCols')).toBeVisible();

    await page.locator('#sceneCols').fill('3');
    await page.locator('#sceneRows').fill('2');
    await expect(page.locator('#sceneGrid .slot')).toHaveCount(6);
    await expect(page.locator('#sceneGrid')).toHaveCSS('grid-template-columns', /.* .* .*/);
    const sceneGridWidth = await page.locator('#sceneGrid').evaluate(el => el.getBoundingClientRect().width);
    const sceneTileWidth = await page.locator('#sceneGrid .slot').first().evaluate(el => el.getBoundingClientRect().width);
    expect(sceneTileWidth).toBeGreaterThan((sceneGridWidth / 3) - 12);

    await page.locator('#chaserCols').fill('2');
    await page.locator('#chaserRows').fill('2');
    await expect(page.locator('#chaserSlots .playback-card')).toHaveCount(4);
    const chaserGridWidth = await page.locator('#chaserSlots').evaluate(el => el.getBoundingClientRect().width);
    const chaserTileWidth = await page.locator('#chaserSlots .playback-card').first().evaluate(el => el.getBoundingClientRect().width);
    expect(chaserTileWidth).toBeGreaterThan((chaserGridWidth / 2) - 12);

    expect(calls.setupWrites).toBe(0);
  });

  test('changing Pico Chaser playback rows does not change the Palettes layout', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#paletteCols').fill('2');
    await page.locator('#paletteRows').fill('1');
    await expect(page.locator('#paletteRows')).toHaveValue('1');
    await expect(page.locator('#paletteGrid .slot')).toHaveCount(2);

    await page.locator('#chaserRows').fill('2');

    await expect(page.locator('#chaserRows')).toHaveValue('2');
    await expect(page.locator('#chaserSlots .playback-card')).toHaveCount(8);
    await expect(page.locator('#paletteRows')).toHaveValue('1');
    await expect(page.locator('#paletteGrid .slot')).toHaveCount(2);
    expect(calls.setupWrites).toBe(0);
  });

  test('allows Pico Effects playback to use a compact layout when only a high slot is loaded', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      liveMotionSlots: Array.from({ length: 64 }, (_, slot) => ({
        slot,
        loaded: slot === 63,
        active: false,
        bpm: 30,
        target_count: slot === 63 ? 2 : 0,
        fixture_count: slot === 63 ? 2 : 0
      }))
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#motionCols').fill('4');
    await page.locator('#motionRows').fill('1');

    await expect(page.locator('#motionRows')).toHaveValue('1');
    await expect(page.locator('#motionSlots .playback-card')).toHaveCount(4);
    await expect(page.locator('#motionSlots')).toContainText('Pico effect 63');
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator move palette tiles locally and still recall the moved palette', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#paletteCols').fill('2');
    await page.locator('#paletteRows').fill('1');
    await page.locator('#paletteMove').click();
    await page.getByRole('button', { name: /Red/ }).click();
    await page.locator('#paletteGrid .slot').nth(1).click();

    await expect(page.locator('#paletteGrid .slot').nth(1)).toContainText('Red');
    await page.locator('#paletteMove').click();
    await page.getByRole('button', { name: /Red/ }).click();

    await expect(page.locator('#status')).toContainText('Palette "Red" recalled');
    expect(calls.liveValues.at(-1)).toEqual({ '101:12': { a: 255, b: 0, c: 0 }, '102:12': { a: 64, b: 0, c: 0 } });
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator drag palette tiles locally in move mode', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#paletteCols').fill('2');
    await page.locator('#paletteRows').fill('1');
    await page.locator('#paletteMove').click();

    const source = page.getByRole('button', { name: /Red/ });
    const target = page.locator('#paletteGrid .slot').nth(1);
    await source.dragTo(target);

    await expect(page.locator('#paletteGrid .slot').nth(1)).toContainText('Red');
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator arrange whole show cards in a card matrix', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('#cardMove')).not.toBeVisible();
    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('#cardMove')).toBeVisible();

    await page.locator('#cardCols').fill('2');
    await page.locator('#cardRows').fill('3');
    await page.locator('#cardMove').click();

    await page.locator('#cardPalette').click({ position: { x: 16, y: 16 } });
    await page.locator('#cardGroup').click({ position: { x: 16, y: 16 } });
    await page.locator('#cardMotion').click({ position: { x: 16, y: 16 } });
    await page.locator('#cardScene').click({ position: { x: 16, y: 16 } });

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Palettes');
    await expect(page.locator('#cardGrid > :nth-child(2) h2')).toHaveText('Pico Effects Playback');
    expect(calls.setupWrites).toBe(0);
  });
});
