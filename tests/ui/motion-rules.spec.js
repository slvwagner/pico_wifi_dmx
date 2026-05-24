const { test, expect } = require('@playwright/test');
const { openDmxPage, routeMotionCompactServerSetup, injectMotionCompactSetup } = require('./helpers/dmx-page');

test.describe('Motion FX established rules', () => {
  test.beforeEach(async ({ page }) => {
    await routeMotionCompactServerSetup(page);
    await page.route('**/group_setup.php**', async route => {
      if (route.request().method() !== 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
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
    await page.addInitScript(() => sessionStorage.removeItem('dmxMotionWorkingState'));
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
    expect(afterTarget.groupEdit).toBe(true);
  });

  test('choosing Dimmer after reload enables Group Edit across different fixture types without enabling playback', async ({ page }) => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await injectMotionCompactSetup(page);

    const result = await page.evaluate(() => {
      const sel = document.getElementById('motionControlFilter');
      const dimmer = [...sel.options].find(o => o.textContent.includes('Dimmer'));
      sel.value = dimmer.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        selectedTarget: selectedMotionTargetKey,
        enabledFixtures: motionFixtures.filter(mf => mf.enabled).length,
        editFixtures: motionGroupEditFixtures().map(mf => ({
          fixture: mf.fixture.id,
          profile: fixtureProfile(mf.fixture)?.name,
          label: mf.control.label
        })),
        controls: getMotionGroupCommonControls().map(motionGroupKey),
        groupEditDisabled: document.getElementById('motionGroupsEdit')?.disabled
      };
    });

    expect(result.selectedTarget).toContain('Dimmer');
    expect(result.enabledFixtures).toBe(0);
    expect(result.editFixtures.map(f => f.fixture).sort()).toEqual([101, 102]);
    expect(new Set(result.editFixtures.map(f => f.profile)).size).toBe(2);
    expect(result.controls).toEqual(['slider8:Dimmer:value']);
    expect(result.groupEditDisabled).toBe(false);
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

  test('scalar targets show one amplitude slider and force hidden tilt amplitude to zero', async ({ page }) => {
    const result = await page.evaluate(() => {
      document.getElementById('panAmp').value = 22;
      document.getElementById('panAmpVal').textContent = '22';
      document.getElementById('tiltAmp').value = 37;
      document.getElementById('tiltAmpVal').textContent = '37';
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      setMotionTarget(motionControlKey(scalar.control));
      const scalarState = {
        panLabel: document.getElementById('panAmpLabel').childNodes[0].nodeValue.trim(),
        tiltDisplay: getComputedStyle(document.getElementById('tiltAmpLabel')).display,
        tiltValue: document.getElementById('tiltAmp').value,
        tiltText: document.getElementById('tiltAmpVal').textContent,
        serializedAmp2: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP2 '))
      };

      const pan = motionFixtures.find(mf => mf.kind === 'panTilt');
      setMotionTarget(motionControlKey(pan.control));
      const panTiltState = {
        panLabel: document.getElementById('panAmpLabel').childNodes[0].nodeValue.trim(),
        panDisplay: getComputedStyle(document.getElementById('panAmpLabel')).display,
        panValue: document.getElementById('panAmp').value,
        tiltDisplay: getComputedStyle(document.getElementById('tiltAmpLabel')).display,
        tiltValue: document.getElementById('tiltAmp').value,
        serializedAmp1: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP1 ')),
        serializedAmp2: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP2 '))
      };
      return { scalarState, panTiltState };
    });

    expect(result.scalarState.panLabel).toBe('Amplitude');
    expect(result.scalarState.tiltDisplay).toBe('none');
    expect(result.scalarState.tiltValue).toBe('0');
    expect(result.scalarState.tiltText).toBe('0');
    expect(result.scalarState.serializedAmp2).toBe('AMP2 0.000000');
    expect(result.panTiltState.panLabel).toBe('Pan amp');
    expect(result.panTiltState.panDisplay).not.toBe('none');
    expect(result.panTiltState.panValue).toBe('22');
    expect(result.panTiltState.tiltDisplay).not.toBe('none');
    expect(result.panTiltState.tiltValue).toBe('37');
    expect(result.panTiltState.serializedAmp1).toBe('AMP1 0.220000');
    expect(result.panTiltState.serializedAmp2).toBe('AMP2 0.370000');
  });

  test('one-axis pan and tilt swing effects hide and zero the unused axis without losing two-axis values', async ({ page }) => {
    const result = await page.evaluate(() => {
      const pan = motionFixtures.find(mf => mf.kind === 'panTilt');
      setMotionTarget(motionControlKey(pan.control));
      document.getElementById('panAmp').value = 44;
      document.getElementById('panAmpVal').textContent = '44';
      document.getElementById('tiltAmp').value = 66;
      document.getElementById('tiltAmpVal').textContent = '66';

      const effect = document.getElementById('effectType');
      effect.value = 'panSwing';
      effect.dispatchEvent(new Event('change'));
      const panSwing = {
        panDisplay: getComputedStyle(document.getElementById('panAmpLabel')).display,
        panValue: document.getElementById('panAmp').value,
        tiltDisplay: getComputedStyle(document.getElementById('tiltAmpLabel')).display,
        tiltValue: document.getElementById('tiltAmp').value,
        amp1: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP1 ')),
        amp2: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP2 '))
      };

      effect.value = 'tiltSwing';
      effect.dispatchEvent(new Event('change'));
      const tiltSwing = {
        panDisplay: getComputedStyle(document.getElementById('panAmpLabel')).display,
        panValue: document.getElementById('panAmp').value,
        tiltDisplay: getComputedStyle(document.getElementById('tiltAmpLabel')).display,
        tiltValue: document.getElementById('tiltAmp').value,
        amp1: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP1 ')),
        amp2: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP2 '))
      };

      effect.value = 'circle';
      effect.dispatchEvent(new Event('change'));
      const circle = {
        panDisplay: getComputedStyle(document.getElementById('panAmpLabel')).display,
        panValue: document.getElementById('panAmp').value,
        tiltDisplay: getComputedStyle(document.getElementById('tiltAmpLabel')).display,
        tiltValue: document.getElementById('tiltAmp').value,
        amp1: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP1 ')),
        amp2: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP2 '))
      };
      return { panSwing, tiltSwing, circle };
    });

    expect(result.panSwing.panDisplay).not.toBe('none');
    expect(result.panSwing.panValue).toBe('44');
    expect(result.panSwing.tiltDisplay).toBe('none');
    expect(result.panSwing.tiltValue).toBe('0');
    expect(result.panSwing.amp1).toBe('AMP1 0.440000');
    expect(result.panSwing.amp2).toBe('AMP2 0.000000');

    expect(result.tiltSwing.panDisplay).toBe('none');
    expect(result.tiltSwing.panValue).toBe('0');
    expect(result.tiltSwing.tiltDisplay).not.toBe('none');
    expect(result.tiltSwing.tiltValue).toBe('66');
    expect(result.tiltSwing.amp1).toBe('AMP1 0.000000');
    expect(result.tiltSwing.amp2).toBe('AMP2 0.660000');

    expect(result.circle.panDisplay).not.toBe('none');
    expect(result.circle.panValue).toBe('44');
    expect(result.circle.tiltDisplay).not.toBe('none');
    expect(result.circle.tiltValue).toBe('66');
    expect(result.circle.amp1).toBe('AMP1 0.440000');
    expect(result.circle.amp2).toBe('AMP2 0.660000');
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
    await page.locator('#btnMotionLoad').click();
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

  test('hard reload resets Effect Target to None even when a saved motion setup exists', async ({ page }) => {
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
      effects: [{ id: 'fx_1', name: 'Circle', slot: 0, recipe: { targetKey, params: {}, fixtures: [] } }],
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
    await page.locator('#btnMotionLoad').click();
    await expect(page.locator('#motionControlFilter')).toHaveValue(targetKey);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#motionControlFilter')).toHaveValue('');
    await expect(page.locator('#motionEffectMatrix .slot.filled')).toHaveCount(1);
  });
});
