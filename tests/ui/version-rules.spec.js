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

  test('fixture library catalog can be exported and imported separately', async ({ page }) => {
    let importedLibrary = null;
    await page.route('**/fixture_library.php', async route => {
      if (route.request().method() === 'POST') {
        importedLibrary = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"file":"fixture_library.json"}' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"exists":false,"library":null}' });
    });
    await openDmxPage(page, '');
    await expect(page.locator('#fixtureLibraryStatus')).toContainText('Loaded', { timeout: 15000 });

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#exportFixtureLibrary').click()
    ]).then(([dl]) => dl);
    expect(download.suggestedFilename()).toBe('pico_dmx_fixture_library.json');

    const library = {
      schemaVersion: 1,
      source: 'Test import',
      fixtureCount: 1,
      fixtures: [{
        key: 'test/demo',
        manufacturerName: 'Test',
        name: 'Demo Fixture',
        categories: ['Dimmer'],
        modes: [{
          name: '1ch',
          channels: 1,
          profile: { name: 'Demo Fixture', mode: '1ch', channels: 1, controls: [{ id: 1, type: 'slider8', label: 'Dimmer', channel: 1 }] }
        }]
      }]
    };
    await page.locator('#importFixtureLibraryFile').setInputFiles({
      name: 'fixture-library-test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(library))
    });

    await expect(page.locator('#fixtureLibraryStatus')).toContainText('Imported 1 library fixtures');
    await expect(page.locator('#fixtureLibraryResults')).toContainText('Demo Fixture');
    expect(importedLibrary).toMatchObject({ source: 'Test import', fixtureCount: 1 });
  });
});
