const { test, expect } = require('@playwright/test');
const { openDmxPage, injectMotionCompactSetup } = require('./helpers/dmx-page');

test.describe('Motion FX established rules', () => {
  test.beforeEach(async ({ page }) => {
    await openDmxPage(page, 'dmx_motion.html');
    await injectMotionCompactSetup(page);
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
