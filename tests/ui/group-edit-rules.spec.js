const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  openDmxPage,
  routeControllerCompactServerSetup,
  injectChaserCompactSetup,
  injectMotionCompactSetup
} = require('./helpers/dmx-page');

test.describe('Cross-page Group Edit contract', () => {
  test('Controller, Chaser, Show, Room Plane, and Effects use the shared Group Edit renderer', async () => {
    const root = path.resolve(__dirname, '..', '..');
    const common = fs.readFileSync(path.join(root, 'web', 'assets', 'dmx-common.js'), 'utf8');
    expect(common).toContain('function fixtureGroupEditControlHtml(options={})');
    expect(common).toContain('fixtureGroupEditControlHtml,');
    expect(common).toContain('function createGroupEditRelativeStepStore(options={})');
    expect(common).toContain('createGroupEditRelativeStepStore,');
    expect(common).toContain('function fixtureGroupEditCompatibilityKey(control)');
    expect(common).toContain('function fixtureGroupEditConvertValue(value,fromControl,toControl,currentTargetValue=null)');
    expect(common).toContain('fixtureGroupEditCompatibilityKey,');
    expect(common).toContain('fixtureGroupEditConvertValue,');

    for (const file of [
      'dmx_fixture_controller.html',
      'dmx_chaser.html',
      'dmx_show.html',
      'dmx_room_plane.html',
      'dmx_motion.html'
    ]) {
      const html = fs.readFileSync(path.join(root, 'web', file), 'utf8');
      expect(html, file).toContain('DmxCommon.fixtureGroupEditControlHtml({');
      expect(html, file).toContain('DmxCommon.createGroupEditRelativeStepStore({');
    }
  });

  test('Controller: hard reload plus Select All enables Group Edit for mixed fixture types', async ({ page }) => {
    await routeControllerCompactServerSetup(page);
    await openDmxPage(page, '');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('header h1')).toBeVisible();

    await page.locator('#selectAllFixtures').click();
    await expect(page.locator('#editSelectedGroups')).toBeEnabled();
    await page.locator('#editSelectedGroups').click();

    await expect(page.locator('#groupModal')).toBeVisible();
    await expect(page.locator('#groupModalBody .control h3')).toHaveText(['Dimmer']);

    await page.locator('#groupModal').click({ position: { x: 8, y: 8 } });
    await expect(page.locator('#groupModal')).toBeVisible();
    await page.locator('#closeGroupModal2').click();
    await expect(page.locator('#groupModal')).toBeHidden();
  });

  test('Controller: optionally merges color modes and matching 8-bit/16-bit controls', async ({ page }) => {
    await routeControllerCompactServerSetup(page);
    await openDmxPage(page, '');
    await page.evaluate(() => {
      const profileB = profiles.find(profile => profile.id === 2);
      const profileA = profiles.find(profile => profile.id === 1);
      const profileC = profiles.find(profile => profile.id === 3);
      profileA.channels = 9;
      profileA.controls.push(
        { id: 13, type: 'rgb', label: 'RGB', a: 6, b: 7, c: 8 },
        { id: 14, type: 'slider8', label: 'Focus', channel: 9, capabilities: [{ type: 'Focus' }] }
      );
      profileB.channels = 10;
      profileB.controls = [
        { id: 21, type: 'slider16', label: 'Dimmer', channel: 1, fine: 2 },
        { id: 22, type: 'panTilt8', label: 'Position', pan: 3, tilt: 4 },
        { id: 23, type: 'rgbw', label: 'Color', a: 5, b: 6, c: 7, d: 8 },
        { id: 24, type: 'slider16', label: 'Focus', channel: 9, fine: 10, capabilities: [{ type: 'Focus' }] }
      ];
      profileC.controls = [{ id: 31, type: 'cmyk', label: 'CMYK', a: 1, b: 2, c: 3, d: 4 }];
      const fixtureB = fixtures.find(fixture => fixture.id === 102);
      setValue(fixtureB,profileB.controls[2],{ a: 1, b: 2, c: 3, d: 77 });
      const fixtureC = fixtures.find(fixture => fixture.id === 103);
      setValue(fixtureC,profileC.controls[0],{ a: 245, b: 235, c: 225, d: 66 });
      drawSurface();
    });

    await page.locator('#selectAllFixtures').click();
    await expect(page.locator('#editSelectedGroups')).toBeEnabled();
    await page.locator('#editSelectedGroups').click();
    await expect(page.locator('#groupModal')).toBeVisible();
    await expect(page.locator('#groupModalBody')).toContainText('No exact controls match');
    await expect(page.locator('#groupModal #mergeGroupControls')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#groupsBox #mergeGroupControls')).toHaveCount(0);

    await page.locator('#groupModal #mergeGroupControls').click();
    await expect(page.locator('#groupModal #mergeGroupControls')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#groupModalBody .control h3')).toHaveText(['Dimmer', 'Pan/Tilt', 'RGB', 'Focus']);
    await expect(page.locator('#groupModalBody .control[data-group-edit-merged="true"]')).toHaveCount(4);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#groupModalBody .control[data-group-edit-merged="true"]')).backgroundColor === getComputedStyle(document.getElementById('mergeGroupControls')).backgroundColor)).toBe(true);

    const dimmer = page.locator('#groupModalBody .control').filter({ has: page.locator('h3', { hasText: 'Dimmer' }) });
    await dimmer.locator('input[type="range"]:not([data-byte-part])').fill('32768');
    const position = page.locator('#groupModalBody .control').filter({ has: page.locator('h3', { hasText: 'Pan/Tilt' }) });
    await position.getByRole('button', { name: 'Center' }).click();
    const color = page.locator('#groupModalBody .control').filter({ has: page.locator('h3', { hasText: 'RGB' }) });
    await color.locator('input[type="range"][data-part="a"]').fill('200');
    const focus = page.locator('#groupModalBody .control').filter({ has: page.locator('h3', { hasText: 'Focus' }) });
    await focus.locator('input[type="range"]:not([data-byte-part])').fill('32768');

    expect(await page.evaluate(() => {
      const fixtureA = fixtures.find(fixture => fixture.id === 101);
      const fixtureB = fixtures.find(fixture => fixture.id === 102);
      const fixtureC = fixtures.find(fixture => fixture.id === 103);
      const dimmerA = fixtureProfile(fixtureA).controls.find(control => control.label === 'Dimmer');
      const dimmerB = fixtureProfile(fixtureB).controls.find(control => control.label === 'Dimmer');
      const positionA = fixtureProfile(fixtureA).controls.find(control => control.type === 'panTilt16');
      const positionB = fixtureProfile(fixtureB).controls.find(control => control.type === 'panTilt8');
      const colorA = fixtureProfile(fixtureA).controls.find(control => control.type === 'rgb');
      const colorB = fixtureProfile(fixtureB).controls.find(control => control.type === 'rgbw');
      const colorC = fixtureProfile(fixtureC).controls.find(control => control.type === 'cmyk');
      const focusA = fixtureProfile(fixtureA).controls.find(control => control.label === 'Focus');
      const focusB = fixtureProfile(fixtureB).controls.find(control => control.label === 'Focus');
      return {
        dimmerA: getValue(fixtureA, dimmerA),
        dimmerB: getValue(fixtureB, dimmerB),
        panA: getValue(fixtureA, positionA).pan,
        panB: getValue(fixtureB, positionB).pan,
        colorA: getValue(fixtureA, colorA),
        colorB: getValue(fixtureB, colorB),
        colorC: getValue(fixtureC, colorC),
        focusA: getValue(fixtureA, focusA),
        focusB: getValue(fixtureB, focusB)
      };
    })).toEqual({
      dimmerA: 128,
      dimmerB: 32768,
      panA: 32768,
      panB: 128,
      colorA: { a: 200, b: 0, c: 0 },
      colorB: { a: 200, b: 0, c: 0, d: 77 },
      colorC: { a: 55, b: 255, c: 255, d: 66 },
      focusA: 128,
      focusB: 32768
    });

    await page.locator('#groupModal #mergeGroupControls').click();
    await expect(page.locator('#groupModal #mergeGroupControls')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#groupModalBody')).toContainText('No exact controls match');

    await page.locator('#groupModal #mergeGroupControls').click();
    await page.evaluate(() => {
      const profileB = profiles.find(profile => profile.id === 2);
      profileB.controls.push({ id: 25, type: 'slider16', label: 'Focus', channel: 11, fine: 12 });
      renderGroupModalContent();
    });
    await expect(page.locator('#groupModalBody .control h3', { hasText: 'Focus' })).toHaveCount(0);
  });

  test('Show: offers the same optional color and 8-bit/16-bit Group Edit merge', async ({ page }) => {
    await routeControllerCompactServerSetup(page);
    await openDmxPage(page, 'dmx_show.html');
    await page.evaluate(() => {
      profiles = [
        { id: 1, name: 'A', channels: 9, controls: [
          { id: 11, type: 'slider8', label: 'Dimmer', channel: 1 },
          { id: 12, type: 'panTilt16', label: 'Pan/Tilt', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 },
          { id: 13, type: 'rgb', label: 'RGB', a: 6, b: 7, c: 8 },
          { id: 14, type: 'slider8', label: 'Focus', channel: 9 }
        ] },
        { id: 2, name: 'B', channels: 10, controls: [
          { id: 21, type: 'slider16', label: 'Dimmer', channel: 1, fine: 2 },
          { id: 22, type: 'panTilt8', label: 'Position', pan: 3, tilt: 4 },
          { id: 23, type: 'cmyk', label: 'CMYK', a: 5, b: 6, c: 7, d: 8 },
          { id: 24, type: 'slider16', label: 'Focus', channel: 9, fine: 10 }
        ] }
      ];
      fixtures = [
        { id: 101, name: 'A 1', profileId: 1, start: 1 },
        { id: 102, name: 'B 1', profileId: 2, start: 21 }
      ];
      selectedGroupIds.clear();
      selectedFixtureIds.clear();
      Object.keys(values).forEach(key => delete values[key]);
      setValue(fixtures[1], profiles[1].controls[2], { a: 245, b: 235, c: 225, d: 66 });
      updateShowGroupEditButton();
    });

    await page.locator('#showGroupEditBtn').click();
    await expect(page.locator('#showGroupModal')).toBeVisible();
    await expect(page.locator('#showMergeGroupControls')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#showMergeGroupControls').click();
    await expect(page.locator('#showMergeGroupControls')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#showGroupModalBody .control h3')).toHaveText(['Dimmer', 'Pan / Tilt', 'RGB', 'Focus']);
    await expect(page.locator('#showGroupModalBody .control[data-group-edit-merged="true"]')).toHaveCount(4);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#showGroupModalBody .control[data-group-edit-merged="true"]')).backgroundColor === getComputedStyle(document.getElementById('showMergeGroupControls')).backgroundColor)).toBe(true);

    expect(await page.evaluate(() => showGroupEditControls().map(row => ({
      key: row.key,
      type: row.control.type,
      targets: row.targets.map(target => target.control.type)
    })))).toEqual([
      { key: 'compatible:scalar:intensity', type: 'slider16', targets: ['slider8', 'slider16'] },
      { key: 'compatible:panTilt', type: 'panTilt16', targets: ['panTilt16', 'panTilt8'] },
      { key: 'compatible:color', type: 'rgb', targets: ['rgb', 'cmyk'] },
      { key: 'compatible:scalar:focus', type: 'slider16', targets: ['slider8', 'slider16'] }
    ]);

    const color = page.locator('#showGroupModalBody .control').filter({ has: page.locator('h3', { hasText: 'RGB' }) });
    await color.locator('input[type="range"][data-part="a"]').fill('200');
    const focus = page.locator('#showGroupModalBody .control').filter({ has: page.locator('h3', { hasText: 'Focus' }) });
    await focus.locator('input[type="range"]:not([data-byte-part])').fill('32768');
    expect(await page.evaluate(() => ({
      rgb: getValue(fixtures[0], profiles[0].controls[2]),
      cmyk: getValue(fixtures[1], profiles[1].controls[2]),
      focus8: getValue(fixtures[0], profiles[0].controls[3]),
      focus16: getValue(fixtures[1], profiles[1].controls[3])
    }))).toEqual({
      rgb: { a: 200, b: 0, c: 0 },
      cmyk: { a: 55, b: 235, c: 225, d: 66 },
      focus8: 128,
      focus16: 32768
    });
  });

  test('Chaser: Participating Controls All enables Group Edit without a selected step', async ({ page }) => {
    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    await page.locator('#btnSelAll').click();
    await expect(page.locator('#chaserGroupsEdit')).toBeEnabled();
    await page.locator('#chaserGroupsEdit').click();

    await expect(page.locator('#chaserGroupModal')).toBeVisible();
    await expect(page.locator('#chaserGroupModalBody .control h3')).toHaveText(['Dimmer']);

    await page.locator('#chaserGroupModal').click({ position: { x: 8, y: 8 } });
    await expect(page.locator('#chaserGroupModal')).toBeVisible();
    await page.locator('#closeChaserGroupModal2').click();
    await expect(page.locator('#chaserGroupModal')).toBeHidden();
  });

  test('Effects: choosing Dimmer enables Group Edit across fixture types without enabling playback', async ({ page }) => {
    await openDmxPage(page, 'dmx_motion.html');
    await injectMotionCompactSetup(page);

    await page.evaluate(() => {
      const select = document.getElementById('motionControlFilter');
      const option = [...select.options].find(o => o.textContent.includes('Dimmer'));
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.locator('#motionGroupsEdit')).toBeEnabled();

    const state = await page.evaluate(() => ({
      enabledPlaybackFixtures: motionFixtures.filter(mf => mf.enabled).length,
      editProfiles: [...new Set(motionGroupEditFixtures().map(mf => fixtureProfile(mf.fixture)?.name))]
    }));

    expect(state.enabledPlaybackFixtures).toBe(0);
    expect(state.editProfiles.sort()).toEqual(['Profile A', 'Profile B']);

    await page.locator('#motionGroupsEdit').click();
    await expect(page.locator('#motionGroupModal')).toBeVisible();
    await expect(page.locator('#motionGroupModalBody .control h3')).toHaveText(['Dimmer']);
    await expect(page.locator('#defaultMotionGroupBtn')).toHaveText('Default');
    await expect(page.locator('#blackoutMotionGroupBtn')).toHaveText('Blackout');
    await page.locator('#motionGroupModal').click({ position: { x: 8, y: 8 } });
    await expect(page.locator('#motionGroupModal')).toBeVisible();
    await page.locator('#closeMotionGroupModal2').click();
    await expect(page.locator('#motionGroupModal')).toBeHidden();
  });
});
