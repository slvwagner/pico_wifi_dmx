const { test, expect } = require('@playwright/test');
const { openDmxPage, injectControllerCompactSetup } = require('./helpers/dmx-page');

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
        disabled: document.getElementById('openGroupEdit').disabled
      };
    });

    expect(state.disabled).toBe(false);
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

  test('manual fixture selection clears the shared Groups toolbox selection', async ({ page }) => {
    const result = await page.evaluate(() => {
      activeSavedGroupIds = new Set([savedGroupKey(savedGroups[0], 0)]);
      rebuildSelectionFromSavedGroups();
      DmxCommon.saveSharedGroupSelection(selectedSavedGroupIds());
      renderSavedGroupsList();
      drawSurface();
      document.querySelector('[data-select-fixture="101"]').click();
      return {
        selectedGroups: selectedSavedGroups().length,
        shared: JSON.parse(localStorage.getItem('selectedGroupIds') || '[]')
      };
    });

    expect(result.selectedGroups).toBe(0);
    expect(result.shared).toEqual([]);
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
