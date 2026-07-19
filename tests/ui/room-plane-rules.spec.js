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
    }).toEqual({ x: 1.25, y: 2.75, z: 0 });
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

  test('reset calibration marks fixtures incomplete', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#resetCalibration').click();

    await expect(page.locator('tbody tr').first()).toContainText('Missing A, B, C');
  });

  test('saves and recalls multiple plane definitions from the library', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await expect(page.locator('#activePlaneSummary')).toHaveCount(0);
    await expect(page.locator('#roomPlaneBox #savePlaneDefinition')).toHaveCount(0);
    await expect(page.locator('#roomPlaneLibraryBox #savePlaneDefinition')).toHaveCount(0);
    await expect(page.locator('#roomPlaneLibraryBox #newPlaneDefinition')).toHaveCount(0);
    await expect(page.locator('#roomPlaneLibraryBox #deletePlaneDefinition')).toHaveCount(0);
    await expect(page.locator('#roomPlaneLibraryBox')).toContainText('Planes');

    await page.locator('#targetX').fill('1');
    await page.locator('#targetY').fill('1');
    await page.locator('[data-visual-plane]').first().click();
    await page.locator('#planeVisualName').fill('Front truss');
    await page.locator('#planeVisualSave').click();

    await page.locator('[data-save-plane-slot="1"]').click();
    await expect(page.locator('#planeVisualModal')).toBeVisible();
    await page.locator('#planeVisualName').fill('Back truss');
    await page.locator('#planeVisualSave').click();
    await page.locator('#targetX').fill('4');
    await page.locator('#targetY').fill('2');

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

    await page.locator('#planeCols').fill('3');
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
    await expect(collapseAll.first()).toHaveText('-- all');

    await collapseAll.first().click();
    await expect(page.locator('#roomPlaneBox')).toHaveClass(/collapsed/);
    await expect(page.locator('#roomPlaneLibraryBox')).toHaveClass(/collapsed/);
    await expect(page.locator('#roomFixturesBox')).toHaveClass(/collapsed/);
    await expect(collapseAll.first()).toHaveText('+ all');

    await collapseAll.first().click();
    await expect(page.locator('#roomPlaneBox')).not.toHaveClass(/collapsed/);
    await expect(page.locator('#roomPlaneLibraryBox')).not.toHaveClass(/collapsed/);
    await expect(page.locator('#roomFixturesBox')).not.toHaveClass(/collapsed/);
    await expect(collapseAll.first()).toHaveText('-- all');
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

  test('selects a newly added fixture for editing', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#addFixture').click();

    await expect(page.locator('[data-edit-fixture="2"]')).toHaveText('Editing');
    await expect(page.locator('.plane-point.fixture').nth(2)).toHaveClass(/editing/);
    await expect(page.locator('#commonPanTiltDimmerModal')).toBeVisible();
    await expect(page.locator('#commonPanTiltDimmerTitle')).toHaveText('Edit Spot 3');
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

    await page.locator('[data-ptd-dimmer]').fill('72');
    await expect(page.locator('[data-live-dimmer="0"]')).toHaveText('72');

    const pad = page.locator('[data-ptd-xy]');
    const box = await pad.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);

    await expect(page.locator('[data-live-pan="0"]')).toHaveText('49151');
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText('49151');

    await page.locator('.relative-control').filter({ hasText: 'Pan fine relative' }).locator('[data-ptd-relative-dir="1"]').click();
    await expect(page.locator('[data-live-pan="0"]')).toHaveText('49152');
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText('49151');
    await expect(page.locator('[data-ptd-action="recall-A"]')).toHaveText('Recall A');
    await expect(page.locator('[data-ptd-action="recall-A"]')).toHaveClass(/success/);
    await expect(page.locator('[data-ptd-action="store-A"]')).toHaveText('Store A');
    await expect(page.locator('[data-ptd-action="store-A"]')).toHaveClass(/warn/);
    await expect(page.locator('[data-ptd-action="recall-B"]')).toHaveText('Recall B');
    await expect(page.locator('[data-ptd-action="store-B"]')).toHaveText('Store B');
    await expect(page.locator('[data-ptd-action="recall-C"]')).toHaveText('Recall C');
    await expect(page.locator('[data-ptd-action="store-C"]')).toHaveText('Store C');

    await page.locator('[data-ptd-action="store-B"]').click();
    await expect(page.locator('input[data-fixture="0"][data-point="B"][data-axis="pan"]')).toHaveValue('49152');
    await expect(page.locator('input[data-fixture="0"][data-point="B"][data-axis="tilt"]')).toHaveValue('49151');
    await expect(page.locator('[data-ptd-action="store-B"]')).toHaveText('Stored B');
    await expect(page.locator('#status')).toContainText('Stored Spot 1 calibration point B');

    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8, { steps: 8 });
    await page.mouse.up();

    await expect(page.locator('[data-live-pan="0"]')).toHaveText('13107');
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText('13107');

    await page.locator('[data-ptd-action="recall-B"]').click();
    await expect(page.locator('[data-live-pan="0"]')).toHaveText('49152');
    await expect(page.locator('[data-live-tilt="0"]')).toHaveText('49151');
    await expect(page.locator('[data-ptd-position-readout]')).toHaveText('Pan 49152 · Tilt 49151');
    await expect(page.locator('#status')).toContainText('Recalled Spot 1 calibration point B');
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

    await page.locator('#loadPatchedFixtures').click();
    await expect(page.locator('[data-edit-fixture="0"]')).toBeVisible();
    await expect(page.locator('input[data-field="name"]')).toHaveCount(0);
    await expect(page.locator('#fixtureRows tr').first()).toContainText('Moving 1');
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
