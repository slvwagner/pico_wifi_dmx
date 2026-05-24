const { test, expect } = require('@playwright/test');
const { openDmxPage, injectMotionCompactSetup } = require('./helpers/dmx-page');

test.describe('Motion FX established rules', () => {
  test.beforeEach(async ({ page }) => {
    await openDmxPage(page, 'dmx_motion.html');
    await injectMotionCompactSetup(page);
  });

  test('Effect Target starts at None and does not enable fixtures automatically', async ({ page }) => {
    const initial = await page.evaluate(() => ({
      target: selectedMotionTargetKey,
      filterValue: document.getElementById('motionControlFilter').value,
      effectDisabled: document.getElementById('effectType').disabled,
      enabled: motionFixtures.filter(mf => mf.enabled).length,
      groupEdit: getMotionGroupCommonControls().length > 0
    }));

    expect(initial.target).toBe('');
    expect(initial.filterValue).toBe('');
    expect(initial.effectDisabled).toBe(true);
    expect(initial.enabled).toBe(0);
    expect(initial.groupEdit).toBe(false);

    const afterTarget = await page.evaluate(() => {
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      document.getElementById('motionControlFilter').value = motionControlKey(scalar.control);
      document.getElementById('motionControlFilter').dispatchEvent(new Event('change'));
      return {
        target: selectedMotionTargetKey,
        enabled: motionFixtures.filter(mf => mf.enabled).length,
        visible: [...document.querySelectorAll('#fixtureList [data-mf] .motion-tile-title')].map(el => el.textContent),
        groupEdit: getMotionGroupCommonControls().length > 0
      };
    });

    expect(afterTarget.target).toContain('Dimmer');
    expect(afterTarget.enabled).toBe(0);
    expect(afterTarget.visible.sort()).toEqual(['A 1', 'B 1']);
    expect(afterTarget.groupEdit).toBe(false);
  });

  test('effect dropdown is filtered by the selected target family', async ({ page }) => {
    const result = await page.evaluate(() => {
      const pan = motionFixtures.find(mf => mf.kind === 'panTilt');
      selectedMotionTargetKey = motionControlKey(pan.control);
      populateEffectTypeFilter();
      const panOptions = [...document.getElementById('effectType').options].map(o => o.value);
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(scalar.control);
      populateEffectTypeFilter();
      const scalarOptions = [...document.getElementById('effectType').options].map(o => o.value);
      return { panOptions, scalarOptions };
    });

    expect(result.panOptions).toEqual(['circle', 'figure8', 'panSwing', 'tiltSwing']);
    expect(result.scalarOptions).toEqual(['sine', 'pulse']);
  });

  test('All enables every fixture for the current effect target and clears group filtering', async ({ page }) => {
    await page.locator('#motionGroupsBox [data-group-index="0"]').click();
    const result = await page.evaluate(() => {
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(scalar.control);
      document.getElementById('btnMotionAll').click();
      return {
        selectedGroups: motionGroupsBox.selectedGroups().length,
        enabledFixtures: motionFixtures
          .filter(mf => mf.enabled && motionControlKey(mf.control) === selectedMotionTargetKey)
          .map(mf => mf.fixture.id)
      };
    });

    expect(result.selectedGroups).toBe(0);
    expect(result.enabledFixtures.sort()).toEqual([101, 102]);
  });

  test('Group Edit uses the selected effect target and requires two matching participating fixtures', async ({ page }) => {
    const result = await page.evaluate(() => {
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(scalar.control);
      motionFixtures.forEach(mf => mf.enabled = motionControlKey(mf.control) === selectedMotionTargetKey);
      refreshMotionGroupActions();
      return {
        fixtures: motionGroupFixtureIds().sort(),
        controls: getMotionGroupCommonControls().map(motionGroupKey)
      };
    });

    expect(result.fixtures).toEqual([101, 102]);
    expect(result.controls).toEqual(['slider8:Dimmer:value']);
  });

  test('None disables every visible fixture for the current effect target', async ({ page }) => {
    const result = await page.evaluate(() => {
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(scalar.control);
      setMotionParticipationByKey(selectedMotionTargetKey, 'all');
      document.getElementById('btnMotionNone').click();
      return motionFixtures
        .filter(mf => motionControlKey(mf.control) === selectedMotionTargetKey)
        .map(mf => ({ id: mf.fixture.id, enabled: mf.enabled }));
    });

    expect(result).toEqual([
      { id: 101, enabled: false },
      { id: 102, enabled: false }
    ]);
  });

  test('selected groups filter the fixture matrix for the current target', async ({ page }) => {
    await page.evaluate(() => {
      motionGroupsBox.groups.length = 0;
      motionGroupsBox.groups.push({ id: 'grp_a', name: 'A only', fixtureIds: [101], values: {} });
      motionGroupsBox.render();
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(scalar.control);
      setMotionParticipationByKey(selectedMotionTargetKey, 'all');
    });
    await page.locator('#motionGroupsBox [data-group-index="0"]').click();

    const visible = await page.evaluate(() =>
      [...document.querySelectorAll('#fixtureList [data-mf] .motion-tile-title')].map(el => el.textContent)
    );

    expect(visible).toEqual(['A 1']);
  });
});

test.describe('Motion FX navigation rules', () => {
  test('restored selected target fixtures keep Group Edit enabled after navigating away and back', async ({ page }) => {
    const profiles = [{
      id: 1,
      name: 'Profile A',
      mode: 'test',
      channels: 8,
      controls: [
        { id: 12, type: 'panTilt16', label: 'Pan/Tilt', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 }
      ]
    }];
    const fixtures = [
      { id: 101, name: 'A 1', profileId: 1, start: 1 },
      { id: 102, name: 'A 2', profileId: 1, start: 21 }
    ];
    const targetKey = 'panTilt16:Pan/Tilt:panTilt';
    const motionState = {
      baseUrl: '',
      targetKey,
      params: { effectType: 'circle', bpm: 60, panAmp: 25, tiltAmp: 25, phaseSpread: 0, updateRate: 20 },
      effects: [],
      fixtures: fixtures.map(f => ({
        fixtureId: f.id,
        controlId: 12,
        kind: 'panTilt',
        enabled: true,
        phaseOffset: 0,
        basePan: 32768,
        baseTilt: 32768
      }))
    };

    await page.route('**/fixture_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, setup: { baseUrl: '', profiles, fixtures, values: {} } })
      });
    });
    await page.route('**/motion_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, motion: motionState, pico_slots: [] })
      });
    });
    await page.route('**/group_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, baseUrl: '', groups: [] })
      });
    });
    await page.route('**/ui_state.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, state: { toolboxes: { selectedGroupIds: [] } } })
      });
    });

    await openDmxPage(page, 'dmx_motion.html');
    await expect(page.locator('#motionControlFilter')).toHaveValue(targetKey);
    await expect(page.locator('#motionGroupsEdit')).toBeEnabled();

    await page.locator('header a[href="dmx_chaser.html"]').click();
    await expect(page.locator('header h1')).toHaveText('DMX Chaser');
    await page.locator('header a[href="dmx_motion.html"]').click();
    await expect(page.locator('header h1')).toHaveText(/Motion/);
    await expect(page.locator('#motionControlFilter')).toHaveValue(targetKey);

    const state = await page.evaluate(() => ({
      enabledFixtures: motionFixtures.filter(mf => mf.enabled && motionControlKey(mf.control) === selectedMotionTargetKey).map(mf => mf.fixture.id),
      commonControls: getMotionGroupCommonControls().map(motionGroupKey),
      groupEditDisabled: document.getElementById('motionGroupsEdit').disabled
    }));

    expect(state.enabledFixtures.sort()).toEqual([101, 102]);
    expect(state.commonControls).toEqual([targetKey]);
    expect(state.groupEditDisabled).toBe(false);
  });
});
