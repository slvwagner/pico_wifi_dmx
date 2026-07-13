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

    for (const file of [
      'dmx_fixture_controller.html',
      'dmx_chaser.html',
      'dmx_show.html',
      'dmx_room_plane.html',
      'dmx_motion.html'
    ]) {
      const html = fs.readFileSync(path.join(root, 'web', file), 'utf8');
      expect(html, file).toContain('DmxCommon.fixtureGroupEditControlHtml({');
    }
  });

  test('Controller: hard reload plus Select All enables Group Edit for mixed fixture types', async ({ page }) => {
    await routeControllerCompactServerSetup(page);
    await openDmxPage(page, '');
    await page.reload({ waitUntil: 'networkidle' });

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
