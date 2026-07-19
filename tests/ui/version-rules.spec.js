const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');
const fs = require('fs');
const path = require('path');

const appVersion = fs.readFileSync(path.join(__dirname, '..', '..', 'VERSION'), 'utf8').trim();

test.describe('Project versioning rules', () => {
  test('shared UI shows the app version and JSON exports include version metadata', async ({ page }) => {
    await openDmxPage(page, '');

    await expect(page.locator('header h1 .app-version')).toHaveText('v' + appVersion);

    const payload = await page.evaluate(() => DmxCommon.versionedPayload({ baseUrl: 'http://example.test/' }));
    expect(payload).toMatchObject({
      appVersion,
      schemaVersion: 1,
      baseUrl: 'http://example.test/'
    });

    await openDmxPage(page, 'dmx_show.html');
    await expect(page.locator('header h1 .app-version')).toHaveText('v' + appVersion);
  });

  test('Groups toolbox layout is shared on Controller, Chaser, and Effects pages', async ({ page }) => {
    const pages = ['', 'dmx_chaser.html', 'dmx_motion.html'];
    const measurements = [];
    for (const path of pages) {
      await openDmxPage(page, path);
      await page.evaluate(() => {
        const groupsBox = document.querySelector('.scene-toolbox--groups');
        if (groupsBox?.classList.contains('collapsed')) {
          groupsBox.querySelector('.scene-toolbox__toggle')?.click();
        }
        const group = { id: 'grp_selectable_test', name: 'Selectable Test', fixtureIds: [], values: {} };
        if (typeof savedGroups !== 'undefined' && typeof renderSavedGroupsList === 'function') {
          savedGroups.splice(0, savedGroups.length, group);
          renderSavedGroupsList();
        } else if (typeof chaserGroupsBox !== 'undefined' && chaserGroupsBox?.setGroups) {
          chaserGroupsBox.setGroups([group]);
        } else if (typeof motionGroupsBox !== 'undefined' && motionGroupsBox?.setGroups) {
          motionGroupsBox.setGroups([group]);
        }
      });
      await expect(page.locator('.scene-toolbox--groups .groups-toolbar').first()).toBeVisible();
      await expect(page.locator('.scene-toolbox--groups .groups-layout-controls').first()).toBeHidden();
      await page.locator('.toolbox-rail-edit').click();
      await expect(page.locator('.scene-toolbox--groups .groups-layout-controls').first()).toBeVisible();
      measurements.push(await page.evaluate(() => {
        const toolbar = document.querySelector('.scene-toolbox--groups .groups-toolbar').getBoundingClientRect();
        const edit = document.querySelector('.scene-toolbox--groups .groups-edit-btn').getBoundingClientRect();
        const layout = document.querySelector('.scene-toolbox--groups .groups-layout-controls').getBoundingClientRect();
        const selectable = document.querySelector('.scene-toolbox--groups .groups-matrix .selectable-card');
        return {
          toolbarWidth: Math.round(toolbar.width),
          editWidth: Math.round(edit.width),
          editLeft: Math.round(edit.left),
          toolbarLeft: Math.round(toolbar.left),
          layoutLeft: Math.round(layout.left),
          layoutTop: Math.round(layout.top),
          editBottom: Math.round(edit.bottom),
          hasSelectableCard: !!selectable
        };
      }));
    }

    for (const layout of measurements) {
      expect(layout.editLeft).toBe(layout.toolbarLeft);
      expect(layout.layoutLeft).toBe(layout.toolbarLeft);
      expect(layout.editWidth).toBeCloseTo(layout.toolbarWidth, 1);
      expect(layout.layoutTop).toBeGreaterThanOrEqual(layout.editBottom);
      expect(layout.hasSelectableCard).toBe(true);
    }
  });

  test('Controller refuses to overwrite saved groups when the group file did not load', async ({ page }) => {
    let groupPosts = 0;
    await page.route('**/group_setup.php**', async route => {
      if (route.request().method() === 'POST') {
        groupPosts += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"ok":false,"error":"temporary group load failure"}'
      });
    });

    await openDmxPage(page, '');
    const result = await page.evaluate(() => {
      createSavedGroup('Should Not Save', [101], {});
      return {
        savedGroups: savedGroups.length,
        status: document.getElementById('status').textContent
      };
    });

    expect(groupPosts).toBe(0);
    expect(result.savedGroups).toBe(0);
    expect(result.status).toContain('Cannot create group until saved groups have loaded');
  });

  test('Shared Groups toolbox keeps loaded groups when a later reload fails', async ({ page }) => {
    let failGroupLoad = false;
    let groupPosts = 0;
    await page.route('**/group_setup.php**', async route => {
      if (route.request().method() === 'POST') {
        groupPosts += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      if (failGroupLoad) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{"ok":false,"error":"temporary group load failure"}'
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          baseUrl: '',
          groups: [{ id: 'grp_keep', name: 'Keep Me', fixtureIds: [101], values: {} }]
        })
      });
    });

    await openDmxPage(page, 'dmx_chaser.html');
    await expect(page.locator('#chaserGroupsBox [data-group-index="0"]')).toContainText('Keep Me');

    failGroupLoad = true;
    const result = await page.evaluate(async () => {
      const loaded = await chaserGroupsBox.loadGroups();
      return {
        loaded,
        groups: chaserGroupsBox.groups.map(g => g.name)
      };
    });

    expect(result.loaded).toBe(false);
    expect(result.groups).toEqual(['Keep Me']);
    expect(groupPosts).toBe(0);
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
        fixtureLibrary: { schemaVersion: 1, fixtureCount: 1, fixtures: [{ key: 'legacy/fixture', name: 'Legacy Fixture', modes: [] }] },
        uiState: {}
      };
      return validateFullSetupPayload(migrateFullSetupPayload(oldSetup));
    });

    expect(migrated).toMatchObject({
      type: 'pico_wifi_dmx_full_setup',
      appVersion: '0.9.4',
      schemaVersion: 1,
      setupFormatVersion: 3,
      minimumAppVersion: '0.9.4',
      roomPlane: {
        points: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: 5, y: 0, z: 0 }, { id: 'C', x: 0, y: 3, z: 0 }],
        fixtures: [],
        planes: [],
        planeCols: 3,
        planeRows: 3
      },
      project: {
        id: 'pico_wifi_dmx',
        name: 'Pico WiFi DMX',
        version: '0.9.4'
      },
      fixtureLibrary: { fixtureCount: 1, fixtures: [{ key: 'legacy/fixture' }] }
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

  test('complete setup export and import preserve saved visuals and Show Run MIDI mappings', async ({ page }) => {
    await openDmxPage(page, '');

    await expect(page.locator('#exportJson')).toHaveText('Export Show');
    await expect(page.locator('#importJson')).toHaveText('Import Show');
    await expect(page.locator('#exportFixtureLibrary')).toHaveText('Export Library');
    await expect(page.locator('#importFixtureLibrary')).toHaveText('Import Library');
    await expect(page.locator('.show-file-actions').locator('#exportJson, #importJson, #exportFixtureLibrary, #importFixtureLibrary')).toHaveCount(4);
    await expect(page.locator('.show-file-actions #exportJson')).toBeVisible();
    await expect(page.locator('.show-file-actions #importJson')).toBeVisible();
    await expect(page.locator('.show-file-actions #exportFixtureLibrary')).toBeVisible();
    await expect(page.locator('.show-file-actions #importFixtureLibrary')).toBeVisible();
    await expect(page.locator('#fixtureLibraryBody #exportFixtureLibrary')).toHaveCount(0);
    expect(await page.locator('.show-file-actions > button').evaluateAll(buttons => buttons.map(button => button.id))).toEqual([
      'newShow',
      'exportCsv',
      'exportJson',
      'exportFixtureLibrary',
      'importJson',
      'importFixtureLibrary'
    ]);

    const result = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      const originalDownloadJson = DmxCommon.downloadJson;
      const originalConfirm = window.confirm;
      const originalSetTimeout = window.setTimeout;
      const posts = [];
      const downloads = [];
      const response = body => ({
        ok: true,
        json: async () => body
      });

      try {
        profiles = [
          { id: 1, name: 'Profile A', mode: '1ch', channels: 1, controls: [{ id: 10, type: 'slider8', label: 'Dimmer', channel: 1 }] },
          { id: 2, name: 'Unused Profile', mode: '2ch', channels: 2, controls: [{ id: 20, type: 'slider8', label: 'Dimmer', channel: 1 }] }
        ];
        fixtures = [{ id: 101, name: 'Fixture A', profileId: 1, start: 1 }];
        Object.keys(values).forEach(key => delete values[key]);
        values['101:1'] = 77;
        savedGroups = [{
          id: 'grp_visual',
          name: 'Visual Group',
          fixtureIds: [101],
          values: { '101:1': 77 },
          visual: { type: 'visual', color: '#115577', image: 'data:image/png;base64,GROUPTILE' }
        }];

        DmxCommon.downloadJson = (filename, payload) => {
          downloads.push({ filename, payload });
        };
        window.confirm = () => true;
        window.setTimeout = () => 0;
        window.fetch = async (url, options = {}) => {
          const href = String(url);
          const method = String(options.method || 'GET').toUpperCase();
          if (method === 'POST') {
            posts.push({ url: href, body: JSON.parse(options.body || '{}') });
            return response({ ok: true });
          }
          if (href.includes('group_setup.php')) return response({ ok: true, exists: true, baseUrl: '', groups: savedGroups });
          if (href.includes('scene_setup.php')) return response({ ok: true, exists: true, baseUrl: '', scenes: [], slotCols: 4, slotRows: 4 });
          if (href.includes('palette_setup.php')) return response({ ok: true, exists: true, baseUrl: '', palettes: [], paletteCols: 4, paletteRows: 4 });
          if (href.includes('chaser_setup.php')) return response({ ok: true, exists: false });
          if (href.includes('motion_setup.php')) return response({ ok: true, exists: false });
          if (href.includes('gpio_setup.php')) return response({ ok: true, exists: true, baseUrl: '', enabled: true, mappings: [], adcMappings: [] });
          if (href.includes('room_plane_setup.php')) return response({
            ok: true,
            exists: true,
            setup: {
              baseUrl: '',
              points: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: 4, y: 0, z: 0 }, { id: 'C', x: 0, y: 3, z: 0 }],
              target: { x: 1.5, y: 1, z: 0 },
              fixtures: [{ id: 101, name: 'Visual Fixture', cal: {} }],
              planes: [{ id: 'plane_visual', name: 'Visual Plane', visual: { type: 'visual', color: '#163f66', image: 'data:image/png;base64,PLANE' } }],
              planeCols: 3,
              planeRows: 2,
              activePlaneId: 'plane_visual'
            }
          });
          if (href.includes('fixture_library.php')) {
            const library = {
              schemaVersion: 1,
              source: 'Test library',
              generatedAt: '2026-01-01T00:00:00Z',
              fixtureCount: 2,
              fixtures: [
                {
                  key: 'demo/profile-a',
                  manufacturerName: 'Demo',
                  name: 'Profile A',
                  modes: [{ name: '1ch', channels: 1, profile: { name: 'Profile A', mode: '1ch', channels: 1, controls: [{ id: 10, type: 'slider8', label: 'Dimmer', channel: 1 }] } }]
                },
                {
                  key: 'demo/unused',
                  manufacturerName: 'Demo',
                  name: 'Unused Profile',
                  modes: [{ name: '2ch', channels: 2, profile: { name: 'Unused Profile', mode: '2ch', channels: 2, controls: [] } }]
                }
              ]
            };
            fixtureLibraryState.data = library;
            return response({ ok: true, exists: true, library });
          }
          if (href.includes('ui_state.php')) return response({
            ok: true,
            exists: true,
            state: {
              showRun: {
                cardCols: 3,
                cardRows: 3,
                cardOrder: ['live', 'scene', 'palette', 'chaser', 'motion', 'group', null, null, null],
                liveControls: [{ id: 'live_restore', cardId: 'live', fixtureId: 101, controlId: 10, part: 'value', widget: 'fader' }],
                paletteOrder: ['palette_1', null],
                midiMappings: [
                  { targetType: 'scene', targetId: 'scene_1', messageType: 'note', channel: 1, number: 41, deviceId: 'launch-control-xl-in', deviceName: 'Launch Control XL', mode: 'trigger', pickup: false },
                  { targetType: 'live', targetId: 'live_restore', messageType: 'cc', channel: 1, number: 77, deviceId: 'launch-control-xl-in', deviceName: 'Launch Control XL', mode: 'continuous', pickup: true },
                  { targetType: 'motion', targetId: '2', messageType: 'note', channel: 1, number: 42, deviceId: 'launch-control-xl-in', deviceName: 'Launch Control XL', mode: 'trigger', pickup: false, action: 'toggle-pause' }
                ]
              }
            }
          });
          if (href.includes('fixture_setup.php')) return response({ ok: true, exists: true, setup: saveData() });
          return response({ ok: true });
        };

        await exportFullSetup();
        const showDownload = downloads.find(download => download.filename === 'pico_dmx_setup.json');
        await importFullSetup(showDownload.payload);

        const groupImport = posts.filter(post => post.url.includes('group_setup.php')).pop();
        const roomPlaneImport = posts.filter(post => post.url.includes('room_plane_setup.php')).pop();
        const showRunImport = posts.filter(post => post.url.includes('ui_state.php') && post.body.page === 'showRun').pop();
        return {
          filenames: downloads.map(download => download.filename),
          setupFormatVersion: showDownload.payload.setupFormatVersion,
          setupFixtureLibrary: showDownload.payload.fixtureLibrary,
          setupProfiles: showDownload.payload.fixture.profiles.map(profile => profile.name),
          exported: showDownload.payload.groups.groups[0],
          imported: groupImport.body.groups[0],
          exportedRoomPlane: showDownload.payload.roomPlane,
          importedRoomPlane: roomPlaneImport.body,
          exportedShowRun: showDownload.payload.uiState.showRun,
          importedShowRun: showRunImport.body.state
        };
      } finally {
        window.fetch = originalFetch;
        DmxCommon.downloadJson = originalDownloadJson;
        window.confirm = originalConfirm;
        window.setTimeout = originalSetTimeout;
      }
    });

    expect(result.filenames).toEqual(['pico_dmx_setup.json']);
    expect(result.setupFormatVersion).toBe(3);
    expect(result.setupProfiles).toEqual(['Profile A', 'Unused Profile']);
    expect(result.setupFixtureLibrary).toMatchObject({
      type: 'pico_wifi_dmx_show_fixture_library',
      fixtureCount: 1,
      fixtures: [{ key: 'demo/profile-a', modes: [{ name: '1ch' }] }]
    });
    expect(result.exported).toMatchObject({
      id: 'grp_visual',
      name: 'Visual Group',
      visual: { type: 'visual', color: '#115577', image: 'data:image/png;base64,GROUPTILE' }
    });
    expect(result.imported).toMatchObject({
      id: 'grp_visual',
      name: 'Visual Group',
      visual: { type: 'visual', color: '#115577', image: 'data:image/png;base64,GROUPTILE' }
    });
    expect(result.exportedRoomPlane).toMatchObject({
      planes: [{ id: 'plane_visual', name: 'Visual Plane', visual: { type: 'visual', color: '#163f66', image: 'data:image/png;base64,PLANE' } }],
      planeCols: 3,
      planeRows: 2,
      activePlaneId: 'plane_visual'
    });
    expect(result.importedRoomPlane).toMatchObject(result.exportedRoomPlane);
    expect(result.exportedShowRun).toMatchObject({
      cardCols: 3,
      cardRows: 3,
      cardOrder: ['live', 'scene', 'palette', 'chaser', 'motion', 'group', null, null, null],
      liveControls: [{ id: 'live_restore', cardId: 'live', fixtureId: 101, controlId: 10, part: 'value', widget: 'fader' }],
      paletteOrder: ['palette_1', null],
      midiMappings: [
        { targetType: 'scene', targetId: 'scene_1', messageType: 'note', channel: 1, number: 41, deviceId: 'launch-control-xl-in', deviceName: 'Launch Control XL', mode: 'trigger', pickup: false },
        { targetType: 'live', targetId: 'live_restore', messageType: 'cc', channel: 1, number: 77, deviceId: 'launch-control-xl-in', deviceName: 'Launch Control XL', mode: 'continuous', pickup: true },
        { targetType: 'motion', targetId: '2', messageType: 'note', channel: 1, number: 42, deviceId: 'launch-control-xl-in', deviceName: 'Launch Control XL', mode: 'trigger', pickup: false, action: 'toggle-pause' }
      ]
    });
    expect(result.importedShowRun).toMatchObject(result.exportedShowRun);
  });

  test('setup import maps changed show fixtures to library versions without removing unrelated catalog entries', async ({ page }) => {
    await openDmxPage(page, '');

    await page.evaluate(() => {
      window.__fixtureImportOriginals = {
        fetch: window.fetch,
        confirm: window.confirm,
        setTimeout: window.setTimeout
      };
      window.__fixtureImportPosts = [];
      window.confirm = () => true;
      window.setTimeout = () => 0;
      const response = body => ({ ok: true, json: async () => body });
      window.fetch = async (url, options = {}) => {
        const method = String(options.method || 'GET').toUpperCase();
        if (method === 'POST') {
          window.__fixtureImportPosts.push({ url: String(url), body: JSON.parse(options.body || '{}') });
          return response({ ok: true });
        }
        return response({ ok: true, exists: false });
      };
      fixtureLibraryState.data = normalizeFixtureLibrary({
        schemaVersion: 1,
        fixtureCount: 2,
        fixtures: [
          {
            key: 'demo/profile-a', manufacturerName: 'Demo', name: 'Profile A',
            modes: [{ name: '1ch', channels: 1, profile: { name: 'Profile A', mode: '1ch', channels: 1, controls: [{ id: 901, type: 'slider8', label: 'Library Dimmer', channel: 1, default: 200 }] } }]
          },
          {
            key: 'demo/unrelated', manufacturerName: 'Demo', name: 'Unrelated',
            modes: [{ name: '4ch', channels: 4, profile: { name: 'Unrelated', mode: '4ch', channels: 4, controls: [] } }]
          }
        ]
      });
      const setup = {
        type: 'pico_wifi_dmx_full_setup', schemaVersion: 1, setupFormatVersion: 3,
        project: { id: 'pico_wifi_dmx', name: 'Pico WiFi DMX', version: '0.9.13' },
        fixture: {
          baseUrl: '',
          profiles: [
            { id: 1, name: 'Profile A', mode: '1ch', channels: 1, controls: [{ id: 101, type: 'slider8', label: 'Show Dimmer', channel: 1, default: 10 }] },
            { id: 2, name: 'Show Only', mode: '2ch', channels: 2, controls: [{ id: 201, type: 'slider8', label: 'Show Only Dimmer', channel: 1 }] }
          ],
          fixtures: [
            { id: 101, name: 'Fixture A', profileId: 1, start: 1 },
            { id: 102, name: 'Fixture B', profileId: 2, start: 10 }
          ]
        },
        liveValues: {}, groups: { groups: [] }, scenes: { scenes: [] }, palettes: { palettes: [] },
        chaser: {}, motion: {}, gpio: { mappings: [], adcMappings: [] }, roomPlane: {}, uiState: {},
        fixtureLibrary: {
          schemaVersion: 1,
          fixtureCount: 2,
          fixtures: [
            {
              key: 'demo/profile-a', manufacturerName: 'Demo', name: 'Profile A',
              modes: [{ name: '1ch', channels: 1, profile: { name: 'Profile A', mode: '1ch', channels: 1, controls: [{ id: 101, type: 'slider8', label: 'Show Dimmer', channel: 1, default: 10 }] } }]
            },
            {
              key: 'show/show-only', manufacturerName: 'Show', name: 'Show Only',
              modes: [{ name: '2ch', channels: 2, profile: { name: 'Show Only', mode: '2ch', channels: 2, controls: [{ id: 201, type: 'slider8', label: 'Show Only Dimmer', channel: 1 }] } }]
            }
          ]
        }
      };
      window.__fixtureImportPromise = importFullSetup(setup);
    });

    await expect(page.locator('#fixtureImportMappingModal')).toBeVisible();
    await expect(page.locator('.fixture-import-map-row')).toHaveCount(2);
    expect(await page.evaluate(() => window.__fixtureImportPosts.length)).toBe(0);

    const changedRow = page.locator('.fixture-import-map-row[data-profile-id="1"]');
    await expect(changedRow.locator('select[data-library-mapping]')).toHaveValue('demo/profile-a::1ch');
    await changedRow.locator('.fixture-import-decision').click();
    await expect(changedRow).toHaveClass(/library-selected/);
    await expect(changedRow.locator('.fixture-import-decision')).toHaveText('Use library');
    await page.locator('#fixtureImportApply').click();

    const result = await page.evaluate(async () => {
      await window.__fixtureImportPromise;
      const fixtureSetup = window.__fixtureImportPosts.find(post => post.url.includes('fixture_setup.php') && !post.url.includes('livevalues'))?.body;
      const library = window.__fixtureImportPosts.find(post => post.url.includes('fixture_library.php'))?.body;
      const originals = window.__fixtureImportOriginals;
      window.fetch = originals.fetch;
      window.confirm = originals.confirm;
      window.setTimeout = originals.setTimeout;
      return { fixtureSetup, library };
    });

    expect(result.fixtureSetup.profiles.find(profile => profile.id === 1)).toMatchObject({
      id: 1,
      name: 'Profile A',
      mode: '1ch',
      controls: [{ id: 101, label: 'Library Dimmer', default: 200 }]
    });
    expect(result.fixtureSetup.profiles.find(profile => profile.id === 2)).toMatchObject({
      id: 2,
      name: 'Show Only',
      controls: [{ label: 'Show Only Dimmer' }]
    });
    expect(result.library.fixtures.map(fixture => fixture.key)).toEqual([
      'demo/profile-a',
      'demo/unrelated',
      'show/show-only'
    ]);
    expect(result.library.fixtures.find(fixture => fixture.key === 'demo/profile-a').modes[0].profile.controls[0]).toMatchObject({
      label: 'Library Dimmer',
      default: 200
    });
  });

  test('Import Library followed by Import Show opens fixture mapping before writing differing show data', async ({ page }) => {
    await openDmxPage(page, '');

    await page.evaluate(() => {
      window.__combinedImportOriginals = {
        fetch: window.fetch,
        confirm: window.confirm,
        setTimeout: window.setTimeout
      };
      window.__combinedImportPosts = [];
      window.confirm = () => true;
      window.setTimeout = () => 0;
      window.fetch = async (url, options = {}) => {
        const method = String(options.method || 'GET').toUpperCase();
        if (method === 'POST') {
          window.__combinedImportPosts.push({ url: String(url), body: JSON.parse(options.body || '{}') });
        }
        return { ok: true, json: async () => ({ ok: true, exists: false }) };
      };
    });

    const library = {
      schemaVersion: 1,
      source: 'Imported test catalog',
      fixtureCount: 2,
      fixtures: [
        {
          key: 'demo/profile-a', manufacturerName: 'Demo', name: 'Profile A',
          modes: [{ name: '1ch', channels: 1, profile: { name: 'Profile A', mode: '1ch', channels: 1, controls: [{ id: 901, type: 'slider8', label: 'Library Dimmer', channel: 1, default: 200 }] } }]
        },
        {
          key: 'demo/unrelated', manufacturerName: 'Demo', name: 'Unrelated',
          modes: [{ name: '4ch', channels: 4, profile: { name: 'Unrelated', mode: '4ch', channels: 4, controls: [] } }]
        }
      ]
    };
    await page.locator('#importFixtureLibraryFile').setInputFiles({
      name: 'pico_dmx_fixture_library.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(library))
    });
    await expect(page.locator('#fixtureLibraryStatus')).toContainText('Imported 2 library fixtures');

    const show = {
      type: 'pico_wifi_dmx_full_setup', schemaVersion: 1, setupFormatVersion: 3,
      project: { id: 'pico_wifi_dmx', name: 'Pico WiFi DMX', version: '0.9.13' },
      fixture: {
        baseUrl: '',
        profiles: [{ id: 1, name: 'Profile A', mode: '1ch', channels: 1, controls: [{ id: 101, type: 'slider8', label: 'Show Dimmer', channel: 1, default: 10 }] }],
        fixtures: [{ id: 101, name: 'Fixture A', profileId: 1, start: 1 }]
      },
      liveValues: {}, groups: { groups: [] }, scenes: { scenes: [] }, palettes: { palettes: [] },
      chaser: {}, motion: {}, gpio: { mappings: [], adcMappings: [] }, roomPlane: {}, uiState: {},
      fixtureLibrary: {
        schemaVersion: 1,
        fixtureCount: 1,
        fixtures: [{
          key: 'demo/profile-a', manufacturerName: 'Demo', name: 'Profile A',
          modes: [{ name: '1ch', channels: 1, profile: { name: 'Profile A', mode: '1ch', channels: 1, controls: [{ id: 101, type: 'slider8', label: 'Show Dimmer', channel: 1, default: 10 }] } }]
        }]
      }
    };
    await page.locator('#importJsonFile').setInputFiles({
      name: 'pico_dmx_setup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(show))
    });

    await expect(page.locator('#fixtureImportMappingModal')).toBeVisible();
    await expect(page.locator('.fixture-import-map-row')).toHaveCount(1);
    await expect(page.locator('.fixture-import-map-row')).toContainText('Definition differs');
    expect(await page.evaluate(() => {
      const showEndpoints = ['fixture_setup.php', 'group_setup.php', 'scene_setup.php', 'palette_setup.php', 'chaser_setup.php', 'motion_setup.php', 'gpio_setup.php', 'room_plane_setup.php'];
      return window.__combinedImportPosts.filter(post => showEndpoints.some(endpoint => post.url.includes(endpoint))).length;
    })).toBe(0);

    const row = page.locator('.fixture-import-map-row');
    await expect(row.locator('select[data-library-mapping]')).toHaveValue('demo/profile-a::1ch');
    await row.locator('.fixture-import-decision').click();
    await expect(row).toHaveClass(/library-selected/);
    await page.locator('#fixtureImportApply').click();
    await expect.poll(() => page.evaluate(() => window.__combinedImportPosts.some(post => post.url.includes('fixture_setup.php') && !post.url.includes('livevalues')))).toBe(true);

    const importedProfile = await page.evaluate(() => {
      const post = window.__combinedImportPosts.find(item => item.url.includes('fixture_setup.php') && !item.url.includes('livevalues'));
      const originals = window.__combinedImportOriginals;
      window.fetch = originals.fetch;
      window.confirm = originals.confirm;
      window.setTimeout = originals.setTimeout;
      return post.body.profiles[0];
    });
    expect(importedProfile).toMatchObject({
      id: 1,
      controls: [{ id: 101, label: 'Library Dimmer', default: 200 }]
    });
  });

  test('New Show clears show data and Pico playback slots but keeps fixture library separate', async ({ page }) => {
    await openDmxPage(page, '');

    const result = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      const originalConfirm = window.confirm;
      const posts = [];
      const response = body => ({
        ok: true,
        json: async () => body
      });

      try {
        profiles = [{ id: 1, name: 'Old Profile', mode: '1ch', channels: 1, controls: [{ id: 10, type: 'slider8', label: 'Dimmer', channel: 1 }] }];
        fixtures = [{ id: 101, name: 'Old Fixture', profileId: 1, start: 1 }];
        values['101:10'] = 255;
        savedGroups = [{ id: 'grp_old', name: 'Old Group', fixtureIds: [101], values: {} }];
        scenes = [{ id: 'scene_old', name: 'Old Scene', slot: 0, values: {} }];
        palettes = [{ id: 'palette_old', name: 'Old Palette', slot: 0, scope: 'all', values: {} }];
        fanPresets = [{ name: 'Old Fan', fixtureIds: [101] }];
        activeSavedGroupIds.add(savedGroupKey(savedGroups[0], 0));
        selectedFixtureIds = new Set([101]);
        renderSavedGroupsList();
        renderSlotMatrix();
        renderPaletteMatrix();
        draw();

        window.confirm = () => true;
        window.fetch = async (url, options = {}) => {
          const href = String(url);
          const method = String(options.method || 'GET').toUpperCase();
          if (method === 'POST') {
            posts.push({ url: href, body: JSON.parse(options.body || '{}') });
            return response({ ok: true });
          }
          return response({ ok: true, exists: false });
        };

        await startNewShow();

        const findPost = part => posts.find(post => post.url.includes(part));
        const countPosts = part => posts.filter(post => post.url.includes(part)).length;
        return {
          fixture: findPost('fixture_setup.php')?.body,
          liveValues: findPost('fixture_setup.php?livevalues')?.body,
          groups: findPost('group_setup.php')?.body,
          scenes: findPost('scene_setup.php')?.body,
          palettes: findPost('palette_setup.php')?.body,
          chaser: findPost('chaser_setup.php')?.body,
          motion: findPost('motion_setup.php?reset_show')?.body,
          gpio: findPost('gpio_setup.php')?.body,
          roomPlane: findPost('room_plane_setup.php')?.body,
          uiStatePosts: countPosts('ui_state.php'),
          chaserSlotDeletes: countPosts('chaser_setup.php?delete_slot='),
          motionShowResets: countPosts('motion_setup.php?reset_show'),
          motionSlotDeletes: countPosts('motion_setup.php?delete_slot='),
          fixtureLibraryPosts: countPosts('fixture_library.php'),
          local: {
            profiles: profiles.length,
            fixtures: fixtures.length,
            values: Object.keys(values).length,
            groups: savedGroups.length,
            scenes: scenes.length,
            palettes: palettes.length,
            selectedFixtures: selectedFixtureIds.size,
            selectedGroups: activeSavedGroupIds.size,
            status: document.getElementById('status').textContent
          }
        };
      } finally {
        window.fetch = originalFetch;
        window.confirm = originalConfirm;
      }
    });

    expect(result.fixture.fixtures).toEqual([]);
    expect(result.fixture.profiles).toHaveLength(1);
    expect(result.fixture.profiles[0].name).toBe('Generic Moving Head');
    expect(result.liveValues).toEqual({});
    expect(result.groups.groups).toEqual([]);
    expect(result.scenes.scenes).toEqual([]);
    expect(result.palettes.palettes).toEqual([]);
    expect(result.chaser.chases).toEqual([]);
    expect(result.motion.effects).toEqual([]);
    expect(result.motion.pico_slots).toHaveLength(64);
    expect(result.motion.pico_slots.every(slot => slot === null)).toBe(true);
    expect(result.gpio).toMatchObject({ enabled: true, mappings: [], adcMappings: [] });
    expect(result.roomPlane).toMatchObject({
      points: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: 5, y: 0, z: 0 }, { id: 'C', x: 0, y: 3, z: 0 }],
      fixtures: [],
      planes: [],
      planeCols: 3,
      planeRows: 3
    });
    expect(result.uiStatePosts).toBeGreaterThanOrEqual(3);
    expect(result.chaserSlotDeletes).toBe(32);
    expect(result.motionShowResets).toBe(1);
    expect(result.motionSlotDeletes).toBe(0);
    expect(result.fixtureLibraryPosts).toBe(0);
    expect(result.local).toMatchObject({
      profiles: 1,
      fixtures: 0,
      values: 0,
      groups: 0,
      scenes: 0,
      palettes: 0,
      selectedFixtures: 0,
      selectedGroups: 0,
      status: 'New show started'
    });
  });

  test('Effects setup reset clears saved effects and Pico slots atomically', async ({ page }) => {
    let motionState = {
      baseUrl: 'http://old-pico/',
      effects: [{ id: 'fx_old', name: 'Old effect', slot: 0, recipe: {} }],
      effectCols: 6,
      effectRows: 2,
      pico_slots: Array.from({ length: 64 }, (_, i) => i === 0 ? 'OLD SLOT' : null)
    };
    await page.route('**/motion_setup.php**', async route => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      if (method === 'POST' && url.searchParams.has('reset_show')) {
        const body = JSON.parse(route.request().postData() || '{}');
        motionState = {
          ...body,
          effects: [],
          effectCols: body.effectCols || 4,
          effectRows: body.effectRows || 4,
          pico_slots: Array(64).fill(null)
        };
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, motion: motionState })
      });
    });
    await openDmxPage(page, '');

    const result = await page.evaluate(async () => {
      await postSetupPayload('motion_setup.php?reset_show', {
        baseUrl: 'http://new-pico/',
        effects: [],
        effectCols: 4,
        effectRows: 4,
        pico_slots: Array(64).fill(null)
      });
      const r = await fetch('motion_setup.php');
      return (await r.json()).motion;
    });

    expect(result.effects).toEqual([]);
    expect(result.effectCols).toBe(4);
    expect(result.effectRows).toBe(4);
    expect(result.pico_slots).toHaveLength(64);
    expect(result.pico_slots.every(slot => slot === null)).toBe(true);
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
    await page.evaluate(() => setSectionCollapsed('profilesCollapseBtn', 'profilesBody', 'profilesCollapsed', true));
    await expect(page.locator('#fixtureLibraryStatus')).toContainText('Loaded', { timeout: 15000 });
    await expect(page.locator('#profilesBody')).toBeHidden();

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
    await expect(page.locator('#profilesBody')).toBeVisible();
    await expect(page.locator('#profilesCollapseBtn')).toHaveText('−');
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
    await page.locator('[data-update-profile-library="7001"]').click();
    await expect(page.locator('[data-update-profile-library="7001"]')).toHaveText('Updated');
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
