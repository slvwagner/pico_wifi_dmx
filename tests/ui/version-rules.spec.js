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
    await page.route('**/assets/fixture-library.json', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schemaVersion: 1,
          source: 'Test fallback',
          fixtureCount: 1,
          fixtures: [{
            key: 'test/fallback',
            manufacturerName: 'Test',
            name: 'Fallback Fixture',
            categories: ['Dimmer'],
            modes: [{ name: '1ch', channels: 1, profile: { name: 'Fallback Fixture', mode: '1ch', channels: 1, controls: [] } }]
          }]
        })
      });
    });
    await openDmxPage(page, '');
    await page.evaluate(() => setSectionCollapsed('fixtureLibraryCollapseBtn', 'fixtureLibraryBody', 'fixtureLibraryCollapsed', false));
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

  test('selected fixture profile can update the fixture library catalog', async ({ page }) => {
    let savedLibrary = null;
    const initialLibrary = {
      schemaVersion: 1,
      source: 'Test library',
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
    await page.route('**/fixture_library.php', async route => {
      if (route.request().method() === 'POST') {
        savedLibrary = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"file":"fixture_library.json"}' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, exists: true, library: initialLibrary }) });
    });
    await openDmxPage(page, '');
    await page.evaluate(() => setSectionCollapsed('profilesCollapseBtn', 'profilesBody', 'profilesCollapsed', false));
    await expect(page.locator('#fixtureLibraryStatus')).toContainText('Loaded 1 custom library fixtures', { timeout: 15000 });

    await page.evaluate(() => {
      profiles.splice(0, profiles.length, {
        id: 7001,
        name: 'Demo Fixture',
        mode: '1ch',
        channels: 1,
        controls: [{ id: 7002, type: 'slider8', label: 'Dimmer Fine', channel: 1 }]
      });
      fixtures.splice(0, fixtures.length);
      activeProfileId = 7001;
      loadProfileEditor(profiles[0]);
      draw();
    });
    await page.locator('#updateFixtureLibraryProfile').click();
    await expect(page.locator('#updateFixtureLibraryProfile')).toHaveText('Updated');
    await expect(page.locator('#fixtureLibraryStatus')).toContainText('Updated library fixture Demo Fixture');

    const mode = savedLibrary.fixtures[0].modes.find(item => item.name === '1ch');
    expect(mode.profile.controls).toEqual([expect.objectContaining({ label: 'Dimmer Fine', channel: 1 })]);
  });

  test('fixture profile fields autosave without a save profile button', async ({ page }) => {
    await openDmxPage(page, '');
    await page.evaluate(() => setSectionCollapsed('profilesCollapseBtn', 'profilesBody', 'profilesCollapsed', false));
    await expect(page.locator('#saveProfile')).toHaveCount(0);

    await page.evaluate(() => {
      profiles.splice(0, profiles.length, {
        id: 8001,
        name: 'Original Profile',
        mode: '1ch',
        channels: 1,
        controls: [{ id: 8002, type: 'slider8', label: 'Dimmer', channel: 1 }]
      });
      activeProfileId = 8001;
      loadProfileEditor(profiles[0]);
      draw();
    });

    await page.locator('#profileName').fill('Autosaved Profile');
    await page.locator('#profileMode').fill('2ch');
    await page.locator('#profileChannels').fill('2');

    const profile = await page.evaluate(() => profiles.find(item => item.id === 8001));
    expect(profile).toMatchObject({ name: 'Autosaved Profile', mode: '2ch', channels: 2 });
  });

  test('profile action buttons show direct click feedback', async ({ page }) => {
    await openDmxPage(page, '');
    await page.evaluate(() => setSectionCollapsed('profilesCollapseBtn', 'profilesBody', 'profilesCollapsed', false));
    await page.locator('#profileName').fill('Feedback Profile');
    await page.locator('#profileMode').fill('1ch');
    await page.locator('#profileChannels').fill('1');

    await page.locator('#addProfile').click();
    await expect(page.locator('#addProfile')).toHaveText('Added');
    await expect(page.locator('#status')).toContainText('Profile added');
  });
});
