const { test, expect } = require('@playwright/test');
const {
  openDmxPage,
  routeControllerCompactServerSetup,
  injectControllerCompactSetup
} = require('./helpers/dmx-page');

test.describe('Fixture Controller established rules', () => {
  test.beforeEach(async ({ page }) => {
    await routeControllerCompactServerSetup(page);
    await openDmxPage(page, '');
    await injectControllerCompactSetup(page);
  });

  test('Find Pico is available on the Controller page and fills the Pico base URL', async ({ page }) => {
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

    await page.getByRole('button', { name: 'Find Pico' }).click();

    await expect(page.locator('#baseUrl')).toHaveValue('http://192.0.2.55/');
  });

  test('fixture card Default and Blackout buttons recall their values to DMX', async ({ page }) => {
    const urls = [];
    await page.route('http://127.0.0.1:18991/**', async route => {
      urls.push(route.request().url());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.evaluate(() => {
      const control = profiles.find(profile => profile.id === 1).controls.find(item => item.id === 11);
      control.defaultValue = 173;
      control.blackoutValue = 7;
      baseUrl.value = 'http://127.0.0.1:18991/';
      values['101:11'] = 44;
      drawSurface();
    });

    await page.locator('[data-fixture-card="101"] [data-recall-which="defaultValue"]').click();
    await expect.poll(() => urls).toContain('http://127.0.0.1:18991/chaser/stop');
    await expect.poll(() => urls).toContain('http://127.0.0.1:18991/motion/stop');
    await expect.poll(() => urls.some(url => url.startsWith('http://127.0.0.1:18991/dmx/set/1/173'))).toBe(true);
    await expect.poll(() => page.evaluate(() => values['101:11'])).toBe(173);
    const defaultDmxIndex = urls.findIndex(url => url.startsWith('http://127.0.0.1:18991/dmx/set/1/173'));
    expect(urls.indexOf('http://127.0.0.1:18991/chaser/stop')).toBeLessThan(defaultDmxIndex);
    expect(urls.indexOf('http://127.0.0.1:18991/motion/stop')).toBeLessThan(defaultDmxIndex);

    urls.length = 0;
    await page.locator('[data-fixture-card="101"] [data-recall-which="blackoutValue"]').click();
    await expect.poll(() => urls).toContain('http://127.0.0.1:18991/chaser/stop');
    await expect.poll(() => urls).toContain('http://127.0.0.1:18991/motion/stop');
    await expect.poll(() => urls.some(url => url.startsWith('http://127.0.0.1:18991/dmx/set/1/7'))).toBe(true);
    await expect.poll(() => page.evaluate(() => values['101:11'])).toBe(7);
  });

  test('Group Edit is available for controls shared by at least two selected fixtures', async ({ page }) => {
    const state = await page.evaluate(() => {
      selectedFixtureIds = new Set([101, 102, 103]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      drawSurface();
      return {
        controls: getGroupEditableControls().map(groupKey),
        groupBarButtonExists: !!document.getElementById('openGroupEdit'),
        toolboxDisabled: document.getElementById('editSelectedGroups').disabled
      };
    });

    expect(state.groupBarButtonExists).toBe(false);
    expect(state.toolboxDisabled).toBe(false);
    expect(state.controls).toContain('slider8:Dimmer');
    expect(state.controls).not.toContain('panTilt16:Pan/Tilt');
    expect(state.controls).not.toContain('wheel:Gobo');
  });

  test('Group Edit applies a mixed selection edit only to matching fixtures', async ({ page }) => {
    const result = await page.evaluate(() => {
      selectedFixtureIds = new Set([101, 102, 103]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      drawSurface();
      const beforeC = values['103:31'];
      const dimmer = getGroupEditableControls().find(c => groupKey(c) === 'slider8:Dimmer');
      setGroupValue(dimmer, 77);
      return {
        a: values['101:11'],
        b: values['102:21'],
        beforeC,
        afterC: values['103:31']
      };
    });

    expect(result.a).toBe(77);
    expect(result.b).toBe(77);
    expect(result.afterC).toBe(result.beforeC);
  });

  test('Group Edit can edit a single selected fixture', async ({ page }) => {
    await page.locator('[data-fixture-card="101"] .fixture-head').click();
    await expect(page.locator('#editSelectedGroups')).toBeEnabled();
    await page.locator('#editSelectedGroups').click();
    await expect(page.locator('#groupModal')).toBeVisible();
    await page.locator('#groupModalBody .control', { hasText: 'Dimmer' }).locator('input[type="range"]:not([data-byte-part])').fill('88');

    const state = await page.evaluate(() => ({
      selectedFixtures: [...selectedFixtureIds],
      value: values['101:11'],
      otherFixtureValue: values['102:21'],
      title: document.getElementById('groupModalTitle').textContent
    }));

    expect(state.selectedFixtures).toEqual([101]);
    expect(state.value).toBe(88);
    expect(state.otherFixtureValue).not.toBe(88);
    expect(state.title).toContain('1 fixture selected');
  });

  test('wheel controls expose direct DMX value inputs on Controller and Group Edit', async ({ page }) => {
    await page.evaluate(() => {
      values['103:31'] = 0;
      selectedFixtureIds = new Set([103]);
      activeSavedGroupIds.clear();
      drawSurface();
    });

    const controllerWheel = page.locator('[data-fixture-card="103"] .control', { hasText: 'Gobo' });
    await expect(controllerWheel.locator('input[type="number"][data-fixture="103"][data-control="31"]')).toHaveValue('0');
    await controllerWheel.locator('input[type="number"][data-fixture="103"][data-control="31"]').fill('77');
    await expect(controllerWheel.locator('[data-readout-fixture="103"][data-readout-control="31"]')).toContainText('77');

    await page.locator('#editSelectedGroups').click();
    await expect(page.locator('#groupModal')).toBeVisible();
    const groupWheel = page.locator('#groupModalBody .control', { hasText: 'Gobo' });
    await expect(groupWheel.locator('input[type="number"][data-gc]')).toHaveValue('77');
    await groupWheel.locator('input[type="number"][data-gc]').fill('88');

    const state = await page.evaluate(() => ({
      value: values['103:31'],
      groupReadout: document.querySelector('[data-gc-readout^="wheel:Gobo"]')?.textContent || ''
    }));

    expect(state.value).toBe(88);
    expect(state.groupReadout).toContain('88');
  });

  test('Controller can refresh live values changed by another page', async ({ page }) => {
    await page.route('**/fixture_setup.php**', async route => {
      if (route.request().url().includes('livevalues')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            exists: true,
            values: {
              '101:12': { pan: 2222, tilt: 3333 }
            }
          })
        });
        return;
      }
      await route.fallback();
    });

    const state = await page.evaluate(async () => {
      values['101:12'] = { pan: 1, tilt: 2 };
      drawSurface();
      await syncLiveValuesSnapshot({ redraw: true });
      return {
        value: values['101:12'],
        readout: document.querySelector('[data-readout-fixture="101"][data-readout-control="12"]')?.textContent || ''
      };
    });

    expect(state.value).toEqual({ pan: 2222, tilt: 3333 });
    expect(state.readout).toContain('Pan 2222');
    expect(state.readout).toContain('Tilt 3333');
  });

  test('single fixture controls can nudge values relative to the current value', async ({ page }) => {
    const state = await page.evaluate(() => {
      values['101:12'] = { pan: 1000, tilt: 2000 };
      drawSurface();
      const control = [...document.querySelectorAll('[data-fixture-card="101"] .control')]
        .find(el => el.textContent.includes('Pan/Tilt'));
      const panRows = [...control.querySelectorAll('.relative-control')]
        .filter(el => el.textContent.includes('Pan'));
      const tiltRows = [...control.querySelectorAll('.relative-control')]
        .filter(el => el.textContent.includes('Tilt'));
      panRows.find(el => el.textContent.includes('coarse')).querySelector('[data-relative-dir="1"]').click();
      panRows.find(el => el.textContent.includes('fine')).querySelector('[data-relative-dir="1"]').click();
      tiltRows.find(el => el.textContent.includes('fine')).querySelector('[data-relative-dir="-1"]').click();
      return {
        value: values['101:12'],
        readout: document.querySelector('[data-readout-fixture="101"][data-readout-control="12"]')?.textContent || ''
      };
    });

    expect(state.value).toEqual({ pan: 1257, tilt: 1999 });
    expect(state.readout).toContain('Pan 1257');
    expect(state.readout).toContain('Tilt 1999');
  });

  test('Pan/Tilt controls use XY pad and relative nudges without absolute sliders', async ({ page }) => {
    const state = await page.evaluate(() => {
      drawSurface();
      const control = [...document.querySelectorAll('[data-fixture-card="101"] .control')]
        .find(el => el.textContent.includes('Pan/Tilt'));
      return {
        hasXY: !!control.querySelector('[data-xy-fixture]'),
        axisSliders: control.querySelectorAll('input[data-axis], input[data-byte-axis]').length,
        relativeRows: [...control.querySelectorAll('.relative-control')]
          .map(el => el.querySelector('label')?.textContent.trim())
      };
    });

    expect(state.hasXY).toBe(true);
    expect(state.axisSliders).toBe(0);
    expect(state.relativeRows).toEqual([
      'Pan coarse relative',
      'Pan fine relative',
      'Tilt coarse relative',
      'Tilt fine relative'
    ]);
  });

  test('Pan/Tilt profile options are saved and shown on the profile card', async ({ page }) => {
    const state = await page.evaluate(() => {
      const profile = profiles.find(p => p.id === 1);
      const control = profile.controls.find(c => c.type === 'panTilt16');
      activeProfileId = profile.id;
      loadProfileEditor(profile);
      loadControlEditor(control);
      document.getElementById('panReverse').checked = true;
      document.getElementById('tiltReverse').checked = true;
      document.getElementById('panTiltSwap').checked = true;
      addControl();
      const saved = profile.controls.find(c => c.id === control.id);
      return {
        flags: {
          panReverse: saved.panReverse,
          tiltReverse: saved.tiltReverse,
          panTiltSwap: saved.panTiltSwap
        },
        cardText: document.querySelector(`[data-profile-card="${profile.id}"]`)?.textContent || ''
      };
    });

    expect(state.flags).toEqual({ panReverse: true, tiltReverse: true, panTiltSwap: true });
    expect(state.cardText).toContain('Pan reversed');
    expect(state.cardText).toContain('Tilt reversed');
    expect(state.cardText).toContain('axes swapped');
  });

  test('Pan/Tilt profile reverse and swap map logical values to physical DMX channels', async ({ page }) => {
    const state = await page.evaluate(() => {
      const fixture = fixtures.find(f => f.id === 101);
      const profile = fixtureProfile(fixture);
      const control = profile.controls.find(c => c.id === 12);
      Object.assign(control, {
        panReverse: true,
        tiltReverse: true,
        panTiltSwap: true
      });
      values['101:12'] = { pan: 0x1234, tilt: 0xabcd };
      return {
        rows: resolveDmxBytes(fixture, control)
          .filter(row => row.param.includes('Pan') || row.param.includes('Tilt'))
          .map(row => ({ ch: row.ch, val: row.val, param: row.param })),
        logicalFromDmx: DmxCommon.panTiltValueFromDmx(control, rel => ({
          2: 0x54,
          3: 0x32,
          4: 0xed,
          5: 0xcb
        })[rel])
      };
    });

    expect(state.rows).toEqual([
      { ch: 4, val: 0xed, param: 'Pan coarse -> Tilt reversed' },
      { ch: 5, val: 0xcb, param: 'Pan fine -> Tilt reversed' },
      { ch: 2, val: 0x54, param: 'Tilt coarse -> Pan reversed' },
      { ch: 3, val: 0x32, param: 'Tilt fine -> Pan reversed' }
    ]);
    expect(state.logicalFromDmx).toEqual({ pan: 0x1234, tilt: 0xabcd });
  });

  test('Update Library clears Pan/Tilt reverse and swap from exported fixture definitions', async ({ page }) => {
    const result = await page.evaluate(() => {
      const profile = {
        id: 9100,
        name: 'Mounted Head',
        mode: '16ch',
        channels: 16,
        controls: [{
          id: 9101,
          type: 'panTilt16',
          label: 'Pan/Tilt',
          pan: 1,
          panFine: 2,
          tilt: 3,
          tiltFine: 4,
          panReverse: true,
          tiltReverse: true,
          panTiltSwap: true
        }]
      };
      const exported = libraryProfileFromControllerProfile(profile);
      return {
        source: profile.controls[0],
        exported: exported.controls[0]
      };
    });

    expect(result.source).toMatchObject({ panReverse: true, tiltReverse: true, panTiltSwap: true });
    expect(result.exported).toMatchObject({ panReverse: false, tiltReverse: false, panTiltSwap: false });
  });

  test('saving Pan/Tilt reverse or swap immediately resends current fixture values', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const sent = [];
      sendChannel = async (ch, value) => sent.push({ ch, value });
      baseUrl.value = location.origin;
      const fixture = fixtures.find(f => f.id === 101);
      const profile = fixtureProfile(fixture);
      const control = profile.controls.find(c => c.id === 12);
      values['101:12'] = { pan: 0x1234, tilt: 0xabcd };
      activeProfileId = profile.id;
      loadProfileEditor(profile);
      loadControlEditor(control);
      document.getElementById('panReverse').checked = true;
      document.getElementById('tiltReverse').checked = true;
      document.getElementById('panTiltSwap').checked = true;
      addControl();
      await new Promise(resolve => setTimeout(resolve, 0));
      return {
        sent,
        saved: profile.controls.find(c => c.id === 12)
      };
    });

    expect(result.saved).toMatchObject({ panReverse: true, tiltReverse: true, panTiltSwap: true });
    expect(result.sent).toEqual([
      { ch: 4, value: 0xed },
      { ch: 5, value: 0xcb },
      { ch: 2, value: 0x54 },
      { ch: 3, value: 0x32 }
    ]);
  });

  test('16-bit slider controls expose coarse and fine relative nudges', async ({ page }) => {
    const state = await page.evaluate(() => {
      profiles.push({
        id: 7001,
        name: '16 Bit Dimmer',
        mode: '2ch',
        channels: 2,
        controls: [{ id: 7002, type: 'slider16', label: 'Dimmer 16', channel: 1, fine: 2 }]
      });
      fixtures.splice(0, fixtures.length, { id: 7003, name: '16 Bit Fixture', profileId: 7001, start: 1 });
      Object.keys(values).forEach(key => delete values[key]);
      values['7003:7002'] = 1000;
      selectedFixtureIds = new Set();
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      drawSurface();
      const control = document.querySelector('[data-fixture-card="7003"] .control');
      const coarse = [...control.querySelectorAll('.relative-control')].find(el => el.textContent.includes('Coarse'));
      const fine = [...control.querySelectorAll('.relative-control')].find(el => el.textContent.includes('Fine'));
      coarse.querySelector('[data-relative-dir="1"]').click();
      fine.querySelector('[data-relative-dir="-1"]').click();
      return {
        value: values['7003:7002'],
        readout: document.querySelector('[data-readout-fixture="7003"][data-readout-control="7002"]')?.textContent || '',
        coarseStep: coarse.querySelector('[data-relative-step]').value,
        fineStep: fine.querySelector('[data-relative-step]').value
      };
    });

    expect(state.value).toBe(1255);
    expect(state.readout).toBe('1255');
    expect(state.coarseStep).toBe('256');
    expect(state.fineStep).toBe('1');
  });

  test('16-bit fine relative nudges borrow and carry across coarse bytes with edge clamps', async ({ page }) => {
    const state = await page.evaluate(() => {
      values['101:12'] = { pan: 256, tilt: 255 };
      drawSurface();
      const control = [...document.querySelectorAll('[data-fixture-card="101"] .control')]
        .find(el => el.textContent.includes('Pan/Tilt'));
      const row = label => [...control.querySelectorAll('.relative-control')]
        .find(el => el.textContent.includes(label));
      row('Pan fine').querySelector('[data-relative-dir="-1"]').click();
      const afterBorrow = {
        value: { ...values['101:12'] },
        panBytes: bytes16(values['101:12'].pan)
      };
      row('Tilt fine').querySelector('[data-relative-dir="1"]').click();
      const afterCarry = {
        value: { ...values['101:12'] },
        tiltBytes: bytes16(values['101:12'].tilt)
      };
      values['101:12'] = { pan: 0, tilt: 65535 };
      updateControlDisplay(fixtures.find(f => f.id === 101), fixtureProfile(fixtures.find(f => f.id === 101)).controls.find(c => c.id === 12));
      row('Pan fine').querySelector('[data-relative-dir="-1"]').click();
      row('Tilt fine').querySelector('[data-relative-dir="1"]').click();
      return {
        afterBorrow,
        afterCarry,
        edge: values['101:12']
      };
    });

    expect(state.afterBorrow.value.pan).toBe(255);
    expect(state.afterBorrow.panBytes).toEqual({ coarse: 0, fine: 255 });
    expect(state.afterCarry.value.tilt).toBe(256);
    expect(state.afterCarry.tiltBytes).toEqual({ coarse: 1, fine: 0 });
    expect(state.edge).toEqual({ pan: 0, tilt: 65535 });
  });

  test('Group Edit relative nudge keeps each fixture relative to its own current value', async ({ page }) => {
    await page.evaluate(() => {
      values['101:11'] = 10;
      values['102:21'] = 80;
      selectedFixtureIds = new Set([101, 102]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      drawSurface();
    });

    await page.locator('#editSelectedGroups').click();
    await expect(page.locator('#groupModal')).toBeVisible();
    const dimmer = page.locator('#groupModalBody .control', { hasText: 'Dimmer' });
    await dimmer.locator('[data-relative-step]').fill('5');
    await dimmer.locator('[data-relative-dir="1"]').click();

    const state = await page.evaluate(() => ({
      a: values['101:11'],
      b: values['102:21'],
      modalReadout: document.querySelector('#groupModalBody [data-gc-readout]')?.textContent || ''
    }));

    expect(state.a).toBe(15);
    expect(state.b).toBe(85);
    expect(state.modalReadout).toBe('15');
  });

  test('Group Edit remembers relative step sizes and autosaves them to the server', async ({ page }) => {
    const posts = [];
    await page.route('**/ui_state.php', async route => {
      if (route.request().method() === 'POST') {
        posts.push(route.request().postDataJSON());
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      await route.fallback();
    });

    await page.evaluate(() => {
      selectedFixtureIds = new Set([101]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      drawSurface();
      openGroupModal();
    });

    const panFine = page.locator('#groupModalBody .relative-control', { hasText: 'Pan fine relative' }).locator('[data-relative-step]');
    await panFine.fill('7');

    await expect.poll(() => posts, { timeout: 5000 }).toContainEqual(expect.objectContaining({
      page: 'fixture',
      state: expect.objectContaining({
        groupEditRelativeSteps: expect.objectContaining({
          'panTilt16:Pan/Tilt|pan|fine': 7
        })
      })
    }));

    await page.locator('#closeGroupModal').click();
    await page.evaluate(() => openGroupModal());
    await expect(page.locator('#groupModalBody .relative-control', { hasText: 'Pan fine relative' }).locator('[data-relative-step]')).toHaveValue('7');
  });

  test('saved group first fixture becomes Controller Group Edit source', async ({ page }) => {
    await page.evaluate(() => {
      savedGroups = [{ id: 'grp_reverse', name: 'Reverse Pair', fixtureIds: [102, 101], values: {} }];
      values['101:11'] = 11;
      values['102:21'] = 88;
      activeSavedGroupIds.clear();
      renderSavedGroupsList();
      drawSurface();
    });

    await page.locator('[data-group-index="0"]').click();
    await expect(page.locator('[data-fixture-card="102"]')).toHaveClass(/source-fixture/);
    await expect(page.locator('[data-fixture-card="102"] h2')).toContainText('Source');

    await page.locator('#editSelectedGroups').click();
    await expect(page.locator('#groupModal')).toBeVisible();

    const initial = await page.evaluate(() => ({
      sourceFixtureId,
      selectedFixtures: [...selectedFixtureIds],
      modalValue: document.querySelector('#groupModalBody [data-gc-readout]')?.textContent
    }));

    expect(initial.sourceFixtureId).toBe('102');
    expect(initial.selectedFixtures).toEqual([102, 101]);
    expect(initial.modalValue).toBe('88');
    await expect(page.locator('#groupModal')).not.toContainText('Apply source');

    await page.locator('#groupModalBody .control', { hasText: 'Dimmer' }).locator('input[type="range"]:not([data-byte-part])').fill('89');
    const after = await page.evaluate(() => ({
      a: values['101:11'],
      b: values['102:21']
    }));

    expect(after.a).toBe(89);
    expect(after.b).toBe(89);
  });

  test('saved plane recall opens a room preview, recalls its fixture selection, and applies live output', async ({ page }) => {
    const dmxBatches = [];
    const roomPlaneWrites = [];
    await page.route('**/dmx/b', async route => {
      dmxBatches.push(route.request().postData() || '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.unroute('**/room_plane_setup.php**');
    await page.route('**/room_plane_setup.php**', async route => {
      if (route.request().method() !== 'GET') {
        roomPlaneWrites.push(route.request().postDataJSON());
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, planes: [], planeCols: 3, planeRows: 3 })
      });
    });

    await page.evaluate(() => {
      baseUrl.value = location.origin;
      savedGroups = [{ id: 'grp_plane', name: 'Plane Movers', fixtureIds: [101], values: {} }];
      activeSavedGroupIds.clear();
      renderSavedGroupsList();
      controllerPlanes = [normalizeControllerPlane({
        id: 'plane_front',
        name: 'Front Plane',
        view: { auto: false, centerX: 5, centerY: 5, zoom: 2 },
        points: [
          { id: 'A', x: 0, y: 0, z: 0 },
          { id: 'B', x: 10, y: 0, z: 0 },
          { id: 'C', x: 0, y: 10, z: 0 }
        ],
        target: { x: 5, y: 0, z: 0 },
        fixtures: [
          {
            id: 101,
            name: 'A 1',
            x: 1,
            y: 1,
            z: 3,
            cal: {
              A: { pan: 1000, tilt: 2000, calibrated: true },
              B: { pan: 3000, tilt: 4000, calibrated: true },
              C: { pan: 5000, tilt: 6000, calibrated: true }
            }
          },
          {
            id: 102,
            name: 'B 1',
            x: 2,
            y: 1,
            z: 3,
            cal: {
              A: { pan: 10, tilt: 20, calibrated: true },
              B: { pan: 30, tilt: 40, calibrated: true },
              C: { pan: 50, tilt: 60, calibrated: true }
            }
          }
        ],
        visual: { type: 'visual', color: '#225a50', image: '' }
      }, 0)];
      renderControllerPlanes();
      drawSurface();
    });

    await page.locator('[data-group-index="0"]').click();
    await page.locator('[data-controller-plane="plane_front"]').click();

    await expect(page.locator('#controllerPlaneModal')).toBeVisible();
    await expect(page.locator('#controllerPlaneModal')).toHaveClass(/section-control-modal/);
    await expect(page.locator('#controllerPlaneModal .modal-body').first()).toHaveCSS('overflow-y', 'auto');
    await expect(page.locator('#controllerPlaneTitle')).toContainText('Front Plane');
    await expect(page.locator('#controllerPlaneSummary')).toContainText('selected 2 fixtures');
    await expect(page.locator('.controller-plane-fixture-row.selected')).toHaveCount(2);
    await expect.poll(() => page.evaluate(() => values['101:12'])).toEqual({ pan: 2000, tilt: 3000 });
    await expect.poll(() => dmxBatches.length).toBeGreaterThan(0);
    const planePadBox = await page.locator('#controllerPlanePad').boundingBox();
    const nudgeBox = await page.locator('.controller-plane-nudge').boundingBox();
    expect(planePadBox).toBeTruthy();
    expect(nudgeBox).toBeTruthy();
    expect(nudgeBox.y).toBeGreaterThan(planePadBox.y + planePadBox.height - 2);
    await expect.poll(() => page.locator('.controller-plane-fixture-row').first().evaluate(el => getComputedStyle(el).display)).toBe('grid');
    const nudgeItems = await page.locator('#controllerPlaneNudgeControls .relative-control').evaluateAll(items => items.map(item => {
      const rect = item.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    }));
    expect(nudgeItems).toHaveLength(4);
    expect(Math.abs(nudgeItems[0].y - nudgeItems[1].y)).toBeLessThan(4);
    expect(nudgeItems[2].y).toBeGreaterThan(nudgeItems[0].y + 10);
    expect(Math.abs(nudgeItems[2].y - nudgeItems[3].y)).toBeLessThan(4);
    const nudgeColumns = await page.locator('#controllerPlaneNudgeControls .relative-control').first().evaluate(el => getComputedStyle(el).gridTemplateColumns);
    expect(nudgeColumns).toMatch(/100px/);
    await expect(page.locator('#controllerPlaneApply')).toHaveCount(0);
    await expect(page.locator('#controllerPlaneZoomIn')).toBeVisible();
    await expect(page.locator('#controllerPlaneZoomOut')).toBeVisible();
    await expect(page.locator('#controllerPlaneResetView')).toBeVisible();
    await expect(page.locator('#controllerPlanePanView')).toBeVisible();
    await expect(page.locator('#controllerPlanePanView')).toHaveText('Pan view');
    await expect(page.locator('#controllerPlanePanView')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('#controllerPlaneZoomIn').click();
    await expect.poll(() => page.evaluate(() => controllerPlaneView.zoom)).toBeGreaterThan(2);
    await expect.poll(() => roomPlaneWrites.length).toBeGreaterThan(0);
    const savedPlane = roomPlaneWrites.at(-1).planes.find(plane => plane.id === 'plane_front');
    expect(savedPlane.view).toMatchObject({ auto: false, centerX: 5, centerY: 5 });
    expect(savedPlane.view.zoom).toBeGreaterThan(2);
    await page.locator('#controllerPlaneResetView').click();
    await expect.poll(() => page.evaluate(() => controllerPlaneView.auto && controllerPlaneView.zoom)).toBe(1);
    await page.locator('#controllerPlanePanView').click();
    await expect(page.locator('#controllerPlanePanView')).toHaveText('Stop pan view');
    await expect(page.locator('#controllerPlanePanView')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#controllerPlanePanView')).toHaveClass(/active/);
    await expect(page.locator('#controllerPlanePanView')).toHaveCSS('background-color', 'rgb(16, 59, 48)');
    await expect(page.locator('#controllerPlanePanView')).toHaveCSS('border-color', 'rgb(47, 158, 125)');
    await expect(page.locator('#controllerPlanePanView')).toHaveCSS('font-weight', '700');
    await expect(page.locator('#controllerPlanePad')).toHaveClass(/pan-mode/);
    await page.locator('#controllerPlanePanView').click();
    await expect(page.locator('#controllerPlanePanView')).toHaveText('Pan view');
    await expect(page.locator('#controllerPlanePanView')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#controllerPlanePanView')).not.toHaveClass(/active/);
    await expect(page.locator('#controllerPlanePad')).not.toHaveClass(/pan-mode/);

    const target = page.locator('#controllerPlaneTarget');
    const box = await target.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 - 20, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator('#controllerPlaneSummary')).not.toContainText('Target X 5 / Y 0');
    await page.evaluate(() => {
      activeControllerPlane.target = { x: 5, y: 0, z: 0 };
      renderControllerPlaneModal();
    });

    await page.locator('#controllerPlaneStepXCoarse').fill('1');
    await page.locator('[data-controller-plane-nudge-axis="x"][data-controller-plane-nudge-dir="1"][data-controller-plane-nudge-step="coarse"]').click();
    await expect(page.locator('#controllerPlaneSummary')).toContainText('Target X 6');
    await expect.poll(() => dmxBatches.length).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => values['101:12'])).toEqual({ pan: 2200, tilt: 3200 });

    const result = await page.evaluate(() => ({
      value: values['101:12'],
      selected: [...selectedFixtureIds],
      selectedGroups: [...activeSavedGroupIds]
    }));
    expect(result.value).toEqual({ pan: 2200, tilt: 3200 });
    expect(result.selected).toEqual([101, 102]);
    expect(result.selectedGroups).toEqual([]);
    expect(dmxBatches.at(-1)).toContain('2:8');
    expect(dmxBatches.at(-1)).toContain('3:152');
    expect(dmxBatches.at(-1)).toContain('4:12');
    expect(dmxBatches.at(-1)).toContain('5:128');
    await expect(page.locator('#status')).toContainText('Plane live Front Plane -> 1 fixture');
  });

  test('Controller Planes toolbox exposes layout controls and moves tiles by slot', async ({ page }) => {
    const roomPlaneWrites = [];
    await page.unroute('**/room_plane_setup.php**');
    await page.route('**/room_plane_setup.php**', async route => {
      if (route.request().method() !== 'GET') {
        roomPlaneWrites.push(route.request().postDataJSON());
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, planes: [], planeCols: 2, planeRows: 2 })
      });
    });

    await page.evaluate(() => {
      controllerPlanes = [
        normalizeControllerPlane({
          id: 'plane_a',
          name: 'Plane A',
          slot: 0,
          visual: { type: 'visual', color: '#225a50', image: '' },
          fixtures: []
        }, 0),
        normalizeControllerPlane({
          id: 'plane_b',
          name: 'Plane B',
          slot: 1,
          visual: { type: 'visual', color: '#225a50', image: '' },
          fixtures: []
        }, 1)
      ];
      controllerPlaneCols = 2;
      controllerPlaneRows = 2;
      renderControllerPlanes();
    });

    await page.locator('.toolbox-rail-edit').click();
    await expect(page.locator('#controllerPlaneCols')).toBeVisible();
    await expect(page.locator('#controllerPlaneRows')).toBeVisible();
    await expect(page.locator('#moveControllerPlanesBtn')).toBeHidden();
    await expect(page.locator('#moveControllerPlanesBtn')).toHaveClass(/active/);
    await expect(page.locator('[data-controller-plane-slot="0"]')).toContainText('Plane A');
    await expect(page.locator('[data-controller-plane-slot="1"]')).toContainText('Plane B');
    await expect(page.locator('[data-controller-plane-slot="2"]')).toContainText('3');

    await page.locator('#controllerPlaneRows').selectOption('3');
    await expect.poll(() => roomPlaneWrites.at(-1)?.planeRows).toBe(3);

    await page.locator('[data-controller-plane-slot="0"]').click();
    await page.locator('[data-controller-plane-slot="3"]').click();
    await expect.poll(() => page.evaluate(() => controllerPlanes.find(plane => plane.id === 'plane_a').slot)).toBe(3);
    await expect(page.locator('[data-controller-plane-slot="0"]')).toContainText('1');
    await expect(page.locator('[data-controller-plane-slot="3"]')).toContainText('Plane A');
    await expect.poll(() => roomPlaneWrites.at(-1)?.planes.find(plane => plane.id === 'plane_a')?.slot).toBe(3);

    await page.locator('[data-controller-plane-slot="3"]').click();
    await page.locator('[data-controller-plane-slot="1"]').click();
    const slots = await page.evaluate(() => Object.fromEntries(controllerPlanes.map(plane => [plane.id, plane.slot])));
    expect(slots).toEqual({ plane_a: 1, plane_b: 3 });
    await expect(page.locator('[data-controller-plane-slot="1"]')).toContainText('Plane A');
    await expect(page.locator('[data-controller-plane-slot="3"]')).toContainText('Plane B');
  });

  test('saved group tiles use corner edit tile and delete actions without toggling selection', async ({ page }) => {
    await page.evaluate(() => {
      savedGroups = [{ id: 'grp_test', name: 'Front Wash', fixtureIds: [101, 102], values: {} }];
      activeSavedGroupIds.clear();
      renderSavedGroupsList();
      drawSurface();
    });

    await expect(page.locator('[data-edit-group="0"]')).toBeVisible();
    await expect(page.locator('[data-delete-group="0"]')).toBeVisible();
    await expect(page.locator('#renameSelectedGroup')).toHaveCount(0);
    await expect(page.locator('#deleteSelectedGroups')).toHaveCount(0);

    await page.locator('[data-edit-group="0"]').click();
    await expect(page.locator('#paletteVisualModal')).toBeVisible();
    await page.locator('#paletteVisualName').fill('Renamed Wash');
    await page.locator('#paletteVisualColor').fill('#115577');
    await page.locator('#paletteVisualSave').click();
    await expect(page.locator('#paletteVisualModal')).toBeHidden();

    let state = await page.evaluate(() => ({
      name: savedGroups[0].name,
      visual: savedGroups[0].visual,
      tileStyle: {
        background: getComputedStyle(document.querySelector('[data-group-index="0"]')).backgroundColor,
        borderColor: getComputedStyle(document.querySelector('[data-group-index="0"]')).borderColor
      },
      selectedGroups: selectedSavedGroups().length
    }));
    expect(state.name).toBe('Renamed Wash');
    expect(state.visual).toEqual(expect.objectContaining({ type: 'visual', color: '#115577' }));
    expect(state.tileStyle.background).toBe('rgb(17, 85, 119)');
    expect(state.tileStyle.borderColor).toBe('rgb(17, 85, 119)');
    expect(state.selectedGroups).toBe(0);

    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await page.locator('[data-delete-group="0"]').click();

    state = await page.evaluate(() => ({
      count: savedGroups.length,
      selectedGroups: selectedSavedGroups().length
    }));
    expect(state).toEqual({ count: 0, selectedGroups: 0 });
  });

  test('Groups toolbox places layout controls below the full-width edit button', async ({ page }) => {
    await page.evaluate(() => {
      savedGroups = [{ id: 'grp_test', name: 'Front Wash', fixtureIds: [101, 102], values: {} }];
      renderSavedGroupsList();
    });

    await page.locator('.toolbox-rail-edit').click();

    const layout = await page.evaluate(() => {
      const toolbar = document.querySelector('#groupsBox .groups-toolbar').getBoundingClientRect();
      const button = document.getElementById('editSelectedGroups').getBoundingClientRect();
      const controls = document.querySelector('#groupsBox .groups-layout-controls').getBoundingClientRect();
      return {
        toolbarWidth: Math.round(toolbar.width),
        buttonWidth: Math.round(button.width),
        buttonLeft: Math.round(button.left),
        toolbarLeft: Math.round(toolbar.left),
        controlsTop: Math.round(controls.top),
        buttonBottom: Math.round(button.bottom),
        controlsLeft: Math.round(controls.left)
      };
    });

    expect(layout.buttonLeft).toBe(layout.toolbarLeft);
    expect(layout.buttonWidth).toBeCloseTo(layout.toolbarWidth, 1);
    expect(layout.controlsTop).toBeGreaterThanOrEqual(layout.buttonBottom);
    expect(layout.controlsLeft).toBe(layout.toolbarLeft);
  });

  test('Control Surface group actions align left below the selection summary', async ({ page }) => {
    await page.evaluate(() => {
      selectedFixtureIds = new Set([101, 102]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      activeFixtureFilterIds.clear();
      drawSurface();
    });

    const layout = await page.evaluate(() => {
      const summary = document.querySelector('#groupBar .group-bar-summary').getBoundingClientRect();
      const actions = document.querySelector('#groupBar .group-bar-actions').getBoundingClientRect();
      const save = document.getElementById('saveGroupBtn').getBoundingClientRect();
      return {
        summaryLeft: Math.round(summary.left),
        summaryBottom: Math.round(summary.bottom),
        actionsLeft: Math.round(actions.left),
        actionsTop: Math.round(actions.top),
        saveLeft: Math.round(save.left)
      };
    });

    expect(layout.actionsTop).toBeGreaterThanOrEqual(layout.summaryBottom);
    expect(layout.actionsLeft).toBe(layout.summaryLeft);
    expect(layout.saveLeft).toBe(layout.summaryLeft);
  });

  test('Show card contains all fixture setup cards and preserves their individual collapse state', async ({ page }) => {
    const showCard = page.locator('main > section.setup-files-card');
    await expect(showCard.locator(':scope > div').first().locator('h2')).toHaveText('Show');
    await expect(page.locator('main > section.panel').first()).toHaveClass(/setup-files-card/);
    await expect(showCard.locator('#fixtureLibraryPanel')).toHaveCount(1);
    await expect(showCard.locator('#profilesSection')).toHaveCount(1);
    await expect(showCard.locator('#patchSection')).toHaveCount(1);
    await expect(page.locator('main > #fixtureLibraryPanel, main > #profilesSection, main > #patchSection')).toHaveCount(0);

    await page.evaluate(() => {
      setSectionCollapsed('fixtureLibraryCollapseBtn', 'fixtureLibraryBody', 'fixtureLibraryCollapsed', false);
      setSectionCollapsed('profilesCollapseBtn', 'profilesBody', 'profilesCollapsed', false);
      setSectionCollapsed('patchCollapseBtn', 'patchBody', 'patchCollapsed', false);
    });
    await expect(page.locator('#newShow')).toBeVisible();
    await expect(page.locator('#exportJson')).toBeVisible();
    await expect(page.locator('#fixtureLibraryBody')).toBeVisible();
    await expect(page.locator('#profilesBody')).toBeVisible();
    await expect(page.locator('#patchBody')).toBeVisible();

    await page.locator('#profilesCollapseBtn').click();
    await expect(page.locator('#profilesBody')).toBeHidden();

    await page.locator('#showCollapseBtn').click();
    await expect(page.locator('#showBody')).toBeHidden();
    await expect(page.locator('#showCollapseBtn')).toHaveText('+');
    await expect(page.locator('#newShow')).toBeHidden();
    await expect(page.locator('#fixtureLibraryPanel')).toBeHidden();
    await expect(page.locator('#profilesSection')).toBeHidden();
    await expect(page.locator('#patchSection')).toBeHidden();

    await page.locator('#showCollapseBtn').click();
    await expect(page.locator('#showBody')).toBeVisible();
    await expect(page.locator('#showCollapseBtn')).toHaveText('−');
    await expect(page.locator('#fixtureLibraryBody')).toBeVisible();
    await expect(page.locator('#profilesBody')).toBeHidden();
    await expect(page.locator('#patchBody')).toBeVisible();
  });

  test('scene saves are serialized so deleting a scene removes its visual from the server payload', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      const calls = [];
      const resolvers = [];
      window.fetch = (_url, options = {}) => new Promise(resolve => {
        calls.push(JSON.parse(options.body || '{}'));
        resolvers.push(resolve);
      });
      const okResponse = () => ({ json: () => Promise.resolve({ ok: true }) });

      try {
        sceneSaveQueue = Promise.resolve();
        scenes = [{
          id: 'scene_test',
          name: 'Scene Test',
          slot: 0,
          values: {},
          visual: { type: 'visual', color: '#123456', image: 'data:image/png;base64,OLD' }
        }];
        const firstSave = saveScenesServer();
        scenes = [];
        const deleteSave = saveScenesServer();
        for (let i = 0; i < 10 && calls.length < 1; i++) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        const beforeFirstResolves = calls.length;
        resolvers[0](okResponse());
        await firstSave;
        await new Promise(resolve => setTimeout(resolve, 0));
        const afterFirstResolves = calls.length;
        resolvers[1](okResponse());
        await deleteSave;

        return {
          beforeFirstResolves,
          afterFirstResolves,
          firstSceneCount: calls[0].scenes.length,
          deleteSceneCount: calls[1].scenes.length,
          deletePayloadHasImage: JSON.stringify(calls[1]).includes('data:image')
        };
      } finally {
        window.fetch = originalFetch;
      }
    });

    expect(result.beforeFirstResolves).toBe(1);
    expect(result.afterFirstResolves).toBe(2);
    expect(result.firstSceneCount).toBe(1);
    expect(result.deleteSceneCount).toBe(0);
    expect(result.deletePayloadHasImage).toBe(false);
  });

  test('saving a scene never copies the default scene icon into the scene tile', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      window.fetch = (_url, _options = {}) => Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
      try {
        sceneSaveQueue = Promise.resolve();
        scenes = [];
        selectedFixtureIds = new Set([101]);
        activeSavedGroupIds.clear();
        sceneFixtureFilterActive = false;
        activeControlScopeKeys.clear();
        fanAffectedKeys.clear();
        sceneVisualDefault = {
          type: 'visual',
          color: '#654321',
          image: 'data:image/png;base64,SHOULD_NOT_COPY'
        };

        saveSceneToSlot(0, 'No Icon Scene');
        await sceneSaveQueue;

        return {
          visual: scenes[0].visual,
          renderedIcon: !!document.querySelector('#slotMatrix .slot .palette-visual')
        };
      } finally {
        window.fetch = originalFetch;
      }
    });

    expect(result.visual).toEqual({ type: 'visual', color: '#654321', image: '' });
    expect(result.renderedIcon).toBe(false);
  });

  test('gobo palettes automatically use the shared selected gobo visual', async ({ page }) => {
    const result = await page.evaluate(() => {
      const goboImage = 'data:image/png;base64,GOBO_SHARED';
      profiles = [{
        id: 9100,
        name: 'Gobo profile',
        mode: 'test',
        channels: 1,
        controls: [{
          id: 9101,
          type: 'wheel',
          label: 'Gobo Wheel',
          channel: 1,
          options: [
            { name: 'Open', value: 0, range: [0, 15], kind: 'WheelSlot', slotNumber: 1 },
            { name: 'Breakup', value: 24, range: [16, 31], kind: 'WheelSlot', slotNumber: 2, image: goboImage, color: '#334455' }
          ]
        }]
      }];
      fixtures = [
        { id: 9102, name: 'Spot 1', profileId: 9100, start: 1 },
        { id: 9103, name: 'Spot 2', profileId: 9100, start: 11 }
      ];
      Object.keys(values).forEach(key => delete values[key]);
      values['9102:9101'] = 24;
      values['9103:9101'] = 24;
      palettes = [];
      selectedFixtureIds = new Set([9102, 9103]);
      sourceFixtureId = '9102';
      document.getElementById('paletteScope').value = 'gobo';
      savePaletteToSlot(0, 'Breakup');
      return {
        visual: palettes[0].visual,
        hasRenderedIcon: !!document.querySelector('#paletteMatrix .palette-visual')
      };
    });

    expect(result.visual).toEqual({ type: 'visual', color: '#334455', image: 'data:image/png;base64,GOBO_SHARED' });
    expect(result.hasRenderedIcon).toBe(true);
  });

  test('gobo palettes use the source fixture visual when selected gobos differ', async ({ page }) => {
    const result = await page.evaluate(() => {
      profiles = [{
        id: 9200,
        name: 'Gobo profile',
        mode: 'test',
        channels: 1,
        controls: [{
          id: 9201,
          type: 'wheel',
          label: 'Gobo Wheel',
          channel: 1,
          options: [
            { name: 'Open', value: 0, range: [0, 15], kind: 'WheelSlot', slotNumber: 1 },
            { name: 'Dots', value: 24, range: [16, 31], kind: 'WheelSlot', slotNumber: 2, image: 'data:image/png;base64,GOBO_DOTS', color: '#112233' },
            { name: 'Cone', value: 40, range: [32, 47], kind: 'WheelSlot', slotNumber: 3, image: 'data:image/png;base64,GOBO_CONE', color: '#445566' }
          ]
        }]
      }];
      fixtures = [
        { id: 9202, name: 'Spot 1', profileId: 9200, start: 1 },
        { id: 9203, name: 'Spot 2', profileId: 9200, start: 11 }
      ];
      Object.keys(values).forEach(key => delete values[key]);
      values['9202:9201'] = 24;
      values['9203:9201'] = 40;
      palettes = [];
      selectedFixtureIds = new Set([9202, 9203]);
      sourceFixtureId = '9203';
      document.getElementById('paletteScope').value = 'gobo';
      savePaletteToSlot(1, 'Source Gobo');
      return palettes[0].visual;
    });

    expect(result).toEqual({ type: 'visual', color: '#445566', image: 'data:image/png;base64,GOBO_CONE' });
  });

  test('Group Edit syncs mixed fixture controls from fixtures that actually own the control', async ({ page }) => {
    const result = await page.evaluate(() => {
      fixtures.push({ id: 104, name: 'B 2', profileId: 2, start: 61 });
      selectedFixtureIds = new Set([101, 102, 104]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      Object.keys(groupValues).forEach(key => delete groupValues[key]);

      values['102:22'] = { a: 12, b: 34, c: 56 };
      values['104:22'] = { a: 1, b: 2, c: 3 };

      const controls = getGroupEditableControls();
      syncGroupValuesFromFirstSelected(controls);
      const color = controls.find(c => groupKey(c) === 'rgb:Color');
      const seededColor = JSON.parse(JSON.stringify(groupValues['rgb:Color']));
      setGroupValue(color, { a: 90, b: 80, c: 70 });

      return {
        controls: controls.map(groupKey),
        seededColor,
        b1Color: values['102:22'],
        b2Color: values['104:22'],
        bogusAColor: Object.prototype.hasOwnProperty.call(values, '101:22')
      };
    });

    expect(result.controls).toEqual(expect.arrayContaining(['slider8:Dimmer', 'rgb:Color']));
    expect(result.seededColor).toEqual({ a: 12, b: 34, c: 56 });
    expect(result.b1Color).toEqual({ a: 90, b: 80, c: 70 });
    expect(result.b2Color).toEqual({ a: 90, b: 80, c: 70 });
    expect(result.bogusAColor).toBe(false);
  });

  test('Select All keeps same-named wheel controls separate when fixture types use different options', async ({ page }) => {
    await page.evaluate(() => {
      profiles = [
        {
          id: 1,
          name: 'Profile A',
          mode: 'test',
          channels: 4,
          controls: [
            { id: 11, type: 'slider8', label: 'Dimmer', channel: 1 },
            { id: 12, type: 'wheel', label: 'Gobo', channel: 2, options: [{ name: 'Open', value: 0 }, { name: 'Dots', value: 40 }] }
          ]
        },
        {
          id: 2,
          name: 'Profile B',
          mode: 'test',
          channels: 4,
          controls: [
            { id: 21, type: 'slider8', label: 'Dimmer', channel: 1 },
            { id: 22, type: 'wheel', label: 'Gobo', channel: 2, options: [{ name: 'Open', value: 0 }, { name: 'Split', value: 80 }] }
          ]
        }
      ];
      fixtures = [
        { id: 101, name: 'A 1', profileId: 1, start: 1 },
        { id: 102, name: 'A 2', profileId: 1, start: 11 },
        { id: 103, name: 'B 1', profileId: 2, start: 21 },
        { id: 104, name: 'B 2', profileId: 2, start: 31 }
      ];
      Object.keys(values).forEach(key => delete values[key]);
      selectedFixtureIds = new Set();
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      drawSurface();
    });

    await page.locator('#selectAllFixtures').click();
    await page.locator('#editSelectedGroups').click();

    const state = await page.evaluate(() => ({
      keys: getGroupEditableControls().map(groupKey),
      modalControls: [...document.querySelectorAll('#groupModalBody .control')].map(control => ({
        title: control.querySelector('h3')?.textContent,
        scope: [...control.querySelectorAll('.bytes')].map(el => el.textContent).join(' | '),
        options: [...control.querySelectorAll('[data-gc-wheel]')].map(btn => btn.textContent)
      }))
    }));

    const goboKeys = state.keys.filter(key => key.startsWith('wheel:Gobo'));
    const goboControls = state.modalControls.filter(control => control.title === 'Gobo');
    expect(goboKeys).toHaveLength(2);
    expect(goboControls).toHaveLength(2);
    expect(goboControls.some(control => control.options.includes('Dots'))).toBe(true);
    expect(goboControls.some(control => control.options.includes('Split'))).toBe(true);
    expect(goboControls.every(control => control.scope.includes('2 matching fixtures'))).toBe(true);
  });

  test('Group Edit modal fits controls horizontally and only scrolls vertically', async ({ page }) => {
    const layout = await page.evaluate(() => {
      const profileA = profiles.find(p => p.id === 1);
      const profileB = profiles.find(p => p.id === 2);
      const wheelOptions = Array.from({ length: 18 }, (_, i) => ({
        name: 'Long wheel option ' + (i + 1),
        value: i * 10
      }));
      for (let i = 0; i < 48; i++) {
        profileA.controls.push({ id: 1000 + i, type: 'slider8', label: 'Shared Control ' + i, channel: 1 });
        profileB.controls.push({ id: 2000 + i, type: 'slider8', label: 'Shared Control ' + i, channel: 1 });
      }
      profileA.controls.push({ id: 3000, type: 'wheel', label: 'Long Wheel', channel: 1, options: wheelOptions });
      profileB.controls.push({ id: 4000, type: 'wheel', label: 'Long Wheel', channel: 1, options: wheelOptions });
      selectedFixtureIds = new Set([101, 102]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      openGroupModal();

      const body = document.getElementById('groupModalBody');
      const style = getComputedStyle(body);
      return {
        defaultLabel: document.getElementById('defaultGroupBtn')?.textContent,
        blackoutLabel: document.getElementById('blackoutGroupBtn')?.textContent,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        clientWidth: body.clientWidth,
        scrollWidth: body.scrollWidth,
        clientHeight: body.clientHeight,
        scrollHeight: body.scrollHeight,
        wheelTabsHeight: document.querySelector('#groupModalBody [data-gc-wheel]')?.closest('.tabs')?.getBoundingClientRect().height || 0,
        wheelControlHeight: document.querySelector('#groupModalBody [data-gc-wheel]')?.closest('.control')?.getBoundingClientRect().height || 0
      };
    });

    expect(layout.defaultLabel).toBe('Default');
    expect(layout.blackoutLabel).toBe('Blackout');
    expect(layout.overflowX).toBe('hidden');
    expect(layout.overflowY).toBe('auto');
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
    expect(layout.wheelTabsHeight).toBeGreaterThan(30);
    expect(layout.wheelControlHeight).toBeGreaterThan(90);
  });

  test('Group Edit modal scrolls to the last control on desktop and iPad-sized viewports', async ({ page }) => {
    async function measureAtViewport(width, height) {
      await page.setViewportSize({ width, height });
      return page.evaluate(() => {
        closeGroupModal?.();
        const profileA = profiles.find(p => p.id === 1);
        const profileB = profiles.find(p => p.id === 2);
        profileA.controls = profileA.controls.filter(c => c.id < 5000);
        profileB.controls = profileB.controls.filter(c => c.id < 5000);
        for (let i = 0; i < 64; i++) {
          profileA.controls.push({ id: 5000 + i, type: 'slider8', label: 'Scrollable Control ' + i, channel: 1 });
          profileB.controls.push({ id: 6000 + i, type: 'slider8', label: 'Scrollable Control ' + i, channel: 1 });
        }
        selectedFixtureIds = new Set([101, 102]);
        activeSavedGroupIds.clear();
        sceneFixtureFilterActive = false;
        activeControlScopeKeys.clear();
        fanAffectedKeys.clear();
        openGroupModal();

        const modal = document.querySelector('#groupModal .modal-card');
        const body = document.getElementById('groupModalBody');
        const controls = body.querySelectorAll('.control');
        body.scrollTop = body.scrollHeight;
        const last = controls[controls.length - 1];
        const lastRect = last.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const footerRect = document.querySelector('#groupModal .modal-actions').getBoundingClientRect();
        return {
          viewportHeight: window.innerHeight,
          modalHeight: modal.getBoundingClientRect().height,
          bodyClientHeight: body.clientHeight,
          bodyScrollHeight: body.scrollHeight,
          bodyScrollTop: body.scrollTop,
          bodyOverflowX: getComputedStyle(body).overflowX,
          bodyOverflowY: getComputedStyle(body).overflowY,
          horizontalOverflow: body.scrollWidth - body.clientWidth,
          lastReachable: lastRect.bottom <= bodyRect.bottom + 2,
          footerVisible: footerRect.bottom <= window.innerHeight && footerRect.top >= 0
        };
      });
    }

    const desktop = await measureAtViewport(1440, 900);
    const ipad = await measureAtViewport(768, 1024);

    for (const layout of [desktop, ipad]) {
      expect(layout.modalHeight).toBeLessThanOrEqual(layout.viewportHeight);
      expect(layout.bodyOverflowX).toBe('hidden');
      expect(layout.bodyOverflowY).toBe('auto');
      expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
      expect(layout.bodyScrollHeight).toBeGreaterThan(layout.bodyClientHeight + 100);
      expect(layout.bodyScrollTop).toBeGreaterThan(100);
      expect(layout.lastReachable).toBe(true);
      expect(layout.footerVisible).toBe(true);
    }
  });

  test('manual fixture selection refines a group without losing the fixture filter', async ({ page }) => {
    const result = await page.evaluate(() => {
      activeSavedGroupIds = new Set([savedGroupKey(savedGroups[0], 0)]);
      rebuildSelectionFromSavedGroups();
      DmxCommon.saveSharedGroupSelection(selectedSavedGroupIds());
      renderSavedGroupsList();
      drawSurface();
      document.querySelector('[data-fixture-card="101"]').click();
      return {
        selectedGroups: selectedSavedGroups().length,
        selectedFixtures: [...selectedFixtureIds].sort(),
        shared: JSON.parse(localStorage.getItem('selectedGroupIds') || '[]'),
        filteredFixtures: [...activeFixtureFilterIds].sort(),
        visibleCards: [...document.querySelectorAll('#surface article')].map(card => ({
          id: Number(card.dataset.fixtureCard),
          title: card.querySelector('h2')?.childNodes[0]?.textContent.trim()
        })),
        groupBarText: document.getElementById('groupBar').textContent
      };
    });

    expect(result.selectedGroups).toBe(0);
    expect(result.selectedFixtures).toEqual([102]);
    expect(result.shared).toEqual([]);
    expect(result.filteredFixtures).toEqual([101, 102]);
    expect(result.visibleCards).toEqual([
      { id: 101, title: 'A 1' },
      { id: 102, title: 'B 1' }
    ]);
    expect(result.groupBarText).toContain('Filtered group selection');
  });

  test('fixture card click toggles selection while controls do not', async ({ page }) => {
    const result = await page.evaluate(() => {
      const card = document.querySelector('[data-fixture-card="101"]');
      const hasLegacySelectButton = !!document.querySelector('[data-select-fixture]');
      card.querySelector('.fixture-head').click();
      const afterCardClick = [...selectedFixtureIds];
      const selectedCard = document.querySelector('[data-fixture-card="101"]');
      selectedCard.querySelector('input[type="range"]').click();
      const afterSliderClick = [...selectedFixtureIds];
      const selectedStyle = {
        borderColor: getComputedStyle(selectedCard).borderColor,
        boxShadow: getComputedStyle(selectedCard).boxShadow
      };
      return { hasLegacySelectButton, afterCardClick, afterSliderClick, selectedStyle };
    });

    expect(result.hasLegacySelectButton).toBe(false);
    expect(result.afterCardClick).toEqual([101]);
    expect(result.afterSliderClick).toEqual([101]);
    expect(result.selectedStyle.boxShadow).not.toBe('none');
  });

  test('saved fixture profile header selects the profile like fixture card headers', async ({ page }) => {
    await page.evaluate(() => {
      profiles.splice(0, profiles.length,
        { id: 9201, name: 'Profile A', mode: '1ch', channels: 1, controls: [] },
        { id: 9202, name: 'Profile B', mode: '2ch', channels: 2, controls: [] }
      );
      activeProfileId = 9201;
      loadProfileEditor(profiles[0]);
      drawProfiles();
      setSectionCollapsed('profilesCollapseBtn', 'profilesBody', 'profilesCollapsed', false);
    });

    await page.locator('[data-profile-card-head="9202"]').click();

    const selected = await page.evaluate(() => ({
      activeProfileId,
      name: document.getElementById('profileName').value,
      mode: document.getElementById('profileMode').value,
      activeCards: [...document.querySelectorAll('#profiles .item.active')].map(el => el.dataset.profileCard),
      selectedStyle: {
        boxShadow: getComputedStyle(document.querySelector('[data-profile-card="9202"]')).boxShadow,
        background: getComputedStyle(document.querySelector('[data-profile-card="9202"]')).backgroundColor
      }
    }));
    expect(selected.activeProfileId).toBe(9202);
    expect(selected.name).toBe('Profile B');
    expect(selected.mode).toBe('2ch');
    expect(selected.activeCards).toEqual(['9202']);
    expect(selected.selectedStyle.boxShadow).not.toBe('none');
    expect(selected.selectedStyle.background).toBe('rgb(16, 36, 31)');
  });

  test('wheel controls reject duplicate DMX option values', async ({ page }) => {
    const message = await page.evaluate(() => duplicateWheelOptionValueError([
      { name: 'Open', value: 0 },
      { name: 'Closed', value: 0 },
      { name: 'Gobo', value: 40 }
    ]));

    expect(message).toContain('DMX 0');
    expect(message).toContain('"Open"');
    expect(message).toContain('"Closed"');
  });

  test('RGB matrix controls render pixels and resolve sequential DMX channels', async ({ page }) => {
    const result = await page.evaluate(() => {
      profiles = [{
        id: 900,
        name: 'Matrix Bar',
        mode: '2x2',
        channels: 12,
        controls: [{
          id: 901,
          type: 'matrixRgb',
          label: 'Pixels',
          channel: 1,
          width: 2,
          height: 2
        }]
      }];
      fixtures = [{ id: 902, name: 'Matrix 1', profileId: 900, start: 101 }];
      Object.keys(values).forEach(key => delete values[key]);
      activeProfileId = 900;
      selectedFixtureIds = new Set();
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      draw();

      const picker = document.querySelector('[data-matrix-paint-color][data-fixture="902"][data-control="901"]');
      picker.value = '#336699';
      document.querySelector('[data-matrix-pixel="2"][data-fixture="902"][data-control="901"]').click();

      return {
        channelText: controlChannelText(profiles[0].controls[0]),
        pixelCount: document.querySelectorAll('[data-matrix-pixel][data-fixture="902"][data-control="901"]').length,
        value: values['902:901'].pixels[2],
        bytes: resolveDmxBytes(fixtures[0], profiles[0].controls[0]).filter(row => row.val > 0)
      };
    });

    expect(result.channelText).toBe('2×2 RGB from CH 1 to 12');
    expect(result.pixelCount).toBe(4);
    expect(result.value).toEqual({ a: 51, b: 102, c: 153 });
    expect(result.bytes).toEqual([
      { ch: 107, val: 51, param: 'Pixel 3 Red' },
      { ch: 108, val: 102, param: 'Pixel 3 Green' },
      { ch: 109, val: 153, param: 'Pixel 3 Blue' }
    ]);
  });

  test('Fixture Library imports a converted OFL mode as a controller profile', async ({ page }) => {
    await page.evaluate(() => setSectionCollapsed('fixtureLibraryCollapseBtn', 'fixtureLibraryBody', 'fixtureLibraryCollapsed', false));
    await expect(page.locator('#fixtureLibraryStatus')).toContainText('Loaded', { timeout: 15000 });
    await page.locator('#fixtureLibrarySearch').fill('american dj inno pocket spot');
    await page.locator('[data-library-key="american-dj/inno-pocket-spot"]').click();
    await page.locator('#fixtureLibraryMode').selectOption('1');
    await page.locator('#importFixtureLibraryProfile').click();

    const profile = await page.evaluate(() => {
      const imported = profiles.find(p => p.name === 'American DJ Inno Pocket Spot' && p.mode === '11-channel');
      return imported ? {
        name: imported.name,
        mode: imported.mode,
        channels: imported.channels,
        controls: imported.controls.map(c => ({ type: c.type, label: c.label, pan: c.pan, panFine: c.panFine, tilt: c.tilt, tiltFine: c.tiltFine, channel: c.channel }))
      } : null;
    });

    expect(profile).toBeTruthy();
    expect(profile.channels).toBe(11);
    expect(profile.controls).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'panTilt16', label: 'Pan/Tilt', pan: 1, panFine: 2, tilt: 3, tiltFine: 4 }),
      expect.objectContaining({ type: 'wheel', label: 'Color Wheel', channel: 5 }),
      expect.objectContaining({ type: 'slider8', label: 'Dimmer', channel: 8 })
    ]));
  });

  test('Fixture Library preserves OFL wheel slot names, ranges, and colors', async ({ page }) => {
    await page.evaluate(() => setSectionCollapsed('fixtureLibraryCollapseBtn', 'fixtureLibraryBody', 'fixtureLibraryCollapsed', false));
    await expect(page.locator('#fixtureLibraryStatus')).toContainText('Loaded', { timeout: 15000 });
    await page.locator('#fixtureLibrarySearch').fill('fun generation picospot 20 led');
    await page.locator('[data-library-key="fun-generation/picospot-20-led"]').click();
    await page.locator('#fixtureLibraryMode').selectOption('0');
    await page.locator('#importFixtureLibraryProfile').click();

    const state = await page.evaluate(() => {
      const profile = profiles.find(p => p.name === 'Fun Generation PicoSpot 20 LED' && p.mode === '5-channel');
      const wheel = profile.controls.find(c => c.label === 'Color Wheel');
      const red = wheel.options.find(o => o.name === 'Red');
      const rotation = wheel.options.find(o => o.kind === 'WheelRotation');
      fixtures.splice(0, fixtures.length, { id: 9901, name: 'PicoSpot', profileId: profile.id, start: 1 });
      Object.keys(values).forEach(key => delete values[key]);
      values['9901:' + wheel.id] = 18;
      drawSurface();
      const activeButton = document.querySelector(`[data-fixture="9901"][data-control="${wheel.id}"][data-wheel].active`);
      return {
        red,
        rotation,
        selectedAtRangeValue: selectedWheelOption(wheel, 18)?.name,
        textFormat: wheelOptionsText([red]),
        activeButtonText: activeButton?.textContent.trim(),
        activeTitle: activeButton?.getAttribute('title')
      };
    });

    expect(state.red).toEqual(expect.objectContaining({
      value: 16,
      range: [11, 21],
      kind: 'WheelSlot',
      slotNumber: 2,
      color: '#ff0000'
    }));
    expect(state.rotation).toEqual(expect.objectContaining({
      value: 216,
      range: [176, 255],
      kind: 'WheelRotation'
    }));
    expect(state.selectedAtRangeValue).toBe('Red');
    expect(state.textFormat).toBe('Red=11-21|#ff0000|kind=WheelSlot|slot=2');
    expect(state.activeButtonText).toContain('Red');
    expect(state.activeTitle).toBe('DMX 11-21 · WheelSlot');
  });

  test('manual wheel option editor supports ranges and OFL-style metadata', async ({ page }) => {
    const state = await page.evaluate(() => {
      const text = [
        'Open=0-15|kind=WheelSlot|slot=1',
        'Gobo 2=16-31|kind=WheelSlot|slot=2',
        'Gobo 3=32-46|kind=WheelSlot|slot=3',
        'Gobo 4=47-62|kind=WheelSlot|slot=4',
        'Gobo 5=63-78|kind=WheelSlot|slot=5',
        'Gobo 6=79-93|kind=WheelSlot|slot=6',
        'Gobo 7=94-109|kind=WheelSlot|slot=7',
        'Gobo 8=110-124|kind=WheelSlot|slot=8',
        'Gobo 2 shake=125-140|kind=WheelShake|slot=2|shake=slow-fast',
        'Gobo 3 shake=141-156|kind=WheelShake|slot=3|shake=slow-fast',
        'Gobo 4 shake=157-171|kind=WheelShake|slot=4|shake=slow-fast',
        'Gobo 5 shake=172-187|kind=WheelShake|slot=5|shake=slow-fast',
        'Gobo 6 shake=188-203|kind=WheelShake|slot=6|shake=slow-fast',
        'Gobo 7 shake=204-218|kind=WheelShake|slot=7|shake=slow-fast',
        'Gobo 8 shake=219-249|kind=WheelShake|slot=8|shake=slow-fast',
        'Rotation slow CW to fast CW=250-255|kind=WheelRotation|speed=slow CW-fast CW'
      ].join('\n');
      const options = parseWheelOptions(text);
      const wheel = { id: 8801, type: 'wheel', label: 'Gobo Wheel', channel: 1, options };
      const shake = options.find(o => o.name === 'Gobo 2 shake');
      const rotation = options.find(o => o.kind === 'WheelRotation');
      profiles.splice(0, profiles.length, { id: 8800, name: 'Manual wheel', mode: 'test', channels: 1, controls: [wheel] });
      fixtures.splice(0, fixtures.length, { id: 8802, name: 'Manual wheel fixture', profileId: 8800, start: 1 });
      Object.keys(values).forEach(key => delete values[key]);
      values['8802:8801'] = 130;
      drawSurface();
      const host = document.querySelector('[data-wheel-range-host="8802:8801"]');
      return {
        count: options.length,
        gobo2: options.find(o => o.name === 'Gobo 2'),
        shake,
        rotation,
        selectedAt130: selectedWheelOption(wheel, 130)?.name,
        sliderMin: host?.querySelector('input[type="range"]')?.getAttribute('min'),
        sliderMax: host?.querySelector('input[type="range"]')?.getAttribute('max'),
        sliderLabel: host?.textContent,
        formattedShake: wheelOptionsText([shake]),
        formattedRotation: wheelOptionsText([rotation])
      };
    });

    expect(state.count).toBe(16);
    expect(state.gobo2).toEqual(expect.objectContaining({ value: 24, range: [16, 31], kind: 'WheelSlot', slotNumber: 2 }));
    expect(state.shake).toEqual(expect.objectContaining({
      value: 133,
      range: [125, 140],
      kind: 'WheelShake',
      slotNumber: 2,
      shakeSpeedStart: 'slow',
      shakeSpeedEnd: 'fast'
    }));
    expect(state.rotation).toEqual(expect.objectContaining({
      value: 253,
      range: [250, 255],
      kind: 'WheelRotation',
      speedStart: 'slow CW',
      speedEnd: 'fast CW'
    }));
    expect(state.selectedAt130).toBe('Gobo 2 shake');
    expect(state.sliderMin).toBe('125');
    expect(state.sliderMax).toBe('140');
    expect(state.sliderLabel).toContain('Shake speed');
    expect(state.formattedShake).toBe('Gobo 2 shake=125-140|kind=WheelShake|slot=2|shake=slow-fast');
    expect(state.formattedRotation).toBe('Rotation slow CW to fast CW=250-255|kind=WheelRotation|speed=slow CW-fast CW');
  });

  test('guided wheel editor modal writes rich wheel metadata', async ({ page }) => {
    await page.evaluate(() => setSectionCollapsed('profilesCollapseBtn', 'profilesBody', 'profilesCollapsed', false));
    await page.locator('#controlType').selectOption('wheel');
    await page.locator('#openControlDetails').click();
    await expect(page.locator('#controlDetailsModal')).toBeVisible();
    await page.locator('#wheelOptions').fill('Open=0-15\nGobo 2 shake=125-140|kind=WheelShake|slot=2|shake=slow-fast\nStrobe=11-255|kind=ShutterStrobe|speed=slow-fast');
    await page.locator('#openWheelOptionsModal').click();
    await expect(page.locator('#wheelOptionsModal')).toBeVisible();
    await expect(page.locator('#wheelOptionsModal')).toHaveClass(/form-modal/);
    await expect(page.locator('#wheelOptionsModal > .modal-card')).toBeVisible();
    await expect(page.locator('#wheelOptionsModal > .modal')).toHaveCount(0);

    const rows = page.locator('[data-wheel-option-row]');
    await expect(rows).toHaveCount(3);
    await rows.nth(1).locator('[data-wheel-field="name"]').fill('Gobo 3 shake');
    await rows.nth(1).locator('[data-wheel-field="start"]').fill('141');
    await rows.nth(1).locator('[data-wheel-field="end"]').fill('156');
    await rows.nth(1).locator('[data-wheel-field="kind"]').selectOption('WheelShake');
    await rows.nth(1).locator('[data-wheel-field="slot"]').fill('3');
    await rows.nth(1).locator('[data-wheel-field="speedStart"]').fill('slow');
    await rows.nth(1).locator('[data-wheel-field="speedEnd"]').fill('fast');
    await expect(rows.nth(1).locator('[data-wheel-field="visual"]')).toHaveCount(0);
    await expect(rows.nth(1).locator('[data-clear-wheel-image]')).toHaveText('No icon');
    await expect(rows.nth(1).locator('[data-wheel-draw]')).toHaveText('Draw');
    await rows.nth(1).locator('[data-wheel-color]').evaluate(input => {
      input.value = '#123456';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await rows.nth(1).locator('[data-wheel-draw]').click();
    await expect(page.locator('#wheelIconDrawModal')).toBeVisible();
    await expect(page.locator('#wheelIconDrawModal')).toHaveClass(/form-modal/);
    await expect(page.locator('#wheelIconDrawModal > .modal-card')).toBeVisible();
    await expect(page.locator('#wheelIconDrawModal > .modal')).toHaveCount(0);
    const canvas = page.locator('#wheelIconCanvas');
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + 80);
    await page.mouse.up();
    await page.locator('#saveWheelIconDrawing').click();
    await expect(page.locator('#wheelIconDrawModal')).toBeHidden();
    await expect.poll(() => page.evaluate(() => wheelOptionsModalRows[1].image.startsWith('data:image/png'))).toBe(true);
    await rows.nth(2).locator('[data-wheel-file]').setInputFiles({
      name: 'gobo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGOSHzRgAAAAABJRU5ErkJggg==', 'base64')
    });
    await expect.poll(() => page.evaluate(() => wheelOptionsModalRows[2].image.startsWith('data:image/png'))).toBe(true);
    const layout = await rows.nth(1).evaluate(row => {
      const clearIcon = row.querySelector('[data-clear-wheel-image]').getBoundingClientRect();
      const removeOption = row.querySelector('[data-remove-wheel-row]').getBoundingClientRect();
      return {
        clearText: row.querySelector('[data-clear-wheel-image]').textContent.trim(),
        drawText: row.querySelector('[data-wheel-draw]').textContent.trim(),
        noColorText: row.querySelector('[data-clear-wheel-color]').textContent.trim(),
        removeText: row.querySelector('[data-remove-wheel-row]').textContent.trim(),
        clearIconFits: row.querySelector('[data-clear-wheel-image]').scrollWidth <= row.querySelector('[data-clear-wheel-image]').clientWidth,
        clearColorFits: row.querySelector('[data-clear-wheel-color]').scrollWidth <= row.querySelector('[data-clear-wheel-color]').clientWidth,
        clearRight: clearIcon.right,
        removeLeft: removeOption.left,
        sameVerticalBand: !(clearIcon.bottom < removeOption.top || removeOption.bottom < clearIcon.top)
      };
    });
    expect(layout.clearText).toBe('No icon');
    expect(layout.drawText).toBe('Draw');
    expect(layout.noColorText).toBe('No color');
    expect(layout.clearIconFits).toBe(true);
    expect(layout.clearColorFits).toBe(true);
    expect(layout.removeText).toBe('×');
    if (layout.sameVerticalBand) expect(layout.clearRight).toBeLessThanOrEqual(layout.removeLeft);
    await expect(rows.nth(2).locator('[data-wheel-field="kind"]')).toHaveValue('ShutterStrobe');
    await page.locator('#applyWheelOptionsModal').click();

    const state = await page.evaluate(() => {
      const options = parseWheelOptions(document.getElementById('wheelOptions').value);
      const shake = options.find(o => o.name === 'Gobo 3 shake');
      const strobe = options.find(o => o.name === 'Strobe');
      const wheel = { id: 8811, type: 'wheel', label: 'Gobo Wheel', channel: 1, options };
      profiles.splice(0, profiles.length, { id: 8810, name: 'Guided wheel', mode: 'test', channels: 1, controls: [wheel] });
      fixtures.splice(0, fixtures.length, { id: 8812, name: 'Guided wheel fixture', profileId: 8810, start: 1 });
      Object.keys(values).forEach(key => delete values[key]);
      values['8812:8811'] = 150;
      drawSurface();
      const host = document.querySelector('[data-wheel-range-host="8812:8811"]');
      const shakeSliderMin = host?.querySelector('input[type="range"]')?.getAttribute('min');
      const shakeSliderMax = host?.querySelector('input[type="range"]')?.getAttribute('max');
      values['8812:8811'] = 120;
      updateControlDisplay(fixtures[0], wheel);
      const strobeHost = document.querySelector('[data-wheel-range-host="8812:8811"]');
      const goboButton = document.querySelector('[data-fixture="8812"][data-control="8811"][data-wheel-option-index="1"]');
      const goboIconStyle = goboButton?.querySelector('.option-icon')?.getAttribute('style') || '';
      return {
        text: document.getElementById('wheelOptions').value,
        shake,
        strobe,
        selectedAt150: selectedWheelOption(wheel, 150)?.name,
        sliderMin: shakeSliderMin,
        sliderMax: shakeSliderMax,
        strobeLabel: strobeHost?.textContent,
        goboIconStyle
      };
    });

    expect(state.text).toContain('Gobo 3 shake=141-156|#123456|data:image/png');
    expect(state.text).toContain('kind=WheelShake|slot=3|shake=slow-fast');
    expect(state.shake).toEqual(expect.objectContaining({
      value: 149,
      range: [141, 156],
      kind: 'WheelShake',
      slotNumber: 3,
      shakeSpeedStart: 'slow',
      shakeSpeedEnd: 'fast',
      color: '#123456'
    }));
    expect(state.shake.image).toContain('data:image/png');
    expect(state.selectedAt150).toBe('Gobo 3 shake');
    expect(state.sliderMin).toBe('141');
    expect(state.sliderMax).toBe('156');
    expect(state.strobe).toEqual(expect.objectContaining({
      kind: 'ShutterStrobe',
      range: [11, 255],
      speedStart: 'slow',
      speedEnd: 'fast'
    }));
    expect(state.strobeLabel).toContain('Strobe speed');
    expect(state.goboIconStyle).toContain('background-color:#123456');
    expect(state.goboIconStyle).toContain('background-image:url(');
  });

  test('control details live in modal below compact profile fields', async ({ page }) => {
    await page.evaluate(() => setSectionCollapsed('profilesCollapseBtn', 'profilesBody', 'profilesCollapsed', false));
    const profilePanel = page.locator('#profilesSection');
    await expect(profilePanel).toContainText('Add / Edit Control');
    await expect(profilePanel.locator('#controlType')).toBeVisible();
    await expect(profilePanel.locator('#controlLabel')).toBeVisible();
    await expect(page.locator('#controlDetailsModal')).toBeHidden();

    await page.locator('#controlType').selectOption('slider8');
    await page.locator('#openControlDetails').click();
    await expect(page.locator('#controlDetailsModal')).toBeVisible();
    await expect(page.locator('#controlDetailsModal')).toHaveClass(/form-modal/);
    await expect(page.locator('#controlDetailsModal > .modal-card')).toBeVisible();
    await expect(page.locator('#controlDetailsModal > .modal')).toHaveCount(0);
    await expect(page.locator('#controlDetailsModal .modal-actions')).toContainText('Add control');
    await expect(page.locator('#defBlkCard')).toBeVisible();
    await expect(page.locator('#wheelEditorWrap')).toBeHidden();
    await expect(page.locator('#panTiltOptions')).toBeHidden();
    await page.locator('#closeControlDetailsModal2').click();
    await expect(page.locator('#controlDetailsModal')).toBeHidden();

    await page.locator('#controlType').selectOption('wheel');
    await page.locator('#openControlDetails').click();
    await expect(page.locator('#wheelEditorWrap')).toBeVisible();
    await expect(page.locator('#controlDetailsTitle')).toContainText('Add Wheel');
    await expect(page.locator('#wheelName')).toHaveCount(0);
    await expect(page.locator('#addWheelOption')).toHaveCount(0);
  });

  test('Update Library preserves rich OFL wheel metadata when edited profile options are plain text', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const r = await fetch('assets/fixture-library.json', { cache: 'no-store' });
      const library = normalizeFixtureLibrary(await r.json());
      const fixture = library.fixtures.find(f => f.key === 'fun-generation/picospot-20-led');
      const mode = fixture.modes.find(m => m.name === '11-channel');
      const editedProfile = JSON.parse(JSON.stringify(mode.profile));
      editedProfile.controls.forEach(control => {
        control.id = uid();
        if (control.type !== 'wheel') return;
        control.options = control.options.map(option => {
          const plain = { name: option.name, value: DmxCommon.wheelOptionValue(option) };
          const range = DmxCommon.wheelOptionRange(option);
          if (range) plain.range = range;
          if (option.color) plain.color = option.color;
          if (option.image) plain.image = option.image;
          return plain;
        });
      });

      upsertProfileIntoFixtureLibrary(library, editedProfile);
      const savedFixture = library.fixtures.find(f => f.key === 'fun-generation/picospot-20-led');
      const savedMode = savedFixture.modes.find(m => m.name === '11-channel');
      const gobo = savedMode.profile.controls.find(c => c.label === 'Gobo Wheel');
      const shake = gobo.options.find(o => o.name === 'Gobo 2 shake');
      const rotation = gobo.options.find(o => o.name.includes('Rotation slow CW'));
      return {
        fixtureCount: library.fixtureCount,
        profileName: savedMode.profile.name,
        shake,
        rotation,
        goboMetadataCount: gobo.options.filter(o => o.kind || o.slotNumber || o.slotNumberStart || o.slotNumberEnd).length
      };
    });

    expect(result.fixtureCount).toBeGreaterThan(600);
    expect(result.profileName).toBe('PicoSpot 20 LED');
    expect(result.shake).toEqual(expect.objectContaining({
      kind: 'WheelShake',
      slotNumber: 2,
      shakeSpeedStart: 'slow',
      shakeSpeedEnd: 'fast'
    }));
    expect(result.rotation).toEqual(expect.objectContaining({
      kind: 'WheelRotation',
      speedStart: 'slow CW',
      speedEnd: 'fast CW'
    }));
    expect(result.goboMetadataCount).toBeGreaterThan(10);
  });

  test('OFL wheel shake ranges expose a bounded speed slider', async ({ page }) => {
    await page.evaluate(() => setSectionCollapsed('fixtureLibraryCollapseBtn', 'fixtureLibraryBody', 'fixtureLibraryCollapsed', false));
    await page.evaluate(async () => {
      const r = await fetch('assets/fixture-library.json', { cache: 'no-store' });
      fixtureLibraryState.data = normalizeFixtureLibrary(await r.json());
      fixtureLibraryState.selectedKey = '';
      fixtureLibraryState.selectedModeIndex = 0;
      document.getElementById('fixtureLibrarySearch').disabled = false;
      document.getElementById('fixtureLibraryStatus').textContent = 'Loaded built-in fixture library for test.';
      renderFixtureLibraryResults();
    });
    await page.locator('#fixtureLibrarySearch').fill('fun generation picospot 20 led');
    await page.locator('[data-library-key="fun-generation/picospot-20-led"]').click();
    await page.locator('#fixtureLibraryMode').selectOption('2');
    await page.locator('#importFixtureLibraryProfile').click();

    const state = await page.evaluate(() => {
      const profile = profiles.find(p => p.name === 'Fun Generation PicoSpot 20 LED' && p.mode === '11-channel');
      const gobo = profile.controls.find(c => c.label === 'Gobo Wheel');
      const shake = gobo.options.find(o => o.kind === 'WheelShake' && o.slotNumber === 2);
      fixtures.splice(0, fixtures.length, { id: 9902, name: 'PicoSpot 11ch', profileId: profile.id, start: 1 });
      Object.keys(values).forEach(key => delete values[key]);
      values['9902:' + gobo.id] = 130;
      drawSurface();
      const host = document.querySelector(`[data-wheel-range-host="9902:${gobo.id}"]`);
      const slider = host?.querySelector('input[type="range"]');
      const button = document.querySelector(`[data-fixture="9902"][data-control="${gobo.id}"][data-wheel-option-index="${gobo.options.indexOf(shake)}"]`);
      const sliderValueBeforeButton = slider?.value;
      slider.focus();
      slider.value = '131';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      const sliderAfterInput = document.querySelector(`[data-wheel-range-host="9902:${gobo.id}"] input[type="range"]`);
      const preservedDuringInput = slider === sliderAfterInput;
      const valueAfterInput = values['9902:' + gobo.id];
      const sliderValueAfterInput = sliderAfterInput?.value;
      button.click();
      const sliderAfterButton = document.querySelector(`[data-wheel-range-host="9902:${gobo.id}"] input[type="range"]`);
      return {
        shake,
        selectedAt130: DmxCommon.selectedWheelOption(gobo, 130)?.name,
        sliderMin: slider?.getAttribute('min'),
        sliderMax: slider?.getAttribute('max'),
        sliderValue: sliderValueBeforeButton,
        valueAfterInput,
        preservedDuringInput,
        sliderValueAfterInput,
        sliderValueAfterButton: sliderAfterButton?.value,
        sliderLabel: host?.textContent,
        buttonValue: button.dataset.wheel,
        valueAfterButton: values['9902:' + gobo.id]
      };
    });

    expect(state.shake).toEqual(expect.objectContaining({
      value: 133,
      range: [125, 140],
      kind: 'WheelShake',
      slotNumber: 2,
      shakeSpeedStart: 'slow',
      shakeSpeedEnd: 'fast'
    }));
    expect(state.selectedAt130).toContain('shake');
    expect(state.sliderMin).toBe('125');
    expect(state.sliderMax).toBe('140');
    expect(state.sliderValue).toBe('130');
    expect(state.valueAfterInput).toBe(131);
    expect(state.preservedDuringInput).toBe(true);
    expect(state.sliderValueAfterInput).toBe('131');
    expect(state.sliderValueAfterButton).toBe('133');
    expect(state.sliderLabel).toContain('Shake speed');
    expect(state.sliderLabel).toContain('slow to fast');
    expect(state.buttonValue).toBe('133');
    expect(state.valueAfterButton).toBe(133);
  });

  test('Fixture Library panel has a persistent collapse button', async ({ page }) => {
    await page.evaluate(() => setSectionCollapsed('fixtureLibraryCollapseBtn', 'fixtureLibraryBody', 'fixtureLibraryCollapsed', false));
    await expect(page.locator('#fixtureLibraryCollapseBtn')).toBeVisible();
    await expect(page.locator('#fixtureLibraryBody')).toBeVisible();

    await page.locator('#fixtureLibraryCollapseBtn').click();
    await expect(page.locator('#fixtureLibraryBody')).toBeHidden();
    await expect(page.locator('#fixtureLibraryCollapseBtn')).toHaveText('+');

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#fixtureLibraryBody')).toBeHidden();
    await expect(page.locator('#fixtureLibraryCollapseBtn')).toHaveText('+');
  });

  test('Control Surface column preference supports four columns and safely falls back as space narrows', async ({ page }) => {
    const posts = [];
    await page.route('**/ui_state.php**', async route => {
      if (route.request().method() === 'POST') {
        posts.push(route.request().postDataJSON());
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fallback();
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.locator('#surfaceColsSelect').selectOption('4');
    await expect(page.locator('#surface')).toHaveAttribute('data-requested-columns', '4');
    await expect(page.locator('#surface')).toHaveAttribute('data-effective-columns', '4');

    const wide = await page.locator('#surface').evaluate(surface => ({
      tracks: getComputedStyle(surface).gridTemplateColumns.split(' ').filter(Boolean).length,
      overflow: surface.scrollWidth - surface.clientWidth,
      cardWidths: [...surface.querySelectorAll('[data-fixture-card]')].map(card => Math.round(card.getBoundingClientRect().width))
    }));
    expect(wide.tracks).toBe(4);
    expect(wide.overflow).toBeLessThanOrEqual(1);
    expect(wide.cardWidths.every(width => width >= 280)).toBe(true);
    await expect.poll(() => posts).toContainEqual(expect.objectContaining({
      page: 'fixture',
      state: expect.objectContaining({ controlSurfaceCols: 4 })
    }));

    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator('#surface')).toHaveAttribute('data-effective-columns', '3');
    const narrower = await page.locator('#surface').evaluate(surface => ({
      tracks: getComputedStyle(surface).gridTemplateColumns.split(' ').filter(Boolean).length,
      overflow: surface.scrollWidth - surface.clientWidth,
      cardOverflow: [...surface.querySelectorAll('[data-fixture-card]')].map(card => card.scrollWidth - card.clientWidth)
    }));
    expect(narrower.tracks).toBe(3);
    expect(narrower.overflow).toBeLessThanOrEqual(1);
    expect(narrower.cardOverflow.every(value => value <= 1)).toBe(true);
  });

  test('Control Surface restores its column preference from server UI state', async ({ page }) => {
    await page.unroute('**/ui_state.php**');
    await page.route('**/ui_state.php**', async route => {
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
          state: {
            fixture: { controlSurfaceCols: 3 },
            toolboxes: { selectedGroupIds: [] }
          }
        })
      });
    });
    await page.evaluate(() => localStorage.removeItem('controlSurfaceCols'));
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('#surfaceColsSelect')).toHaveValue('3');
    await expect(page.locator('#surface')).toHaveAttribute('data-requested-columns', '3');
    expect(await page.evaluate(() => localStorage.getItem('controlSurfaceCols'))).toBe('3');
  });

  test('Control Surface header collapses and expands all visible fixture cards', async ({ page }) => {
    await page.evaluate(() => {
      profiles.splice(0, profiles.length, {
        id: 9100,
        name: 'Dimmer Profile',
        mode: '1ch',
        channels: 1,
        controls: [{ id: 9101, type: 'slider8', label: 'Dimmer', channel: 1 }]
      });
      fixtures.splice(0, fixtures.length,
        { id: 9102, name: 'Fixture A', profileId: 9100, start: 1 },
        { id: 9103, name: 'Fixture B', profileId: 9100, start: 2 }
      );
      collapsedFixtureIds.clear();
      drawSurface();
    });

    await expect(page.locator('#surfaceCollapseAllBtn')).toHaveText('—');
    await page.locator('#surfaceCollapseAllBtn').click();
    await expect(page.locator('#surfaceCollapseAllBtn')).toHaveText('+');
    await expect(page.locator('[data-fixture-card="9102"] [data-control="9101"]')).toBeHidden();
    await expect(page.locator('[data-fixture-card="9103"] [data-control="9101"]')).toBeHidden();

    const collapsed = await page.evaluate(() => [...collapsedFixtureIds].sort());
    expect(collapsed).toEqual([9102, 9103]);

    await page.locator('#surfaceCollapseAllBtn').click();
    await expect(page.locator('#surfaceCollapseAllBtn')).toHaveText('—');
    await expect(page.locator('[data-fixture-card="9102"] [data-control="9101"]')).toBeVisible();
    await expect(page.locator('[data-fixture-card="9103"] [data-control="9101"]')).toBeVisible();
  });

  test('scene recall clears groups and filters the surface to involved fixtures', async ({ page }) => {
    const result = await page.evaluate(() => {
      activeSavedGroupIds = new Set([savedGroupKey(savedGroups[0], 0)]);
      rebuildSelectionFromSavedGroups();
      DmxCommon.saveSharedGroupSelection(selectedSavedGroupIds());
      const scene = { name: 'A only', values: { '101:11': 55 } };
      recallScene(scene);
      return {
        selectedGroups: selectedSavedGroups().length,
        shared: JSON.parse(localStorage.getItem('selectedGroupIds') || '[]'),
        selectedFixtures: [...selectedFixtureIds],
        sceneFilter: sceneFixtureFilterActive,
        visibleCards: [...document.querySelectorAll('#surface article')].map(card => ({
          id: Number(card.dataset.fixtureCard),
          title: card.querySelector('h2')?.childNodes[0]?.textContent.trim()
        }))
      };
    });

    expect(result.selectedGroups).toBe(0);
    expect(result.shared).toEqual([]);
    expect(result.selectedFixtures).toEqual([101]);
    expect(result.sceneFilter).toBe(true);
    expect(result.visibleCards).toEqual([{ id: 101, title: 'A 1' }]);
  });

  test('palette recall applies only stored values and leaves unrelated controls unchanged', async ({ page }) => {
    const result = await page.evaluate(() => {
      values['101:11'] = 10;
      values['102:21'] = 20;
      recallPalette({ name: 'Dimmer A', scope: 'dimmer', values: { '101:11': 99 } });
      return {
        a: values['101:11'],
        b: values['102:21'],
        selectedGroups: selectedSavedGroups().length,
        selectedFixtures: [...selectedFixtureIds],
        scope: [...activeControlScopeKeys]
      };
    });

    expect(result.a).toBe(99);
    expect(result.b).toBe(20);
    expect(result.selectedGroups).toBe(0);
    expect(result.selectedFixtures).toEqual([101]);
    expect(result.scope).toEqual(['101:11']);
  });

  test('palette scopes cover common fixture-library control families', async ({ page }) => {
    const result = await page.evaluate(() => {
      const sample = {
        uv: { type: 'slider8', label: 'UV' },
        redFine: { type: 'slider8', label: 'Red fine' },
        cct: { type: 'slider8', label: 'CCT' },
        dimmer: { type: 'slider8', label: 'Dimmer fine' },
        strobe: { type: 'slider8', label: 'Strobe Frequency' },
        shutter: { type: 'slider8', label: 'Shutter / Strobe' },
        gobo: { type: 'wheel', label: 'Gobo Wheel' },
        prism: { type: 'slider8', label: 'Prism Rotation' },
        optics: { type: 'slider8', label: 'Focus fine' },
        effects: { type: 'slider8', label: 'Program Speed' },
        position: { type: 'panTilt16', label: 'Pan/Tilt' },
        blueMaster: { type: 'slider8', label: 'Blue Master' }
      };
      const matches = (key, scope) => paletteControlMatchesScope(sample[key], scope);
      return {
        options: [...document.querySelectorAll('#paletteScope option')].map(option => option.value),
        color: ['uv', 'redFine', 'cct', 'blueMaster'].every(key => matches(key, 'color')),
        blueMasterNotDimmer: !matches('blueMaster', 'dimmer'),
        dimmer: matches('dimmer', 'dimmer'),
        shutter: matches('strobe', 'shutter') && matches('shutter', 'shutter'),
        gobo: matches('gobo', 'gobo'),
        prism: matches('prism', 'prism'),
        optics: matches('optics', 'optics'),
        effects: matches('effects', 'effects'),
        position: matches('position', 'position'),
        legacyBeamStillMatches: matches('gobo', 'beam') && matches('optics', 'beam')
      };
    });

    expect(result.options).toEqual(['position', 'color', 'dimmer', 'shutter', 'gobo', 'prism', 'optics', 'effects', 'all']);
    expect(result.color).toBe(true);
    expect(result.blueMasterNotDimmer).toBe(true);
    expect(result.dimmer).toBe(true);
    expect(result.shutter).toBe(true);
    expect(result.gobo).toBe(true);
    expect(result.prism).toBe(true);
    expect(result.optics).toBe(true);
    expect(result.effects).toBe(true);
    expect(result.position).toBe(true);
    expect(result.legacyBeamStillMatches).toBe(true);
  });

  test('palette merge uses a visual matrix picker instead of a slot prompt', async ({ page }) => {
    const palettePosts = [];
    await page.route('**/palette_setup.php', async route => {
      if (route.request().method() !== 'GET') {
        palettePosts.push(JSON.parse(route.request().postData()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, palettes: [], paletteCols: 4, paletteRows: 4 })
      });
    });

    await page.evaluate(() => {
      palettes = [
        { id: 'pal_a', name: 'Dimmer A', slot: 0, scope: 'dimmer', values: { '101:11': 12 }, visual: { type: 'visual', color: '#225a50', image: '' } },
        { id: 'pal_b', name: 'Dimmer B', slot: 2, scope: 'dimmer', values: { '102:21': 44 }, visual: { type: 'visual', color: '#553355', image: '' } }
      ];
      paletteCols = 4;
      paletteRows = 1;
      document.getElementById('paletteScope').value = 'dimmer';
      selectedFixtureIds = new Set([101]);
      values['101:11'] = 88;
      renderPaletteMatrix();
    });

    let promptOpened = false;
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') promptOpened = true;
      await dialog.accept();
    });

    await page.locator('#mergePaletteBtn').click();
    await expect(page.locator('#paletteMergeModal')).toBeVisible();
    await expect(page.locator('#paletteMergeModal')).toHaveClass(/form-modal/);
    await expect(page.locator('#paletteMergeModal > .modal-card')).toBeVisible();
    await expect(page.locator('#paletteMergeModal > .modal')).toHaveCount(0);
    await expect(page.locator('#paletteMergeModal .modal-actions')).toBeVisible();
    await expect(page.locator('#paletteMergeMatrix [data-merge-palette-slot]')).toHaveCount(2);
    await expect(page.locator('#paletteMergeMatrix [data-merge-empty-slot]')).toHaveCount(2);
    await page.locator('#paletteMergeMatrix [data-merge-empty-slot="1"]').click();
    await expect(page.locator('#paletteMergeModal')).toBeVisible();
    await page.locator('#paletteMergeMatrix [data-merge-palette-slot="0"]').click();
    await expect(page.locator('#paletteMergeModal')).toBeHidden();

    const state = await page.evaluate(() => ({
      paletteValue: palettes.find(p => p.id === 'pal_a').values['101:11'],
      otherValue: palettes.find(p => p.id === 'pal_b').values['102:21'],
      status: document.getElementById('status').textContent
    }));

    expect(promptOpened).toBe(false);
    expect(state.paletteValue).toBe(88);
    expect(state.otherValue).toBe(44);
    expect(state.status).toContain('Merged 1 fixture into palette "Dimmer A"');
    await expect.poll(() => palettePosts.at(-1)?.palettes?.find(p => p.id === 'pal_a')?.values?.['101:11'], { timeout: 5000 }).toBe(88);
  });

  test('palette move mode reorders tiles without recalling them', async ({ page }) => {
    const palettePosts = [];
    await page.route('**/palette_setup.php', async route => {
      if (route.request().method() !== 'GET') {
        palettePosts.push(JSON.parse(route.request().postData()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, palettes: [], paletteCols: 4, paletteRows: 4 })
      });
    });

    const state = await page.evaluate(() => {
      palettes = [
        { id: 'pal_a', name: 'Dimmer A', slot: 0, scope: 'dimmer', values: { '101:11': 99 } },
        { id: 'pal_b', name: 'Dimmer B', slot: 2, scope: 'dimmer', values: { '102:21': 77 } }
      ];
      paletteCols = 4;
      paletteRows = 1;
      values['101:11'] = 10;
      renderPaletteMatrix();
      document.getElementById('movePaletteBtn').click();
      document.querySelector('[data-palette-slot="0"]').click();
      const clickDidNotRecall = values['101:11'] === 10;
      const selectedForMove = paletteMoveSelectedSlot === 0;
      document.querySelector('[data-palette-slot="3"]').click();
      const afterMove = palettes.map(p => ({ id: p.id, slot: p.slot }));
      const swapped = movePaletteSlot(3, 2);
      return {
        moveMode: paletteMoveMode,
        clickDidNotRecall,
        selectedForMove,
        afterMove,
        swapped,
        afterSwap: palettes.map(p => ({ id: p.id, slot: p.slot })),
        activeButton: document.getElementById('movePaletteBtn').classList.contains('active')
      };
    });

    expect(state.moveMode).toBe(true);
    expect(state.activeButton).toBe(true);
    expect(state.clickDidNotRecall).toBe(true);
    expect(state.selectedForMove).toBe(true);
    expect(state.afterMove).toEqual([
      { id: 'pal_b', slot: 2 },
      { id: 'pal_a', slot: 3 }
    ]);
    expect(state.swapped).toBe(true);
    expect(state.afterSwap).toEqual([
      { id: 'pal_a', slot: 2 },
      { id: 'pal_b', slot: 3 }
    ]);
    await expect.poll(() => palettePosts.at(-1)?.palettes?.map(p => ({ id: p.id, slot: p.slot })), { timeout: 5000 }).toEqual([
      { id: 'pal_a', slot: 2 },
      { id: 'pal_b', slot: 3 }
    ]);
  });

  test('palette move mode supports real drag and drop between slots', async ({ page }) => {
    const palettePosts = [];
    await page.route('**/palette_setup.php', async route => {
      if (route.request().method() !== 'GET') {
        palettePosts.push(JSON.parse(route.request().postData()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, palettes: [], paletteCols: 4, paletteRows: 4 })
      });
    });

    await page.evaluate(() => {
      palettes = [
        { id: 'pal_a', name: 'Dimmer A', slot: 0, scope: 'dimmer', values: { '101:11': 99 } },
        { id: 'pal_b', name: 'Dimmer B', slot: 2, scope: 'dimmer', values: { '102:21': 77 } }
      ];
      paletteCols = 4;
      paletteRows = 1;
      renderPaletteMatrix();
      document.getElementById('movePaletteBtn').click();
    });

    const source = page.locator('[data-palette-slot="0"]');
    const target = page.locator('[data-palette-slot="3"]');
    await source.dragTo(target);

    await expect.poll(() => page.evaluate(() => palettes.map(p => ({ id: p.id, slot: p.slot })))).toEqual([
      { id: 'pal_b', slot: 2 },
      { id: 'pal_a', slot: 3 }
    ]);
    await expect.poll(() => palettePosts.length, { timeout: 5000 }).toBeGreaterThan(0);
    expect(palettePosts.at(-1).palettes.map(p => ({ id: p.id, slot: p.slot }))).toEqual([
      { id: 'pal_b', slot: 2 },
      { id: 'pal_a', slot: 3 }
    ]);
  });

  test('scene move mode reorders tiles without recalling them', async ({ page }) => {
    const scenePosts = [];
    await page.route('**/scene_setup.php', async route => {
      if (route.request().method() !== 'GET') {
        scenePosts.push(JSON.parse(route.request().postData()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, scenes: [], slotCols: 4, slotRows: 4 })
      });
    });

    const state = await page.evaluate(() => {
      scenes = [
        { id: 'scene_a', name: 'Scene A', slot: 0, values: { '101:11': 99 } },
        { id: 'scene_b', name: 'Scene B', slot: 2, values: { '102:21': 77 } }
      ];
      slotCols = 4;
      slotRows = 1;
      values['101:11'] = 10;
      renderSlotMatrix();
      document.getElementById('moveScenesBtn').click();
      document.querySelector('[data-slot="0"]').click();
      const clickDidNotRecall = values['101:11'] === 10;
      const selectedForMove = sceneMoveSelectedSlot === 0;
      document.querySelector('[data-slot="3"]').click();
      const afterMove = scenes.map(s => ({ id: s.id, slot: s.slot }));
      const swapped = moveSceneSlot(3, 2);
      return {
        moveMode: sceneMoveMode,
        clickDidNotRecall,
        selectedForMove,
        afterMove,
        swapped,
        afterSwap: scenes.map(s => ({ id: s.id, slot: s.slot })),
        activeButton: document.getElementById('moveScenesBtn').classList.contains('active')
      };
    });

    expect(state.moveMode).toBe(true);
    expect(state.activeButton).toBe(true);
    expect(state.clickDidNotRecall).toBe(true);
    expect(state.selectedForMove).toBe(true);
    expect(state.afterMove).toEqual([
      { id: 'scene_b', slot: 2 },
      { id: 'scene_a', slot: 3 }
    ]);
    expect(state.swapped).toBe(true);
    expect(state.afterSwap).toEqual([
      { id: 'scene_a', slot: 2 },
      { id: 'scene_b', slot: 3 }
    ]);
    await expect.poll(() => scenePosts.length, { timeout: 5000 }).toBeGreaterThan(0);
    expect(scenePosts.at(-1).scenes.map(s => ({ id: s.id, slot: s.slot }))).toEqual([
      { id: 'scene_a', slot: 2 },
      { id: 'scene_b', slot: 3 }
    ]);
  });

  test('group move mode reorders saved group tiles without selecting them', async ({ page }) => {
    const groupPosts = [];
    await page.route('**/group_setup.php', async route => {
      if (route.request().method() !== 'GET') {
        groupPosts.push(JSON.parse(route.request().postData()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, groups: [] })
      });
    });

    const state = await page.evaluate(() => {
      savedGroupsLoaded = true;
      savedGroups = [
        { id: 'grp_a', name: 'Group A', fixtureIds: [101], values: {} },
        { id: 'grp_b', name: 'Group B', fixtureIds: [102], values: {} },
        { id: 'grp_c', name: 'Group C', fixtureIds: [103], values: {} }
      ];
      groupCols = 3;
      groupRows = 2;
      activeSavedGroupIds.clear();
      selectedFixtureIds.clear();
      renderSavedGroupsList();
      document.getElementById('moveGroupsBtn').click();
      document.querySelector('[data-group-index="0"]').click();
      const clickDidNotSelect = selectedFixtureIds.size === 0 && activeSavedGroupIds.size === 0;
      const selectedForMove = groupMoveSelectedIndex === 0;
      document.querySelector('[data-group-index="2"]').click();
      return {
        moveMode: groupMoveMode,
        activeButton: document.getElementById('moveGroupsBtn').classList.contains('active'),
        clickDidNotSelect,
        selectedForMove,
        groups: savedGroups.map(g => ({ id: g.id, slot: g.slot }))
      };
    });

    expect(state.moveMode).toBe(true);
    expect(state.activeButton).toBe(true);
    expect(state.clickDidNotSelect).toBe(true);
    expect(state.selectedForMove).toBe(true);
    expect(state.groups).toEqual([
      { id: 'grp_c', slot: 0 },
      { id: 'grp_b', slot: 1 },
      { id: 'grp_a', slot: 2 }
    ]);
    await expect.poll(() => groupPosts.at(-1)?.groups?.map(g => ({ id: g.id, slot: g.slot })), { timeout: 5000 }).toEqual([
      { id: 'grp_c', slot: 0 },
      { id: 'grp_b', slot: 1 },
      { id: 'grp_a', slot: 2 }
    ]);
  });

  test('group move mode supports real drag and drop between group tiles', async ({ page }) => {
    const groupPosts = [];
    await page.route('**/group_setup.php', async route => {
      if (route.request().method() !== 'GET') {
        groupPosts.push(JSON.parse(route.request().postData()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, groups: [] })
      });
    });

    await page.evaluate(() => {
      savedGroupsLoaded = true;
      savedGroups = [
        { id: 'grp_a', name: 'Group A', fixtureIds: [101], values: {} },
        { id: 'grp_b', name: 'Group B', fixtureIds: [102], values: {} },
        { id: 'grp_c', name: 'Group C', fixtureIds: [103], values: {} }
      ];
      groupCols = 3;
      groupRows = 2;
      activeSavedGroupIds.clear();
      selectedFixtureIds.clear();
      renderSavedGroupsList();
      document.getElementById('moveGroupsBtn').click();
    });

    await page.locator('[data-group-index="0"]').dragTo(page.locator('[data-group-index="2"]'));

    await expect.poll(() => page.evaluate(() => savedGroups.map(g => ({ id: g.id, slot: g.slot })))).toEqual([
      { id: 'grp_c', slot: 0 },
      { id: 'grp_b', slot: 1 },
      { id: 'grp_a', slot: 2 }
    ]);
    await expect.poll(() => groupPosts.at(-1)?.groups?.map(g => ({ id: g.id, slot: g.slot })), { timeout: 5000 }).toEqual([
      { id: 'grp_c', slot: 0 },
      { id: 'grp_b', slot: 1 },
      { id: 'grp_a', slot: 2 }
    ]);
  });

  test('group move mode supports mouse drag between group tiles', async ({ page }) => {
    const groupPosts = [];
    await page.route('**/group_setup.php', async route => {
      if (route.request().method() !== 'GET') {
        groupPosts.push(JSON.parse(route.request().postData()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, groups: [] })
      });
    });

    await page.evaluate(() => {
      savedGroupsLoaded = true;
      savedGroups = [
        { id: 'grp_a', name: 'Group A', fixtureIds: [101], values: {} },
        { id: 'grp_b', name: 'Group B', fixtureIds: [102], values: {} },
        { id: 'grp_c', name: 'Group C', fixtureIds: [103], values: {} }
      ];
      groupCols = 3;
      groupRows = 2;
      activeSavedGroupIds.clear();
      selectedFixtureIds.clear();
      renderSavedGroupsList();
      document.getElementById('moveGroupsBtn').click();
    });

    const source = page.locator('[data-group-index="0"]');
    const target = page.locator('[data-group-index="2"]');
    await source.scrollIntoViewIfNeeded();
    await target.scrollIntoViewIfNeeded();
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    expect(sourceBox).toBeTruthy();
    expect(targetBox).toBeTruthy();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect.poll(() => page.evaluate(() => savedGroups.map(g => ({ id: g.id, slot: g.slot })))).toEqual([
      { id: 'grp_c', slot: 0 },
      { id: 'grp_b', slot: 1 },
      { id: 'grp_a', slot: 2 }
    ]);
    await expect.poll(() => groupPosts.at(-1)?.groups?.map(g => ({ id: g.id, slot: g.slot })), { timeout: 5000 }).toEqual([
      { id: 'grp_c', slot: 0 },
      { id: 'grp_b', slot: 1 },
      { id: 'grp_a', slot: 2 }
    ]);
  });

  test('group move mode supports dragging a group to an empty visible position', async ({ page }) => {
    const groupPosts = [];
    await page.route('**/group_setup.php', async route => {
      if (route.request().method() !== 'GET') {
        groupPosts.push(JSON.parse(route.request().postData()));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, groups: [] })
      });
    });

    await page.evaluate(() => {
      savedGroupsLoaded = true;
      savedGroups = [
        { id: 'grp_a', name: 'Group A', fixtureIds: [101], values: {} },
        { id: 'grp_b', name: 'Group B', fixtureIds: [102], values: {} }
      ];
      groupCols = 3;
      groupRows = 2;
      activeSavedGroupIds.clear();
      selectedFixtureIds.clear();
      renderSavedGroupsList();
      document.getElementById('moveGroupsBtn').click();
    });

    await expect(page.locator('[data-group-drop-index="4"]')).toContainText('5');
    await page.locator('[data-group-index="0"]').dragTo(page.locator('[data-group-drop-index="4"]'));

    await expect.poll(() => page.evaluate(() => savedGroups.map(g => ({ id: g.id, slot: g.slot })))).toEqual([
      { id: 'grp_b', slot: 1 },
      { id: 'grp_a', slot: 4 }
    ]);
    await expect.poll(() => groupPosts.at(-1)?.groups?.map(g => ({ id: g.id, slot: g.slot })), { timeout: 5000 }).toEqual([
      { id: 'grp_b', slot: 1 },
      { id: 'grp_a', slot: 4 }
    ]);
  });

  test('Fan Out symmetric spread calculates around snapshotted base values', async ({ page }) => {
    const result = await page.evaluate(() => {
      fixtures.push({ id: 104, name: 'A 2', profileId: 1, start: 61 });
      selectedFixtureIds = new Set([101, 104]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      values['101:11'] = 128;
      values['104:11'] = 128;
      drawSurface();
      const dimmer = fanControlOptions().find(o => o.label === 'Dimmer' && o.key === 'slider8:Dimmer:value');
      fanState.controlKey = dimmer.key;
      snapshotFanBases();
      fanState.mode = 'symmetric';
      fanState.spread = 100;
      fanState.inverted = false;
      return fanComputedValues().map(v => ({ id: v.fixture.id, base: v.base, finalVal: v.finalVal }));
    });

    expect(result).toEqual([
      { id: 101, base: 128, finalVal: 78 },
      { id: 104, base: 128, finalVal: 178 }
    ]);
  });

  test('Fan Out negative spread reverses the symmetric direction without an Invert button', async ({ page }) => {
    const result = await page.evaluate(() => {
      fixtures.push({ id: 104, name: 'A 2', profileId: 1, start: 61 });
      selectedFixtureIds = new Set([101, 104]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      values['101:11'] = 128;
      values['104:11'] = 128;
      drawSurface();
      const dimmer = fanControlOptions().find(o => o.label === 'Dimmer' && o.key === 'slider8:Dimmer:value');
      fanState.controlKey = dimmer.key;
      snapshotFanBases();
      fanState.mode = 'symmetric';
      fanState.spread = -100;
      renderFanToolbox();
      return {
        preview: fanComputedValues().map(v => ({ id: v.fixture.id, base: v.base, finalVal: v.finalVal })),
        sliderMin: document.getElementById('fanSpread').min,
        sliderValue: document.getElementById('fanSpread').value,
        readout: document.getElementById('fanSpreadReadout').textContent,
        hasInvert: !!document.getElementById('fanInvert')
      };
    });

    expect(result.preview).toEqual([
      { id: 101, base: 128, finalVal: 178 },
      { id: 104, base: 128, finalVal: 78 }
    ]);
    expect(result.sliderMin).toBe('-255');
    expect(result.sliderValue).toBe('-100');
    expect(result.readout).toBe('-100');
    expect(result.hasInvert).toBe(false);
  });


  test('Fan Out core behavior is provided by DmxCommon', async ({ page }) => {
    const result = await page.evaluate(() => {
      const valuesByKey = { '1:11': 128, '2:21': 128 };
      const fixturesData = [
        { id: 1, controls: [{ id: 11, type: 'slider8', label: 'Dimmer', channel: 1 }] },
        { id: 2, controls: [{ id: 21, type: 'slider8', label: 'Dimmer', channel: 1 }] }
      ];
      const state = { controlKey: '', mode: 'symmetric', spread: 100, fromOffset: 0, toOffset: 0, inverted: false, bases: {} };
      const fan = DmxCommon.createFanOutController({
        state,
        controlsFor: fixture => fixture.controls,
        compatibilityKey: control => control.type + ':' + control.label,
        controlId: control => control.id,
        controlLabel: control => control.label,
        controlType: control => control.type,
        hasChannel: control => control.channel >= 1,
        fixtureId: fixture => fixture.id,
        getValue: (fixture, control, def = 0) => valuesByKey[fixture.id + ':' + control.id] ?? def,
        setValue: (fixture, control, value) => { valuesByKey[fixture.id + ':' + control.id] = value; }
      });

      const options = fan.controlOptions(fixturesData);
      state.controlKey = options[0].key;
      fan.snapshotBases(fixturesData);
      const preview = fan.computedValues(fixturesData).map(item => ({ id: item.fixture.id, base: item.base, finalVal: item.finalVal }));
      fan.apply(fixturesData);
      fan.resetOffsets();
      return { options, preview, valuesByKey, spread: state.spread, fromOffset: state.fromOffset, toOffset: state.toOffset };
    });

    expect(result.options).toEqual([{ key: 'slider8:Dimmer:value', label: 'Dimmer', max: 255 }]);
    expect(result.preview).toEqual([
      { id: 1, base: 128, finalVal: 78 },
      { id: 2, base: 128, finalVal: 178 }
    ]);
    expect(result.valuesByKey).toMatchObject({ '1:11': 78, '2:21': 178 });
    expect(result).toMatchObject({ spread: 0, fromOffset: 0, toOffset: 0 });
  });

  test('Fan Out works across fixtures with matching controls but different control ids', async ({ page }) => {
    const result = await page.evaluate(() => {
      selectedFixtureIds = new Set([101, 102]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      values['101:11'] = 128;
      values['102:21'] = 128;
      drawSurface();

      const options = fanControlOptions().map(o => ({ key: o.key, label: o.label }));
      const dimmer = fanControlOptions().find(o => o.label === 'Dimmer');
      if (dimmer) {
        fanState.controlKey = dimmer.key;
        snapshotFanBases();
        fanState.mode = 'symmetric';
        fanState.spread = 100;
        applyFanToController({ silent: true });
      }
      return {
        options,
        dimmerKey: dimmer?.key || '',
        a: values['101:11'],
        b: values['102:21'],
        affected: [...fanAffectedKeys].sort(),
        status: document.getElementById('status').textContent
      };
    });

    expect(result.options).toEqual([{ key: 'slider8:Dimmer:value', label: 'Dimmer' }]);
    expect(result.dimmerKey).toBe('slider8:Dimmer:value');
    expect(result.a).toBe(78);
    expect(result.b).toBe(178);
    expect(result.affected).toEqual(['101:11', '102:21']);
  });

  test('Fan Out control selection resets spread offsets to zero', async ({ page }) => {
    const result = await page.evaluate(() => {
      selectedFixtureIds = new Set([101]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      drawSurface();
      renderFanToolbox();

      const select = document.getElementById('fanControlSelect');
      const options = [...select.options].map(option => option.value);
      fanState.controlKey = options[0];
      fanState.mode = 'symmetric';
      fanState.spread = 120;
      fanState.fromOffset = -40;
      fanState.toOffset = 40;
      renderFanToolbox();

      select.value = options[1];
      select.dispatchEvent(new Event('change', { bubbles: true }));

      return {
        optionCount: options.length,
        controlKey: fanState.controlKey,
        spread: fanState.spread,
        fromOffset: fanState.fromOffset,
        toOffset: fanState.toOffset,
        slider: document.getElementById('fanSpread').value,
        readout: document.getElementById('fanSpreadReadout').textContent
      };
    });

    expect(result.optionCount).toBeGreaterThan(1);
    expect(result.spread).toBe(0);
    expect(result.fromOffset).toBe(0);
    expect(result.toOffset).toBe(0);
    expect(result.slider).toBe('0');
    expect(result.readout).toBe('0');
  });

  test('Fan Out spread can be nudged by a user-defined fine step', async ({ page }) => {
    const posts = [];
    await page.route('**/ui_state.php', async route => {
      if (route.request().method() === 'POST') {
        posts.push(route.request().postDataJSON());
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      await route.fallback();
    });

    const result = await page.evaluate(() => {
      selectedFixtureIds = new Set([101, 102]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      drawSurface();
      renderFanToolbox();

      const option = fanControlOptions().find(o => o.label === 'Dimmer');
      fanState.controlKey = option.key;
      fanState.mode = 'symmetric';
      fanState.spread = 10;
      renderFanToolbox();

      document.getElementById('fanSpreadStep').value = '3';
      document.getElementById('fanSpreadUp').click();
      const afterUp = {
        spread: fanState.spread,
        slider: document.getElementById('fanSpread').value,
        readout: document.getElementById('fanSpreadReadout').textContent
      };
      document.getElementById('fanSpreadDown').click();
      document.getElementById('fanSpreadDown').click();
      document.getElementById('fanSpreadDown').click();
      document.getElementById('fanSpreadDown').click();
      document.getElementById('fanSpreadDown').click();
      return {
        afterUp,
        afterDown: {
          spread: fanState.spread,
          slider: document.getElementById('fanSpread').value,
          readout: document.getElementById('fanSpreadReadout').textContent
        }
      };
    });

    expect(result.afterUp).toEqual({ spread: 13, slider: '13', readout: '13' });
    expect(result.afterDown).toEqual({ spread: -2, slider: '-2', readout: '-2' });
    await expect.poll(() => posts, { timeout: 5000 }).toContainEqual(expect.objectContaining({
      page: 'fixture',
      state: expect.objectContaining({
        fanOutState: expect.objectContaining({
          mode: 'symmetric',
          spread: -2,
          spreadStep: 3
        })
      })
    }));
  });

  test('Fan Out Clear resets the shaping controls', async ({ page }) => {
    const result = await page.evaluate(() => {
      selectedFixtureIds = new Set([101, 102]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys = new Set(['101:11']);
      drawSurface();
      renderFanToolbox();

      const option = fanControlOptions().find(o => o.label === 'Dimmer');
      fanState.controlKey = option.key;
      fanState.mode = 'range';
      fanState.spread = 90;
      fanState.fromOffset = -30;
      fanState.toOffset = 60;
      fanState.inverted = true;
      renderFanToolbox();
      document.getElementById('fanClear').click();

      return {
        spread: fanState.spread,
        fromOffset: fanState.fromOffset,
        toOffset: fanState.toOffset,
        inverted: fanState.inverted,
        affected: [...fanAffectedKeys],
        slider: document.getElementById('fanSpread').value,
        readout: document.getElementById('fanSpreadReadout').textContent,
        hasInvert: !!document.getElementById('fanInvert')
      };
    });

    expect(result.spread).toBe(0);
    expect(result.fromOffset).toBe(0);
    expect(result.toOffset).toBe(0);
    expect(result.inverted).toBe(false);
    expect(result.affected).toEqual([]);
    expect(result.slider).toBe('0');
    expect(result.readout).toBe('0');
    expect(result.hasInvert).toBe(false);
  });
});

test.describe('Fixture Controller reload rules', () => {
  test('toolbox Group Edit enables after a hard reload and manual fixture selection with no group filter', async ({ page }) => {
    await routeControllerCompactServerSetup(page);
    await openDmxPage(page, '');
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.locator('[data-fixture-card="101"]')).toBeVisible();
    await expect(page.locator('[data-fixture-card="102"]')).toBeVisible();
    let state = await page.evaluate(() => ({
      selectedFixtures: [...selectedFixtureIds],
      selectedGroups: selectedSavedGroups().length,
      groupBarButtonExists: !!document.getElementById('openGroupEdit'),
      toolboxDisabled: document.getElementById('editSelectedGroups')?.disabled
    }));
    expect(state.selectedFixtures).toEqual([]);
    expect(state.selectedGroups).toBe(0);
    expect(state.groupBarButtonExists).toBe(false);
    expect(state.toolboxDisabled).toBe(true);

    await page.locator('[data-fixture-card="101"] .fixture-head').click();
    await page.locator('[data-fixture-card="102"] .fixture-head').click();

    state = await page.evaluate(() => ({
      selectedFixtures: [...selectedFixtureIds],
      selectedGroups: selectedSavedGroups().length,
      sharedGroups: JSON.parse(localStorage.getItem('selectedGroupIds') || '[]'),
      controls: getGroupEditableControls().map(groupKey),
      toolboxDisabled: document.getElementById('editSelectedGroups')?.disabled
    }));

    expect(state.selectedFixtures.sort()).toEqual([101, 102]);
    expect(state.selectedGroups).toBe(0);
    expect(state.sharedGroups).toEqual([]);
    expect(state.controls).toContain('slider8:Dimmer');
    expect(state.toolboxDisabled).toBe(false);
  });

  test('Select All is the explicit way to enable toolbox Group Edit for all fixtures after hard reload', async ({ page }) => {
    await routeControllerCompactServerSetup(page);
    await openDmxPage(page, '');
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.locator('#selectAllFixtures')).toBeVisible();
    await expect(page.locator('#openGroupEdit')).toHaveCount(0);
    await expect(page.locator('#editSelectedGroups')).toBeDisabled();
    await page.locator('#selectAllFixtures').click();

    const state = await page.evaluate(() => ({
      selectedFixtures: [...selectedFixtureIds],
      selectedGroups: selectedSavedGroups().length,
      controls: getGroupEditableControls().map(groupKey),
      toolboxDisabled: document.getElementById('editSelectedGroups')?.disabled
    }));

    expect(state.selectedFixtures.sort()).toEqual([101, 102, 103]);
    expect(state.selectedGroups).toBe(0);
    expect(state.controls).toContain('slider8:Dimmer');
    expect(state.toolboxDisabled).toBe(false);

    await page.locator('#editSelectedGroups').click();
    await expect(page.locator('#groupModal')).toBeVisible();
    await expect(page.locator('#groupModalBody .control h3')).toHaveText(['Dimmer']);
  });

  test('late empty group selection load does not clear manual fixture selection after hard reload', async ({ page }) => {
    let releaseGroups;
    const groupsReady = new Promise(resolve => { releaseGroups = resolve; });

    await page.route('**/fixture_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            baseUrl: '',
            profiles: [
              {
                id: 1,
                name: 'Profile A',
                mode: 'test',
                channels: 8,
                controls: [
                  { id: 11, type: 'slider8', label: 'Dimmer', channel: 1 }
                ]
              }
            ],
            fixtures: [
              { id: 101, name: 'A 1', profileId: 1, start: 1 },
              { id: 102, name: 'A 2', profileId: 1, start: 11 }
            ],
            values: {}
          }
        })
      });
    });
    await page.route('**/group_setup.php**', async route => {
      if (route.request().method() !== 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await groupsReady;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, baseUrl: '', groups: [] })
      });
    });
    await page.route('**/ui_state.php**', async route => {
      if (route.request().method() !== 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, state: { toolboxes: { selectedGroupIds: [] } } })
      });
    });

    await openDmxPage(page, '');
    await expect(page.locator('[data-fixture-card="101"]')).toBeVisible();
    await page.locator('[data-fixture-card="101"] .fixture-head').click();
    await page.locator('[data-fixture-card="102"] .fixture-head').click();
    releaseGroups();
    await page.waitForResponse(response => response.url().includes('group_setup.php') && response.request().method() === 'GET');
    await page.waitForTimeout(100);

    const state = await page.evaluate(() => ({
      selectedFixtures: [...selectedFixtureIds],
      selectedGroups: selectedSavedGroups().length,
      toolboxDisabled: document.getElementById('editSelectedGroups')?.disabled
    }));

    expect(state.selectedFixtures.sort()).toEqual([101, 102]);
    expect(state.selectedGroups).toBe(0);
    expect(state.toolboxDisabled).toBe(false);
  });
});
