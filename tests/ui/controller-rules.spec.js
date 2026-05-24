const { test, expect } = require('@playwright/test');
const {
  openDmxPage,
  routeControllerCompactServerSetup,
  injectControllerCompactSetup
} = require('./helpers/dmx-page');

test.describe('Fixture Controller established rules', () => {
  test.beforeEach(async ({ page }) => {
    await openDmxPage(page, '');
    await injectControllerCompactSetup(page);
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

        const modal = document.querySelector('#groupModal .modal');
        const body = document.getElementById('groupModalBody');
        const controls = body.querySelectorAll('.control');
        body.scrollTop = body.scrollHeight;
        const last = controls[controls.length - 1];
        const lastRect = last.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const footerRect = document.querySelector('#groupModal .buttons').getBoundingClientRect();
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

  test('manual fixture selection clears the shared Groups toolbox selection', async ({ page }) => {
    const result = await page.evaluate(() => {
      activeSavedGroupIds = new Set([savedGroupKey(savedGroups[0], 0)]);
      rebuildSelectionFromSavedGroups();
      DmxCommon.saveSharedGroupSelection(selectedSavedGroupIds());
      renderSavedGroupsList();
      drawSurface();
      document.querySelector('[data-fixture-card="101"]').click();
      return {
        selectedGroups: selectedSavedGroups().length,
        shared: JSON.parse(localStorage.getItem('selectedGroupIds') || '[]')
      };
    });

    expect(result.selectedGroups).toBe(0);
    expect(result.shared).toEqual([]);
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
        visibleCards: [...document.querySelectorAll('#surface article h2')].map(el => el.textContent)
      };
    });

    expect(result.selectedGroups).toBe(0);
    expect(result.shared).toEqual([]);
    expect(result.selectedFixtures).toEqual([101]);
    expect(result.sceneFilter).toBe(true);
    expect(result.visibleCards).toEqual(['A 1']);
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
      const dimmer = fanControlOptions().find(o => o.label === 'Dimmer' && o.key === '11:value');
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
