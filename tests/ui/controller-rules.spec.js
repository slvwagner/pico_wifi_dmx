const { test, expect } = require('@playwright/test');
const {
  openDmxPage,
  routeControllerCompactServerSetup,
  injectControllerCompactSetup
} = require('./helpers/dmx-page');

test.describe('Fixture Controller established rules', () => {
  test.beforeEach(async ({ page }) => {
    await openDmxPage(page, '');
    await injectControllerCompactSetup(page);
  });

  test('Group Edit is available for controls shared by at least two selected fixtures', async ({ page }) => {
    const state = await page.evaluate(() => {
      selectedFixtureIds = new Set([101, 102, 103]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      drawSurface();
      return {
        controls: getGroupEditableControls().map(groupKey),
        groupBarButtonExists: !!document.getElementById('openGroupEdit'),
        toolboxDisabled: document.getElementById('editSelectedGroups').disabled
      };
    });

    expect(state.groupBarButtonExists).toBe(false);
    expect(state.toolboxDisabled).toBe(false);
    expect(state.controls).toContain('slider8:Dimmer');
    expect(state.controls).not.toContain('panTilt16:Pan/Tilt');
    expect(state.controls).not.toContain('wheel:Gobo');
  });

  test('Group Edit applies a mixed selection edit only to matching fixtures', async ({ page }) => {
    const result = await page.evaluate(() => {
      selectedFixtureIds = new Set([101, 102, 103]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      drawSurface();
      const beforeC = values['103:31'];
      const dimmer = getGroupEditableControls().find(c => groupKey(c) === 'slider8:Dimmer');
      setGroupValue(dimmer, 77);
      return {
        a: values['101:11'],
        b: values['102:21'],
        beforeC,
        afterC: values['103:31']
      };
    });

    expect(result.a).toBe(77);
    expect(result.b).toBe(77);
    expect(result.afterC).toBe(result.beforeC);
  });

  test('Group Edit can edit a single selected fixture', async ({ page }) => {
    await page.locator('[data-fixture-card="101"] .fixture-head').click();
    await expect(page.locator('#editSelectedGroups')).toBeEnabled();
    await page.locator('#editSelectedGroups').click();
    await expect(page.locator('#groupModal')).toBeVisible();
    await page.locator('#groupModalBody .control', { hasText: 'Dimmer' }).locator('input[type="range"]:not([data-byte-part])').fill('88');

    const state = await page.evaluate(() => ({
      selectedFixtures: [...selectedFixtureIds],
      value: values['101:11'],
      otherFixtureValue: values['102:21'],
      title: document.getElementById('groupModalTitle').textContent
    }));

    expect(state.selectedFixtures).toEqual([101]);
    expect(state.value).toBe(88);
    expect(state.otherFixtureValue).not.toBe(88);
    expect(state.title).toContain('1 fixture selected');
  });

  test('saved group first fixture becomes Controller Group Edit source', async ({ page }) => {
    await page.evaluate(() => {
      savedGroups = [{ id: 'grp_reverse', name: 'Reverse Pair', fixtureIds: [102, 101], values: {} }];
      values['101:11'] = 11;
      values['102:21'] = 88;
      activeSavedGroupIds.clear();
      renderSavedGroupsList();
      drawSurface();
    });

    await page.locator('[data-group-index="0"]').click();
    await expect(page.locator('[data-fixture-card="102"]')).toHaveClass(/source-fixture/);
    await expect(page.locator('[data-fixture-card="102"] h2')).toContainText('Source');

    await page.locator('#editSelectedGroups').click();
    await expect(page.locator('#groupModal')).toBeVisible();

    const initial = await page.evaluate(() => ({
      sourceFixtureId,
      selectedFixtures: [...selectedFixtureIds],
      modalValue: document.querySelector('#groupModalBody [data-gc-readout]')?.textContent
    }));

    expect(initial.sourceFixtureId).toBe('102');
    expect(initial.selectedFixtures).toEqual([102, 101]);
    expect(initial.modalValue).toBe('88');
    await expect(page.locator('#groupModal')).not.toContainText('Apply source');

    await page.locator('#groupModalBody .control', { hasText: 'Dimmer' }).locator('input[type="range"]:not([data-byte-part])').fill('89');
    const after = await page.evaluate(() => ({
      a: values['101:11'],
      b: values['102:21']
    }));

    expect(after.a).toBe(89);
    expect(after.b).toBe(89);
  });

  test('saved group tiles use corner edit tile and delete actions without toggling selection', async ({ page }) => {
    await page.evaluate(() => {
      savedGroups = [{ id: 'grp_test', name: 'Front Wash', fixtureIds: [101, 102], values: {} }];
      activeSavedGroupIds.clear();
      renderSavedGroupsList();
      drawSurface();
    });

    await expect(page.locator('[data-edit-group="0"]')).toBeVisible();
    await expect(page.locator('[data-delete-group="0"]')).toBeVisible();
    await expect(page.locator('#renameSelectedGroup')).toHaveCount(0);
    await expect(page.locator('#deleteSelectedGroups')).toHaveCount(0);

    await page.locator('[data-edit-group="0"]').click();
    await expect(page.locator('#paletteVisualModal')).toBeVisible();
    await page.locator('#paletteVisualName').fill('Renamed Wash');
    await page.locator('#paletteVisualColor').fill('#115577');
    await page.locator('#paletteVisualSave').click();
    await expect(page.locator('#paletteVisualModal')).toBeHidden();

    let state = await page.evaluate(() => ({
      name: savedGroups[0].name,
      visual: savedGroups[0].visual,
      tileStyle: {
        background: getComputedStyle(document.querySelector('[data-group-index="0"]')).backgroundColor,
        borderColor: getComputedStyle(document.querySelector('[data-group-index="0"]')).borderColor
      },
      selectedGroups: selectedSavedGroups().length
    }));
    expect(state.name).toBe('Renamed Wash');
    expect(state.visual).toEqual(expect.objectContaining({ type: 'visual', color: '#115577' }));
    expect(state.tileStyle.background).toBe('rgb(17, 85, 119)');
    expect(state.tileStyle.borderColor).toBe('rgb(17, 85, 119)');
    expect(state.selectedGroups).toBe(0);

    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await page.locator('[data-delete-group="0"]').click();

    state = await page.evaluate(() => ({
      count: savedGroups.length,
      selectedGroups: selectedSavedGroups().length
    }));
    expect(state).toEqual({ count: 0, selectedGroups: 0 });
  });

  test('Groups toolbox places layout controls below the full-width edit button', async ({ page }) => {
    await page.evaluate(() => {
      savedGroups = [{ id: 'grp_test', name: 'Front Wash', fixtureIds: [101, 102], values: {} }];
      renderSavedGroupsList();
    });

    const layout = await page.evaluate(() => {
      const toolbar = document.querySelector('#groupsBox .groups-toolbar').getBoundingClientRect();
      const button = document.getElementById('editSelectedGroups').getBoundingClientRect();
      const controls = document.querySelector('#groupsBox .groups-layout-controls').getBoundingClientRect();
      return {
        toolbarWidth: Math.round(toolbar.width),
        buttonWidth: Math.round(button.width),
        buttonLeft: Math.round(button.left),
        toolbarLeft: Math.round(toolbar.left),
        controlsTop: Math.round(controls.top),
        buttonBottom: Math.round(button.bottom),
        controlsLeft: Math.round(controls.left)
      };
    });

    expect(layout.buttonLeft).toBe(layout.toolbarLeft);
    expect(layout.buttonWidth).toBeCloseTo(layout.toolbarWidth, 1);
    expect(layout.controlsTop).toBeGreaterThanOrEqual(layout.buttonBottom);
    expect(layout.controlsLeft).toBe(layout.toolbarLeft);
  });

  test('Control Surface group actions align left below the selection summary', async ({ page }) => {
    await page.evaluate(() => {
      selectedFixtureIds = new Set([101, 102]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      activeFixtureFilterIds.clear();
      drawSurface();
    });

    const layout = await page.evaluate(() => {
      const summary = document.querySelector('#groupBar .group-bar-summary').getBoundingClientRect();
      const actions = document.querySelector('#groupBar .group-bar-actions').getBoundingClientRect();
      const save = document.getElementById('saveGroupBtn').getBoundingClientRect();
      return {
        summaryLeft: Math.round(summary.left),
        summaryBottom: Math.round(summary.bottom),
        actionsLeft: Math.round(actions.left),
        actionsTop: Math.round(actions.top),
        saveLeft: Math.round(save.left)
      };
    });

    expect(layout.actionsTop).toBeGreaterThanOrEqual(layout.summaryBottom);
    expect(layout.actionsLeft).toBe(layout.summaryLeft);
    expect(layout.saveLeft).toBe(layout.summaryLeft);
  });

  test('Show card can collapse its project file buttons', async ({ page }) => {
    await expect(page.locator('.setup-files-card h2')).toHaveText('Show');
    await expect(page.locator('#newShow')).toBeVisible();
    await expect(page.locator('#exportJson')).toBeVisible();

    await page.locator('#showCollapseBtn').click();
    await expect(page.locator('#showBody')).toBeHidden();
    await expect(page.locator('#showCollapseBtn')).toHaveText('+');
    await expect(page.locator('#newShow')).toBeHidden();

    await page.locator('#showCollapseBtn').click();
    await expect(page.locator('#showBody')).toBeVisible();
    await expect(page.locator('#showCollapseBtn')).toHaveText('−');
  });

  test('scene saves are serialized so deleting a scene removes its visual from the server payload', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      const calls = [];
      const resolvers = [];
      window.fetch = (_url, options = {}) => new Promise(resolve => {
        calls.push(JSON.parse(options.body || '{}'));
        resolvers.push(resolve);
      });
      const okResponse = () => ({ json: () => Promise.resolve({ ok: true }) });

      try {
        sceneSaveQueue = Promise.resolve();
        scenes = [{
          id: 'scene_test',
          name: 'Scene Test',
          slot: 0,
          values: {},
          visual: { type: 'visual', color: '#123456', image: 'data:image/png;base64,OLD' }
        }];
        const firstSave = saveScenesServer();
        scenes = [];
        const deleteSave = saveScenesServer();
        for (let i = 0; i < 10 && calls.length < 1; i++) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        const beforeFirstResolves = calls.length;
        resolvers[0](okResponse());
        await firstSave;
        await new Promise(resolve => setTimeout(resolve, 0));
        const afterFirstResolves = calls.length;
        resolvers[1](okResponse());
        await deleteSave;

        return {
          beforeFirstResolves,
          afterFirstResolves,
          firstSceneCount: calls[0].scenes.length,
          deleteSceneCount: calls[1].scenes.length,
          deletePayloadHasImage: JSON.stringify(calls[1]).includes('data:image')
        };
      } finally {
        window.fetch = originalFetch;
      }
    });

    expect(result.beforeFirstResolves).toBe(1);
    expect(result.afterFirstResolves).toBe(2);
    expect(result.firstSceneCount).toBe(1);
    expect(result.deleteSceneCount).toBe(0);
    expect(result.deletePayloadHasImage).toBe(false);
  });

  test('saving a scene never copies the default scene icon into the scene tile', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      window.fetch = (_url, _options = {}) => Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
      try {
        sceneSaveQueue = Promise.resolve();
        scenes = [];
        selectedFixtureIds = new Set([101]);
        activeSavedGroupIds.clear();
        sceneFixtureFilterActive = false;
        activeControlScopeKeys.clear();
        fanAffectedKeys.clear();
        sceneVisualDefault = {
          type: 'visual',
          color: '#654321',
          image: 'data:image/png;base64,SHOULD_NOT_COPY'
        };

        saveSceneToSlot(0, 'No Icon Scene');
        await sceneSaveQueue;

        return {
          visual: scenes[0].visual,
          renderedIcon: !!document.querySelector('#slotMatrix .slot .palette-visual')
        };
      } finally {
        window.fetch = originalFetch;
      }
    });

    expect(result.visual).toEqual({ type: 'visual', color: '#654321', image: '' });
    expect(result.renderedIcon).toBe(false);
  });

  test('Group Edit syncs mixed fixture controls from fixtures that actually own the control', async ({ page }) => {
    const result = await page.evaluate(() => {
      fixtures.push({ id: 104, name: 'B 2', profileId: 2, start: 61 });
      selectedFixtureIds = new Set([101, 102, 104]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      Object.keys(groupValues).forEach(key => delete groupValues[key]);

      values['102:22'] = { a: 12, b: 34, c: 56 };
      values['104:22'] = { a: 1, b: 2, c: 3 };

      const controls = getGroupEditableControls();
      syncGroupValuesFromFirstSelected(controls);
      const color = controls.find(c => groupKey(c) === 'rgb:Color');
      const seededColor = JSON.parse(JSON.stringify(groupValues['rgb:Color']));
      setGroupValue(color, { a: 90, b: 80, c: 70 });

      return {
        controls: controls.map(groupKey),
        seededColor,
        b1Color: values['102:22'],
        b2Color: values['104:22'],
        bogusAColor: Object.prototype.hasOwnProperty.call(values, '101:22')
      };
    });

    expect(result.controls).toEqual(expect.arrayContaining(['slider8:Dimmer', 'rgb:Color']));
    expect(result.seededColor).toEqual({ a: 12, b: 34, c: 56 });
    expect(result.b1Color).toEqual({ a: 90, b: 80, c: 70 });
    expect(result.b2Color).toEqual({ a: 90, b: 80, c: 70 });
    expect(result.bogusAColor).toBe(false);
  });

  test('Select All keeps same-named wheel controls separate when fixture types use different options', async ({ page }) => {
    await page.evaluate(() => {
      profiles = [
        {
          id: 1,
          name: 'Profile A',
          mode: 'test',
          channels: 4,
          controls: [
            { id: 11, type: 'slider8', label: 'Dimmer', channel: 1 },
            { id: 12, type: 'wheel', label: 'Gobo', channel: 2, options: [{ name: 'Open', value: 0 }, { name: 'Dots', value: 40 }] }
          ]
        },
        {
          id: 2,
          name: 'Profile B',
          mode: 'test',
          channels: 4,
          controls: [
            { id: 21, type: 'slider8', label: 'Dimmer', channel: 1 },
            { id: 22, type: 'wheel', label: 'Gobo', channel: 2, options: [{ name: 'Open', value: 0 }, { name: 'Split', value: 80 }] }
          ]
        }
      ];
      fixtures = [
        { id: 101, name: 'A 1', profileId: 1, start: 1 },
        { id: 102, name: 'A 2', profileId: 1, start: 11 },
        { id: 103, name: 'B 1', profileId: 2, start: 21 },
        { id: 104, name: 'B 2', profileId: 2, start: 31 }
      ];
      Object.keys(values).forEach(key => delete values[key]);
      selectedFixtureIds = new Set();
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      drawSurface();
    });

    await page.locator('#selectAllFixtures').click();
    await page.locator('#editSelectedGroups').click();

    const state = await page.evaluate(() => ({
      keys: getGroupEditableControls().map(groupKey),
      modalControls: [...document.querySelectorAll('#groupModalBody .control')].map(control => ({
        title: control.querySelector('h3')?.textContent,
        scope: [...control.querySelectorAll('.bytes')].map(el => el.textContent).join(' | '),
        options: [...control.querySelectorAll('[data-gc-wheel]')].map(btn => btn.textContent)
      }))
    }));

    const goboKeys = state.keys.filter(key => key.startsWith('wheel:Gobo'));
    const goboControls = state.modalControls.filter(control => control.title === 'Gobo');
    expect(goboKeys).toHaveLength(2);
    expect(goboControls).toHaveLength(2);
    expect(goboControls.some(control => control.options.includes('Dots'))).toBe(true);
    expect(goboControls.some(control => control.options.includes('Split'))).toBe(true);
    expect(goboControls.every(control => control.scope.includes('2 matching fixtures'))).toBe(true);
  });

  test('Group Edit modal fits controls horizontally and only scrolls vertically', async ({ page }) => {
    const layout = await page.evaluate(() => {
      const profileA = profiles.find(p => p.id === 1);
      const profileB = profiles.find(p => p.id === 2);
      const wheelOptions = Array.from({ length: 18 }, (_, i) => ({
        name: 'Long wheel option ' + (i + 1),
        value: i * 10
      }));
      for (let i = 0; i < 48; i++) {
        profileA.controls.push({ id: 1000 + i, type: 'slider8', label: 'Shared Control ' + i, channel: 1 });
        profileB.controls.push({ id: 2000 + i, type: 'slider8', label: 'Shared Control ' + i, channel: 1 });
      }
      profileA.controls.push({ id: 3000, type: 'wheel', label: 'Long Wheel', channel: 1, options: wheelOptions });
      profileB.controls.push({ id: 4000, type: 'wheel', label: 'Long Wheel', channel: 1, options: wheelOptions });
      selectedFixtureIds = new Set([101, 102]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      openGroupModal();

      const body = document.getElementById('groupModalBody');
      const style = getComputedStyle(body);
      return {
        defaultLabel: document.getElementById('defaultGroupBtn')?.textContent,
        blackoutLabel: document.getElementById('blackoutGroupBtn')?.textContent,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        clientWidth: body.clientWidth,
        scrollWidth: body.scrollWidth,
        clientHeight: body.clientHeight,
        scrollHeight: body.scrollHeight,
        wheelTabsHeight: document.querySelector('#groupModalBody [data-gc-wheel]')?.closest('.tabs')?.getBoundingClientRect().height || 0,
        wheelControlHeight: document.querySelector('#groupModalBody [data-gc-wheel]')?.closest('.control')?.getBoundingClientRect().height || 0
      };
    });

    expect(layout.defaultLabel).toBe('Default');
    expect(layout.blackoutLabel).toBe('Blackout');
    expect(layout.overflowX).toBe('hidden');
    expect(layout.overflowY).toBe('auto');
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
    expect(layout.wheelTabsHeight).toBeGreaterThan(30);
    expect(layout.wheelControlHeight).toBeGreaterThan(90);
  });

  test('Group Edit modal scrolls to the last control on desktop and iPad-sized viewports', async ({ page }) => {
    async function measureAtViewport(width, height) {
      await page.setViewportSize({ width, height });
      return page.evaluate(() => {
        closeGroupModal?.();
        const profileA = profiles.find(p => p.id === 1);
        const profileB = profiles.find(p => p.id === 2);
        profileA.controls = profileA.controls.filter(c => c.id < 5000);
        profileB.controls = profileB.controls.filter(c => c.id < 5000);
        for (let i = 0; i < 64; i++) {
          profileA.controls.push({ id: 5000 + i, type: 'slider8', label: 'Scrollable Control ' + i, channel: 1 });
          profileB.controls.push({ id: 6000 + i, type: 'slider8', label: 'Scrollable Control ' + i, channel: 1 });
        }
        selectedFixtureIds = new Set([101, 102]);
        activeSavedGroupIds.clear();
        sceneFixtureFilterActive = false;
        activeControlScopeKeys.clear();
        fanAffectedKeys.clear();
        openGroupModal();

        const modal = document.querySelector('#groupModal .modal');
        const body = document.getElementById('groupModalBody');
        const controls = body.querySelectorAll('.control');
        body.scrollTop = body.scrollHeight;
        const last = controls[controls.length - 1];
        const lastRect = last.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const footerRect = document.querySelector('#groupModal .buttons').getBoundingClientRect();
        return {
          viewportHeight: window.innerHeight,
          modalHeight: modal.getBoundingClientRect().height,
          bodyClientHeight: body.clientHeight,
          bodyScrollHeight: body.scrollHeight,
          bodyScrollTop: body.scrollTop,
          bodyOverflowX: getComputedStyle(body).overflowX,
          bodyOverflowY: getComputedStyle(body).overflowY,
          horizontalOverflow: body.scrollWidth - body.clientWidth,
          lastReachable: lastRect.bottom <= bodyRect.bottom + 2,
          footerVisible: footerRect.bottom <= window.innerHeight && footerRect.top >= 0
        };
      });
    }

    const desktop = await measureAtViewport(1440, 900);
    const ipad = await measureAtViewport(768, 1024);

    for (const layout of [desktop, ipad]) {
      expect(layout.modalHeight).toBeLessThanOrEqual(layout.viewportHeight);
      expect(layout.bodyOverflowX).toBe('hidden');
      expect(layout.bodyOverflowY).toBe('auto');
      expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
      expect(layout.bodyScrollHeight).toBeGreaterThan(layout.bodyClientHeight + 100);
      expect(layout.bodyScrollTop).toBeGreaterThan(100);
      expect(layout.lastReachable).toBe(true);
      expect(layout.footerVisible).toBe(true);
    }
  });

  test('manual fixture selection refines a group without losing the fixture filter', async ({ page }) => {
    const result = await page.evaluate(() => {
      activeSavedGroupIds = new Set([savedGroupKey(savedGroups[0], 0)]);
      rebuildSelectionFromSavedGroups();
      DmxCommon.saveSharedGroupSelection(selectedSavedGroupIds());
      renderSavedGroupsList();
      drawSurface();
      document.querySelector('[data-fixture-card="101"]').click();
      return {
        selectedGroups: selectedSavedGroups().length,
        selectedFixtures: [...selectedFixtureIds].sort(),
        shared: JSON.parse(localStorage.getItem('selectedGroupIds') || '[]'),
        filteredFixtures: [...activeFixtureFilterIds].sort(),
        visibleCards: [...document.querySelectorAll('#surface article h2')].map(el => el.textContent),
        groupBarText: document.getElementById('groupBar').textContent
      };
    });

    expect(result.selectedGroups).toBe(0);
    expect(result.selectedFixtures).toEqual([102]);
    expect(result.shared).toEqual([]);
    expect(result.filteredFixtures).toEqual([101, 102]);
    expect(result.visibleCards).toEqual(['A 1', 'B 1']);
    expect(result.groupBarText).toContain('Filtered group selection');
  });

  test('fixture card click toggles selection while controls do not', async ({ page }) => {
    const result = await page.evaluate(() => {
      const card = document.querySelector('[data-fixture-card="101"]');
      const hasLegacySelectButton = !!document.querySelector('[data-select-fixture]');
      card.querySelector('.fixture-head').click();
      const afterCardClick = [...selectedFixtureIds];
      const selectedCard = document.querySelector('[data-fixture-card="101"]');
      selectedCard.querySelector('input[type="range"]').click();
      const afterSliderClick = [...selectedFixtureIds];
      const selectedStyle = {
        borderColor: getComputedStyle(selectedCard).borderColor,
        boxShadow: getComputedStyle(selectedCard).boxShadow
      };
      return { hasLegacySelectButton, afterCardClick, afterSliderClick, selectedStyle };
    });

    expect(result.hasLegacySelectButton).toBe(false);
    expect(result.afterCardClick).toEqual([101]);
    expect(result.afterSliderClick).toEqual([101]);
    expect(result.selectedStyle.boxShadow).not.toBe('none');
  });

  test('saved fixture profile header selects the profile like fixture card headers', async ({ page }) => {
    await page.evaluate(() => {
      profiles.splice(0, profiles.length,
        { id: 9201, name: 'Profile A', mode: '1ch', channels: 1, controls: [] },
        { id: 9202, name: 'Profile B', mode: '2ch', channels: 2, controls: [] }
      );
      activeProfileId = 9201;
      loadProfileEditor(profiles[0]);
      drawProfiles();
      setSectionCollapsed('profilesCollapseBtn', 'profilesBody', 'profilesCollapsed', false);
    });

    await page.locator('[data-profile-card-head="9202"]').click();

    const selected = await page.evaluate(() => ({
      activeProfileId,
      name: document.getElementById('profileName').value,
      mode: document.getElementById('profileMode').value,
      activeCards: [...document.querySelectorAll('#profiles .item.active')].map(el => el.dataset.profileCard),
      selectedStyle: {
        boxShadow: getComputedStyle(document.querySelector('[data-profile-card="9202"]')).boxShadow,
        background: getComputedStyle(document.querySelector('[data-profile-card="9202"]')).backgroundColor
      }
    }));
    expect(selected.activeProfileId).toBe(9202);
    expect(selected.name).toBe('Profile B');
    expect(selected.mode).toBe('2ch');
    expect(selected.activeCards).toEqual(['9202']);
    expect(selected.selectedStyle.boxShadow).not.toBe('none');
    expect(selected.selectedStyle.background).toBe('rgb(16, 36, 31)');
  });

  test('wheel controls reject duplicate DMX option values', async ({ page }) => {
    const message = await page.evaluate(() => duplicateWheelOptionValueError([
      { name: 'Open', value: 0 },
      { name: 'Closed', value: 0 },
      { name: 'Gobo', value: 40 }
    ]));

    expect(message).toContain('DMX 0');
    expect(message).toContain('"Open"');
    expect(message).toContain('"Closed"');
  });

  test('RGB matrix controls render pixels and resolve sequential DMX channels', async ({ page }) => {
    const result = await page.evaluate(() => {
      profiles = [{
        id: 900,
        name: 'Matrix Bar',
        mode: '2x2',
        channels: 12,
        controls: [{
          id: 901,
          type: 'matrixRgb',
          label: 'Pixels',
          channel: 1,
          width: 2,
          height: 2
        }]
      }];
      fixtures = [{ id: 902, name: 'Matrix 1', profileId: 900, start: 101 }];
      Object.keys(values).forEach(key => delete values[key]);
      activeProfileId = 900;
      selectedFixtureIds = new Set();
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      draw();

      const picker = document.querySelector('[data-matrix-paint-color][data-fixture="902"][data-control="901"]');
      picker.value = '#336699';
      document.querySelector('[data-matrix-pixel="2"][data-fixture="902"][data-control="901"]').click();

      return {
        channelText: controlChannelText(profiles[0].controls[0]),
        pixelCount: document.querySelectorAll('[data-matrix-pixel][data-fixture="902"][data-control="901"]').length,
        value: values['902:901'].pixels[2],
        bytes: resolveDmxBytes(fixtures[0], profiles[0].controls[0]).filter(row => row.val > 0)
      };
    });

    expect(result.channelText).toBe('2×2 RGB from CH 1 to 12');
    expect(result.pixelCount).toBe(4);
    expect(result.value).toEqual({ a: 51, b: 102, c: 153 });
    expect(result.bytes).toEqual([
      { ch: 107, val: 51, param: 'Pixel 3 Red' },
      { ch: 108, val: 102, param: 'Pixel 3 Green' },
      { ch: 109, val: 153, param: 'Pixel 3 Blue' }
    ]);
  });

  test('Fixture Library imports a converted OFL mode as a controller profile', async ({ page }) => {
    await page.evaluate(() => setSectionCollapsed('fixtureLibraryCollapseBtn', 'fixtureLibraryBody', 'fixtureLibraryCollapsed', false));
    await expect(page.locator('#fixtureLibraryStatus')).toContainText('Loaded', { timeout: 15000 });
    await page.locator('#fixtureLibrarySearch').fill('american dj inno pocket spot');
    await page.locator('[data-library-key="american-dj/inno-pocket-spot"]').click();
    await page.locator('#fixtureLibraryMode').selectOption('1');
    await page.locator('#importFixtureLibraryProfile').click();

    const profile = await page.evaluate(() => {
      const imported = profiles.find(p => p.name === 'American DJ Inno Pocket Spot' && p.mode === '11-channel');
      return imported ? {
        name: imported.name,
        mode: imported.mode,
        channels: imported.channels,
        controls: imported.controls.map(c => ({ type: c.type, label: c.label, pan: c.pan, panFine: c.panFine, tilt: c.tilt, tiltFine: c.tiltFine, channel: c.channel }))
      } : null;
    });

    expect(profile).toBeTruthy();
    expect(profile.channels).toBe(11);
    expect(profile.controls).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'panTilt16', label: 'Pan/Tilt', pan: 1, panFine: 2, tilt: 3, tiltFine: 4 }),
      expect.objectContaining({ type: 'wheel', label: 'Color Wheel', channel: 5 }),
      expect.objectContaining({ type: 'slider8', label: 'Dimmer', channel: 8 })
    ]));
  });

  test('Fixture Library preserves OFL wheel slot names, ranges, and colors', async ({ page }) => {
    await page.evaluate(() => setSectionCollapsed('fixtureLibraryCollapseBtn', 'fixtureLibraryBody', 'fixtureLibraryCollapsed', false));
    await expect(page.locator('#fixtureLibraryStatus')).toContainText('Loaded', { timeout: 15000 });
    await page.locator('#fixtureLibrarySearch').fill('fun generation picospot 20 led');
    await page.locator('[data-library-key="fun-generation/picospot-20-led"]').click();
    await page.locator('#fixtureLibraryMode').selectOption('0');
    await page.locator('#importFixtureLibraryProfile').click();

    const state = await page.evaluate(() => {
      const profile = profiles.find(p => p.name === 'Fun Generation PicoSpot 20 LED' && p.mode === '5-channel');
      const wheel = profile.controls.find(c => c.label === 'Color Wheel');
      const red = wheel.options.find(o => o.name === 'Red');
      const rotation = wheel.options.find(o => o.kind === 'WheelRotation');
      fixtures.splice(0, fixtures.length, { id: 9901, name: 'PicoSpot', profileId: profile.id, start: 1 });
      Object.keys(values).forEach(key => delete values[key]);
      values['9901:' + wheel.id] = 18;
      drawSurface();
      const activeButton = document.querySelector(`[data-fixture="9901"][data-control="${wheel.id}"][data-wheel].active`);
      return {
        red,
        rotation,
        selectedAtRangeValue: selectedWheelOption(wheel, 18)?.name,
        textFormat: wheelOptionsText([red]),
        activeButtonText: activeButton?.textContent.trim(),
        activeTitle: activeButton?.getAttribute('title')
      };
    });

    expect(state.red).toEqual(expect.objectContaining({
      value: 16,
      range: [11, 21],
      kind: 'WheelSlot',
      slotNumber: 2,
      color: '#ff0000'
    }));
    expect(state.rotation).toEqual(expect.objectContaining({
      value: 216,
      range: [176, 255],
      kind: 'WheelRotation'
    }));
    expect(state.selectedAtRangeValue).toBe('Red');
    expect(state.textFormat).toBe('Red=11-21|#ff0000');
    expect(state.activeButtonText).toContain('Red');
    expect(state.activeTitle).toBe('DMX 11-21 · WheelSlot');
  });

  test('OFL wheel shake ranges expose a bounded speed slider', async ({ page }) => {
    await page.evaluate(() => setSectionCollapsed('fixtureLibraryCollapseBtn', 'fixtureLibraryBody', 'fixtureLibraryCollapsed', false));
    await expect(page.locator('#fixtureLibraryStatus')).toContainText('Loaded', { timeout: 15000 });
    await page.locator('#fixtureLibrarySearch').fill('fun generation picospot 20 led');
    await page.locator('[data-library-key="fun-generation/picospot-20-led"]').click();
    await page.locator('#fixtureLibraryMode').selectOption('2');
    await page.locator('#importFixtureLibraryProfile').click();

    const state = await page.evaluate(() => {
      const profile = profiles.find(p => p.name === 'Fun Generation PicoSpot 20 LED' && p.mode === '11-channel');
      const gobo = profile.controls.find(c => c.label === 'Gobo Wheel');
      const shake = gobo.options.find(o => o.kind === 'WheelShake' && o.slotNumber === 2);
      fixtures.splice(0, fixtures.length, { id: 9902, name: 'PicoSpot 11ch', profileId: profile.id, start: 1 });
      Object.keys(values).forEach(key => delete values[key]);
      values['9902:' + gobo.id] = 130;
      drawSurface();
      const host = document.querySelector(`[data-wheel-range-host="9902:${gobo.id}"]`);
      const slider = host?.querySelector('input[type="range"]');
      const button = document.querySelector(`[data-fixture="9902"][data-control="${gobo.id}"][data-wheel-option-index="${gobo.options.indexOf(shake)}"]`);
      const sliderValueBeforeButton = slider?.value;
      slider.focus();
      slider.value = '131';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      const sliderAfterInput = document.querySelector(`[data-wheel-range-host="9902:${gobo.id}"] input[type="range"]`);
      const preservedDuringInput = slider === sliderAfterInput;
      const valueAfterInput = values['9902:' + gobo.id];
      const sliderValueAfterInput = sliderAfterInput?.value;
      button.click();
      const sliderAfterButton = document.querySelector(`[data-wheel-range-host="9902:${gobo.id}"] input[type="range"]`);
      return {
        shake,
        selectedAt130: DmxCommon.selectedWheelOption(gobo, 130)?.name,
        sliderMin: slider?.getAttribute('min'),
        sliderMax: slider?.getAttribute('max'),
        sliderValue: sliderValueBeforeButton,
        valueAfterInput,
        preservedDuringInput,
        sliderValueAfterInput,
        sliderValueAfterButton: sliderAfterButton?.value,
        sliderLabel: host?.textContent,
        buttonValue: button.dataset.wheel,
        valueAfterButton: values['9902:' + gobo.id]
      };
    });

    expect(state.shake).toEqual(expect.objectContaining({
      value: 133,
      range: [125, 140],
      kind: 'WheelShake',
      slotNumber: 2,
      shakeSpeedStart: 'slow',
      shakeSpeedEnd: 'fast'
    }));
    expect(state.selectedAt130).toContain('shake');
    expect(state.sliderMin).toBe('125');
    expect(state.sliderMax).toBe('140');
    expect(state.sliderValue).toBe('130');
    expect(state.valueAfterInput).toBe(131);
    expect(state.preservedDuringInput).toBe(true);
    expect(state.sliderValueAfterInput).toBe('131');
    expect(state.sliderValueAfterButton).toBe('133');
    expect(state.sliderLabel).toContain('Shake speed');
    expect(state.sliderLabel).toContain('slow to fast');
    expect(state.buttonValue).toBe('133');
    expect(state.valueAfterButton).toBe(133);
  });

  test('Fixture Library panel has a persistent collapse button', async ({ page }) => {
    await page.evaluate(() => setSectionCollapsed('fixtureLibraryCollapseBtn', 'fixtureLibraryBody', 'fixtureLibraryCollapsed', false));
    await expect(page.locator('#fixtureLibraryCollapseBtn')).toBeVisible();
    await expect(page.locator('#fixtureLibraryBody')).toBeVisible();

    await page.locator('#fixtureLibraryCollapseBtn').click();
    await expect(page.locator('#fixtureLibraryBody')).toBeHidden();
    await expect(page.locator('#fixtureLibraryCollapseBtn')).toHaveText('+');

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#fixtureLibraryBody')).toBeHidden();
    await expect(page.locator('#fixtureLibraryCollapseBtn')).toHaveText('+');
  });

  test('Control Surface header collapses and expands all visible fixture cards', async ({ page }) => {
    await page.evaluate(() => {
      profiles.splice(0, profiles.length, {
        id: 9100,
        name: 'Dimmer Profile',
        mode: '1ch',
        channels: 1,
        controls: [{ id: 9101, type: 'slider8', label: 'Dimmer', channel: 1 }]
      });
      fixtures.splice(0, fixtures.length,
        { id: 9102, name: 'Fixture A', profileId: 9100, start: 1 },
        { id: 9103, name: 'Fixture B', profileId: 9100, start: 2 }
      );
      collapsedFixtureIds.clear();
      drawSurface();
    });

    await expect(page.locator('#surfaceCollapseAllBtn')).toHaveText('—');
    await page.locator('#surfaceCollapseAllBtn').click();
    await expect(page.locator('#surfaceCollapseAllBtn')).toHaveText('+');
    await expect(page.locator('[data-fixture-card="9102"] [data-control="9101"]')).toBeHidden();
    await expect(page.locator('[data-fixture-card="9103"] [data-control="9101"]')).toBeHidden();

    const collapsed = await page.evaluate(() => [...collapsedFixtureIds].sort());
    expect(collapsed).toEqual([9102, 9103]);

    await page.locator('#surfaceCollapseAllBtn').click();
    await expect(page.locator('#surfaceCollapseAllBtn')).toHaveText('—');
    await expect(page.locator('[data-fixture-card="9102"] [data-control="9101"]')).toBeVisible();
    await expect(page.locator('[data-fixture-card="9103"] [data-control="9101"]')).toBeVisible();
  });

  test('scene recall clears groups and filters the surface to involved fixtures', async ({ page }) => {
    const result = await page.evaluate(() => {
      activeSavedGroupIds = new Set([savedGroupKey(savedGroups[0], 0)]);
      rebuildSelectionFromSavedGroups();
      DmxCommon.saveSharedGroupSelection(selectedSavedGroupIds());
      const scene = { name: 'A only', values: { '101:11': 55 } };
      recallScene(scene);
      return {
        selectedGroups: selectedSavedGroups().length,
        shared: JSON.parse(localStorage.getItem('selectedGroupIds') || '[]'),
        selectedFixtures: [...selectedFixtureIds],
        sceneFilter: sceneFixtureFilterActive,
        visibleCards: [...document.querySelectorAll('#surface article h2')].map(el => el.textContent)
      };
    });

    expect(result.selectedGroups).toBe(0);
    expect(result.shared).toEqual([]);
    expect(result.selectedFixtures).toEqual([101]);
    expect(result.sceneFilter).toBe(true);
    expect(result.visibleCards).toEqual(['A 1']);
  });

  test('palette recall applies only stored values and leaves unrelated controls unchanged', async ({ page }) => {
    const result = await page.evaluate(() => {
      values['101:11'] = 10;
      values['102:21'] = 20;
      recallPalette({ name: 'Dimmer A', scope: 'dimmer', values: { '101:11': 99 } });
      return {
        a: values['101:11'],
        b: values['102:21'],
        selectedGroups: selectedSavedGroups().length,
        selectedFixtures: [...selectedFixtureIds],
        scope: [...activeControlScopeKeys]
      };
    });

    expect(result.a).toBe(99);
    expect(result.b).toBe(20);
    expect(result.selectedGroups).toBe(0);
    expect(result.selectedFixtures).toEqual([101]);
    expect(result.scope).toEqual(['101:11']);
  });

  test('Fan Out symmetric spread calculates around snapshotted base values', async ({ page }) => {
    const result = await page.evaluate(() => {
      fixtures.push({ id: 104, name: 'A 2', profileId: 1, start: 61 });
      selectedFixtureIds = new Set([101, 104]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      values['101:11'] = 128;
      values['104:11'] = 128;
      drawSurface();
      const dimmer = fanControlOptions().find(o => o.label === 'Dimmer' && o.key === 'slider8:Dimmer:value');
      fanState.controlKey = dimmer.key;
      snapshotFanBases();
      fanState.mode = 'symmetric';
      fanState.spread = 100;
      fanState.inverted = false;
      return fanComputedValues().map(v => ({ id: v.fixture.id, base: v.base, finalVal: v.finalVal }));
    });

    expect(result).toEqual([
      { id: 101, base: 128, finalVal: 78 },
      { id: 104, base: 128, finalVal: 178 }
    ]);
  });

  test('Fan Out core behavior is provided by DmxCommon', async ({ page }) => {
    const result = await page.evaluate(() => {
      const valuesByKey = { '1:11': 128, '2:21': 128 };
      const fixturesData = [
        { id: 1, controls: [{ id: 11, type: 'slider8', label: 'Dimmer', channel: 1 }] },
        { id: 2, controls: [{ id: 21, type: 'slider8', label: 'Dimmer', channel: 1 }] }
      ];
      const state = { controlKey: '', mode: 'symmetric', spread: 100, fromOffset: 0, toOffset: 0, inverted: false, bases: {} };
      const fan = DmxCommon.createFanOutController({
        state,
        controlsFor: fixture => fixture.controls,
        compatibilityKey: control => control.type + ':' + control.label,
        controlId: control => control.id,
        controlLabel: control => control.label,
        controlType: control => control.type,
        hasChannel: control => control.channel >= 1,
        fixtureId: fixture => fixture.id,
        getValue: (fixture, control, def = 0) => valuesByKey[fixture.id + ':' + control.id] ?? def,
        setValue: (fixture, control, value) => { valuesByKey[fixture.id + ':' + control.id] = value; }
      });

      const options = fan.controlOptions(fixturesData);
      state.controlKey = options[0].key;
      fan.snapshotBases(fixturesData);
      const preview = fan.computedValues(fixturesData).map(item => ({ id: item.fixture.id, base: item.base, finalVal: item.finalVal }));
      fan.apply(fixturesData);
      fan.resetOffsets();
      return { options, preview, valuesByKey, spread: state.spread, fromOffset: state.fromOffset, toOffset: state.toOffset };
    });

    expect(result.options).toEqual([{ key: 'slider8:Dimmer:value', label: 'Dimmer', max: 255 }]);
    expect(result.preview).toEqual([
      { id: 1, base: 128, finalVal: 78 },
      { id: 2, base: 128, finalVal: 178 }
    ]);
    expect(result.valuesByKey).toMatchObject({ '1:11': 78, '2:21': 178 });
    expect(result).toMatchObject({ spread: 0, fromOffset: 0, toOffset: 0 });
  });

  test('Fan Out works across fixtures with matching controls but different control ids', async ({ page }) => {
    const result = await page.evaluate(() => {
      selectedFixtureIds = new Set([101, 102]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      values['101:11'] = 128;
      values['102:21'] = 128;
      drawSurface();

      const options = fanControlOptions().map(o => ({ key: o.key, label: o.label }));
      const dimmer = fanControlOptions().find(o => o.label === 'Dimmer');
      if (dimmer) {
        fanState.controlKey = dimmer.key;
        snapshotFanBases();
        fanState.mode = 'symmetric';
        fanState.spread = 100;
        applyFanToController({ silent: true });
      }
      return {
        options,
        dimmerKey: dimmer?.key || '',
        a: values['101:11'],
        b: values['102:21'],
        affected: [...fanAffectedKeys].sort(),
        status: document.getElementById('status').textContent
      };
    });

    expect(result.options).toEqual([{ key: 'slider8:Dimmer:value', label: 'Dimmer' }]);
    expect(result.dimmerKey).toBe('slider8:Dimmer:value');
    expect(result.a).toBe(78);
    expect(result.b).toBe(178);
    expect(result.affected).toEqual(['101:11', '102:21']);
  });

  test('Fan Out control selection resets spread offsets to zero', async ({ page }) => {
    const result = await page.evaluate(() => {
      selectedFixtureIds = new Set([101]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys.clear();
      drawSurface();
      renderFanToolbox();

      const select = document.getElementById('fanControlSelect');
      const options = [...select.options].map(option => option.value);
      fanState.controlKey = options[0];
      fanState.mode = 'symmetric';
      fanState.spread = 120;
      fanState.fromOffset = -40;
      fanState.toOffset = 40;
      renderFanToolbox();

      select.value = options[1];
      select.dispatchEvent(new Event('change', { bubbles: true }));

      return {
        optionCount: options.length,
        controlKey: fanState.controlKey,
        spread: fanState.spread,
        fromOffset: fanState.fromOffset,
        toOffset: fanState.toOffset,
        slider: document.getElementById('fanSpread').value,
        readout: document.getElementById('fanSpreadReadout').textContent
      };
    });

    expect(result.optionCount).toBeGreaterThan(1);
    expect(result.spread).toBe(0);
    expect(result.fromOffset).toBe(0);
    expect(result.toOffset).toBe(0);
    expect(result.slider).toBe('0');
    expect(result.readout).toBe('0');
  });

  test('Fan Out Clear resets the shaping controls', async ({ page }) => {
    const result = await page.evaluate(() => {
      selectedFixtureIds = new Set([101, 102]);
      activeSavedGroupIds.clear();
      sceneFixtureFilterActive = false;
      activeControlScopeKeys.clear();
      fanAffectedKeys = new Set(['101:11']);
      drawSurface();
      renderFanToolbox();

      const option = fanControlOptions().find(o => o.label === 'Dimmer');
      fanState.controlKey = option.key;
      fanState.mode = 'range';
      fanState.spread = 90;
      fanState.fromOffset = -30;
      fanState.toOffset = 60;
      fanState.inverted = true;
      renderFanToolbox();
      document.getElementById('fanClear').click();

      return {
        spread: fanState.spread,
        fromOffset: fanState.fromOffset,
        toOffset: fanState.toOffset,
        inverted: fanState.inverted,
        affected: [...fanAffectedKeys],
        slider: document.getElementById('fanSpread').value,
        readout: document.getElementById('fanSpreadReadout').textContent,
        invertText: document.getElementById('fanInvert').textContent
      };
    });

    expect(result.spread).toBe(0);
    expect(result.fromOffset).toBe(0);
    expect(result.toOffset).toBe(0);
    expect(result.inverted).toBe(false);
    expect(result.affected).toEqual([]);
    expect(result.slider).toBe('0');
    expect(result.readout).toBe('0');
    expect(result.invertText).toBe('Invert');
  });
});

test.describe('Fixture Controller reload rules', () => {
  test('toolbox Group Edit enables after a hard reload and manual fixture selection with no group filter', async ({ page }) => {
    await routeControllerCompactServerSetup(page);
    await openDmxPage(page, '');
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.locator('[data-fixture-card="101"]')).toBeVisible();
    await expect(page.locator('[data-fixture-card="102"]')).toBeVisible();
    let state = await page.evaluate(() => ({
      selectedFixtures: [...selectedFixtureIds],
      selectedGroups: selectedSavedGroups().length,
      groupBarButtonExists: !!document.getElementById('openGroupEdit'),
      toolboxDisabled: document.getElementById('editSelectedGroups')?.disabled
    }));
    expect(state.selectedFixtures).toEqual([]);
    expect(state.selectedGroups).toBe(0);
    expect(state.groupBarButtonExists).toBe(false);
    expect(state.toolboxDisabled).toBe(true);

    await page.locator('[data-fixture-card="101"] .fixture-head').click();
    await page.locator('[data-fixture-card="102"] .fixture-head').click();

    state = await page.evaluate(() => ({
      selectedFixtures: [...selectedFixtureIds],
      selectedGroups: selectedSavedGroups().length,
      sharedGroups: JSON.parse(localStorage.getItem('selectedGroupIds') || '[]'),
      controls: getGroupEditableControls().map(groupKey),
      toolboxDisabled: document.getElementById('editSelectedGroups')?.disabled
    }));

    expect(state.selectedFixtures.sort()).toEqual([101, 102]);
    expect(state.selectedGroups).toBe(0);
    expect(state.sharedGroups).toEqual([]);
    expect(state.controls).toContain('slider8:Dimmer');
    expect(state.toolboxDisabled).toBe(false);
  });

  test('Select All is the explicit way to enable toolbox Group Edit for all fixtures after hard reload', async ({ page }) => {
    await routeControllerCompactServerSetup(page);
    await openDmxPage(page, '');
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.locator('#selectAllFixtures')).toBeVisible();
    await expect(page.locator('#openGroupEdit')).toHaveCount(0);
    await expect(page.locator('#editSelectedGroups')).toBeDisabled();
    await page.locator('#selectAllFixtures').click();

    const state = await page.evaluate(() => ({
      selectedFixtures: [...selectedFixtureIds],
      selectedGroups: selectedSavedGroups().length,
      controls: getGroupEditableControls().map(groupKey),
      toolboxDisabled: document.getElementById('editSelectedGroups')?.disabled
    }));

    expect(state.selectedFixtures.sort()).toEqual([101, 102, 103]);
    expect(state.selectedGroups).toBe(0);
    expect(state.controls).toContain('slider8:Dimmer');
    expect(state.toolboxDisabled).toBe(false);

    await page.locator('#editSelectedGroups').click();
    await expect(page.locator('#groupModal')).toBeVisible();
    await expect(page.locator('#groupModalBody .control h3')).toHaveText(['Dimmer']);
  });

  test('late empty group selection load does not clear manual fixture selection after hard reload', async ({ page }) => {
    let releaseGroups;
    const groupsReady = new Promise(resolve => { releaseGroups = resolve; });

    await page.route('**/fixture_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          setup: {
            baseUrl: '',
            profiles: [
              {
                id: 1,
                name: 'Profile A',
                mode: 'test',
                channels: 8,
                controls: [
                  { id: 11, type: 'slider8', label: 'Dimmer', channel: 1 }
                ]
              }
            ],
            fixtures: [
              { id: 101, name: 'A 1', profileId: 1, start: 1 },
              { id: 102, name: 'A 2', profileId: 1, start: 11 }
            ],
            values: {}
          }
        })
      });
    });
    await page.route('**/group_setup.php**', async route => {
      if (route.request().method() !== 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await groupsReady;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, baseUrl: '', groups: [] })
      });
    });
    await page.route('**/ui_state.php**', async route => {
      if (route.request().method() !== 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, state: { toolboxes: { selectedGroupIds: [] } } })
      });
    });

    await openDmxPage(page, '');
    await expect(page.locator('[data-fixture-card="101"]')).toBeVisible();
    await page.locator('[data-fixture-card="101"] .fixture-head').click();
    await page.locator('[data-fixture-card="102"] .fixture-head').click();
    releaseGroups();
    await page.waitForResponse(response => response.url().includes('group_setup.php') && response.request().method() === 'GET');
    await page.waitForTimeout(100);

    const state = await page.evaluate(() => ({
      selectedFixtures: [...selectedFixtureIds],
      selectedGroups: selectedSavedGroups().length,
      toolboxDisabled: document.getElementById('editSelectedGroups')?.disabled
    }));

    expect(state.selectedFixtures.sort()).toEqual([101, 102]);
    expect(state.selectedGroups).toBe(0);
    expect(state.toolboxDisabled).toBe(false);
  });
});
