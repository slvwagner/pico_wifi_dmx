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
    calls.fixtureGets = (calls.fixtureGets || 0) + 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        exists: true,
        setup: {
          baseUrl: 'http://pico.test',
          profiles: calls.profiles || profiles,
          fixtures: calls.fixtures || fixtures,
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
        groups: calls.groups || [
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

  await page.route('**/room_plane_setup.php**', async route => {
    if (route.request().method() !== 'GET') {
      calls.roomPlaneWrites = calls.roomPlaneWrites || [];
      calls.roomPlaneWrites.push(route.request().postDataJSON());
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
        planeCols: calls.planeCols || 2,
        planeRows: calls.planeRows || 1,
        planes: calls.planes || []
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
    const defaultShowRunState = {
      grandMasterFactor: 1,
      targetMasters: [{ id: 'target_1', name: 'Group Master 1', fixtureIds: [], factor: 1 }]
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, exists: true, state: { showRun: { ...defaultShowRunState, ...(calls.showRunState || {}) } } })
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
    if (url === 'http://pico.test/midi/status.json') {
      calls.midiStatusGets = (calls.midiStatusGets || 0) + 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(calls.midiStatus || {
          ok: true,
          enabled: true,
          initialized: true,
          rx_pin: 5,
          uart_id: 1,
          baud: 31250,
          byte_count: 0,
          message_count: 0,
          realtime_count: 0,
          parse_error_count: 0,
          last_event_ms: 0,
          running_status: 0,
          last_status: 0,
          last_type: 0,
          last_channel: 0,
          last_data1: 0,
          last_data2: 0
        })
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
}

async function installFakeComputerMidi(page) {
  await page.addInitScript(() => {
    const input = {
      id: 'launch-control-xl-in',
      name: 'Launch Control XL',
      manufacturer: 'Novation',
      state: 'connected',
      connection: 'closed',
      onmidimessage: null,
      open() { this.connection = 'open'; return Promise.resolve(this); }
    };
    const output = {
      id: 'launch-control-xl-out',
      name: 'Launch Control XL',
      manufacturer: 'Novation',
      state: 'connected',
      connection: 'closed',
      open() { this.connection = 'open'; return Promise.resolve(this); },
      send() {}
    };
    const access = {
      inputs: new Map([[input.id, input]]),
      outputs: new Map([[output.id, output]]),
      onstatechange: null
    };
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: () => Promise.resolve(access)
    });
    window.__emitComputerMidi = data => input.onmidimessage?.({ data: Uint8Array.from(data), target: input });
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

  test('recalls scenes only to individually selected fixtures', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('#cardFixture h2')).toHaveText('Fixtures');
    await page.getByRole('button', { name: /Spot 2/ }).click();
    await page.getByRole('button', { name: /Both On/ }).click();

    await expect(page.locator('#status')).toContainText('Scene "Both On" recalled');
    expect(calls.liveValues.at(-1)).toEqual({ '102:11': 200 });
    expect(calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body === '11:200')).toBe(true);
    expect(calls.setupWrites).toBe(0);
  });

  test('mirrors selected groups into fixture tiles and clears groups on manual fixture selection', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    const frontGroup = page.locator('#groupGrid [data-group="front"]');
    const spot1 = page.locator('#fixtureGrid [data-fixture="101"]');
    const spot2 = page.locator('#fixtureGrid [data-fixture="102"]');

    await frontGroup.click();
    await expect(frontGroup).toHaveClass(/active/);
    await expect(spot1).toHaveClass(/active/);
    await expect(spot2).not.toHaveClass(/active/);
    await expect(page.locator('#fixtureSummary')).toContainText('Spot 1');

    await spot2.click();
    await expect(frontGroup).not.toHaveClass(/active/);
    await expect(spot1).toHaveClass(/active/);
    await expect(spot2).toHaveClass(/active/);

    await page.locator('#editLayoutBtn').click();
    await page.locator('[data-target-master-assign="0"]').click();
    await expect(page.locator('[data-target-master-summary="0"]')).toContainText('2 fixtures');
    await expect.poll(() => calls.uiStatePosts.at(-1)?.state?.targetMasters?.[0]?.fixtureIds).toEqual(['101', '102']);
    expect(calls.setupWrites).toBe(0);
  });

  test('opens Group Edit from the Groups card and applies controls to the selected group target', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      groups: [
        { id: 'both', name: 'Both Spots', fixtureIds: [101, 102], values: {} }
      ]
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#groupGrid [data-group="both"]').click();
    await page.locator('#showGroupEditBtn').click();

    await expect(page.locator('#showGroupModal')).toBeVisible();
    await expect(page.locator('#showGroupModalTitle')).toContainText('2 fixtures');
    await expect(page.locator('#showGroupModalBody .control')).toHaveCount(2);
    await expect(page.locator('#showGroupModalBody .control-head')).toHaveCount(2);
    await expect(page.locator('#showGroupModalBody .readout')).toBeVisible();
    await expect(page.locator('#showGroupDefaultBtn')).toBeVisible();
    await expect(page.locator('#showGroupBlackoutBtn')).toBeVisible();
    expect((await page.locator('#showGroupModal .modal-card').boundingBox()).width).toBeLessThanOrEqual(762);
    const dimmer = page.locator('[data-show-group-slider][data-part="value"]').first();
    await expect(dimmer).toBeVisible();
    await dimmer.fill('77');

    await expect.poll(() => calls.liveValues.at(-1)).toEqual({ '101:11': 77, '102:11': 77 });
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body.includes('1:77') && call.body.includes('11:77'))).toBe(true);
    await expect(page.locator('#status')).toContainText('Group Edit Dimmer -> 2 fixtures');
    await page.locator('#showGroupBlackoutBtn').click();
    await expect.poll(() => calls.liveValues.at(-1)).toMatchObject({ '101:11': 0, '102:11': 0 });
    await expect(page.locator('#status')).toContainText('Group blackout recalled for 2 fixtures');
    expect(calls.setupWrites).toBe(0);
  });

  test('Group Edit exposes the same rich fixture control types as the controller modal', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      profiles: [
        {
          id: 10,
          name: 'Full Control Spot',
          mode: '16ch',
          channels: 16,
          controls: [
            { id: 11, type: 'slider8', label: 'Dimmer', channel: 1 },
            { id: 12, type: 'rgb', label: 'Color', a: 2, b: 3, c: 4 },
            { id: 13, type: 'panTilt16', label: 'Pan/Tilt', pan: 5, panFine: 6, tilt: 7, tiltFine: 8 },
            { id: 14, type: 'wheel', label: 'Gobo', channel: 9, options: [{ name: 'Open', value: 0 }, { name: 'Dots', value: 32 }] },
            { id: 15, type: 'slider16', label: 'Focus', channel: 10, fine: 11 }
          ]
        }
      ],
      fixtures: [
        { id: 201, name: 'Full Spot 1', profileId: 10, start: 1 },
        { id: 202, name: 'Full Spot 2', profileId: 10, start: 21 }
      ],
      groups: [
        { id: 'full', name: 'Full Spots', fixtureIds: [201, 202], values: {} }
      ]
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#groupGrid [data-group="full"]').click();
    await page.locator('#showGroupEditBtn').click();

    await expect(page.locator('#showGroupModal')).toBeVisible();
    await expect(page.locator('#showGroupModalBody .control h3')).toHaveText(['Dimmer', 'Color', 'Pan / Tilt', 'Gobo', 'Focus']);
    await expect(page.locator('#showGroupModalBody .xy-pad')).toBeVisible();
    await expect(page.locator('#showGroupModalBody input[type="color"]')).toBeVisible();
    await expect(page.locator('#showGroupModalBody .swatch')).toHaveCount(4);
    await expect(page.locator('#showGroupModalBody .byte-sliders input')).toHaveCount(2);
    await expect(page.locator('#showGroupModalBody .tab', { hasText: 'Open' })).toBeVisible();
    await expect(page.locator('#showGroupModalBody .tab', { hasText: 'Dots' })).toBeVisible();

    await page.locator('#showGroupModalBody .tab', { hasText: 'Dots' }).click();

    await expect.poll(() => calls.liveValues.at(-1)).toEqual({ '201:14': 32, '202:14': 32 });
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body.includes('9:32') && call.body.includes('29:32'))).toBe(true);
    expect(calls.setupWrites).toBe(0);
  });

  test('Group Edit autosaves and restores Pan and Tilt fine relative steps from server UI state', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      profiles: [{
        id: 10,
        name: 'Moving Spot',
        mode: '16ch',
        channels: 8,
        controls: [{ id: 13, type: 'panTilt16', label: 'Pan/Tilt', pan: 1, panFine: 2, tilt: 3, tiltFine: 4 }]
      }],
      fixtures: [
        { id: 201, name: 'Mover 1', profileId: 10, start: 1 },
        { id: 202, name: 'Mover 2', profileId: 10, start: 11 }
      ],
      groups: [{ id: 'movers', name: 'Movers', fixtureIds: [201, 202], values: {} }]
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#groupGrid [data-group="movers"]').click();
    await page.locator('#showGroupEditBtn').click();
    const panFine = page.locator('#showGroupModalBody .relative-control', { hasText: 'Pan fine relative' }).locator('[data-show-group-step]');
    const tiltFine = page.locator('#showGroupModalBody .relative-control', { hasText: 'Tilt fine relative' }).locator('[data-show-group-step]');
    await panFine.fill('7');
    await tiltFine.fill('9');

    await expect.poll(() => calls.uiStatePosts.some(post => {
      const steps = post.state?.groupEditRelativeSteps;
      return steps?.['panTilt|pan|fine'] === 7 && steps?.['panTilt|tilt|fine'] === 9;
    })).toBe(true);

    await page.locator('#showGroupModalClose').click();
    await page.locator('#showGroupEditBtn').click();
    await expect(page.locator('#showGroupModalBody .relative-control', { hasText: 'Pan fine relative' }).locator('[data-show-group-step]')).toHaveValue('7');
    await expect(page.locator('#showGroupModalBody .relative-control', { hasText: 'Tilt fine relative' }).locator('[data-show-group-step]')).toHaveValue('9');

    const savedPost = calls.uiStatePosts.findLast(post => post.state?.groupEditRelativeSteps);
    calls.showRunState = { groupEditRelativeSteps: savedPost.state.groupEditRelativeSteps };
    await page.evaluate(() => localStorage.removeItem('dmxShowRun.groupEditRelativeSteps'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#groupGrid [data-group="movers"]').click();
    await page.locator('#showGroupEditBtn').click();
    await expect(page.locator('#showGroupModalBody .relative-control', { hasText: 'Pan fine relative' }).locator('[data-show-group-step]')).toHaveValue('7');
    await expect(page.locator('#showGroupModalBody .relative-control', { hasText: 'Tilt fine relative' }).locator('[data-show-group-step]')).toHaveValue('9');
    expect(calls.setupWrites).toBe(0);
  });

  test('Group Edit preserves profile control order and continuously updates adjustable wheel ranges', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      profiles: [{
        id: 20,
        name: 'Ordered Moving Spot',
        mode: '3ch',
        channels: 3,
        controls: [
          { id: 23, type: 'slider8', label: 'Dimmer', channel: 3 },
          {
            id: 21,
            type: 'wheel',
            label: 'Gobo Wheel',
            channel: 1,
            options: [
              { name: 'Open', value: 0, range: [0, 15], kind: 'WheelSlot' },
              { name: 'Rotation slow CW to fast CW', value: 253, range: [250, 255], kind: 'WheelRotation', speedStart: 'slow CW', speedEnd: 'fast CW' }
            ]
          },
          { id: 22, type: 'slider8', label: 'Focus', channel: 2 }
        ]
      }],
      fixtures: [
        { id: 301, name: 'Ordered Spot 1', profileId: 20, start: 1 },
        { id: 302, name: 'Ordered Spot 2', profileId: 20, start: 11 }
      ],
      setupValues: { '301:21': 250, '302:21': 250 },
      groups: [{ id: 'ordered', name: 'Ordered Spots', fixtureIds: [301, 302], values: {} }]
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#groupGrid [data-group="ordered"]').click();
    await page.locator('#showGroupEditBtn').click();

    await expect(page.locator('#showGroupModalBody .control h3')).toHaveText(['Dimmer', 'Gobo Wheel', 'Focus']);
    const state = await page.evaluate(() => {
      const host = document.querySelector('[data-show-group-wheel-range-host]');
      const slider = host?.querySelector('input[type="range"]');
      slider?.focus();
      if (slider) {
        slider.value = '252';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const preservedAfterFirstInput = slider === host?.querySelector('input[type="range"]');
      if (slider) {
        slider.value = '255';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return {
        preservedAfterFirstInput,
        preservedAfterSecondInput: slider === host?.querySelector('input[type="range"]'),
        sliderValue: host?.querySelector('input[type="range"]')?.value,
        readout: host?.querySelector('[data-wheel-range-readout]')?.textContent,
        values: [values['301:21'], values['302:21']]
      };
    });

    expect(state).toEqual({
      preservedAfterFirstInput: true,
      preservedAfterSecondInput: true,
      sliderValue: '255',
      readout: '255',
      values: [255, 255]
    });
    await expect.poll(() => calls.liveValues.at(-1)).toEqual({ '301:21': 255, '302:21': 255 });
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body.includes('1:255') && call.body.includes('11:255'))).toBe(true);
    expect(calls.setupWrites).toBe(0);
  });

  test('opens saved room planes on Show Run and sends calibrated pan tilt to selected targets', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      profiles: [
        {
          id: 1,
          name: 'Moving Spot',
          mode: '16ch',
          channels: 16,
          controls: [
            { id: 21, type: 'panTilt16', label: 'Pan Tilt', pan: 1, panFine: 2, tilt: 3, tiltFine: 4 }
          ]
        }
      ],
      fixtures: [
        { id: 101, name: 'Move 1', profileId: 1, start: 1 },
        { id: 102, name: 'Move 2', profileId: 1, start: 21 }
      ],
      planes: [
        {
          id: 'front_plane',
          name: 'Front Plane',
          visual: { type: 'visual', color: '#123456', image: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 50%22%3E%3Crect width=%22100%22 height=%2250%22 fill=%22red%22/%3E%3C/svg%3E' },
          view: { auto: false, centerX: 5, centerY: 5, zoom: 2 },
          points: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: 10, y: 0, z: 0 }, { id: 'C', x: 0, y: 10, z: 0 }],
          target: { x: 5, y: 0, z: 0 },
          fixtures: [
            {
              id: 101,
              name: 'Move 1',
              x: 1,
              y: 1,
              z: 3,
              cal: {
                A: { calibrated: true, pan: 1000, tilt: 2000 },
                B: { calibrated: true, pan: 3000, tilt: 4000 },
                C: { calibrated: true, pan: 5000, tilt: 6000 }
              }
            },
            {
              id: 102,
              name: 'Move 2',
              x: 2,
              y: 1,
              z: 3,
              cal: {
                A: { calibrated: true, pan: 10000, tilt: 20000 },
                B: { calibrated: true, pan: 30000, tilt: 40000 },
                C: { calibrated: true, pan: 50000, tilt: 60000 }
              }
            }
          ]
        }
      ]
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('#cardPlane')).toBeVisible();
    await expect(page.locator('#planeGrid [data-plane-key="front_plane"]')).toContainText('Front Plane');
    await expect(page.locator('#planeGrid [data-plane-key="front_plane"] .palette-visual')).toHaveCSS('background-size', 'contain');

    await page.locator('#groupGrid [data-group="front"]').click();
    await page.locator('#planeGrid [data-plane-key="front_plane"]').click();
    await expect(page.locator('#showPlaneModal')).toBeVisible();
    await expect(page.locator('#showPlaneModal')).toHaveClass(/section-control-modal/);
    await expect(page.locator('#showPlaneModal > .modal-card')).toBeVisible();
    await expect(page.locator('#showPlaneModal > .modal')).toHaveCount(0);
    await expect(page.locator('#showPlaneModal .modal-head')).toContainText('Recall Plane: Front Plane');
    await expect(page.locator('#showPlaneModal .modal-actions')).toBeVisible();
    await expect.poll(() => page.locator('#showPlaneModal .modal-body').evaluate(el => getComputedStyle(el).overflowY)).toBe('auto');
    await expect(page.locator('#showPlaneSummary')).toContainText('selected 1 fixture');
    await expect(page.locator('#showPlanePanView')).toHaveText('Pan view');
    await expect(page.locator('#showPlanePanView')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#showPlanePanView').click();
    await expect(page.locator('#showPlanePanView')).toHaveText('Stop pan view');
    await expect(page.locator('#showPlanePanView')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#showPlanePanView')).toHaveClass(/active/);
    await expect(page.locator('#showPlanePanView')).toHaveCSS('background-color', 'rgb(16, 59, 48)');
    await expect(page.locator('#showPlanePanView')).toHaveCSS('border-color', 'rgb(47, 158, 125)');
    await expect(page.locator('#showPlanePanView')).toHaveCSS('font-weight', '700');
    await expect(page.locator('#showPlanePad')).toHaveClass(/pan-mode/);
    await page.locator('#showPlanePanView').click();
    await expect(page.locator('#showPlanePanView')).toHaveText('Pan view');
    await expect(page.locator('#showPlanePanView')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#showPlanePanView')).not.toHaveClass(/active/);
    await expect(page.locator('#showPlanePad')).not.toHaveClass(/pan-mode/);

    await page.locator('#showPlaneStepXCoarse').fill('1');
    await page.locator('[data-show-plane-nudge-axis="x"][data-show-plane-nudge-dir="1"][data-show-plane-nudge-step="coarse"]').click();

    await expect.poll(() => calls.pico.some(call =>
      call.url === 'http://pico.test/dmx/b' &&
      call.method === 'POST' &&
      call.body.includes('1:8') &&
      call.body.includes('2:152') &&
      call.body.includes('3:12') &&
      call.body.includes('4:128')
    )).toBe(true);
    await expect(page.locator('#status')).toContainText('Plane live Front Plane -> 1 fixture');
    expect(calls.liveValues.at(-1)).toEqual({ '101:21': { pan: 2200, tilt: 3200 } });

    await page.locator('#showPlaneZoomIn').click();
    await expect.poll(() => calls.roomPlaneWrites?.length || 0).toBeGreaterThan(0);
    const savedPlane = calls.roomPlaneWrites.at(-1).planes.find(plane => plane.id === 'front_plane');
    expect(savedPlane.view).toMatchObject({ auto: false, centerX: 5, centerY: 5 });
    expect(savedPlane.view.zoom).toBeGreaterThan(2);
  });

  test('shows primary show actions in the Master card', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    const master = page.locator('#cardMaster');
    await expect(master.getByRole('heading', { name: 'Master', exact: true })).toBeVisible();
    await expect(master.getByRole('button', { name: 'Refresh Show Data' })).toBeVisible();
    await expect(master.getByRole('button', { name: 'Stop All Playback' })).toBeVisible();
    await expect(master.getByRole('button', { name: 'Show All Fixtures' })).toBeVisible();
    await expect(master.locator('.grand-master-fader')).toBeVisible();
    await expect(master.locator('[data-target-master-fader="0"]')).toBeVisible();
    await expect(master.locator('[data-master-full="all"]')).toBeVisible();
    await expect(master.locator('[data-master-full="target:0"]')).toBeVisible();
    await expect(master.locator('[data-master-blackout="all"]')).toBeVisible();
    await expect(master.locator('[data-master-blackout="target:0"]')).toBeVisible();
    await expect(master.getByRole('button', { name: 'Blackout Target' })).toHaveCount(0);
    await expect(master.getByRole('button', { name: 'Assign Selection to Group Master 1' })).toHaveCount(0);
    await expect(master.getByRole('button', { name: 'Add Group Master' })).toBeHidden();
    await expect(master.locator('[data-target-master-assign="0"]')).toBeHidden();
    await expect(master.locator('[data-target-master-clear="0"]')).toBeHidden();
    await expect(master.locator('[data-target-master-delete="0"]')).toBeHidden();
    await expect(master.locator('[data-master-delete="all"]')).toHaveCount(0);
    await expect(master.locator('.grand-master-fader')).toHaveCSS('writing-mode', 'vertical-lr');
    await expect(master.locator('[data-target-master-fader="0"]')).toHaveCSS('writing-mode', 'vertical-lr');

    await page.locator('#editLayoutBtn').click();
    await expect(master.getByRole('button', { name: 'Add Group Master' })).toBeVisible();
    await expect(master.locator('[data-target-master-assign="0"]')).toBeVisible();
    await expect(master.locator('[data-target-master-clear="0"]')).toBeVisible();
    await expect(master.locator('[data-target-master-delete="0"]')).toBeVisible();
  });

  test('deletes Group Master tiles only while editing the Show Run layout', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      setupValues: { '101:11': 100, '102:11': 200 },
      showRunState: {
        grandMasterFactor: 1,
        targetMasters: [{ id: 'target_1', name: 'Group Master 1', fixtureIds: [102], factor: 0.25 }]
      }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    const master = page.locator('#cardMaster');
    await expect(master.locator('[data-target-master-fader="0"]')).toBeVisible();
    await expect(master.locator('[data-target-master-delete="0"]')).toBeHidden();
    await expect(master.locator('[data-master-delete="all"]')).toHaveCount(0);

    await page.locator('#editLayoutBtn').click();
    await master.locator('[data-target-master-delete="0"]').click();

    await expect(master.locator('[data-target-master-fader="0"]')).toHaveCount(0);
    await expect(page.locator('#status')).toContainText('Deleted Group Master 1');
    await expect.poll(() => calls.uiStatePosts.at(-1)?.state?.targetMasters).toEqual([]);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.targetMasters') || 'null'));
    expect(saved).toEqual([]);
  });

  test('shows Pico MIDI input status and the last MIDI event on Show Run', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      midiStatus: {
        ok: true,
        enabled: true,
        initialized: true,
        rx_pin: 5,
        uart_id: 1,
        baud: 31250,
        byte_count: 24,
        message_count: 8,
        realtime_count: 0,
        parse_error_count: 1,
        last_event_ms: 1234,
        running_status: 176,
        last_status: 176,
        last_type: 176,
        last_channel: 1,
        last_data1: 7,
        last_data2: 96
      }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    const card = page.locator('#cardGrid #cardMidi');
    await expect(card.getByRole('heading', { name: 'MIDI Controller' })).toBeVisible();
    await expect(page.locator('#midiStatusPill')).toHaveText('Ready');
    await expect(page.locator('#midiHardware')).toHaveText('GPIO5 · UART1 · 31,250 baud');
    await expect(page.locator('#midiBytes')).toHaveText('24');
    await expect(page.locator('#midiMessages')).toHaveText('8');
    await expect(page.locator('#midiErrors')).toHaveText('1');
    await expect(page.locator('#midiLastEvent')).toContainText('Control Change');
    await expect(page.locator('#midiLastEvent')).toContainText('Ch 1 · CC 7 · Value 96');
    expect(calls.midiStatusGets).toBeGreaterThan(0);
    expect(calls.setupWrites).toBe(0);
  });

  test('learns a computer MIDI button from the scene edit modal and recalls the scene', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await installFakeComputerMidi(page);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('[data-midi-connect]').click();
    await page.locator('#editLayoutBtn').click();
    await page.locator('[data-show-edit-tile="scene:scene_1"]').click();
    await expect(page.locator('#showTileMidiMapping')).toContainText('No MIDI control mapped');
    await page.locator('#showTileMidiMapping [data-midi-learn]').click();
    await page.evaluate(() => window.__emitComputerMidi([0x90, 41, 127]));

    await expect(page.locator('#showTileMidiMapping')).toContainText('Note 41 · Channel 1');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.midiMappings') || '[]')[0])).toMatchObject({
      targetType: 'scene',
      targetId: 'scene_1',
      messageType: 'note',
      channel: 1,
      number: 41,
      mode: 'trigger'
    });
    await page.locator('#showTileVisualClose2').click();
    await page.locator('#editLayoutBtn').click();
    await page.evaluate(() => window.__emitComputerMidi([0x90, 41, 127]));

    await expect(page.locator('#status')).toContainText('Scene "Both On" recalled');
    expect(calls.liveValues.at(-1)).toEqual({ '101:11': 100, '102:11': 200 });
    await expect.poll(() => calls.uiStatePosts.find(post => Array.isArray(post.state?.midiMappings))?.state?.midiMappings?.[0]).toMatchObject({
      targetType: 'scene',
      targetId: 'scene_1',
      messageType: 'note',
      channel: 1,
      number: 41,
      deviceId: 'launch-control-xl-in',
      deviceName: 'Launch Control XL',
      mode: 'trigger',
      pickup: false
    });
  });

  test('loads a restored MIDI mapping from XAMPP UI state and recalls its scene without relearning', async ({ page }) => {
    const calls = {
      pico: [], liveValues: [], setupWrites: 0,
      showRunState: {
        midiMappings: [{
          targetType: 'scene', targetId: 'scene_1', messageType: 'note', channel: 1, number: 41,
          deviceId: 'launch-control-xl-in', deviceName: 'Launch Control XL', mode: 'trigger', pickup: false
        }]
      }
    };
    await routeShowSetup(page, calls);
    await installFakeComputerMidi(page);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('[data-midi-connect]').click();
    await page.evaluate(() => window.__emitComputerMidi([0x90, 41, 127]));

    await expect(page.locator('#status')).toContainText('Scene "Both On" recalled');
    expect(calls.liveValues.at(-1)).toEqual({ '101:11': 100, '102:11': 200 });
    expect(calls.uiStatePosts.filter(post => Array.isArray(post.state?.midiMappings))).toHaveLength(0);
  });

  test('maps a computer MIDI fader to a Live Control with soft takeover', async ({ page }) => {
    const calls = {
      pico: [], liveValues: [], setupWrites: 0,
      setupValues: { '101:11': 0 },
      showRunState: {
        liveControls: [{
          id: 'live_dimmer', cardId: 'live', fixtureId: 101, fixtureIds: ['101'],
          controlId: 11, controlLabel: 'Dimmer', controlType: 'slider8', part: 'value', widget: 'fader'
        }]
      }
    };
    await routeShowSetup(page, calls);
    await installFakeComputerMidi(page);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('[data-midi-connect]').click();
    await page.locator('#editLayoutBtn').click();
    await page.locator('[data-midi-edit-target="live:live_dimmer"]').click();
    await page.locator('#midiMappingModalBody [data-midi-learn]').click();
    await page.evaluate(() => window.__emitComputerMidi([0xB0, 77, 0]));
    await expect(page.locator('#midiMappingModalBody')).toContainText('CC 77 · Channel 1');
    await page.evaluate(() => window.__emitComputerMidi([0xB0, 77, 127]));

    await expect.poll(() => calls.liveValues.at(-1)?.['101:11']).toBe(255);
    expect(calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body === '1:255')).toBe(true);
    await page.evaluate(() => window.__emitComputerMidi([0xB0, 77, 64]));
    await expect.poll(() => calls.liveValues.at(-1)?.['101:11']).toBe(129);
    expect(calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body === '1:129')).toBe(true);
    expect(await page.evaluate(() => [
      scaleMidi7Bit(0, 0, 255),
      scaleMidi7Bit(64, 0, 255),
      scaleMidi7Bit(127, 0, 255),
      scaleMidi7Bit(127, 0, 100),
      scaleMidi7Bit(127, 0, 65535)
    ])).toEqual([0, 129, 255, 100, 65535]);
  });

  test('learns and runs a scene mapping from the separate MIDI emulator page', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');
    const emulator = await page.context().newPage();
    await emulator.goto(new URL('dmx_midi_emulator.html?test=' + Date.now(), page.url()).href);

    await expect(emulator.locator('header h1 .app-version')).toHaveText(/v0\.9\.9/);
    await expect(emulator.locator('#connectionPill')).toContainText('Connected to Show Run');
    await expect(emulator.locator('[data-midi-cc]')).toHaveCount(32);
    await expect(emulator.locator('[data-midi-note]')).toHaveCount(24);
    await expect(emulator.locator('[data-emulator-section]')).toHaveCount(4);
    await expect(emulator.locator('[data-emulator-section="faders"] [data-midi-note]')).toHaveCount(0);
    await expect(emulator.locator('[data-emulator-section="channel-buttons"] [data-midi-note]')).toHaveCount(16);
    await expect(emulator.locator('[data-emulator-section="utility-buttons"] [data-midi-note]')).toHaveCount(8);
    await expect(page.locator('[data-midi-emulator-status]').first()).toContainText('connected');

    await page.bringToFront();
    await page.locator('#editLayoutBtn').click();
    await page.locator('[data-show-edit-tile="scene:scene_1"]').click();
    await page.locator('#showTileMidiMapping [data-midi-learn]').click();
    await emulator.bringToFront();
    await emulator.locator('[data-midi-note="41"]').click();

    await page.bringToFront();
    await expect(page.locator('#showTileMidiMapping')).toContainText('Launch Control XL Emulator');
    await page.locator('#showTileVisualClose2').click();
    await page.locator('#editLayoutBtn').click();
    await emulator.bringToFront();
    await emulator.locator('[data-midi-note="41"]').click();

    await page.bringToFront();
    await expect(page.locator('#status')).toContainText('Scene "Both On" recalled');
    expect(calls.liveValues.at(-1)).toEqual({ '101:11': 100, '102:11': 200 });
    await emulator.close();
  });

  test('shows MIDI edit actions for masters and Pico playback tiles only in Edit mode', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('[data-midi-edit-target="master:all"]')).toBeHidden();
    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('[data-midi-edit-target="master:all"]')).toBeVisible();
    await expect(page.locator('#chaserSlots [data-midi-edit-target="chaser:0"]')).toBeVisible();
    await expect(page.locator('#motionSlots [data-midi-edit-target="motion:0"]')).toBeVisible();
    for (const [container, type] of [['#chaserSlots', 'chaser'], ['#motionSlots', 'motion']]) {
      const tile = page.locator(`${container} .playback-card`).filter({ has: page.locator(`[data-midi-edit-target="${type}:0"]`) });
      const editButton = tile.locator(`[data-midi-edit-target="${type}:0"]`);
      expect(await editButton.evaluate(button => button.offsetParent === button.closest('.playback-card'))).toBe(true);
      const tileBox = await tile.boundingBox();
      const buttonBox = await editButton.boundingBox();
      expect(tileBox).not.toBeNull();
      expect(buttonBox).not.toBeNull();
      expect(buttonBox.x).toBeGreaterThanOrEqual(tileBox.x);
      expect(buttonBox.y).toBeGreaterThanOrEqual(tileBox.y);
      expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(tileBox.x + tileBox.width);
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(tileBox.y + tileBox.height);
      expect(await tile.evaluate(element => {
        const button = element.querySelector('[data-midi-edit-target]');
        const title = element.querySelector('h3');
        if (!button || !title) return false;
        const buttonRect = button.getBoundingClientRect();
        const titleRange = document.createRange();
        titleRange.selectNodeContents(title);
        const titleRect = titleRange.getBoundingClientRect();
        return buttonRect.right <= titleRect.left
          || buttonRect.left >= titleRect.right
          || buttonRect.bottom <= titleRect.top
          || buttonRect.top >= titleRect.bottom;
      })).toBe(true);
    }
    await page.locator('#chaserSlots [data-midi-edit-target="chaser:0"]').click();
    await expect(page.locator('#midiMappingTitle')).toContainText('Pico Chaser');
  });

  test('learns selectable pause and resume MIDI actions for Pico chaser and effects tiles', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await installFakeComputerMidi(page);
    await openDmxPage(page, 'dmx_show.html');

    expect(await page.evaluate(() => normalizeMidiMapping({
      targetType: 'chaser', targetId: '0', messageType: 'note', channel: 1, number: 40, mode: 'trigger'
    }).action)).toBe('toggle-run');

    await page.locator('[data-midi-connect]').click();
    await page.locator('#editLayoutBtn').click();
    for (const target of [
      { type: 'chaser', container: '#chaserSlots', note: 41 },
      { type: 'motion', container: '#motionSlots', note: 42 }
    ]) {
      await page.locator(`${target.container} [data-midi-edit-target="${target.type}:0"]`).click();
      const actionSelect = page.locator('#midiMappingModalBody [data-midi-playback-action]');
      await expect(actionSelect.locator('option')).toHaveCount(6);
      await expect(actionSelect).toHaveValue('toggle-run');
      await actionSelect.selectOption('toggle-pause');
      await page.locator('#midiMappingModalBody [data-midi-learn]').click();
      await page.evaluate(note => window.__emitComputerMidi([0x90, note, 127]), target.note);
      await expect(page.locator('#midiMappingModalBody')).toContainText('Pause / Resume toggle');
      await page.locator('#midiMappingClose2').click();
    }
    await page.locator('#editLayoutBtn').click();

    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.midiMappings') || '[]'))).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetType: 'chaser', targetId: '0', number: 41, action: 'toggle-pause' }),
      expect.objectContaining({ targetType: 'motion', targetId: '0', number: 42, action: 'toggle-pause' })
    ]));
    await expect.poll(() => {
      const post = [...calls.uiStatePosts].reverse().find(item => Array.isArray(item.state?.midiMappings));
      return post?.state?.midiMappings;
    }).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetType: 'chaser', targetId: '0', action: 'toggle-pause' }),
      expect.objectContaining({ targetType: 'motion', targetId: '0', action: 'toggle-pause' })
    ]));

    for (const target of [
      { type: 'chaser', note: 41 },
      { type: 'motion', note: 42 }
    ]) {
      await page.evaluate(note => window.__emitComputerMidi([0x80, note, 0]), target.note);
      await page.evaluate(note => window.__emitComputerMidi([0x90, note, 127]), target.note);
      await expect.poll(() => calls.pico.some(call => call.url === `http://pico.test/${target.type}/pause/0`)).toBe(true);
      await page.evaluate(note => window.__emitComputerMidi([0x80, note, 0]), target.note);
      await page.evaluate(note => window.__emitComputerMidi([0x90, note, 127]), target.note);
      await expect.poll(() => calls.pico.some(call => call.url === `http://pico.test/${target.type}/resume/0`)).toBe(true);
    }
  });

  test('lets the operator add a MIDI Controller card through Show Run card management', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('#cardGrid [data-show-card="midi"] h2')).toHaveText('MIDI Controller');
    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardRows').fill('5');
    await page.locator('[data-add-card-position="9"]').click();
    await page.locator('#addCardType').selectOption('midi');
    await expect(page.locator('#addShowCard')).toHaveText('Add MIDI Controller Card');
    await page.locator('#addShowCard').click();

    await expect(page.locator('#cardGrid [data-show-card="midi"] h2')).toHaveCount(2);
    await expect(page.locator('#status')).toContainText('Added MIDI Controller at position 10');
    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.filter(entry => String(entry || '').startsWith('midi'))).toHaveLength(2);
    expect(calls.setupWrites).toBe(0);
  });

  test('repairs stale browser-only Show Run card order so Chaser is not lost', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0, showRunState: { cardLayouts: {} } };
    await routeShowSetup(page, calls);
    await page.addInitScript(() => {
      localStorage.setItem('dmxShowRun.cardCols', '2');
      localStorage.setItem('dmxShowRun.cardRows', '4');
      localStorage.setItem('dmxShowRun.cardOrder', JSON.stringify(['group', 'scene', 'palette', 'motion', 'live', 'midi', null, null]));
    });
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('#cardGrid #cardChaser h2')).toHaveText('Pico Chaser Playback');
    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.some(entry => entry === 'chaser')).toBe(true);
    expect(calls.setupWrites).toBe(0);
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

  test('auto-refreshes show data when the Show Run page becomes active again', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.getByRole('button', { name: /Both On/ })).toBeVisible();
    const initialGets = calls.fixtureGets;
    calls.scenes = [
      {
        id: 'scene_2',
        name: 'Fresh Look',
        slot: 0,
        values: { '101:11': 123 }
      }
    ];

    await page.waitForTimeout(700);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(page.getByRole('button', { name: /Fresh Look/ })).toBeVisible();
    expect(calls.fixtureGets).toBeGreaterThan(initialGets);
    expect(calls.setupWrites).toBe(0);
  });

  test('does not auto-refresh over active Show Run layout edits', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('#editLayoutBtn')).toHaveText('Done');
    const initialGets = calls.fixtureGets;
    calls.scenes = [
      {
        id: 'scene_2',
        name: 'Hidden Until Done',
        slot: 0,
        values: { '101:11': 123 }
      }
    ];

    await page.waitForTimeout(700);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(600);

    await expect(page.getByRole('button', { name: /Hidden Until Done/ })).toHaveCount(0);
    expect(calls.fixtureGets).toBe(initialGets);
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

  test('blackout buttons set Grand and Group Master faders to zero', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0, setupValues: { '101:11': 100, '102:11': 200 }, showRunState: { grandMasterFactor: 1 } };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('[data-master-blackout="all"]').click();
    await expect(page.locator('.grand-master-fader')).toHaveValue('0');
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master' && call.body === '1:0,11:0')).toBe(true);
    expect(calls.liveValues).toHaveLength(0);

    await page.locator('.grand-master-fader').fill('100');
    await page.getByRole('button', { name: /Spot 2/ }).click();
    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardMaster [data-target-master-assign="0"]').first().click();
    await page.locator('#editLayoutBtn').click();
    calls.pico.length = 0;

    await page.locator('[data-master-blackout="target:0"]').click();
    await expect(page.locator('[data-target-master-fader="0"]')).toHaveValue('0');
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master' && call.body === '11:0')).toBe(true);
  });

  test('full buttons set Grand and Group Master faders to full', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0, setupValues: { '101:11': 100, '102:11': 200 }, showRunState: { grandMasterFactor: 0.5 } };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    calls.pico.length = 0;
    await page.locator('[data-master-full="all"]').click();
    await expect(page.locator('.grand-master-fader')).toHaveValue('100');
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master/clear')).toBe(true);
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body === '1:100,11:200')).toBe(true);

    await page.getByRole('button', { name: /Spot 2/ }).click();
    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardMaster [data-target-master-assign="0"]').first().click();
    await page.locator('[data-target-master-fader="0"]').fill('25');
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master' && call.body === '11:64')).toBe(true);
    calls.pico.length = 0;

    await page.locator('[data-master-full="target:0"]').click();
    await expect(page.locator('[data-target-master-fader="0"]')).toHaveValue('100');
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master/clear')).toBe(true);
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body === '11:200')).toBe(true);
    expect(calls.liveValues).toHaveLength(0);
  });

  test('Grand Master fader scales all fixture dimmers without overwriting live values', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0, setupValues: { '101:11': 100, '102:11': 200 } };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('.grand-master-fader').fill('50');

    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master' && call.body.includes('1:128') && call.body.includes('11:128')))
      .toBe(true);
    expect(calls.liveValues).toHaveLength(0);
    expect(calls.uiStatePosts.some(post => post.page === 'showRun' && post.state.grandMasterFactor === 0.5)).toBe(true);
    expect(calls.setupWrites).toBe(0);
  });

  test('recalls raw scene values while master scaling is active on the Pico', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      setupValues: { '101:11': 100, '102:11': 200 },
      showRunState: { grandMasterFactor: 0.5 }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master' && call.body === '1:128,11:128'))
      .toBe(true);
    calls.pico.length = 0;

    await page.getByRole('button', { name: /Both On/ }).click();

    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body === '1:100,11:200'))
      .toBe(true);
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master' && call.body === '1:128,11:128'))
      .toBe(true);
  });

  test('restores unscaled dimmer output before leaving Show Run', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0, setupValues: { '101:11': 100, '102:11': 200 } };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('.grand-master-fader').fill('50');
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master' && call.body === '1:128,11:128'))
      .toBe(true);
    calls.pico.length = 0;

    await page.getByRole('link', { name: 'Controller' }).click();

    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master/clear'))
      .toBe(true);
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.body === '1:100,11:200'))
      .toBe(true);
  });

  test('applies saved master multipliers when entering Show Run', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      setupValues: { '101:11': 100, '102:11': 200 },
      showRunState: {
        grandMasterFactor: 0.5,
        targetMasters: [{ id: 'target_1', name: 'Group Master 1', fixtureIds: [102], factor: 0.25 }]
      }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await expect(page.locator('.grand-master-fader')).toHaveValue('50');
    await expect(page.locator('[data-target-master-fader="0"]')).toHaveValue('25');
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master' && call.body === '1:128,11:32'))
      .toBe(true);
  });

  test('Group Master fader scales assigned fixture dimmers without overwriting live values', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0, setupValues: { '101:11': 100, '102:11': 200 }, showRunState: { grandMasterFactor: 1 } };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.getByRole('button', { name: /Spot 2/ }).click();
    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardMaster [data-target-master-assign="0"]').first().click();
    await expect(page.locator('#status')).toContainText('Assigned 1 fixture(s) to Group Master 1');
    await page.locator('#editLayoutBtn').click();
    await page.getByRole('button', { name: 'Show All Fixtures' }).click();
    calls.pico.length = 0;
    await page.locator('[data-target-master-fader="0"]').fill('25');

    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master' && call.body === '11:64'))
      .toBe(true);
    expect(calls.liveValues).toHaveLength(0);
    expect(calls.uiStatePosts.some(post => post.page === 'showRun' && Array.isArray(post.state.targetMasters))).toBe(true);
    expect(calls.setupWrites).toBe(0);
  });

  test('assigns a Group Master from a fixture selected while Edit Layout is active', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0, setupValues: { '101:11': 100, '102:11': 200 }, showRunState: { grandMasterFactor: 1 } };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#fixtureGrid [data-fixture="101"]').click();
    await expect(page.locator('#fixtureGrid [data-fixture="101"]')).toHaveClass(/active/);
    await page.locator('#cardMaster [data-target-master-assign="0"]').first().click();

    await expect(page.locator('[data-target-master-summary="0"]')).toContainText('Spot 1');
    await expect.poll(() => calls.uiStatePosts.at(-1)?.state?.targetMasters?.[0]?.fixtureIds).toEqual(['101']);
    expect(calls.setupWrites).toBe(0);
  });

  test('reapplies Group Master scale after starting Pico effects playback', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      setupValues: { '101:11': 100, '102:11': 200 },
      showRunState: {
        grandMasterFactor: 1,
        targetMasters: [{ id: 'target_1', name: 'Group Master 1', fixtureIds: [102], factor: 0 }]
      },
      liveMotionSlots: [{ slot: 0, loaded: true, active: false, bpm: 30, label: 'Dimmer sine' }]
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');
    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master' && call.body === '11:0'))
      .toBe(true);
    calls.pico.length = 0;

    await page.locator('[data-motion-toggle="0"]').first().click();

    await expect.poll(() => {
      const startIndex = calls.pico.findIndex(call => call.url === 'http://pico.test/motion/start/0');
      return startIndex >= 0 && calls.pico.slice(startIndex + 1).some(call => call.url === 'http://pico.test/dmx/master' && call.body === '11:0');
    })
      .toBe(true);
  });

  test('can add another group master and assign a saved group to it', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0, setupValues: { '101:11': 100, '102:11': 200 }, showRunState: { grandMasterFactor: 1 } };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.getByRole('button', { name: /Front Spots/ }).click();
    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardMaster .add-target-master').click();
    await expect(page.locator('[data-target-master-fader="1"]')).toBeVisible();
    await page.locator('#cardMaster [data-target-master-assign="1"]').first().click();
    await expect(page.locator('#status')).toContainText('Assigned 1 fixture(s) to Group Master 2');
    await page.locator('[data-target-master-fader="1"]').fill('10');

    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master' && call.body === '1:26'))
      .toBe(true);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.targetMasters') || '[]'));
    expect(saved).toHaveLength(2);
    expect(saved[1].fixtureIds.map(String)).toEqual(['101']);
  });

  test('Grand Master fader scales 16-bit dimmers with coarse and fine output', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      profiles: [
        {
          id: 2,
          name: '16 Bit Spot',
          mode: '2ch',
          channels: 2,
          controls: [
            { id: 21, type: 'slider16', label: 'Dimmer', channel: 1, fine: 2, blackoutValue: 0 }
          ]
        }
      ],
      fixtures: [{ id: 201, name: 'Fine Dimmer', profileId: 2, start: 1 }],
      setupValues: { '201:21': 32768 }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('.grand-master-fader').fill('50');

    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/master' && call.body === '1:128,2:128'))
      .toBe(true);
    expect(calls.liveValues).toHaveLength(0);
    expect(calls.setupWrites).toBe(0);
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
    await expect(page.locator('#motionControlPauseResume')).toHaveText('Pause');
    await page.locator('#motionControlPauseResume').click();
    await expect(page.locator('#motionControlPauseResume')).toHaveText('Resume');
    await page.locator('#motionControlPauseResume').click();
    await expect(page.locator('#motionControlPauseResume')).toHaveText('Pause');
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
    expect(urls).toContain('http://pico.test/motion/pause/0');
    expect(urls).toContain('http://pico.test/motion/resume/0');
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
        grandMasterFactor: 0.4,
        targetMasters: [{ id: 'server_target', name: 'Group Master 1', fixtureIds: ['102'], factor: 0.25 }],
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
    await expect(page.locator('#cardGrid > :nth-child(6) h2')).toHaveText('Groups');
    await expect(page.locator('#cardLive .live-widget')).toHaveCount(1);
    await expect(page.locator('#cardLive .live-widget h3')).toContainText('Spot 1 - Dimmer');
    await expect(page.locator('.grand-master-fader')).toHaveValue('40');
    await expect(page.locator('[data-target-master-fader="0"]')).toHaveValue('25');
    await expect(page.locator('[data-target-master-summary="0"]')).toContainText('Spot 2');
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

  test('lets one live fader control the same control on multiple fixtures', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#liveFixtureSelect').selectOption(['101', '102']);
    await page.locator('#liveControlSelect').selectOption('11');
    await page.locator('#liveWidgetSelect').selectOption('fader');
    await page.locator('#addLiveControl').click();

    await expect(page.locator('#liveControlGrid .live-widget h3')).toHaveText('2 fixtures - Dimmer');
    await page.locator('#liveControlGrid input[type="range"]').fill('77');

    await expect.poll(() => calls.pico.some(call => call.url === 'http://pico.test/dmx/b' && call.method === 'POST' && call.body.includes('1:77') && call.body.includes('11:77')))
      .toBe(true);
    expect(calls.liveValues.at(-1)).toEqual({ '101:11': 77, '102:11': 77 });
    const savedControls = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.liveControls') || '[]'));
    expect(savedControls[0].fixtureIds.map(String).sort()).toEqual(['101', '102']);
    expect(calls.setupWrites).toBe(0);
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
    await page.locator('#liveTimerOn').fill('0.2');
    await page.locator('#liveTimerOff').fill('0.2');
    await page.locator('#addLiveControl').click();

    await page.locator('#liveControlGrid [data-live-button]').click();
    await expect(page.locator('#liveControlGrid [data-live-button]')).toHaveText('Stop Timer');
    await expect(page.locator('#liveControlGrid [data-live-timer-id]')).toBeVisible();
    await expect(page.locator('#liveControlGrid [data-live-timer-label]')).toContainText(/On|Off/);
    await expect.poll(async () => {
      const width = await page.locator('#liveControlGrid [data-live-timer-fill]').evaluate(el => parseFloat(el.style.width) || 0);
      return width > 0;
    }).toBe(true);
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
    await expect(page.locator('#hiddenTileModal')).toHaveClass(/form-modal/);
    await expect(page.locator('#hiddenTileModal > .modal-card')).toBeVisible();
    await expect(page.locator('#hiddenTileModal > .modal')).toHaveCount(0);
    await expect(page.locator('#hiddenTileModal .modal-actions')).toBeVisible();
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

    await page.locator('#paletteGrid [data-show-delete-tile]').click();

    await expect(page.locator('#paletteGrid')).not.toContainText('Warm Red');
    expect(calls.paletteWrites).toHaveLength(1);
    expect(calls.paletteWrites.at(-1).palettes[0]).toMatchObject({
      name: 'Warm Red',
      visual: { type: 'visual', color: '#884422' }
    });
    expect(calls.uiStatePosts.map(post => post.state?.paletteOrder).filter(Boolean).at(-1)[0]).toBeNull();
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
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Groups');
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
    await expect(page.locator('#cardGrid > :nth-child(4) h2')).toHaveText('Groups');

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

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Groups');
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
    await page.locator('#cardRows').fill('4');

    // Position 5 contains Pico Effects Playback, position 6 contains Live Controls,
    // position 7 contains MIDI Input, position 8 contains Fixtures, position 9 contains Master,
    // and position 10 is empty.
    await page.locator('#cardMotion .panel-head').dragTo(page.locator('#cardGrid > :nth-child(10)'));

    await expect(page.locator('#cardGrid > :nth-child(5)')).toContainText('Add card');
    await expect(page.locator('#cardGrid > :nth-child(5)')).toContainText('Position 5');
    await expect(page.locator('#cardGrid > :nth-child(6) h2')).toHaveText('Live Controls');
    await expect(page.locator('#cardGrid > :nth-child(7) h2')).toHaveText('MIDI Controller');
    await expect(page.locator('#cardGrid > :nth-child(8) h2')).toHaveText('Fixtures');
    await expect(page.locator('#cardGrid > :nth-child(9) h2')).toHaveText('Master');
    await expect(page.locator('#cardGrid > :nth-child(10) h2')).toHaveText('Pico Effects Playback');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 10)).toEqual(['group', 'scene', 'palette', 'chaser', null, 'live', 'midi', 'fixture', 'master', 'motion']);
    expect(calls.setupWrites).toBe(0);
  });

  test('lets the operator move the Live Controls card from its header', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardCols').fill('3');
    await page.locator('#cardRows').fill('4');

    await expect(page.locator('#cardLive .card-move-handle')).toHaveCount(0);
    await page.locator('#cardLive .panel-head').dragTo(page.locator('#cardGrid > :nth-child(10)'));

    await expect(page.locator('#cardGrid > :nth-child(6)')).toContainText('Add card');
    await expect(page.locator('#cardGrid > :nth-child(6)')).toContainText('Position 6');
    await expect(page.locator('#cardGrid > :nth-child(8) h2')).toHaveText('Fixtures');
    await expect(page.locator('#cardGrid > :nth-child(9) h2')).toHaveText('Master');
    await expect(page.locator('#cardGrid > :nth-child(10) h2')).toHaveText('Live Controls');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 10)).toEqual(['group', 'scene', 'palette', 'chaser', 'motion', null, 'midi', 'fixture', 'master', 'live']);
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
    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Groups');
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
    expect(savedOrder.slice(0, 9)).toEqual(['live', 'scene', 'palette', 'chaser', 'motion', expect.stringMatching(/^live:/), 'group', 'midi', 'fixture']);

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardLive .panel-head').dragTo(page.locator('#cardPalette .panel-head'));

    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Palettes');
    await expect(page.locator('#cardGrid > :nth-child(3) h2')).toHaveText('Live Controls');
    savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 9)).toEqual(['palette', 'scene', 'live', 'chaser', 'motion', expect.stringMatching(/^live:/), 'group', 'midi', 'fixture']);
    expect(calls.setupWrites).toBe(0);
  });

  test('adds and deletes a second Live Controls card with independent controls', async ({ page }) => {
    const calls = { pico: [], liveValues: [], setupWrites: 0 };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await page.locator('#cardRows').fill('5');
    await expect(page.locator('[data-add-card-position="9"]')).toBeVisible();
    await page.locator('[data-add-card-position="9"]').click();
    await expect(page.locator('#addCardModal')).toBeVisible();
    await expect(page.locator('#addCardModal')).toHaveClass(/form-modal/);
    await expect(page.locator('#addCardModal > .modal-card')).toBeVisible();
    await expect(page.locator('#addCardModal > .modal')).toHaveCount(0);
    await expect(page.locator('#addCardModal .modal-actions')).toBeVisible();
    await page.locator('#addCardType').selectOption('live');
    await expect(page.locator('#addShowCard')).toHaveText('Add Live Controls');
    await page.locator('#addShowCard').click();

    await expect(page.locator('#addCardModal')).toBeHidden();
    await expect(page.locator('[data-show-card="live"]')).toHaveCount(2);
    await expect(page.locator('#status')).toHaveText('Added Live Controls at position 10');
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
    expect(addOptions.sort()).toEqual(['Fixtures', 'Live Controls', 'Master', 'MIDI Controller', 'Palettes', 'Pico Chaser Playback', 'Pico Effects Playback', 'Planes', 'Scenes', 'Groups'].sort());
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

  test('removes a palette tile only from the selected repeated card layout', async ({ page }) => {
    const calls = {
      pico: [],
      liveValues: [],
      setupWrites: 0,
      paletteWrites: [],
      showRunState: {
        cardCols: 3,
        cardRows: 3,
        cardOrder: ['group', 'scene', 'palette', 'palette:custom', 'motion', 'live', null, null, null],
        paletteCols: 1,
        paletteRows: 1,
        cardLayouts: {
          'palette:custom': { kind: 'palette', cols: 1, rows: 1, order: ['palette_1'] }
        }
      }
    };
    await routeShowSetup(page, calls);
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    const primaryPalette = page.locator('#cardPalette');
    const repeatedPalette = page.locator('[data-show-card-key="palette:custom"]');
    await expect(primaryPalette).toContainText('Red');
    await expect(repeatedPalette).toContainText('Red');

    await repeatedPalette.locator('[data-show-delete-tile]').click();

    await expect(primaryPalette).toContainText('Red');
    await expect(repeatedPalette).not.toContainText('Red');
    expect(calls.paletteWrites).toHaveLength(0);
    const savedLayouts = calls.uiStatePosts.map(post => post.state?.cardLayouts).filter(Boolean).at(-1);
    expect(savedLayouts['palette:custom'].order[0]).toBeNull();
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
    expect(addOptions).toEqual(['Fixtures', 'Live Controls', 'Master', 'MIDI Controller', 'Palettes', 'Pico Chaser Playback', 'Pico Effects Playback', 'Planes', 'Scenes', 'Groups'].sort());

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
      localStorage.setItem('dmxShowRun.cardRows', '4');
      localStorage.setItem('dmxShowRun.cardOrder', JSON.stringify(['live', 'scene', 'palette', 'chaser', 'motion', 'group', null, null, null, null, null, null]));
    });
    await openDmxPage(page, 'dmx_show.html');

    await page.locator('#editLayoutBtn').click();
    await expect(page.locator('#cardGrid > :nth-child(1) h2')).toHaveText('Live Controls');
    await page.locator('#cardLive .panel-head').dragTo(page.locator('#cardGrid > :nth-child(10)'));

    await expect(page.locator('#cardGrid > :nth-child(1)')).toContainText('Add card');
    await expect(page.locator('#cardGrid > :nth-child(1)')).toContainText('Position 1');
    await expect(page.locator('#cardGrid > :nth-child(8) h2')).toHaveText('Fixtures');
    await expect(page.locator('#cardGrid > :nth-child(9) h2')).toHaveText('Master');
    await expect(page.locator('#cardGrid > :nth-child(10) h2')).toHaveText('Live Controls');

    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('dmxShowRun.cardOrder') || '[]'));
    expect(savedOrder.slice(0, 10)).toEqual([null, 'scene', 'palette', 'chaser', 'motion', 'group', 'midi', 'fixture', 'master', 'live']);
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
