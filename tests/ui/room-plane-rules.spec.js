const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Room Plane rules', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/ui_state.php**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, exists: false, state: {} })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      }
    });
    await page.route('**/room_plane_setup.php', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: false, setup: null })
      });
    });
    await page.route('**/group_setup.php', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, groups: [] })
      });
    });
  });

  test('Scenes and Palettes toolboxes recall shared fixture values to DMX', async ({ page }) => {
    const dmxBodies = [];
    await page.route('**/fixture_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            baseUrl: 'http://pico.test',
            values: {},
            profiles: [{ id: 1, name: 'Wash', controls: [
              { id: 11, type: 'slider8', label: 'Dimmer', channel: 1 },
              { id: 12, type: 'rgb', label: 'Color', a: 2, b: 3, c: 4 }
            ] }],
            fixtures: [{ id: 101, name: 'Wash 1', profileId: 1, start: 1 }]
          }
        })
      });
    });
    await page.route('**/scene_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, scenes: [
          { id: 'scene_room', name: 'Room Scene', slot: 0, values: { '101:11': 75 } }
        ], slotCols: 2, slotRows: 2 })
      });
    });
    await page.route('**/palette_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, palettes: [
          { id: 'palette_room', name: 'Room Color', slot: 0, values: { '101:12': { a: 10, b: 20, c: 30 } } }
        ], paletteCols: 2, paletteRows: 2 })
      });
    });
    await page.route('http://pico.test/dmx/b', async route => {
      dmxBodies.push(route.request().postData());
      await route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' });
    });

    await openDmxPage(page, 'dmx_room_plane.html');

    await expect(page.locator('#roomSceneBox')).toBeVisible();
    await expect(page.locator('#roomPaletteBox')).toBeVisible();
    await expect(page.locator('#roomSceneMatrix [data-room-scene-slot="0"]')).toContainText('Room Scene');
    await expect(page.locator('#roomPaletteMatrix [data-room-palette-slot="0"]')).toContainText('Room Color');

    await page.locator('#roomSceneMatrix [data-room-scene-slot="0"]').click();
    await expect.poll(() => dmxBodies.at(-1)).toBe('1:75');
    await expect(page.locator('#status')).toContainText('Recalled scene: "Room Scene"');

    await page.locator('#roomPaletteMatrix [data-room-palette-slot="0"]').click();
    await expect.poll(() => dmxBodies.at(-1)).toBe('2:10,3:20,4:30');
    await expect(page.locator('#status')).toContainText('Recalled palette: "Room Color"');
    await expect.poll(() => page.evaluate(() => liveValues['101:12'])).toEqual({ a: 10, b: 20, c: 30 });
  });

  test('routes recalled fixture values to each fixture DMX output', async ({ page }) => {
    const dmxCalls = [];
    await page.route('**/fixture_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            baseUrl: 'http://front-pico.test',
            dmxOutputs: [
              { id: 'front', name: 'Front Pico', universe: 1, baseUrl: 'http://front-pico.test/' },
              { id: 'rear', name: 'Rear Pico', universe: 2, baseUrl: 'http://rear-pico.test/' }
            ],
            values: {},
            profiles: [{ id: 1, name: 'Wash', controls: [
              { id: 11, type: 'slider8', label: 'Dimmer', channel: 1 }
            ] }],
            fixtures: [
              { id: 101, name: 'Front Wash', profileId: 1, start: 1, outputId: 'front' },
              { id: 102, name: 'Rear Wash', profileId: 1, start: 11, outputId: 'rear' }
            ]
          }
        })
      });
    });
    await page.route('**/scene_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          scenes: [{
            id: 'scene_multi_output',
            name: 'Two Universes',
            slot: 0,
            values: { '101:11': 75, '102:11': 125 }
          }],
          slotCols: 2,
          slotRows: 2
        })
      });
    });
    await page.route('**/palette_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"ok":true,"exists":true,"palettes":[],"paletteCols":2,"paletteRows":2}'
      });
    });
    for (const root of ['http://front-pico.test', 'http://rear-pico.test']) {
      await page.route(root + '/dmx/b', async route => {
        dmxCalls.push({ url: route.request().url(), body: route.request().postData() });
        await route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' });
      });
    }

    await openDmxPage(page, 'dmx_room_plane.html');
    await page.locator('#roomSceneMatrix [data-room-scene-slot="0"]').click();

    await expect.poll(() => dmxCalls.some(call =>
      call.url === 'http://front-pico.test/dmx/b' && call.body === '1:75'
    )).toBe(true);
    await expect.poll(() => dmxCalls.some(call =>
      call.url === 'http://rear-pico.test/dmx/b' && call.body === '11:125'
    )).toBe(true);
  });

  test('interpolates fixture pan and tilt from the calibrated plane points', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await expect(page.locator('h1')).toContainText('Room Plane');
    await expect(page.locator('thead th').first()).toHaveText('Edit');
    await expect(page.locator('#selectAllFixtures')).toHaveCount(0);
    await expect(page.locator('#clearFixtureSelection')).toHaveCount(0);
    await expect(page.locator('#weightReadout')).toContainText('A 0');
    await expect(page.locator('#weightReadout')).toContainText('B 0.5');
    await expect(page.locator('#weightReadout')).toContainText('C 0.5');
    await expect.poll(async () => page.evaluate(() => {
      const weights = barycentric(currentTarget());
      return fixtures.map(f => interpolateFixture(f, weights));
    })).toEqual([{ pan: 105, tilt: 93.5 }, { pan: 181, tilt: 98 }]);
    await expect(page.locator('#insideReadout')).toHaveText('Inside plane: yes');
  });

  test('keeps edit and delete controls visible on every occupied Plane tile', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    const occupiedTiles = page.locator('#planeLibrary [data-recall-plane]');
    await expect(occupiedTiles).not.toHaveCount(0);
    await expect(page.locator('#planeLibrary [data-visual-plane]')).toHaveCount(await occupiedTiles.count());
    await expect(page.locator('#planeLibrary [data-del-plane]')).toHaveCount(await occupiedTiles.count());
    await expect(page.locator('#planeLibrary [data-visual-plane]').first()).toBeVisible();
    await expect(page.locator('#planeLibrary [data-del-plane]').first()).toBeVisible();
  });

  test('uses every calibration point available to each fixture while keeping three-point fixtures usable', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    const result = await page.evaluate(() => {
      const plane = DmxCommon.normalizeRoomPlane({
        id: 'variable_points',
        name: 'Variable points',
        points: [
          { id: 'A', x: 0, y: 0 },
          { id: 'B', x: 10, y: 0 },
          { id: 'C', x: 0, y: 10 },
          { id: 'D', x: 10, y: 10 },
          { id: 'E', x: 5, y: 5 }
        ],
        target: { x: 5, y: 5 },
        fixtures: []
      }, 0);
      const basicFixture = {
        cal: {
          A: { calibrated: true, pan: 0, tilt: 0 },
          B: { calibrated: true, pan: 100, tilt: 200 },
          C: { calibrated: true, pan: 200, tilt: 100 }
        }
      };
      const detailedFixture = {
        cal: {
          ...basicFixture.cal,
          D: { calibrated: true, pan: 300, tilt: 300 },
          E: { calibrated: true, pan: 240, tilt: 180 }
        }
      };
      const weights = DmxCommon.roomPlaneWeights(plane);
      return {
        pointCount: plane.points.length,
        basic: DmxCommon.roomPlaneInterpolateFixture(plane, basicFixture, weights),
        detailed: DmxCommon.roomPlaneInterpolateFixture(plane, detailedFixture, weights)
      };
    });

    expect(result.pointCount).toBe(5);
    expect(result.basic).toMatchObject({ pan: 150, tilt: 150 });
    expect(result.detailed).toMatchObject({ pan: 240, tilt: 180 });
  });

  test('adds and removes optional calibration points at the current target without invalidating three-point fixtures', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#targetX').fill('2');
    await page.locator('#targetY').fill('2');
    await page.locator('#addCalibrationPoint').click();

    await expect(page.locator('#planePointInputs')).toContainText('D');
    await expect(page.locator('#fixtureHeaderRow')).toContainText('D pan');
    await expect(page.locator('#fixtureRows .cal-state').first()).toContainText('3 points');
    await expect.poll(() => page.evaluate(() => ({
      points: points.map(point => ({ ...point })),
      calibrated: fixtures.map(fixture => fixture.cal.D?.calibrated)
    }))).toEqual({
      points: [
        { id: 'A', x: 0, y: 0, z: 0 },
        { id: 'B', x: 5, y: 0, z: 0 },
        { id: 'C', x: 0, y: 3, z: 0 },
        { id: 'D', x: 2, y: 2, z: 0 }
      ],
      calibrated: [false, false]
    });

    await page.locator('#addCalibrationPoint').click();
    await expect(page.locator('#status')).toContainText('already calibration point D');
    await expect.poll(() => page.evaluate(() => points.length)).toBe(4);

    await page.locator('[data-remove-point="3"]').click();
    await expect(page.locator('#planePointInputs')).not.toContainText('D');
    await expect(page.locator('[data-remove-point]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => points.length)).toBe(3);
  });

  test('updates calculated pan and tilt when the target moves', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#targetX').fill('1');
    await page.locator('#targetY').fill('1');

    await expect(page.locator('#weightReadout')).toContainText('A 0.467');
    await expect(page.locator('#weightReadout')).toContainText('B 0.2');
    await expect(page.locator('#weightReadout')).toContainText('C 0.333');
    await expect.poll(async () => page.evaluate(() => {
      const weights = barycentric(currentTarget());
      return fixtures.map(f => {
        const out = interpolateFixture(f, weights);
        return { pan: Number(out.pan.toFixed(2)), tilt: Number(out.tilt.toFixed(2)) };
      });
    })).toEqual([{ pan: 86.53, tilt: 102.6 }, { pan: 199.2, tilt: 101.87 }]);
  });

  test('autosaves target point changes after the room plane debounce', async ({ page }) => {
    const posts = [];
    await page.unroute('**/room_plane_setup.php');
    await page.route('**/room_plane_setup.php', async route => {
      if (route.request().method() === 'POST') posts.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: false, setup: null })
      });
    });
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#targetX').fill('1.25');
    await page.locator('#targetY').fill('2.75');

    await expect.poll(() => posts.at(-1)?.target).toEqual({ x: 1.25, y: 2.75, z: 0 });
    await expect.poll(() => {
      const active = posts.at(-1)?.planes?.find(plane => plane.id === posts.at(-1)?.activePlaneId);
      return active?.target;
    }).toEqual({ x: 2.5, y: 1.5, z: 0 });
  });

  test('drags the red target point responsively across the plane', async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 900 });
    await openDmxPage(page, 'dmx_room_plane.html');

    const beforeX = Number(await page.locator('#targetX').inputValue());
    const beforeY = Number(await page.locator('#targetY').inputValue());
    const target = page.locator('#planeTarget');
    const box = await target.boundingBox();
    expect(box).toBeTruthy();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 - 70, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => Number(await page.locator('#targetX').inputValue())).not.toBe(beforeX);
    await expect.poll(async () => Number(await page.locator('#targetY').inputValue())).not.toBe(beforeY);
  });

  test('drags the red target beyond the current zoomed view edge on wide screens', async ({ page }) => {
    await page.setViewportSize({ width: 1900, height: 900 });
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#zoomInPlane').click();
    await page.locator('#zoomInPlane').click();
    const maxVisibleX = await page.evaluate(() => planeBounds().maxX);
    const target = page.locator('#planeTarget');
    const targetBox = await target.boundingBox();
    const padBox = await page.locator('#planePad').boundingBox();
    expect(targetBox).toBeTruthy();
    expect(padBox).toBeTruthy();

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(padBox.x + padBox.width - 6, targetBox.y + targetBox.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect.poll(async () => Number(await page.locator('#targetX').inputValue())).toBeGreaterThan(maxVisibleX);
  });

  test('nudges target with coarse and fine controls below the plane', async ({ page }) => {
    const sent = [];
    await page.route('**/fixture_setup.php**', async route => {
      const url = route.request().url();
      if (url.includes('livevalues')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, exists: true, values: {} }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            baseUrl: 'http://localhost/dmx-test',
            profiles: [{
              id: 1,
              name: 'Moving Profile',
              mode: '16-bit',
              channels: 8,
              controls: [
                { id: 11, type: 'slider8', label: 'Dimmer', channel: 1, scope: 'dimmer' },
                { id: 12, type: 'panTilt16', label: 'Position', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 }
              ]
            }],
            fixtures: [{ id: 101, name: 'Moving 1', profileId: 1, start: 10 }],
            values: {}
          }
        })
      });
    });
    await page.route('**/dmx/b**', async route => {
      sent.push(route.request().postData() || '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"updated":5}' });
    });
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#loadPatchedFixtures').click();
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Moving 1');
    await page.evaluate(() => {
      fixtures.forEach((fixture, index) => { fixture.cal = defaultCalibration(index); });
      renderFixtureRows();
    });
    await page.locator('#targetStepXCoarse').fill('0.5');
    await page.locator('[data-target-nudge-axis="x"][data-target-nudge-step="coarse"][data-target-nudge-dir="1"]').click();
    await expect(page.locator('#targetX')).toHaveValue('3');

    await page.locator('#targetStepYFine').fill('0.05');
    await page.locator('[data-target-nudge-axis="y"][data-target-nudge-step="fine"][data-target-nudge-dir="-1"]').click();
    await expect(page.locator('#targetY')).toHaveValue('1.45');
    await expect.poll(() => sent.length).toBeGreaterThan(0);
  });

  test('removes manual apply and auto-apply remains active', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await expect(page.locator('#applyTargetSelected')).toHaveCount(0);
    await expect(page.locator('#selectAllFixtures')).toHaveCount(0);
    await expect(page.locator('#clearFixtureSelection')).toHaveCount(0);
  });

  test('zooms and pans the virtual room plane view', async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 900 });
    await openDmxPage(page, 'dmx_room_plane.html');

    const before = await page.locator('.plane-point').filter({ hasText: 'A' }).first().boundingBox();
    await page.locator('#zoomInPlane').click();
    const zoomed = await page.locator('.plane-point').filter({ hasText: 'A' }).first().boundingBox();
    expect(Math.abs(zoomed.x - before.x)).toBeGreaterThan(1);

    await page.locator('#panPlaneView').click();
    const pad = await page.locator('#planePad').boundingBox();
    await page.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2);
    await page.mouse.down();
    await page.mouse.move(pad.x + pad.width / 2 + 100, pad.y + pad.height / 2 + 40, { steps: 5 });
    await page.mouse.up();
    const panned = await page.locator('.plane-point').filter({ hasText: 'A' }).first().boundingBox();
    expect(Math.abs(panned.x - zoomed.x)).toBeGreaterThan(1);
    await expect(page.locator('#panPlaneView')).toHaveText('Stop pan view');
    await page.locator('#panPlaneView').click();
    await expect(page.locator('#panPlaneView')).toHaveText('Pan view');
    await expect(page.locator('#planePad')).not.toHaveClass(/pan-mode/);
    await page.locator('#panPlaneView').click();
    await page.locator('#resetPlaneView').click();
    await expect(page.locator('#panPlaneView')).toHaveText('Pan view');
    await expect(page.locator('#planePad')).not.toHaveClass(/pan-mode/);
  });

  test('pinch zooms the virtual room plane without moving its target', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');
    const before = await page.evaluate(() => ({ zoom: planeView.zoom, x: Number(targetX.value), y: Number(targetY.value) }));

    await page.locator('#planePad').evaluate(pad => {
      const rect = pad.getBoundingClientRect();
      const fire = (type, pointerId, x) => pad.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: 'touch',
        isPrimary: pointerId === 41,
        clientX: rect.left + x,
        clientY: rect.top + rect.height / 2
      }));
      fire('pointerdown', 41, rect.width / 2 - 40);
      fire('pointerdown', 42, rect.width / 2 + 40);
      fire('pointermove', 41, rect.width / 2 - 90);
      fire('pointermove', 42, rect.width / 2 + 90);
      fire('pointerup', 41, rect.width / 2 - 90);
      fire('pointerup', 42, rect.width / 2 + 90);
    });

    const after = await page.evaluate(() => ({ zoom: planeView.zoom, x: Number(targetX.value), y: Number(targetY.value) }));
    expect(after.zoom).toBeGreaterThan(before.zoom * 2);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  test('reset calibration marks fixtures incomplete', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await expect(page.locator('#resetDemo')).toHaveCount(0);
    await page.locator('#resetCalibration').click();

    await expect(page.locator('tbody tr').first()).toContainText('Missing A, B, C');
  });

  test('resetting the working calibration and recalling planes do not edit saved plane snapshots', async ({ page }) => {
    const posts = [];
    await page.unroute('**/room_plane_setup.php');
    await page.route('**/room_plane_setup.php', async route => {
      if (route.request().method() === 'POST') posts.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: route.request().method() === 'GET'
          ? JSON.stringify({ ok: true, exists: false, setup: null })
          : JSON.stringify({ ok: true })
      });
    });
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('[data-save-plane-slot="1"]').click();
    await page.locator('#planeVisualName').fill('Saved calibration');
    await page.locator('#planeVisualSave').click();
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Calibrated');

    await page.locator('#resetCalibration').click();
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Missing A, B, C');
    await expect(page.locator('#planeLibrary .slot.active')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => activePlaneId)).toBe('');
    await expect.poll(() => posts.length).toBeGreaterThan(0);
    await expect.poll(() => posts.at(-1)?.activePlaneId).toBe('');
    expect(posts.at(-1).fixtures[0].cal.A.calibrated).toBe(false);
    expect(posts.at(-1).planes.every(plane =>
      plane.fixtures.every(fixture => ['A', 'B', 'C'].every(point => fixture.cal?.[point]?.calibrated))
    )).toBe(true);

    await page.locator('[data-recall-plane]').first().click();
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Calibrated');

    await page.locator('[data-recall-plane]').filter({ hasText: 'Saved calibration' }).click();
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Calibrated');
    await expect.poll(() => page.evaluate(() => planeDefinitions.every(plane =>
      plane.fixtures.every(fixture => ['A', 'B', 'C'].every(point => fixture.cal?.[point]?.calibrated))
    ))).toBe(true);
  });

  test('deleting the final saved plane leaves an empty library and keeps the working calibration after reload', async ({ page }) => {
    let savedSetup = null;
    await page.unroute('**/room_plane_setup.php');
    await page.route('**/room_plane_setup.php', async route => {
      if (route.request().method() === 'POST') {
        savedSetup = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(savedSetup
          ? { ok: true, exists: true, setup: savedSetup }
          : { ok: true, exists: false, setup: null })
      });
    });
    await openDmxPage(page, 'dmx_room_plane.html');

    const fixtureAPan = page.locator('input[data-fixture="0"][data-point="A"][data-axis="pan"]');
    const workingPan = await fixtureAPan.inputValue();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-del-plane]').click();

    await expect(page.locator('#planeLibrary .slot.filled')).toHaveCount(0);
    await expect(fixtureAPan).toHaveValue(workingPan);
    await expect.poll(() => savedSetup?.planes?.length).toBe(0);

    await page.reload();
    await expect(page.locator('#planeLibrary .slot.filled')).toHaveCount(0);
    await expect(fixtureAPan).toHaveValue(workingPan);
  });

  test('removes the final fixture and keeps the working fixture list empty after reload', async ({ page }) => {
    let savedSetup = null;
    await page.unroute('**/room_plane_setup.php');
    await page.route('**/room_plane_setup.php', async route => {
      if (route.request().method() === 'POST') {
        savedSetup = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(savedSetup
          ? { ok: true, exists: true, setup: savedSetup }
          : { ok: true, exists: false, setup: null })
      });
    });
    await openDmxPage(page, 'dmx_room_plane.html');

    await expect(page.locator('#fixtureRows tr')).toHaveCount(2);
    await page.locator('#removeFixture').click();
    await page.locator('#removeFixture').click();

    await expect(page.locator('#fixtureRows tr')).toHaveCount(0);
    await expect.poll(() => savedSetup?.fixtures?.length).toBe(0);

    await page.reload();
    await expect(page.locator('#fixtureRows tr')).toHaveCount(0);
  });

  test('Remove selected deletes only the selected fixtures', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await expect(page.locator('#removeFixture')).toHaveText('Remove selected');
    await page.locator('[data-select-fixture="0"]').uncheck();
    await page.locator('[data-select-fixture="1"]').check();
    await page.locator('#removeFixture').click();

    await expect(page.locator('#fixtureRows tr')).toHaveCount(1);
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Spot 1');
    await expect(page.locator('#fixtureRows tr').first()).not.toContainText('Spot 2');
  });

  test('Add patched fixtures selects available Controller moving lights without replacing the working list', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.route('**/fixture_setup.php**', async route => {
      if (route.request().url().includes('livevalues')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, exists: true, values: {} }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            baseUrl: 'http://localhost/dmx-test',
            profiles: [
              { id: 1, name: 'Mover', controls: [{ id: 11, type: 'panTilt16', label: 'Position', pan: 1, panFine: 2, tilt: 3, tiltFine: 4 }] },
              { id: 2, name: 'Dimmer', controls: [{ id: 21, type: 'slider8', label: 'Dimmer', channel: 1 }] }
            ],
            fixtures: [
              { id: 101, name: 'Moving 1', profileId: 1, start: 1 },
              { id: 102, name: 'Moving 2', profileId: 1, start: 11 },
              { id: 103, name: 'Static 1', profileId: 2, start: 21 }
            ],
            values: {}
          }
        })
      });
    });
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('[data-select-fixture="1"]').check();
    await page.locator('#removeFixture').click();
    await expect(page.locator('#fixtureRows tr')).toHaveCount(0);
    await expect(page.locator('#addFixture')).toHaveText('Add patched fixtures');

    await page.locator('#addFixture').click();
    await expect(page.locator('#addPatchedFixturesModal')).toBeVisible();
    await expect(page.locator('[data-add-patched-fixture]')).toHaveCount(2);
    await expect(page.locator('#addPatchedFixturesList input[type="checkbox"]')).toHaveCount(0);
    await expect(page.locator('#addPatchedFixturesList .fixture-picker-card__indicator')).toHaveCount(0);
    await expect(page.locator('#addPatchedFixturesModal')).not.toContainText('Static 1');
    const moving2Card=page.locator('[data-add-patched-fixture="102"]');
    const cardBounds=await moving2Card.boundingBox();
    expect(cardBounds?.height).toBeGreaterThanOrEqual(88);
    expect(cardBounds?.width).toBeGreaterThan(220);
    await expect(moving2Card).toHaveAttribute('aria-pressed','false');
    await expect(page.locator('#confirmAddPatchedFixtures')).toBeDisabled();
    await moving2Card.click();
    await expect(moving2Card).toHaveAttribute('aria-pressed','true');
    await expect(moving2Card).toHaveClass(/selected/);
    await expect(page.locator('#confirmAddPatchedFixtures')).toHaveText('Add selected (1)');
    await expect(page.locator('#confirmAddPatchedFixtures')).toBeEnabled();
    await page.locator('#confirmAddPatchedFixtures').click();

    await expect(page.locator('#fixtureRows tr')).toHaveCount(1);
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Moving 2');
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Missing A, B, C');
    await expect(page.locator('#fixtureRows')).not.toContainText('Moving 1');
  });

  test('saves and recalls multiple plane definitions from the library', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await expect(page.locator('#activePlaneSummary')).toHaveCount(0);
    await expect(page.locator('#roomPlaneBox #savePlaneDefinition')).toHaveCount(0);
    await expect(page.locator('#roomPlaneLibraryBox #savePlaneDefinition')).toHaveCount(0);
    await expect(page.locator('#roomPlaneLibraryBox #newPlaneDefinition')).toHaveCount(0);
    await expect(page.locator('#roomPlaneLibraryBox #deletePlaneDefinition')).toHaveCount(0);
    await expect(page.locator('#roomPlaneLibraryBox')).toContainText('Planes');

    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-del-plane]').first().click();

    await page.locator('#targetX').fill('1');
    await page.locator('#targetY').fill('1');
    await page.locator('[data-save-plane-slot="0"]').click();
    await page.locator('#planeVisualName').fill('Front truss');
    await page.locator('#planeVisualSave').click();

    await page.locator('#targetX').fill('4');
    await page.locator('#targetY').fill('2');
    await page.locator('[data-save-plane-slot="1"]').click();
    await expect(page.locator('#planeVisualModal')).toBeVisible();
    await page.locator('#planeVisualName').fill('Back truss');
    await page.locator('#planeVisualSave').click();

    await expect(page.locator('#planeLibrary')).toContainText('Front truss');
    await expect(page.locator('#planeLibrary')).toContainText('Back truss');
    await expect(page.locator('#planeLibrary .slot')).toHaveCount(9);
    await expect(page.locator('#planeLibrary .slot.filled')).toHaveCount(2);
    await expect(page.locator('#targetX')).toHaveValue('4');

    await page.locator('[data-recall-plane]').filter({ hasText: 'Front truss' }).click();

    await expect(page.locator('#planeName')).toHaveValue('Front truss');
    await expect(page.locator('#targetX')).toHaveValue('1');
    await expect(page.locator('#targetY')).toHaveValue('1');
    await expect(page.locator('#status')).toContainText('Recalled plane Front truss');
  });

  test('stores and recalls additional points and their fixture calibration in a Plane tile', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#targetX').fill('2');
    await page.locator('#targetY').fill('2');
    await page.locator('#addCalibrationPoint').click();
    await page.locator('input[data-fixture="0"][data-point="D"][data-axis="pan"]').fill('12345');
    await page.locator('input[data-fixture="0"][data-point="D"][data-axis="tilt"]').fill('54321');

    await page.locator('[data-save-plane-slot="1"]').click();
    await page.locator('#planeVisualName').fill('Four-point plane');
    await page.locator('#planeVisualSave').click();
    const savedId = await page.evaluate(() => String(activePlaneId));

    await page.locator('[data-recall-plane="default"]').dispatchEvent('click');
    await expect(page.locator('#planePointInputs')).not.toContainText('D');
    await page.locator(`[data-recall-plane="${savedId}"]`).dispatchEvent('click');

    await expect(page.locator('#planePointInputs')).toContainText('D');
    await expect.poll(() => page.evaluate(() => ({
      point: points.find(point => point.id === 'D'),
      calibration: fixtures[0]?.cal?.D
    }))).toEqual({
      point: { id: 'D', x: 2, y: 2, z: 0 },
      calibration: { pan: 12345, tilt: 54321, calibrated: true }
    });
  });

  test('keeps the Planes toolbox anchored on iPad when recalled planes have different point counts', async ({ page }) => {
    const makePoints = count => Array.from({ length: count }, (_, index) => ({
      id: String.fromCharCode(65 + index),
      x: 1 + (index % 3) * 1.5,
      y: 1 + Math.floor(index / 3) * 1.2,
      z: 0
    }));
    const setup = {
      activePlaneId: 'three-points',
      planeCols: 3,
      planeRows: 3,
      planes: [
        { id: 'three-points', name: 'Three points', slot: 0, points: makePoints(3), fixtures: [], target: { x: 2, y: 2, z: 0 } },
        { id: 'nine-points', name: 'Nine points', slot: 1, points: makePoints(9), fixtures: [], target: { x: 2, y: 2, z: 0 } }
      ]
    };
    await page.unroute('**/room_plane_setup.php');
    await page.route('**/room_plane_setup.php', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, setup })
      });
    });
    await page.setViewportSize({ width: 820, height: 600 });
    await openDmxPage(page, 'dmx_room_plane.html');

    const scrollHost = page.locator('#roomPlaneToolboxRail .toolbox-rail-scroll');
    const recalledTile = page.locator('[data-recall-plane="nine-points"]');
    await scrollHost.evaluate((element, tileElement) => {
      element.style.overflowAnchor = 'none';
      element.scrollTop += tileElement.getBoundingClientRect().top - element.getBoundingClientRect().top - 35;
    }, await recalledTile.elementHandle());
    const before = await recalledTile.evaluate(element => element.getBoundingClientRect().top);

    await recalledTile.dispatchEvent('click');
    await expect(page.locator('#planeName')).toHaveValue('Nine points');
    await page.waitForTimeout(50);

    const after = await page.locator('[data-recall-plane="nine-points"]').evaluate(element => element.getBoundingClientRect().top);
    expect(Math.abs(after - before)).toBeLessThan(2);
  });

  test('allows partial calibration saves and warns which fixtures and points are unusable', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#resetCalibration').click();
    await page.locator('input[data-fixture="0"][data-point="A"][data-axis="pan"]').fill('123');
    await page.locator('[data-save-plane-slot="1"]').click();

    await expect(page.locator('#planeLibrary .slot.filled')).toHaveCount(2);
    await expect(page.locator('#planeVisualModal')).toBeVisible();
    await expect(page.locator('#planeVisualHint')).toContainText('cannot be used for all fixtures');
    await expect(page.locator('#planeVisualHint')).toContainText('Spot 1: B, C');
    await expect(page.locator('#planeVisualHint')).toContainText('Spot 2: A, B, C');
  });

  test('saved planes independently recall room geometry and fixture calibration', async ({ page }) => {
    let savedSetup = null;
    await page.unroute('**/room_plane_setup.php');
    await page.route('**/room_plane_setup.php', async route => {
      if (route.request().method() === 'POST') {
        savedSetup = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: Boolean(savedSetup), setup: savedSetup })
      });
    });
    await openDmxPage(page, 'dmx_room_plane.html');

    const fixtureAPan = page.locator('input[data-fixture="0"][data-point="A"][data-axis="pan"]');
    const roomPointBX = page.locator('input[data-point="1"][data-axis="x"]');
    await fixtureAPan.fill('111');
    await roomPointBX.fill('6.5');
    await page.locator('#targetX').fill('1.1');
    await page.locator('[data-save-plane-slot="1"]').click();
    await page.locator('#planeVisualName').fill('First calibration');
    await page.locator('#planeVisualSave').click();

    await fixtureAPan.fill('222');
    await roomPointBX.fill('8.5');
    await page.locator('#targetX').fill('2.2');
    await page.locator('[data-save-plane-slot="2"]').click();
    await page.locator('#planeVisualName').fill('Second calibration');
    await page.locator('#planeVisualSave').click();

    await expect.poll(() => savedSetup?.planes?.find(plane => plane.name === 'First calibration')).toMatchObject({
      points: expect.arrayContaining([expect.objectContaining({ id: 'B', x: 6.5 })]),
      target: expect.objectContaining({ x: 1.1 }),
      fixtures: expect.arrayContaining([
        expect.objectContaining({ cal: expect.objectContaining({ A: expect.objectContaining({ pan: 111 }) }) })
      ])
    });
    await expect.poll(() => savedSetup?.planes?.find(plane => plane.name === 'Second calibration')).toMatchObject({
      points: expect.arrayContaining([expect.objectContaining({ id: 'B', x: 8.5 })]),
      target: expect.objectContaining({ x: 2.2 }),
      fixtures: expect.arrayContaining([
        expect.objectContaining({ cal: expect.objectContaining({ A: expect.objectContaining({ pan: 222 }) }) })
      ])
    });

    await page.reload();
    await page.locator('[data-recall-plane]').filter({ hasText: 'First calibration' }).click();
    await expect(fixtureAPan).toHaveValue('111');
    await expect(roomPointBX).toHaveValue('6.5');
    await expect(page.locator('#targetX')).toHaveValue('1.1');
    await page.locator('[data-recall-plane]').filter({ hasText: 'Second calibration' }).click();
    await expect(fixtureAPan).toHaveValue('222');
    await expect(roomPointBX).toHaveValue('8.5');
    await expect(page.locator('#targetX')).toHaveValue('2.2');
  });

  test('saved planes use a configurable tile matrix layout', async ({ page }) => {
    const posts = [];
    await page.unroute('**/room_plane_setup.php');
    await page.route('**/room_plane_setup.php', async route => {
      if (route.request().method() === 'POST') posts.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            activePlaneId: 'front',
            planeCols: 2,
            planeRows: 2,
            planes: [
              { id: 'front', name: 'Front', points: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 5, y: 0 }, { id: 'C', x: 0, y: 3 }], target: { x: 1, y: 1 }, fixtures: [], view: {} },
              { id: 'back', name: 'Back', points: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 5, y: 0 }, { id: 'C', x: 0, y: 3 }], target: { x: 4, y: 2 }, fixtures: [], view: {} }
            ]
          }
        })
      });
    });

    await openDmxPage(page, 'dmx_room_plane.html');
    await page.locator('.toolbox-rail-edit').click();
    await expect(page.locator('#planeCols')).toHaveValue('2');
    await expect(page.locator('#planeRows')).toHaveValue('2');
    const colBox = await page.locator('#planeCols').boundingBox();
    const rowBox = await page.locator('#planeRows').boundingBox();
    expect(colBox).toBeTruthy();
    expect(rowBox).toBeTruthy();
    expect(Math.abs(colBox.y - rowBox.y)).toBeLessThan(4);
    await expect(page.locator('#planeLibrary .slot')).toHaveCount(4);
    await expect(page.locator('#planeLibrary [data-recall-plane="front"]')).toHaveClass(/active/);

    await page.locator('#planeCols').selectOption('3');
    await expect(page.locator('#planeLibrary .slot')).toHaveCount(6);
    await expect.poll(() => posts.at(-1)?.planeCols).toBe(3);

    await page.locator('[data-visual-plane="front"]').click();
    await expect(page.locator('#planeVisualModal')).toBeVisible();
    await page.locator('#planeVisualName').fill('Front tile');
    await page.locator('#planeVisualColor').fill('#884422');
    await page.locator('#planeVisualSave').click();
    await expect(page.locator('[data-recall-plane="front"]')).toContainText('Front tile');
    await expect.poll(() => {
      const planes = posts.at(-1)?.planes || [];
      return planes.find(plane => plane.id === 'front')?.visual?.color;
    }).toBe('#884422');

    await page.locator('.toolbox-rail-edit').click();
    await page.locator('[data-recall-plane="back"]').click();
    await expect(page.locator('#planeName')).toHaveValue('Back');
    await expect(page.locator('#targetX')).toHaveValue('4');
    await expect(page.locator('#planeLibrary [data-recall-plane="back"]')).toHaveClass(/active/);

    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-del-plane="back"]').click();
    await expect(page.locator('[data-recall-plane="back"]')).toHaveCount(0);
    await expect(page.locator('#planeName')).toHaveValue('Front tile');
    await expect.poll(() => (posts.at(-1)?.planes || []).map(plane => plane.id)).not.toContain('back');
  });

  test('collapses and expands room plane toolboxes as a group', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    const collapseAll = page.locator('[data-collapse-group="room-plane"]');
    await expect(collapseAll).toHaveCount(3);
    await expect(page.locator('#roomSceneBox [data-collapse-group="room-plane"]')).toHaveCount(0);
    await expect(page.locator('#roomPaletteBox [data-collapse-group="room-plane"]')).toHaveCount(0);
    await expect(collapseAll.first()).toHaveText('-- all');

    await collapseAll.first().click();
    await expect(page.locator('#roomPlaneBox')).toHaveClass(/collapsed/);
    await expect(page.locator('#roomPlaneLibraryBox')).toHaveClass(/collapsed/);
    await expect(page.locator('#roomSceneBox')).toHaveClass(/collapsed/);
    await expect(page.locator('#roomPaletteBox')).toHaveClass(/collapsed/);
    await expect(page.locator('#roomFixturesBox')).toHaveClass(/collapsed/);
    await expect(collapseAll.first()).toHaveText('+ all');

    await collapseAll.first().click();
    await expect(page.locator('#roomPlaneBox')).not.toHaveClass(/collapsed/);
    await expect(page.locator('#roomPlaneLibraryBox')).not.toHaveClass(/collapsed/);
    await expect(page.locator('#roomSceneBox')).not.toHaveClass(/collapsed/);
    await expect(page.locator('#roomPaletteBox')).not.toHaveClass(/collapsed/);
    await expect(page.locator('#roomFixturesBox')).not.toHaveClass(/collapsed/);
    await expect(collapseAll.first()).toHaveText('-- all');
  });

  test('persists a reordered Fixtures toolbox between Planes and Scenes after reload', async ({ page }) => {
    let toolboxState = {};
    await page.unroute('**/ui_state.php**');
    await page.route('**/ui_state.php**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, exists: Object.keys(toolboxState).length > 0, state: { toolboxes: toolboxState } })
        });
        return;
      }
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.page === 'toolboxes') toolboxState = { ...toolboxState, ...(body.state || {}) };
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await openDmxPage(page, 'dmx_room_plane.html');
    await page.locator('#roomPlaneToolboxRail .toolbox-rail-edit').click();
    await page.evaluate(() => {
      const rail = document.getElementById('roomPlaneToolboxRail');
      const fixture = document.getElementById('roomFixturesBox');
      const scene = document.getElementById('roomSceneBox');
      const header = fixture.querySelector('.scene-toolbox__header');
      const start = header.getBoundingClientRect();
      const target = scene.getBoundingClientRect();
      header.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 81, pointerType: 'touch', clientX: start.left + 20, clientY: start.top + 20 }));
      rail.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 81, pointerType: 'touch', clientX: target.left + 20, clientY: target.top + 2 }));
      rail.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 81, pointerType: 'touch', clientX: target.left + 20, clientY: target.top + 2 }));
    });

    await expect.poll(() => toolboxState.toolboxRailOrder).toEqual(expect.arrayContaining(['roomPlaneLibrary', 'roomFixtures', 'roomScenes']));
    await page.reload();
    await expect.poll(() => page.locator('#roomPlaneToolboxRail .scene-toolbox[data-toolbox-type]').evaluateAll(boxes => boxes.map(box => box.dataset.toolboxType)))
      .toEqual(['groups', 'roomPlane', 'roomPlaneLibrary', 'roomFixtures', 'roomScenes', 'roomPalettes']);
  });

  test('uses the navy plane toolbox header color for all room plane toolboxes', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    const colors = await page.locator('#roomPlaneBoxHdr,#roomPlaneLibraryBoxHdr,#roomFixturesBoxHdr').evaluateAll(headers =>
      headers.map(header => getComputedStyle(header).backgroundColor)
    );

    expect(colors).toEqual(['rgb(11, 47, 79)', 'rgb(11, 47, 79)', 'rgb(11, 47, 79)']);
  });

  test('flags targets outside the calibrated triangle', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#targetX').fill('6');
    await page.locator('#targetY').fill('3');

    await expect(page.locator('#insideReadout')).toHaveText('Inside plane: no');
    await expect(page.locator('#weightReadout')).toContainText('Weights:');
  });

  test('renders room coordinates with equal x and y scale on wide screens', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openDmxPage(page, 'dmx_room_plane.html');

    const scale = await page.evaluate(() => {
      const points = [...document.querySelectorAll('.plane-point:not(.fixture)')].map(el => {
        const r = el.getBoundingClientRect();
        return { label: el.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      const byLabel = Object.fromEntries(points.map(point => [point.label, point]));
      const abPixels = Math.hypot(byLabel.B.x - byLabel.A.x, byLabel.B.y - byLabel.A.y);
      const acPixels = Math.hypot(byLabel.C.x - byLabel.A.x, byLabel.C.y - byLabel.A.y);
      return { xPerUnit: abPixels / 5, yPerUnit: acPixels / 3 };
    });

    expect(Math.abs(scale.xPerUnit - scale.yPerUnit)).toBeLessThan(0.5);
  });

  test('clears fixture edit state when the edit modal closes', async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 900 });
    await openDmxPage(page, 'dmx_room_plane.html');

    const marker = page.locator('.plane-point.fixture').first();
    const box = await marker.boundingBox();
    expect(box).toBeTruthy();

    const before = Number(await page.locator('input[data-fixture="0"][data-field="x"]').inputValue());
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 - 30, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('input[data-fixture="0"][data-field="x"]')).toHaveValue(String(before));

    await page.locator('[data-edit-fixture="0"]').click();
    await expect(page.locator('[data-edit-fixture="0"]')).toHaveText('Editing');
    await expect(marker).toHaveClass(/editing/);
    await page.locator('#commonPanTiltDimmerModal [data-ptd-close]').first().click();

    await expect(page.locator('[data-edit-fixture="0"]')).toHaveText('Edit');
    await expect(marker).not.toHaveClass(/editing/);

    const closedBox = await marker.boundingBox();
    await page.mouse.move(closedBox.x + closedBox.width / 2, closedBox.y + closedBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(closedBox.x + closedBox.width / 2 + 80, closedBox.y + closedBox.height / 2 - 30, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('input[data-fixture="0"][data-field="x"]')).toHaveValue(String(before));
  });

  test('opens the common pan tilt dimmer editor from the fixture Edit button', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('[data-edit-fixture="0"]').click();

    await expect(page.locator('#commonPanTiltDimmerModal')).toBeVisible();
    await expect(page.locator('#commonPanTiltDimmerTitle')).toHaveText('Edit Spot 1');
    const modalBox = await page.locator('#commonPanTiltDimmerModal .modal-card').boundingBox();
    const closeBox = await page.locator('#commonPanTiltDimmerModal [data-ptd-close][aria-label="Close"]').boundingBox();
    expect(modalBox).toBeTruthy();
    expect(closeBox).toBeTruthy();
    expect(closeBox.x).toBeGreaterThan(modalBox.x + modalBox.width - 70);
    expect(closeBox.y).toBeLessThan(modalBox.y + 30);
    await expect(page.locator('[data-live-pan="0"]')).toHaveText('32768');
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText('32768');
    await expect(page.locator('[data-live-dimmer="0"]')).toHaveText('255');
    await expect(page.locator('[data-ptd-center]')).toHaveText('Center Pan/Tilt');
    await expect(page.locator('[data-ptd-relative-dir][data-ptd-axis="pan"]')).toHaveCount(4);
    await expect(page.locator('[data-ptd-relative-dir][data-ptd-axis="tilt"]')).toHaveCount(4);

    const panFineStep = page.locator('.relative-control').filter({ hasText: 'Pan fine relative' }).locator('[data-ptd-relative-step]');
    await panFineStep.fill('7');
    await page.locator('#commonPanTiltDimmerModal [data-ptd-close][aria-label="Close"]').click();
    await page.locator('[data-edit-fixture="0"]').click();
    await expect(panFineStep).toHaveValue('7');
    await page.locator('#commonPanTiltDimmerModal [data-ptd-close][aria-label="Close"]').click();
    await page.reload();
    await page.locator('[data-edit-fixture="0"]').click();
    await expect(panFineStep).toHaveValue('7');

    await page.locator('[data-ptd-dimmer]').fill('72');
    await expect(page.locator('[data-live-dimmer="0"]')).toHaveText('72');

    const pad = page.locator('[data-ptd-xy]');
    const box = await pad.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);

    await expect(page.locator('[data-live-pan="0"]')).toHaveText('49151');
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText('49151');

    await page.locator('.relative-control').filter({ hasText: 'Pan fine relative' }).locator('[data-ptd-relative-dir="1"]').click();
    await expect(page.locator('[data-live-pan="0"]')).toHaveText('49158');
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText('49151');
    await expect(page.locator('[data-ptd-action="recall-A"]')).toHaveText('Recall A');
    await expect(page.locator('[data-ptd-action="recall-A"]')).toHaveClass(/success/);
    await expect(page.locator('[data-ptd-action="store-A"]')).toHaveText('Store A');
    await expect(page.locator('[data-ptd-action="store-A"]')).toHaveClass(/warn/);
    await expect(page.locator('[data-ptd-action="recall-B"]')).toHaveText('Recall B');
    await expect(page.locator('[data-ptd-action="store-B"]')).toHaveText('Store B');
    await expect(page.locator('[data-ptd-action="recall-C"]')).toHaveText('Recall C');
    await expect(page.locator('[data-ptd-action="store-C"]')).toHaveText('Store C');
    const recallActions = page.locator('[data-ptd-action-group="recall"]');
    const storeActions = page.locator('[data-ptd-action-group="store"]');
    await expect(recallActions).toContainText('Recall A');
    await expect(storeActions).toContainText('Store A');
    await expect(page.locator('[data-ptd-action-group="recall"] + [data-ptd-action-group="store"]')).toHaveCount(1);
    await expect.poll(() => storeActions.evaluate(element => getComputedStyle(element).borderTopWidth)).not.toBe('0px');

    await page.locator('[data-ptd-action="store-B"]').click();
    await expect(page.locator('input[data-fixture="0"][data-point="B"][data-axis="pan"]')).toHaveValue('49158');
    await expect(page.locator('input[data-fixture="0"][data-point="B"][data-axis="tilt"]')).toHaveValue('49151');
    await expect(page.locator('[data-ptd-action="store-B"]')).toHaveText('Stored B');
    await expect(page.locator('#status')).toContainText('Stored Spot 1 calibration point B');

    await pad.scrollIntoViewIfNeeded();
    const dragBox = await pad.boundingBox();
    expect(dragBox).toBeTruthy();
    await page.mouse.move(dragBox.x + dragBox.width * 0.75, dragBox.y + dragBox.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(dragBox.x + dragBox.width * 0.2, dragBox.y + dragBox.height * 0.8, { steps: 8 });
    await page.mouse.up();

    await expect(page.locator('[data-live-pan="0"]')).toHaveText('13107');
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText('13107');

    await page.locator('[data-ptd-action="recall-B"]').click();
    await expect(page.locator('[data-live-pan="0"]')).toHaveText('49158');
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText('49151');
    await expect(page.locator('[data-ptd-position-readout]')).toHaveText('Pan 49158 · Tilt 49151');
    await expect(page.locator('#status')).toContainText('Recalled Spot 1 calibration point B');
  });

  test('scrolls all calibration actions into reach in an iPad-sized fixture modal', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 600 });
    await openDmxPage(page, 'dmx_room_plane.html');

    for (let index = 0; index < 6; index++) {
      await page.locator('#targetX').fill(String(1 + index * 0.4));
      await page.locator('#targetY').fill(String(1.2 + index * 0.2));
      await page.locator('#addCalibrationPoint').click();
    }
    await page.locator('[data-edit-fixture="0"]').click();

    const body = page.locator('#commonPanTiltDimmerModal .modal-body');
    await expect(body).toHaveCSS('overflow-y', 'auto');
    const metrics = await body.evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(page.locator('[data-ptd-action="store-I"]')).toBeInViewport();
  });

  test('locks modal scrolling while an iPad Pan/Tilt gesture is active', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 600 });
    await openDmxPage(page, 'dmx_room_plane.html');

    for (let index = 0; index < 6; index++) {
      await page.locator('#targetX').fill(String(1 + index * 0.4));
      await page.locator('#targetY').fill(String(1.2 + index * 0.2));
      await page.locator('#addCalibrationPoint').click();
    }
    await page.locator('[data-edit-fixture="0"]').click();

    const body = page.locator('#commonPanTiltDimmerModal .modal-body');
    const pad = page.locator('[data-ptd-xy]');
    await body.evaluate(element => { element.scrollTop = 120; });
    const initialScrollTop = await body.evaluate(element => element.scrollTop);

    await pad.evaluate(element => {
      const rect = element.getBoundingClientRect();
      element.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 91,
        pointerType: 'touch',
        isPrimary: true,
        clientX: rect.left + rect.width * 0.25,
        clientY: rect.top + rect.height * 0.25
      }));
    });

    await expect(body).toHaveClass(/ptd-pad-editing/);
    await expect(body).toHaveCSS('overflow-y', 'hidden');
    expect(await body.evaluate(element => element.scrollTop)).toBe(initialScrollTop);

    await pad.evaluate(element => {
      const rect = element.getBoundingClientRect();
      element.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 91,
        pointerType: 'touch',
        isPrimary: true,
        clientX: rect.left + rect.width * 0.75,
        clientY: rect.top + rect.height * 0.75
      }));
      element.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 91,
        pointerType: 'touch',
        isPrimary: true,
        clientX: rect.left + rect.width * 0.75,
        clientY: rect.top + rect.height * 0.75
      }));
    });

    await expect(body).not.toHaveClass(/ptd-pad-editing/);
    await expect(body).toHaveCSS('overflow-y', 'auto');
    expect(await body.evaluate(element => element.scrollTop)).toBe(initialScrollTop);
  });

  test('loads patched moving lights and sends modal movement to DMX channels', async ({ page }) => {
    const sent = [];
    await page.route('**/fixture_setup.php**', async route => {
      const url = route.request().url();
      const method = route.request().method();
      if (url.includes('livevalues')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: method === 'GET'
            ? JSON.stringify({ ok: true, exists: true, values: {} })
            : JSON.stringify({ ok: true })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            baseUrl: 'http://localhost/dmx-test',
            profiles: [{
              id: 1,
              name: 'Moving Profile',
              mode: '16-bit',
              channels: 8,
              controls: [
                { id: 11, type: 'slider8', label: 'Dimmer', channel: 1, scope: 'dimmer' },
                { id: 12, type: 'panTilt16', label: 'Position', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 }
              ]
            }],
            fixtures: [{ id: 101, name: 'Moving 1', profileId: 1, start: 10 }],
            values: {}
          }
        })
      });
    });
    await page.route('**/dmx/b**', async route => {
      sent.push({ url: route.request().url(), method: route.request().method(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"updated":5}' });
    });
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#resetCalibration').click();
    await page.locator('#removeFixture').click();
    await page.locator('#removeFixture').click();
    await expect(page.locator('#fixtureRows tr')).toHaveCount(0);

    await page.locator('#loadPatchedFixtures').click();
    await expect(page.locator('[data-edit-fixture="0"]')).toBeVisible();
    await expect(page.locator('input[data-field="name"]')).toHaveCount(0);
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Moving 1');
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Missing A, B, C');
    await expect(page.locator('thead')).toContainText('Live Pan');
    await expect(page.locator('thead')).toContainText('Last send / channels');
    await expect(page.locator('[data-live-pan="0"]')).toHaveText('32768');
    await expect(page.locator('[data-live-dimmer="0"]')).toHaveText('255');

    await page.locator('[data-edit-fixture="0"]').click();
    const pad = page.locator('[data-ptd-xy]');
    const box = await pad.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);
    await expect(page.locator('[data-live-pan="0"]')).toHaveText('49151');
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText('49151');

    await expect.poll(() => sent.length).toBeGreaterThanOrEqual(1);
    expect(sent[0].url).toContain('/dmx/b');
    expect(sent[0].method).toBe('POST');
    expect(sent[0].body).toContain('10:255');
    expect(sent[0].body).toContain('11:191');
    expect(sent[0].body).toContain('12:255');
    expect(sent[0].body).toContain('13:191');
    expect(sent[0].body).toContain('14:255');
    await expect(page.locator('[data-send-summary="0"]')).toContainText('ch 11=191');
    await expect(page.locator('[data-send-summary="0"]')).toContainText('ch 14=255');
    await expect(page.locator('#status')).toContainText('Sent Moving 1:');
  });

  test('saved plane fixtures automatically bind to current Controller fixtures by id', async ({ page }) => {
    const posts = [];
    await page.unroute('**/room_plane_setup.php');
    await page.route('**/room_plane_setup.php', async route => {
      if (route.request().method() === 'POST') posts.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            activePlaneId: 'front',
            planes: [{
              id: 'front',
              name: 'Front',
              points: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 5, y: 0 }, { id: 'C', x: 0, y: 3 }],
              target: { x: 2, y: 1, z: 0 },
              fixtures: [{
                id: 101,
                name: 'Old Plane Name',
                profileId: 1,
                start: 10,
                x: 7,
                y: 8,
                z: 9,
                cal: {
                  A: { pan: 10, tilt: 20, calibrated: true },
                  B: { pan: 30, tilt: 40, calibrated: true },
                  C: { pan: 50, tilt: 60, calibrated: true }
                }
              }]
            }]
          }
        })
      });
    });
    await page.route('**/fixture_setup.php**', async route => {
      const url = route.request().url();
      if (url.includes('livevalues')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, exists: true, values: {} }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            baseUrl: 'http://localhost/dmx-test',
            profiles: [{
              id: 1,
              name: 'Moving Profile',
              mode: '16-bit',
              channels: 8,
              controls: [{ id: 12, type: 'panTilt16', label: 'Position', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 }]
            }],
            fixtures: [{ id: 101, name: 'Controller Name', profileId: 1, start: 10 }],
            values: {}
          }
        })
      });
    });

    await openDmxPage(page, 'dmx_room_plane.html');
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Controller Name');
    await expect(page.locator('#fixtureRows tr').first()).not.toContainText('Old Plane Name');
    await expect(page.locator('[data-send-summary="0"]')).toContainText('ch 11');
    await expect(page.locator('input[data-fixture="0"][data-field="x"]')).toHaveValue('7');
    await expect(page.locator('input[data-fixture="0"][data-point="A"][data-axis="pan"]')).toHaveValue('10');
    await page.locator('#loadPatchedFixtures').click();

    await expect(page.locator('#fixtureRows tr').first()).toContainText('Controller Name');
    await expect(page.locator('#fixtureRows tr').first()).not.toContainText('Old Plane Name');
    await expect(page.locator('input[data-field="name"]')).toHaveCount(0);
    await expect(page.locator('input[data-fixture="0"][data-field="x"]')).toHaveValue('7');
    await expect.poll(() => posts.at(-1)?.fixtures?.[0]?.name).toBe('Controller Name');
    await expect.poll(() => posts.at(-1)?.fixtures?.[0]?.cal?.A?.pan).toBe(10);
  });

  test('fixture editor modal moves live pan tilt without full room plane autosave churn', async ({ page }) => {
    const sent = [];
    let roomPlanePosts = 0;
    await page.unroute('**/room_plane_setup.php');
    await page.route('**/room_plane_setup.php', async route => {
      if (route.request().method() === 'POST') roomPlanePosts++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: false, setup: null })
      });
    });
    await page.route('**/fixture_setup.php**', async route => {
      const url = route.request().url();
      const method = route.request().method();
      if (url.includes('livevalues')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: method === 'GET'
            ? JSON.stringify({ ok: true, exists: true, values: {} })
            : JSON.stringify({ ok: true })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            baseUrl: 'http://localhost/dmx-test',
            profiles: [{
              id: 1,
              name: 'Moving Profile',
              mode: '16-bit',
              channels: 8,
              controls: [
                { id: 11, type: 'slider8', label: 'Dimmer', channel: 1, scope: 'dimmer' },
                { id: 12, type: 'panTilt16', label: 'Position', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 }
              ]
            }],
            fixtures: [{ id: 101, name: 'Moving 1', profileId: 1, start: 10 }],
            values: {}
          }
        })
      });
    });
    await page.route('**/dmx/b**', async route => {
      sent.push(route.request().postData() || '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await openDmxPage(page, 'dmx_room_plane.html');
    await page.locator('#loadPatchedFixtures').click();
    await expect(page.locator('[data-edit-fixture="0"]')).toBeVisible();
    await page.waitForTimeout(900);
    roomPlanePosts = 0;
    await page.locator('[data-edit-fixture="0"]').click();
    const pad = page.locator('[data-ptd-xy]');
    const box = await pad.boundingBox();
    expect(box).toBeTruthy();

    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.85);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.15, { steps: 12 });
    await page.mouse.up();

    await expect.poll(() => sent.length).toBeGreaterThanOrEqual(5);
    await expect(page.locator('[data-live-pan="0"]')).toHaveText(/\d+/);
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText(/\d+/);
    await page.waitForTimeout(900);
    expect(roomPlanePosts).toBe(0);
  });

  test('recalling a saved calibration point uses the current Controller patch binding', async ({ page }) => {
    const sent = [];
    const savedFixture = {
      id: 101,
      name: 'Old saved name',
      start: 1,
      live: false,
      x: 1,
      y: 2,
      z: 3,
      control: { pan: 32768, tilt: 32768, dimmer: 255 },
      cal: {
        A: { pan: 0x1234, tilt: 0x5678, calibrated: true },
        B: { pan: 20000, tilt: 30000, calibrated: true },
        C: { pan: 40000, tilt: 50000, calibrated: true }
      }
    };

    await page.unroute('**/room_plane_setup.php');
    await page.route('**/room_plane_setup.php', async route => {
      if (route.request().method() !== 'GET') {
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
            baseUrl: 'http://localhost/dmx-test',
            activePlaneId: 'front',
            points: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 5, y: 0 }, { id: 'C', x: 0, y: 3 }],
            target: { x: 1, y: 1 },
            fixtures: [savedFixture],
            planes: [{
              id: 'front',
              name: 'Front',
              points: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 5, y: 0 }, { id: 'C', x: 0, y: 3 }],
              target: { x: 1, y: 1 },
              fixtures: [savedFixture]
            }]
          }
        })
      });
    });
    await page.route('**/fixture_setup.php**', async route => {
      if (route.request().url().includes('livevalues')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, exists: true, values: {} })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            baseUrl: 'http://localhost/dmx-test',
            profiles: [{
              id: 7,
              name: 'Current moving profile',
              channels: 8,
              controls: [{ id: 12, type: 'panTilt16', label: 'Position', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 }]
            }],
            fixtures: [{ id: 101, name: 'Current Controller name', profileId: 7, start: 10 }]
          }
        })
      });
    });
    await page.route('**/dmx/b', async route => {
      sent.push(route.request().postData() || '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await openDmxPage(page, 'dmx_room_plane.html');
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Current Controller name');
    await page.locator('[data-edit-fixture="0"]').click();
    await page.locator('[data-ptd-action="recall-A"]').click();

    await expect.poll(() => sent.at(-1)).toBe('11:18,12:52,13:86,14:120');
    await expect(page.locator('[data-live-pan="0"]')).toHaveText(String(0x1234));
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText(String(0x5678));
  });

  test('selects room plane fixtures from the shared Groups toolbox', async ({ page }) => {
    const sent = [];
    await page.unroute('**/group_setup.php');
    await page.route('**/group_setup.php', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          groups: [
            { id: 'front', name: 'Front movers', fixtureIds: [101, 103] }
          ]
        })
      });
    });
    await page.route('**/fixture_setup.php**', async route => {
      const url = route.request().url();
      if (url.includes('livevalues')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, exists: true, values: {} }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            baseUrl: 'http://localhost/dmx-test',
            profiles: [{
              id: 1,
              name: 'Moving Profile',
              mode: '16-bit',
              channels: 8,
              controls: [
                { id: 11, type: 'slider8', label: 'Dimmer', channel: 1, scope: 'dimmer' },
                { id: 12, type: 'panTilt16', label: 'Position', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 }
              ]
            }],
            fixtures: [
              { id: 101, name: 'Moving 1', profileId: 1, start: 10 },
              { id: 102, name: 'Moving 2', profileId: 1, start: 20 },
              { id: 103, name: 'Moving 3', profileId: 1, start: 30 }
            ],
            values: {}
          }
        })
      });
    });
    await page.route('**/dmx/b**', async route => {
      sent.push(route.request().postData() || '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await openDmxPage(page, 'dmx_room_plane.html');

    await expect(page.locator('#roomPlaneGroupsRename')).toHaveCount(0);
    await expect(page.locator('#roomPlaneGroupsDelete')).toHaveCount(0);
    await expect(page.locator('#roomPlaneGroupsList [data-edit-group-tile="0"]')).toBeVisible();
    await expect(page.locator('#roomPlaneGroupsList [data-delete-group-tile="0"]')).toBeVisible();
    await expect(page.locator('#roomPlaneGroupsEdit')).toBeDisabled();
    await expect(page.locator('#roomPlaneGroupsList')).toContainText('Front movers');

    await page.locator('#loadPatchedFixtures').click();
    await page.locator('#roomPlaneGroupsList [data-group-index="0"]').click();

    await expect(page.locator('#roomPlaneGroupsEdit')).toBeEnabled();
    await expect(page.locator('[data-select-fixture="0"]')).toBeChecked();
    await expect(page.locator('[data-select-fixture="1"]')).not.toBeChecked();
    await expect(page.locator('[data-select-fixture="2"]')).toBeChecked();
    await expect(page.locator('#status')).toContainText('Selected 2 fixtures from 1 group');
    await page.locator('#roomPlaneGroupsEdit').click();
    await expect(page.locator('#commonPanTiltDimmerModal')).toHaveCount(0);
    await expect(page.locator('#groupModal')).toBeVisible();
    await expect(page.locator('#groupModalTitle')).toContainText('2 fixtures selected');
    await expect(page.locator('#groupModal')).toContainText('Dimmer');
    await expect(page.locator('#groupModal')).toContainText('Position');
    await expect(page.locator('#defaultRoomGroupBtn')).toHaveText('Default');
    await expect(page.locator('#blackoutRoomGroupBtn')).toHaveText('Blackout');
    await page.locator('#groupModal [data-room-gc^="slider8:Dimmer"]').first().fill('77');
    await expect.poll(() => sent.some(body => body.includes('10:77') && body.includes('30:77'))).toBe(true);
    await page.locator('#closeGroupModal2').click();

    await page.locator('[data-select-fixture="1"]').check();
    await expect(page.locator('#roomPlaneGroupsList [data-group-index="0"]')).not.toHaveClass(/selected|active/);
    await expect(page.locator('[data-select-fixture="1"]')).toBeChecked();
  });

  test('auto-applies the calibrated target to selected patched moving lights as a group', async ({ page }) => {
    const sent = [];
    await page.route('**/fixture_setup.php**', async route => {
      const url = route.request().url();
      if (url.includes('livevalues')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, exists: true, values: {} }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            baseUrl: 'http://localhost/dmx-test',
            profiles: [{
              id: 1,
              name: 'Moving Profile',
              mode: '16-bit',
              channels: 8,
              controls: [
                { id: 11, type: 'slider8', label: 'Dimmer', channel: 1, scope: 'dimmer' },
                { id: 12, type: 'panTilt16', label: 'Position', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 }
              ]
            }],
            fixtures: [
              { id: 101, name: 'Moving 1', profileId: 1, start: 10 },
              { id: 102, name: 'Moving 2', profileId: 1, start: 20 }
            ],
            values: {}
          }
        })
      });
    });
    await page.route('**/dmx/b**', async route => {
      sent.push({ url: route.request().url(), method: route.request().method(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"updated":10}' });
    });
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#loadPatchedFixtures').click();
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Moving 1');
    await page.evaluate(() => {
      fixtures.forEach((fixture, index) => { fixture.cal = defaultCalibration(index); });
      renderFixtureRows();
    });
    await page.locator('[data-select-fixture="0"]').check();
    await page.locator('[data-select-fixture="1"]').check();
    await page.locator('#targetX').fill('1');
    await page.locator('#targetY').fill('1');

    await expect(page.locator('#status')).toContainText('Live plane target X 1 / Y 1 -> 2 fixtures');
    await expect(page.locator('[data-live-pan="0"]')).toHaveText('87');
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText('103');
    await expect(page.locator('[data-live-pan="1"]')).toHaveText('105');
    await expect(page.locator('[data-live-tilt="1"]')).toHaveText('103');
    await expect.poll(() => sent.length).toBeGreaterThanOrEqual(1);
    const latestBody = sent[sent.length - 1].body;
    expect(latestBody).toContain('11:0');
    expect(latestBody).toContain('12:87');
    expect(latestBody).toContain('13:0');
    expect(latestBody).toContain('14:103');
    expect(latestBody).toContain('21:0');
    expect(latestBody).toContain('22:105');
    expect(latestBody).toContain('23:0');
    expect(latestBody).toContain('24:103');
  });

  test('loads and autosaves room plane setup on the server', async ({ page }) => {
    const posts = [];
    await page.unroute('**/room_plane_setup.php');
    await page.route('**/room_plane_setup.php', async route => {
      if (route.request().method() === 'POST') {
        posts.push(JSON.parse(route.request().postData() || '{}'));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            schemaVersion: 1,
            baseUrl: 'http://localhost/dmx-test',
            points: [
              { id: 'A', x: 1, y: 0, z: 0 },
              { id: 'B', x: 6, y: 0, z: 0 },
              { id: 'C', x: 1, y: 4, z: 0 }
            ],
            target: { x: 3, y: 2, z: 0 },
            fixtures: [{
              name: 'Saved Spot',
              x: 2,
              y: -3,
              z: 4,
              control: { pan: 32768, tilt: 32768, dimmer: 255 },
              cal: {
                A: { pan: 10, tilt: 20 },
                B: { pan: 30, tilt: 40 },
                C: { pan: 50, tilt: 60 }
              }
            }]
          }
        })
      });
    });
    await page.route('**/fixture_setup.php**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, exists: false, setup: null }) });
    });
    await openDmxPage(page, 'dmx_room_plane.html');

    await expect(page.locator('input[data-field="name"]')).toHaveCount(0);
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Saved Spot');
    await expect(page.locator('#targetX')).toHaveValue('3');
    await expect(page.locator('input[data-point="1"][data-axis="x"]')).toHaveValue('6');

    await page.locator('input[data-fixture="0"][data-field="x"]').fill('2.75');

    await expect.poll(() => posts.length).toBeGreaterThan(0);
    const latest = posts[posts.length - 1];
    expect(latest.points[1].x).toBe(6);
    expect(latest.target.x).toBe(3);
    expect(latest.fixtures[0].name).toBe('Saved Spot');
    expect(latest.fixtures[0].x).toBe(2.75);
    expect(latest.fixtures[0].cal.A.pan).toBe(10);
    expect(Array.isArray(latest.planes)).toBeTruthy();
    expect(latest.planes[0].name).toBe('Default plane');

    await page.locator('[data-save-plane-slot="1"]').click();
    await page.locator('#planeVisualName').fill('Second plane');
    await page.locator('#planeVisualSave').click();

    await expect.poll(() => posts.some(post => Array.isArray(post.planes) && post.planes.some(plane => plane.name === 'Second plane'))).toBeTruthy();
  });
});
