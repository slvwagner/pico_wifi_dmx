const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Project versioning rules', () => {
  test('shared UI shows the app version and JSON exports include version metadata', async ({ page }) => {
    await openDmxPage(page, '');

    await expect(page.locator('header h1 .app-version')).toHaveText('v0.9.4');

    const payload = await page.evaluate(() => DmxCommon.versionedPayload({ baseUrl: 'http://example.test/' }));
    expect(payload).toMatchObject({
      appVersion: '0.9.4',
      schemaVersion: 1,
      baseUrl: 'http://example.test/'
    });
  });

  test('complete setup import migrates old setup format and rejects future formats', async ({ page }) => {
    await openDmxPage(page, '');

    const migrated = await page.evaluate(() => {
      const oldSetup = {
        type: 'pico_wifi_dmx_full_setup',
        appVersion: '0.9.4',
        schemaVersion: 1,
        fixture: { baseUrl: 'http://example.test/', profiles: [], fixtures: [] },
        liveValues: {},
        groups: { groups: [] },
        scenes: { scenes: [], slotCols: 4, slotRows: 4 },
        palettes: { palettes: [], paletteCols: 4, paletteRows: 4 },
        chaser: {},
        motion: {},
        gpio: { enabled: true, mappings: [], adcMappings: [] },
        uiState: {}
      };
      return validateFullSetupPayload(migrateFullSetupPayload(oldSetup));
    });

    expect(migrated).toMatchObject({
      type: 'pico_wifi_dmx_full_setup',
      appVersion: '0.9.4',
      schemaVersion: 1,
      setupFormatVersion: 2,
      minimumAppVersion: '0.9.4',
      project: {
        id: 'pico_wifi_dmx',
        name: 'Pico WiFi DMX',
        version: '0.9.4'
      }
    });

    const futureError = await page.evaluate(() => {
      try {
        migrateFullSetupPayload({ type: 'pico_wifi_dmx_full_setup', setupFormatVersion: 99 });
        return '';
      } catch (err) {
        return err.message;
      }
    });
    expect(futureError).toContain('newer than this software supports');
  });
});
