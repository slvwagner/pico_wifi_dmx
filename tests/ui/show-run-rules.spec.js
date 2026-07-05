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
  calls.uiStatePosts = calls.uiStatePosts || [];
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
          values: calls.setupValues || {}
        }
      })
    });
  });

  await page.route('**/group_setup.php**', async route => {
    if (route.request().method() !== 'GET') {
      calls.groupWrites = calls.groupWrites || [];
      calls.groupWrites.push(route.request().postDataJSON());
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
      calls.sceneWrites = calls.sceneWrites || [];
      calls.sceneWrites.push(route.request().postDataJSON());
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
        scenes: calls.scenes || [
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
      calls.paletteWrites = calls.paletteWrites || [];
      calls.paletteWrites.push(route.request().postDataJSON());
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
        palettes: calls.palettes || [
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

  await page.route('**/ui_state.php**', async route => {
    if (route.request().method() !== 'GET') {
      calls.uiStatePosts.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, exists: true, state: { showRun: calls.showRunState || {} } })
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

  test('uses the available browser width for the Show Run workspace', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await page.setViewportSize({ width: 2200, height: 1100 });
    await openDmxPage(page, 'dmx_show.html');

    const metrics = await page.evaluate(() => {
      const main = document.querySelector('main');
      const grid = document.querySelector('#cardGrid');
      const mainRect = main.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      return {
        mainWidth: mainRect.width,
        mainLeft: mainRect.left,
        gridWidth: gridRect.width
      };
    });
    expect(metrics.mainLeft).toBeLessThan(2);
    expect(metrics.mainWidth).toBeGreaterThan(2160);
    expect(metrics.gridWidth).toBeGreaterThan(2160);
    expect(calls.setupWrites).toBe(0);
  });

  test('starts and stops saved Pico playback slots', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('[data-chaser-toggle="0"]').click();
    await expect(page.locator('[data-chaser-toggle="0"]')).toHaveText('Stop');
    await page.locator('[data-motion-toggle="0"]').click();
    await expect(page.locator('[data-motion-toggle="0"]')).toHaveText('Stop');
    await page.getByRole('button', { name: 'Stop All Playback' }).click();

    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/chaser/load/0');
    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/chaser/play/0');
    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/motion/load/0');
    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/motion/start/0');
    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/chaser/stop');
    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/motion/stop');
  });

  test('locks blackout channels on the Pico and clears the lock before normal recalls', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.getByRole('button', { name: 'Blackout Target' }).click();

    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/blackout')).toBe(true);
    const blackoutCall = calls.pico.find(call => call.url === 'http://pico.test/dmx/blackout');
    expect(blackoutCall).toBeTruthy();
    expect(blackoutCall.method).toBe('POST');
    expect(blackoutCall.body.split(',').sort()).toEqual(['11:0', '12:0', '13:0', '14:0', '1:0', '2:0', '3:0', '4:0'].sort());
    await expect(page.getByRole('button', { name: 'Clear Blackout' })).toBeVisible();

    await page.getByRole('button', { name: 'Clear Blackout' }).click();

    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/blackout/clear')).toBe(true);
    await expect(page.getByRole('button', { name: 'Blackout Target' })).toBeVisible();

    calls.pico.length = 0;
    await page.getByRole('button', { name: 'Blackout Target' }).click();
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/blackout')).toBe(true);
    await page.getByRole('button', { name: /Both On/ }).click();

    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b')).toBe(true);
    const urls = calls.pico.map(call => call.url);
    expect(urls.indexOf('http://pico.test/dmx/blackout/clear')).toBeLessThan(urls.indexOf('http://pico.test/dmx/b'));
    expect(calls.pico.find(call => call.url === 'http://pico.test/dmx/b').body).toBe('1:100,11:200');
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

    await page.locator('[data-chaser-toggle="1"]').click();
    expect(calls.pico.map(call => call.url)).not.toContain('http://pico.test/chaser/load/1');
    expect(calls.pico.map(call => call.url)).toContain('http://pico.test/chaser/play/1');
  });

  test('Find Pico fills the Pico base URL from the discovery endpoint', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await page.route('**/pico_discovery.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          devices: [{ id: 'test-pico', name: 'pico-wifi-dmx', ip: '192.0.2.55', http: 80, url: 'http://192.0.2.55/' }]
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
    await openDmxPage(page, 'dmx_show.html');

    await page.getByRole('button', { name: 'Find Pico' }).click();

    await expect(page.locator('#baseUrl')).toHaveValue('http://192.0.2.55/');
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

  test('loads Show Run layout and live controls from server UI state', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      showRunState: {
        cardCols: 3,
        cardRows: 3,
        cardOrder: ['live', 'scene', 'palette', 'chaser', 'motion', 'group', null, null, null],
        paletteCols: 2,
        paletteRows: 1,
        paletteOrder: ['palette_1', null],
        liveControls: [{
          id: 'server_live_button',
          cardId: 'live',
          fixtureId: 101,
          controlId: 11,
          part: 'value',
          widget: 'button',
          buttonMode: 'hold',
          buttonValue: 255,
          timerOnMs: 3000,
          timerOffMs: 30000
        }]
      }
    };
    await routeShowSetup(page, calls);
    await page.addInitScript(() => {
      localStorage.setItem('dmxShowRun.cardOrder', JSON.stringify(['group', 'scene', 'palette', 'chaser', 'motion', 'live']));
      localStorage.setItem('dmxShowRun.paletteCols', '1');
      localStorage.setItem('dmxShowRun.paletteRows', '1');
    });
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Live Controls');
    await expect(page.locator('#cardGrid > :nth-child(6) h2')).toHaveText('Show Target');
    await expect(page.locator('#cardLive .live-widget')).toHaveCount(1);
    await expect(page.locator('#cardLive .live-widget h3')).toContainText('Spot 1 - Dimmer');
    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 6)).toEqual(['live', 'scene', 'palette', 'chaser', 'motion', 'group']);
  });

  test('lets the operator add a live fader and send direct fixture DMX from Show Run', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('#cardLive')).toBeVisible();
    await page.locator('#liveFixtureSelect').selectOption('101');
    await page.locator('#liveControlSelect').selectOption('11');
    await page.locator('#liveWidgetSelect').selectOption('fader');
    await page.locator('#addLiveControl').click();

    await expect(page.locator('#liveControlGrid .live-widget')).toHaveCount(1);
    await expect(page.locator('#liveControlGrid')).toContainText('Spot 1 - Dimmer');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.liveControls') || '[]').length))
      .toBe(1);

    await page.locator('#liveControlGrid input[type="range"]').fill('77');

    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.method === 'POST' && call.body.includes('1:77')))
      .toBe(true);
    await expect.poll(() => calls.liveValues.some(snapshot => snapshot['101:11'] === 77))
      .toBe(true);
  });

  test('restores the previous live value when a hold live button is released', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0, setupValues: { '101:11': 33 } };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#liveFixtureSelect').selectOption('101');
    await page.locator('#liveControlSelect').selectOption('11');
    await page.locator('#liveWidgetSelect').selectOption('button');
    await page.locator('#liveButtonMode').selectOption('hold');
    await page.locator('#liveButtonValue').fill('255');
    await page.locator('#addLiveControl').click();

    const button = page.locator('#liveControlGrid [data-live-button]');
    await button.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0 });
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body.includes('1:255')))
      .toBe(true);

    await button.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'mouse', button: 0 });
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body.includes('1:33')))
      .toBe(true);
    await expect.poll(() => calls.liveValues.some(snapshot => snapshot['101:11'] === 33))
      .toBe(true);
  });

  test('cycles a timer live button for fog and haze style controls', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0, setupValues: { '101:11': 0 } };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#liveFixtureSelect').selectOption('101');
    await page.locator('#liveControlSelect').selectOption('11');
    await page.locator('#liveWidgetSelect').selectOption('button');
    await page.locator('#liveButtonMode').selectOption('timer');
    await page.locator('#liveButtonValue').fill('200');
    await page.locator('#liveTimerOn').fill('0.1');
    await page.locator('#liveTimerOff').fill('0.1');
    await page.locator('#addLiveControl').click();

    await page.locator('#liveControlGrid [data-live-button]').click();
    await expect(page.locator('#liveControlGrid [data-live-button]')).toHaveText('Stop Timer');
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body.includes('1:200')))
      .toBe(true);
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body.includes('1:0')))
      .toBe(true);

    await page.locator('#liveControlGrid [data-live-button]').click();
    await expect(page.locator('#liveControlGrid [data-live-button]')).toHaveText('Start Timer');
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

  test('changes the page background while Show Run layout editing is active', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    const normalBg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    const normalHeaderBg = await page.locator('header').evaluate(el => getComputedStyle(el).backgroundColor);
    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('body')).toHaveClass(/layout-editing/);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 25, 21)');
    await expect(page.locator('header')).toHaveCSS('background-color', 'rgb(119, 64, 65)');
    const editBg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    const editHeaderBg = await page.locator('header').evaluate(el => getComputedStyle(el).backgroundColor);

    expect(editBg).not.toBe(normalBg);
    expect(editHeaderBg).not.toBe(normalHeaderBg);

    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('body')).not.toHaveClass(/layout-editing/);
    await expect(page.locator('body')).toHaveCSS('background-color', normalBg);
    await expect(page.locator('header')).toHaveCSS('background-color', normalHeaderBg);
    const restoredBg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);

    expect(restoredBg).toBe(normalBg);
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

  test('warns when loaded Pico playback slots are hidden outside the visible Show Run matrix', async ({ page }) => {
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
      })),
      liveMotionSlots: Array.from({ length: 64 }, (_, slot) => ({
        slot,
        loaded: slot === 0 || slot === 63,
        active: false,
        bpm: slot === 63 ? 45 : 30,
        target_count: 2,
        fixture_count: 2
      }))
    };
    await routeShowSetup(page, calls);
    await page.addInitScript(() => {
      localStorage.setItem('dmxShowRun.chaserCols', '2');
      localStorage.setItem('dmxShowRun.chaserRows', '1');
      localStorage.setItem('dmxShowRun.chaserOrder', JSON.stringify(['1', null, '31']));
      localStorage.setItem('dmxShowRun.motionCols', '2');
      localStorage.setItem('dmxShowRun.motionRows', '1');
      localStorage.setItem('dmxShowRun.motionOrder', JSON.stringify(['0', null, '63']));
    });

    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('#hiddenTileModal')).toBeVisible();
    await expect(page.locator('#hiddenTileList')).toContainText('Pico chaser slot 31');
    await expect(page.locator('#hiddenTileList')).toContainText('Pico effect slot 63');

    await page.locator('[data-hidden-place="chaser:31"]').click();

    await expect(page.locator('#chaserRows')).toHaveValue('1');
    await expect(page.locator('#chaserSlots')).toContainText('Pico slot 31');
    await expect(page.locator('#hiddenTileModal')).toBeVisible();

    await page.locator('[data-hidden-place="motion:63"]').click();

    await expect(page.locator('#motionRows')).toHaveValue('1');
    await expect(page.locator('#motionSlots')).toContainText('Pico effect 63');
    await expect(page.locator('#hiddenTileModal')).not.toBeVisible();
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator move palette tiles locally and still recall the moved palette', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#paletteCols').fill('2');
    await page.locator('#paletteRows').fill('1');
    await expect(page.locator('#paletteMove')).toHaveCount(0);
    await page.getByRole('button', { name: /Red/ }).click();
    await page.locator('#paletteGrid .slot').nth(1).click();

    await expect(page.locator('#paletteGrid .slot').nth(1)).toContainText('Red');
    await page.locator('#editLayoutBtn').click();
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
    await expect(page.locator('#groupMove, #sceneMove, #paletteMove, #chaserMove, #motionMove')).toHaveCount(0);

    const source = page.getByRole('button', { name: /Red/ });
    const target = page.locator('#paletteGrid .slot').nth(1);
    await source.dragTo(target);

    await expect(page.locator('#paletteGrid .slot').nth(1)).toContainText('Red');
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator move tiles in every Show Run card type', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      scenes: [
        { id: 'scene_1', name: 'Scene One', slot: 0, values: { '101:11': 10 } }
      ],
      palettes: [
        { id: 'palette_1', name: 'Palette One', slot: 0, scope: 'Color', values: { '101:12': { a: 255, b: 0, c: 0 } } }
      ],
      mirroredChaserSlots: ['{"name":"Chase One"}'],
      liveMotionSlots: [{ loaded: true, slot: 0, bpm: 30 }],
      showRunState: {
        groupCols: 2,
        groupRows: 2,
        sceneCols: 2,
        sceneRows: 2,
        paletteCols: 2,
        paletteRows: 2,
        chaserCols: 2,
        chaserRows: 2,
        motionCols: 2,
        motionRows: 2
      }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();

    const cases = [
      { kind: 'group', grid: '#groupGrid', label: 'Front Spots', key: 'front', stateKey: 'groupOrder' },
      { kind: 'scene', grid: '#sceneGrid', label: 'Scene One', key: 'scene_1', stateKey: 'sceneOrder' },
      { kind: 'palette', grid: '#paletteGrid', label: 'Palette One', key: 'palette_1', stateKey: 'paletteOrder' },
      { kind: 'chaser', grid: '#chaserSlots', label: 'Chase One', key: '0', stateKey: 'chaserOrder' },
      { kind: 'motion', grid: '#motionSlots', label: 'Pico effect 0', key: '0', stateKey: 'motionOrder' }
    ];

    for (const row of cases) {
      const grid = page.locator(row.grid);
      await expect(grid.locator('[data-show-tile-index="0"]')).toContainText(row.label);
      await grid.locator('[data-show-tile-index="0"]').click({ position: { x: 40, y: 44 } });
      await grid.locator('[data-show-tile-index="3"]').click({ position: { x: 40, y: 44 } });
      await expect(grid.locator('[data-show-tile-index="3"]')).toContainText(row.label);
      await expect(grid.locator('[data-show-tile-index="0"]')).not.toContainText(row.label);
      const saved = calls.uiStatePosts.map(post => post.state?.[row.stateKey]).filter(Boolean).at(-1);
      expect(saved[3]).toBe(row.key);
    }
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator drag tiles in every Show Run card type', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      scenes: [
        { id: 'scene_1', name: 'Scene One', slot: 0, values: { '101:11': 10 } }
      ],
      palettes: [
        { id: 'palette_1', name: 'Palette One', slot: 0, scope: 'Color', values: { '101:12': { a: 255, b: 0, c: 0 } } }
      ],
      mirroredChaserSlots: ['{"name":"Chase One"}'],
      liveMotionSlots: [{ loaded: true, slot: 0, bpm: 30 }],
      showRunState: {
        groupCols: 2,
        groupRows: 2,
        sceneCols: 2,
        sceneRows: 2,
        paletteCols: 2,
        paletteRows: 2,
        chaserCols: 2,
        chaserRows: 2,
        motionCols: 2,
        motionRows: 2
      }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();

    const cases = [
      { grid: '#groupGrid', label: 'Front Spots', key: 'front', stateKey: 'groupOrder' },
      { grid: '#sceneGrid', label: 'Scene One', key: 'scene_1', stateKey: 'sceneOrder' },
      { grid: '#paletteGrid', label: 'Palette One', key: 'palette_1', stateKey: 'paletteOrder' },
      { grid: '#chaserSlots', label: 'Chase One', key: '0', stateKey: 'chaserOrder' },
      { grid: '#motionSlots', label: 'Pico effect 0', key: '0', stateKey: 'motionOrder' }
    ];

    for (const row of cases) {
      const grid = page.locator(row.grid);
      await expect(grid.locator('[data-show-tile-index="0"]')).toContainText(row.label);
      await grid.locator('[data-show-tile-index="0"]').dragTo(grid.locator('[data-show-tile-index="3"]'));
      await expect(grid.locator('[data-show-tile-index="3"]')).toContainText(row.label);
      const saved = calls.uiStatePosts.map(post => post.state?.[row.stateKey]).filter(Boolean).at(-1);
      expect(saved[3]).toBe(row.key);
    }
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator drag tiles in repeated playback cards', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      mirroredChaserSlots: ['{"name":"Chase One"}'],
      liveMotionSlots: [{ loaded: true, slot: 0, bpm: 30 }],
      showRunState: {
        cardCols: 3,
        cardRows: 3,
        cardOrder: ['group', 'scene', 'palette', 'chaser', 'motion', 'chaser:custom', 'motion:custom', 'live', null],
        cardLayouts: {
          'chaser:custom': { kind: 'chaser', cols: 2, rows: 2, order: ['0', null, null, null] },
          'motion:custom': { kind: 'motion', cols: 2, rows: 2, order: ['0', null, null, null] }
        }
      }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();

    const cases = [
      { card: '[data-show-card-key="chaser:custom"]', label: 'Chase One', key: '0' },
      { card: '[data-show-card-key="motion:custom"]', label: 'Pico effect 0', key: '0' }
    ];

    for (const row of cases) {
      const card = page.locator(row.card);
      await expect(card.locator('[data-show-tile-index="0"]')).toContainText(row.label);
      await card.locator('[data-show-tile-index="0"]').dragTo(card.locator('[data-show-tile-index="3"]'));
      await expect(card.locator('[data-show-tile-index="3"]')).toContainText(row.label);
    }

    const savedLayouts = calls.uiStatePosts.map(post => post.state?.cardLayouts).filter(Boolean).at(-1);
    expect(savedLayouts['chaser:custom'].order[3]).toBe('0');
    expect(savedLayouts['motion:custom'].order[3]).toBe('0');
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator click-move tiles in repeated playback cards', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      mirroredChaserSlots: ['{"name":"Chase One"}'],
      liveMotionSlots: [{ loaded: true, slot: 0, bpm: 30 }],
      showRunState: {
        cardCols: 3,
        cardRows: 3,
        cardOrder: ['group', 'scene', 'palette', 'chaser', 'motion', 'chaser:custom', 'motion:custom', 'live', null],
        cardLayouts: {
          'chaser:custom': { kind: 'chaser', cols: 2, rows: 2, order: ['0', null, null, null] },
          'motion:custom': { kind: 'motion', cols: 2, rows: 2, order: ['0', null, null, null] }
        }
      }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();

    for (const row of [
      { card: '[data-show-card-key="chaser:custom"]', label: 'Chase One' },
      { card: '[data-show-card-key="motion:custom"]', label: 'Pico effect 0' }
    ]) {
      const card = page.locator(row.card);
      await card.locator('[data-show-tile-index="0"]').click({ position: { x: 40, y: 44 } });
      await card.locator('[data-show-tile-index="3"]').click({ position: { x: 40, y: 44 } });
      await expect(card.locator('[data-show-tile-index="3"]')).toContainText(row.label);
    }
  });

  test('shows tile edit and delete actions while editing Show Run layout', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0, groupWrites: [], sceneWrites: [], paletteWrites: [] };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('#paletteGrid .slot-visual-btn')).toHaveCount(0);
    await expect(page.locator('#paletteGrid .slot-del')).toHaveCount(0);

    await page.locator('#editLayoutBtn').click();
    await page.locator('#paletteGrid .slot-visual-btn').click();
    await expect(page.locator('#showTileVisualModal')).toBeVisible();
    await page.locator('#showTileVisualName').fill('Warm Red');
    await page.locator('#showTileVisualColor').fill('#884422');
    await page.locator('#showTileVisualSave').click();

    await expect(page.locator('#paletteGrid')).toContainText('Warm Red');
    expect(calls.paletteWrites.at(-1).palettes[0]).toMatchObject({
      name: 'Warm Red',
      visual: { type: 'visual', color: '#884422' }
    });

    page.once('dialog', dialog => dialog.accept());
    await page.locator('#paletteGrid .slot-del').click();

    await expect(page.locator('#paletteGrid')).not.toContainText('Warm Red');
    expect(calls.paletteWrites.at(-1).palettes).toEqual([]);
  });

  test('warns when saved palettes are hidden outside the visible Show Run matrix', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
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
            { id: 'palette_1', name: 'Red', scope: 'Color', values: { '101:12': { a: 255, b: 0, c: 0 } } },
            { id: 'palette_2', name: 'Blue', scope: 'Color', values: { '101:12': { a: 0, b: 0, c: 255 } } }
          ]
        })
      });
    });
    await page.addInitScript(() => {
      localStorage.setItem('dmxShowRun.paletteCols', '1');
      localStorage.setItem('dmxShowRun.paletteRows', '1');
      localStorage.setItem('dmxShowRun.paletteOrder', JSON.stringify(['palette_1', 'palette_2']));
    });

    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('#hiddenTileModal')).toBeVisible();
    await expect(page.locator('#hiddenTileList')).toContainText('Blue');
    await expect(page.locator('#paletteGrid')).not.toContainText('Blue');

    await page.locator('[data-hidden-expand="palette"]').click();

    await expect(page.locator('#hiddenTileModal')).not.toBeVisible();
    await expect(page.locator('#paletteRows')).toHaveValue('2');
    await expect(page.locator('#paletteGrid')).toContainText('Blue');
    expect(calls.setupWrites).toBe(0);
  });

  test('can place a hidden saved palette into a free visible Show Run tile', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
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
          paletteCols: 2,
          paletteRows: 1,
          palettes: [
            { id: 'palette_1', name: 'Red', scope: 'Color', values: { '101:12': { a: 255, b: 0, c: 0 } } },
            { id: 'palette_2', name: 'Blue', scope: 'Color', values: { '101:12': { a: 0, b: 0, c: 255 } } }
          ]
        })
      });
    });
    await page.addInitScript(() => {
      localStorage.setItem('dmxShowRun.paletteCols', '2');
      localStorage.setItem('dmxShowRun.paletteRows', '1');
      localStorage.setItem('dmxShowRun.paletteOrder', JSON.stringify(['palette_1', null, 'palette_2']));
    });

    await openDmxPage(page, 'dmx_show.html');
    await expect(page.locator('#hiddenTileModal')).toBeVisible();

    await page.locator('[data-hidden-place="palette:palette_2"]').click();

    await expect(page.locator('#hiddenTileModal')).not.toBeVisible();
    await expect(page.locator('#paletteRows')).toHaveValue('1');
    await expect(page.locator('#paletteGrid .slot').nth(1)).toContainText('Blue');
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator arrange whole show cards in a card matrix', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('#cardMove')).toHaveCount(0);

    await page.locator('#cardCols').fill('2');
    await page.locator('#cardRows').fill('3');

    await page.locator('#cardPalette .panel-head').dragTo(page.locator('#cardGroup .panel-head'));
    await page.locator('#cardMotion .panel-head').dragTo(page.locator('#cardScene .panel-head'));

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Palettes');
    await expect(page.locator('#cardGrid > :nth-child(2) h2')).toHaveText('Pico Effects Playback');
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Show Target');
    expect(calls.setupWrites).toBe(0);
  });

  test('shows only the configured number of card matrix slots', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardCols').fill('3');
    await page.locator('#cardRows').fill('2');

    await expect(page.locator('#cardGrid > *')).toHaveCount(6);
    await expect(page.locator('[data-add-card-position="6"]')).toHaveCount(0);
    expect(calls.setupWrites).toBe(0);
  });

  test('moving a show card to an occupied matrix spot swaps only those two cards', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardCols').fill('2');
    await page.locator('#cardRows').fill('3');

    // Row 2 / col 2 is the fourth visible card in a 2-column matrix.
    await page.locator('#cardChaser .panel-head').dragTo(page.locator('#cardGroup .panel-head'));

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Pico Chaser Playback');
    await expect(page.locator('#cardGrid > :nth-child(2) h2')).toHaveText('Scenes');
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Palettes');
    await expect(page.locator('#cardGrid > :nth-child(4) h2')).toHaveText('Show Target');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 4)).toEqual(['chaser', 'scene', 'palette', 'group']);
  });

  test('swapping non-adjacent show cards leaves every other card position unchanged', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardCols').fill('3');
    await page.locator('#cardRows').fill('3');

    const beforeOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(beforeOrder.slice(0, 6)).toEqual(['group', 'scene', 'palette', 'chaser', 'motion', 'live']);

    await page.locator('#cardScene .panel-head').dragTo(page.locator('#cardMotion .panel-head'));

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Show Target');
    await expect(page.locator('#cardGrid > :nth-child(2) h2')).toHaveText('Pico Effects Playback');
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Palettes');
    await expect(page.locator('#cardGrid > :nth-child(4) h2')).toHaveText('Pico Chaser Playback');
    await expect(page.locator('#cardGrid > :nth-child(5) h2')).toHaveText('Scenes');
    await expect(page.locator('#cardGrid > :nth-child(6) h2')).toHaveText('Live Controls');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 6)).toEqual(['group', 'motion', 'palette', 'chaser', 'scene', 'live']);
    expect(calls.setupWrites).toBe(0);
  });

  test('moving a show card to an empty matrix spot does not shift other cards', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardCols').fill('3');
    await page.locator('#cardRows').fill('3');

    // Position 5 contains Pico Effects Playback, position 6 contains Live Controls,
    // and position 7 is empty in the default 3x3 card matrix.
    await page.locator('#cardMotion .panel-head').dragTo(page.locator('#cardGrid > :nth-child(7)'));

    await expect(page.locator('#cardGrid > :nth-child(5)')).toContainText('Add card');
    await expect(page.locator('#cardGrid > :nth-child(5)')).toContainText('Position 5');
    await expect(page.locator('#cardGrid > :nth-child(6) h2')).toHaveText('Live Controls');
    await expect(page.locator('#cardGrid > :nth-child(7) h2')).toHaveText('Pico Effects Playback');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 7)).toEqual(['group', 'scene', 'palette', 'chaser', null, 'live', 'motion']);
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator move the Live Controls card from its header', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardCols').fill('3');
    await page.locator('#cardRows').fill('3');

    await expect(page.locator('#cardLive .card-move-handle')).toHaveCount(0);
    await page.locator('#cardLive .panel-head').dragTo(page.locator('#cardGrid > :nth-child(8)'));

    await expect(page.locator('#cardGrid > :nth-child(6)')).toContainText('Add card');
    await expect(page.locator('#cardGrid > :nth-child(6)')).toContainText('Position 6');
    await expect(page.locator('#cardGrid > :nth-child(8) h2')).toHaveText('Live Controls');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 8)).toEqual(['group', 'scene', 'palette', 'chaser', 'motion', null, null, 'live']);
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator swap the Live Controls card with another occupied card', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardCols').fill('3');
    await page.locator('#cardRows').fill('3');

    await expect(page.locator('#cardLive .card-move-handle')).toHaveCount(0);
    await page.locator('#cardLive .panel-head').dragTo(page.locator('#cardScene .panel-head'));

    await expect(page.locator('#cardGrid > :nth-child(2) h2')).toHaveText('Live Controls');
    await expect(page.locator('#cardGrid > :nth-child(6) h2')).toHaveText('Scenes');
    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Show Target');
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Palettes');
    await expect(page.locator('#cardGrid > :nth-child(4) h2')).toHaveText('Pico Chaser Playback');
    await expect(page.locator('#cardGrid > :nth-child(5) h2')).toHaveText('Pico Effects Playback');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 6)).toEqual(['group', 'live', 'palette', 'chaser', 'motion', 'scene']);
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator mouse-drag the Live Controls card onto another card', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardCols').fill('3');
    await page.locator('#cardRows').fill('3');

    await expect(page.locator('#cardGrid > :nth-child(2) h2')).toHaveText('Scenes');
    await expect(page.locator('#cardGrid > :nth-child(6) h2')).toHaveText('Live Controls');

    const source = await page.locator('#cardLive .panel-head').boundingBox();
    const target = await page.locator('#cardScene .panel-head').boundingBox();
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();

    await page.mouse.move(source.x + source.width / 2, source.y + Math.min(80, source.height / 2));
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + Math.min(80, target.height / 2), { steps: 12 });
    await page.mouse.up();

    await expect(page.locator('#cardGrid > :nth-child(2) h2')).toHaveText('Live Controls');
    await expect(page.locator('#cardGrid > :nth-child(6) h2')).toHaveText('Scenes');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 6)).toEqual(['group', 'live', 'palette', 'chaser', 'motion', 'scene']);
    expect(calls.setupWrites).toBe(0);
  });

  test('keeps multiple Live Controls card entries as separate cards', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await page.addInitScript(() => {
      localStorage.setItem('dmxShowRun.cardCols', '3');
      localStorage.setItem('dmxShowRun.cardRows', '3');
      localStorage.setItem('dmxShowRun.cardOrder', JSON.stringify(['live', 'scene', 'palette', 'chaser', 'motion', 'live', 'group', null, null]));
    });
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('[data-show-card="live"]')).toHaveCount(2);
    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Live Controls');
    await expect(page.locator('#cardGrid > :nth-child(6) h2')).toHaveText('Live Controls');

    let savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 9)).toEqual(['live', 'scene', 'palette', 'chaser', 'motion', expect.stringMatching(/^live:/), 'group', null, null]);

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardLive .panel-head').dragTo(page.locator('#cardPalette .panel-head'));

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Palettes');
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Live Controls');
    savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 9)).toEqual(['palette', 'scene', 'live', 'chaser', 'motion', expect.stringMatching(/^live:/), 'group', null, null]);
    expect(calls.setupWrites).toBe(0);
  });

  test('adds and deletes a second Live Controls card with independent controls', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardRows').fill('4');
    await expect(page.locator('[data-add-card-position="6"]')).toBeVisible();
    await page.locator('[data-add-card-position="6"]').click();
    await expect(page.locator('#addCardModal')).toBeVisible();
    await page.locator('#addCardType').selectOption('live');
    await expect(page.locator('#addShowCard')).toHaveText('Add Live Controls');
    await page.locator('#addShowCard').click();

    await expect(page.locator('#addCardModal')).toBeHidden();
    await expect(page.locator('[data-show-card="live"]')).toHaveCount(2);
    await expect(page.locator('#status')).toHaveText('Added Live Controls at position 7');
    const secondLive = page.locator('[data-show-card="live"]').nth(1);
    await secondLive.locator('.live-fixture-select').selectOption('101');
    await secondLive.locator('.live-control-select').selectOption('12');
    await secondLive.locator('.live-widget-select').selectOption('button');
    await secondLive.locator('.live-button-mode').selectOption('hold');
    await secondLive.locator('.add-live-control').click();

    await expect(secondLive.locator('.live-widget')).toHaveCount(1);
    await expect(page.locator('[data-show-card="live"]').nth(0).locator('.live-widget')).toHaveCount(0);
    let savedControls = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.liveControls') || '[]'));
    expect(savedControls).toHaveLength(1);
    expect(savedControls[0].cardId).toMatch(/^live_/);
    expect(savedControls[0].widget).toBe('button');
    expect(savedControls[0].buttonMode).toBe('hold');

    await secondLive.locator('.card-delete').click();
    await expect(page.locator('[data-show-card="live"]')).toHaveCount(1);
    savedControls = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.liveControls') || '[]'));
    expect(savedControls).toHaveLength(0);
    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.filter(entry => String(entry || '').startsWith('live'))).toHaveLength(1);
    expect(calls.uiStatePosts.some(post => post.page === 'showRun' && post.state.cardOrder)).toBe(true);
    expect(calls.uiStatePosts.some(post => post.page === 'showRun' && Array.isArray(post.state.liveControls))).toBe(true);
    expect(calls.setupWrites).toBe(0);
  });

  test('can remove a card and add it back', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardScene .card-delete').click();
    await expect(page.locator('#cardGrid #cardScene')).toHaveCount(0);

    await expect(page.locator('[data-add-card-position="1"]')).toBeVisible();
    await page.locator('[data-add-card-position="1"]').click();
    await expect(page.locator('#addCardModal')).toBeVisible();
    await expect(page.locator('#addCardType option:disabled')).toHaveCount(0);
    const addOptions = await page.locator('#addCardType option').evaluateAll(options => options.map(option => option.textContent));
    expect(addOptions.sort()).toEqual(['Live Controls', 'Palettes', 'Pico Chaser Playback', 'Pico Effects Playback', 'Scenes', 'Show Target'].sort());
    await page.locator('#addCardType').selectOption('scene');
    await expect(page.locator('#addShowCard')).toHaveText('Add Scenes Card');
    await page.locator('#addShowCard').click();
    await expect(page.locator('#cardGrid #cardScene')).toHaveCount(1);
    await expect(page.locator('#status')).toHaveText('Added Scenes at position 2');
    await expect(page.locator('#addCardType option[value="scene"]')).toHaveCount(1);

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.filter(entry => entry === 'scene')).toHaveLength(1);
    expect(calls.uiStatePosts.some(post => post.page === 'showRun' && post.state.cardOrder)).toBe(true);
    expect(calls.setupWrites).toBe(0);
  });

  test('can add a second Palettes card', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      showRunState: {
        cardCols: 3,
        cardRows: 3,
        cardOrder: ['group', 'scene', 'palette', 'chaser', 'motion', 'live', null, null, null]
      }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('[data-add-card-position="6"]').click();
    await expect(page.locator('#addCardModal')).toBeVisible();
    await expect(page.locator('#addCardType option[value="palette"]')).toHaveCount(1);
    await page.locator('#addCardType').selectOption('palette');
    await expect(page.locator('#addShowCard')).toHaveText('Add Palettes Card');
    await page.locator('#addShowCard').click();

    await expect(page.locator('[data-show-card="palette"]')).toHaveCount(2);
    await expect(page.locator('[data-show-card="palette"]').nth(1)).toContainText('Red');
    await expect(page.locator('#status')).toHaveText('Added Palettes at position 7');
    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.filter(entry => String(entry || '').startsWith('palette'))).toHaveLength(2);
    expect(calls.uiStatePosts.some(post => post.page === 'showRun' && post.state.cardOrder)).toBe(true);
    expect(calls.setupWrites).toBe(0);
  });

  test('keeps repeated Palettes card layouts independent', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      showRunState: {
        cardCols: 3,
        cardRows: 3,
        cardOrder: ['group', 'scene', 'palette', 'palette:custom', 'motion', 'live', null, null, null],
        paletteCols: 1,
        paletteRows: 1,
        cardLayouts: {
          'palette:custom': { kind: 'palette', cols: 2, rows: 1, order: ['palette_1', null] }
        }
      }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    const paletteCards = page.locator('[data-show-card="palette"]');
    const secondPalette = page.locator('[data-show-card-key="palette:custom"]');
    await expect(paletteCards).toHaveCount(2);
    await expect(paletteCards.nth(0).locator('.slot')).toHaveCount(1);
    await expect(secondPalette.locator('.slot')).toHaveCount(2);
    const secondRows = secondPalette.locator('.matrix-tools label', { hasText: 'Rows' }).locator('input');
    expect(await secondRows.evaluate(input => typeof input.oninput)).toBe('function');

    await secondRows.evaluate(input => {
      input.value = '2';
      input.oninput({ target: input });
    });
    await expect(paletteCards.nth(0).locator('.slot')).toHaveCount(1);
    await expect(secondPalette.locator('.slot')).toHaveCount(4);

    const savedLayouts = calls.uiStatePosts
      .map(post => post.state?.cardLayouts)
      .filter(Boolean)
      .at(-1);
    expect(savedLayouts['palette:custom']).toMatchObject({ kind: 'palette', cols: 2, rows: 2 });
    expect(calls.setupWrites).toBe(0);
  });

  test('can add another card when the same card type is hidden outside the visible matrix', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      showRunState: {
        cardCols: 3,
        cardRows: 2,
        cardOrder: ['live', 'group', null, null, null, null, 'scene', 'palette', 'chaser', 'motion']
      }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('#cardGrid > *')).toHaveCount(6);
    await page.locator('[data-add-card-position="2"]').click();
    await expect(page.locator('#addCardModal')).toBeVisible();
    const addOptions = await page.locator('#addCardType option').evaluateAll(options => options.map(option => option.textContent).sort());
    expect(addOptions).toEqual(['Live Controls', 'Palettes', 'Pico Chaser Playback', 'Pico Effects Playback', 'Scenes', 'Show Target'].sort());

    await page.locator('#addCardType').selectOption('palette');
    await page.locator('#addShowCard').click();

    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Palettes');
    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder[2]).toBe('palette');
    expect(savedOrder.filter(entry => String(entry || '').startsWith('palette'))).toHaveLength(2);
    expect(calls.uiStatePosts.some(post => post.page === 'showRun' && post.state.cardOrder)).toBe(true);
  });

  test('hides Live Controls setup outside Edit Layout', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('#cardLive .live-control-toolbar')).not.toBeVisible();
    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('#cardLive .live-control-toolbar')).toBeVisible();
    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('#cardLive .live-control-toolbar')).not.toBeVisible();
    expect(calls.setupWrites).toBe(0);
  });

  test('moves Live Controls correctly when it starts at matrix position 0', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await page.addInitScript(() => {
      localStorage.setItem('dmxShowRun.cardCols', '3');
      localStorage.setItem('dmxShowRun.cardRows', '3');
      localStorage.setItem('dmxShowRun.cardOrder', JSON.stringify(['live', 'scene', 'palette', 'chaser', 'motion', 'group', null, null, null]));
    });
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Live Controls');
    await page.locator('#cardLive .panel-head').dragTo(page.locator('#cardGrid > :nth-child(8)'));

    await expect(page.locator('#cardGrid > :nth-child(1)')).toContainText('Add card');
    await expect(page.locator('#cardGrid > :nth-child(1)')).toContainText('Position 1');
    await expect(page.locator('#cardGrid > :nth-child(8) h2')).toHaveText('Live Controls');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 9)).toEqual([null, 'scene', 'palette', 'chaser', 'motion', 'group', null, 'live', null]);
    expect(calls.setupWrites).toBe(0);
  });

  test('auto-scrolls while dragging the Live Controls card to an offscreen card above it', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardCols').fill('3');
    await page.locator('#cardRows').fill('3');

    await expect(page.locator('#cardGrid > :nth-child(2) h2')).toHaveText('Scenes');
    await expect(page.locator('#cardGrid > :nth-child(6) h2')).toHaveText('Live Controls');

    await page.locator('#cardLive').scrollIntoViewIfNeeded();
    const source = await page.locator('#cardLive .panel-head').boundingBox();
    expect(source).not.toBeNull();

    await page.mouse.move(source.x + source.width / 2, source.y + Math.min(80, source.height / 2));
    await page.mouse.down();
    for (let i = 0; i < 36; i++) {
      await page.mouse.move(source.x + source.width / 2, 28, { steps: 2 });
      await page.waitForTimeout(16);
    }
    const target = await page.locator('#cardScene .panel-head').boundingBox();
    expect(target).not.toBeNull();
    await page.mouse.move(target.x + target.width / 2, target.y + Math.min(80, target.height / 2), { steps: 10 });
    await page.mouse.up();

    await expect(page.locator('#cardGrid > :nth-child(2) h2')).toHaveText('Live Controls');
    await expect(page.locator('#cardGrid > :nth-child(6) h2')).toHaveText('Scenes');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 6)).toEqual(['group', 'live', 'palette', 'chaser', 'motion', 'scene']);
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator swap Pico Chaser Playback with Live Controls when Live Controls is the target card', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await page.addInitScript(() => {
      localStorage.setItem('dmxShowRun.cardCols', '3');
      localStorage.setItem('dmxShowRun.cardRows', '3');
      localStorage.setItem('dmxShowRun.cardOrder', JSON.stringify(['live', 'scene', 'chaser', 'group', 'motion', 'palette', null, null, null]));
    });
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Live Controls');
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Pico Chaser Playback');

    await page.locator('#cardChaser .panel-head').dragTo(page.locator('#cardLive .panel-head'));

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Pico Chaser Playback');
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Live Controls');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 6)).toEqual(['chaser', 'scene', 'live', 'group', 'motion', 'palette']);
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator drag Pico Chaser Playback onto Live Controls to swap the cards', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await page.addInitScript(() => {
      localStorage.setItem('dmxShowRun.cardCols', '3');
      localStorage.setItem('dmxShowRun.cardRows', '3');
      localStorage.setItem('dmxShowRun.cardOrder', JSON.stringify(['live', 'scene', 'chaser', 'group', 'motion', 'palette', null, null, null]));
    });
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Live Controls');
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Pico Chaser Playback');

    await page.locator('#cardChaser .panel-head').dragTo(page.locator('#cardLive .panel-head'));

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Pico Chaser Playback');
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Live Controls');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 6)).toEqual(['chaser', 'scene', 'live', 'group', 'motion', 'palette']);
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator drag the Pico Chaser Playback card body onto Live Controls', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await page.addInitScript(() => {
      localStorage.setItem('dmxShowRun.cardCols', '3');
      localStorage.setItem('dmxShowRun.cardRows', '3');
      localStorage.setItem('dmxShowRun.cardOrder', JSON.stringify(['live', 'scene', 'chaser', 'group', 'motion', 'palette', null, null, null]));
    });
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Live Controls');
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Pico Chaser Playback');

    await page.locator('#cardChaser .panel-head').dragTo(page.locator('#cardLive .panel-head'));

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Pico Chaser Playback');
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Live Controls');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 6)).toEqual(['chaser', 'scene', 'live', 'group', 'motion', 'palette']);
    expect(calls.setupWrites).toBe(0);
  });
});
