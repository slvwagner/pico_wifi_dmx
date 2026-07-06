const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Room Plane Test prototype rules', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/room_plane_setup.php', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: false, setup: null })
      });
    });
  });

  test('interpolates fixture pan and tilt from the calibrated plane points', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await expect(page.locator('h1')).toContainText('Room Plane Test');
    await expect(page.locator('thead th').first()).toHaveText('Edit');
    await expect(page.locator('#weightReadout')).toContainText('A 0');
    await expect(page.locator('#weightReadout')).toContainText('B 0.5');
    await expect(page.locator('#weightReadout')).toContainText('C 0.5');
    await expect(page.locator('[data-result-fixture="Spot 1"] .result-value')).toHaveText('Pan 105 / Tilt 93.5');
    await expect(page.locator('[data-result-fixture="Spot 2"] .result-value')).toHaveText('Pan 181 / Tilt 98');
    await expect(page.locator('#insideReadout')).toHaveText('Inside plane: yes');
  });

  test('updates calculated pan and tilt when the target moves', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#targetX').fill('1');
    await page.locator('#targetY').fill('1');

    await expect(page.locator('#weightReadout')).toContainText('A 0.467');
    await expect(page.locator('#weightReadout')).toContainText('B 0.2');
    await expect(page.locator('#weightReadout')).toContainText('C 0.333');
    await expect(page.locator('[data-result-fixture="Spot 1"] .result-value')).toHaveText('Pan 86.53 / Tilt 102.6');
    await expect(page.locator('[data-result-fixture="Spot 2"] .result-value')).toHaveText('Pan 199.2 / Tilt 101.87');
  });

  test('flags targets outside the calibrated triangle', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#targetX').fill('6');
    await page.locator('#targetY').fill('3');

    await expect(page.locator('#insideReadout')).toHaveText('Inside plane: no');
    await expect(page.locator('[data-result-fixture="Spot 1"] .result-value')).toContainText('Pan');
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
    await expect(page.locator('[data-control-readout="Spot 1"]')).toHaveText('Live control Pan 32768 / Tilt 32768 / Dimmer 255');
    await expect(page.locator('[data-ptd-center]')).toHaveText('Center Pan/Tilt');
    await expect(page.locator('[data-ptd-relative-dir][data-ptd-axis="pan"]')).toHaveCount(4);
    await expect(page.locator('[data-ptd-relative-dir][data-ptd-axis="tilt"]')).toHaveCount(4);

    await page.locator('[data-ptd-dimmer]').fill('72');
    await expect(page.locator('[data-control-readout="Spot 1"]')).toHaveText('Live control Pan 32768 / Tilt 32768 / Dimmer 72');

    const pad = page.locator('[data-ptd-xy]');
    const box = await pad.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);

    await expect(page.locator('[data-control-readout="Spot 1"]')).toHaveText('Live control Pan 49151 / Tilt 49151 / Dimmer 72');

    await page.locator('.relative-control').filter({ hasText: 'Pan fine relative' }).locator('[data-ptd-relative-dir="1"]').click();
    await expect(page.locator('[data-control-readout="Spot 1"]')).toHaveText('Live control Pan 49152 / Tilt 49151 / Dimmer 72');

    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8, { steps: 8 });
    await page.mouse.up();

    await expect(page.locator('[data-control-readout="Spot 1"]')).toHaveText('Live control Pan 13107 / Tilt 13107 / Dimmer 72');
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
    await page.route('**/dmx/set/**', async route => {
      sent.push(route.request().url());
      await route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' });
    });
    await openDmxPage(page, 'dmx_room_plane.html');

    await page.locator('#loadPatchedFixtures').click();
    await expect(page.locator('[data-edit-fixture="0"]')).toBeVisible();
    await expect(page.locator('[data-result-fixture="Moving 1"]')).toBeVisible();

    await page.locator('[data-edit-fixture="0"]').click();
    const pad = page.locator('[data-ptd-xy]');
    const box = await pad.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);
    await expect(page.locator('[data-control-readout="Moving 1"]')).toHaveText('DMX output Pan 49151 / Tilt 49151 / Dimmer 255');

    await expect.poll(() => sent.length).toBeGreaterThanOrEqual(5);
    expect(sent.some(url => url.includes('/dmx/set/10/255'))).toBeTruthy();
    expect(sent.some(url => url.includes('/dmx/set/11/191'))).toBeTruthy();
    expect(sent.some(url => url.includes('/dmx/set/12/255'))).toBeTruthy();
    expect(sent.some(url => url.includes('/dmx/set/13/191'))).toBeTruthy();
    expect(sent.some(url => url.includes('/dmx/set/14/255'))).toBeTruthy();
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

    await expect(page.locator('[data-result-fixture="Saved Spot"]')).toBeVisible();
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
  });
});
