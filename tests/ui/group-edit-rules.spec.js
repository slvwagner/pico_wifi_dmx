const { test, expect } = require('@playwright/test');
const {
  openDmxPage,
  routeControllerCompactServerSetup,
  injectChaserCompactSetup,
  injectMotionCompactSetup
} = require('./helpers/dmx-page');

test.describe('Cross-page Group Edit contract', () => {
  test('Controller: hard reload plus Select All enables Group Edit for mixed fixture types', async ({ page }) => {
    await routeControllerCompactServerSetup(page);
    await openDmxPage(page, '');
    await page.reload({ waitUntil: 'networkidle' });

    await page.locator('#selectAllFixtures').click();
    await expect(page.locator('#editSelectedGroups')).toBeEnabled();
    await page.locator('#editSelectedGroups').click();

    await expect(page.locator('#groupModal')).toBeVisible();
    await expect(page.locator('#groupModalBody .control h3')).toHaveText(['Dimmer']);
  });

  test('Chaser: Participating Controls All enables Group Edit without a selected step', async ({ page }) => {
    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    await page.locator('#btnSelAll').click();
    await expect(page.locator('#chaserGroupsEdit')).toBeEnabled();
    await page.locator('#chaserGroupsEdit').click();

    await expect(page.locator('#chaserGroupModal')).toBeVisible();
    await expect(page.locator('#chaserGroupModalBody .control h3')).toHaveText(['Dimmer']);
  });

  test('Motion: choosing Dimmer enables Group Edit across fixture types without enabling playback', async ({ page }) => {
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
  });
});
