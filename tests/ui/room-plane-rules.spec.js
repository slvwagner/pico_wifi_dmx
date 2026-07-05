const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Room Plane Test prototype rules', () => {
  test('interpolates fixture pan and tilt from the calibrated plane points', async ({ page }) => {
    await openDmxPage(page, 'dmx_room_plane.html');

    await expect(page.locator('h1')).toContainText('Room Plane Test');
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
});
