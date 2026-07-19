const { test, expect } = require('@playwright/test');
const { openDmxPage, injectChaserCompactSetup } = require('./helpers/dmx-page');
const fs = require('fs');
const path = require('path');

function parseDmxBatch(body) {
  return Object.fromEntries(String(body || '').split(',').filter(Boolean).map(pair => {
    const [channel, value] = pair.split(':').map(Number);
    return [channel, value];
  }));
}

test.describe('Chaser established rules', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/scene_setup.php**', async route => {
      if (route.request().method() !== 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, scenes: [], slotCols: 4, slotRows: 4 })
      });
    });
    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);
  });

  test('Participating Controls and Edit Step cards stay compact when collapsed', async ({ page }) => {
    const result = await page.evaluate(() => {
      const measure = panelId => {
        const panel = document.getElementById(panelId);
        const btn = document.querySelector(`[data-panel-toggle="${panelId}"]`);
        if (panel.classList.contains('collapsed-panel')) btn.click();
        const expandedHeight = panel.getBoundingClientRect().height;
        btn.click();
        const collapsedHeight = panel.getBoundingClientRect().height;
        return {
          expandedHeight,
          collapsedHeight,
          bodyHidden: getComputedStyle(panel.querySelector('.panel-body')).display === 'none'
        };
      };
      return {
        participation: measure('participationPanel'),
        editStep: measure('stepEditorSection')
      };
    });

    for (const state of [result.participation, result.editStep]) {
      expect(state.bodyHidden).toBe(true);
      expect(state.collapsedHeight).toBeLessThan(state.expandedHeight * 0.45);
      expect(state.collapsedHeight).toBeLessThanOrEqual(60);
    }
  });

  test('Fan Out toolbox layout comes from shared common markup', async ({ page }) => {
    const repoRoot = path.resolve(__dirname, '../..');
    const controllerHtml = fs.readFileSync(path.join(repoRoot, 'web/dmx_fixture_controller.html'), 'utf8');
    const chaserHtml = fs.readFileSync(path.join(repoRoot, 'web/dmx_chaser.html'), 'utf8');
    const commonJs = fs.readFileSync(path.join(repoRoot, 'web/assets/dmx-common.js'), 'utf8');

    expect((controllerHtml.match(/scene-toolbox--fan/g) || []).length).toBe(0);
    expect((chaserHtml.match(/scene-toolbox--fan/g) || []).length).toBe(0);
    expect(commonJs).toContain('function fanOutToolboxHtml');
    expect(controllerHtml).toContain('DmxCommon.mountFanOutToolbox');
    expect(chaserHtml).toContain('DmxCommon.mountFanOutToolbox');

    const chaserLayout = await page.evaluate(() => ({
      labels: [...document.querySelectorAll('#fanToolbox label')].map(label => label.childNodes[0]?.textContent.trim()),
      inputs: [...document.querySelectorAll('#fanToolbox select,#fanToolbox input')].map(input => ({ id: input.id, type: input.tagName === 'SELECT' ? 'select' : input.type })),
      buttons: [...document.querySelectorAll('#fanToolbox button')].map(button => button.id)
    }));

    await openDmxPage(page, '');
    const controllerLayout = await page.evaluate(() => ({
      labels: [...document.querySelectorAll('#fanToolbox label')].map(label => label.childNodes[0]?.textContent.trim()),
      inputs: [...document.querySelectorAll('#fanToolbox select,#fanToolbox input')].map(input => ({ id: input.id, type: input.tagName === 'SELECT' ? 'select' : input.type })),
      buttons: [...document.querySelectorAll('#fanToolbox button')].map(button => button.id)
    }));

    expect(chaserLayout).toEqual(controllerLayout);
    expect(chaserLayout.inputs).toEqual(expect.arrayContaining([
      { id: 'fanSpreadStep', type: 'number' }
    ]));
    expect(chaserLayout.buttons).toEqual(expect.arrayContaining(['fanSpreadDown', 'fanSpreadUp']));
  });

  test('Chaser toolbox tile matrices expose common Move controls', async ({ page }) => {
    await page.evaluate(() => {
      chaserGroupsBox.setGroups([
        { id: 'grp_a', name: 'Group A', slot: 0, fixtureIds: [101], values: {} },
        { id: 'grp_b', name: 'Group B', slot: 1, fixtureIds: [102], values: {} }
      ]);
      savedChases = [
        { id: 'chase_a', name: 'Chase A', slot: 0, data: currentChaseSlotData() },
        { id: 'chase_b', name: 'Chase B', slot: 1, data: currentChaseSlotData() }
      ];
      chaserScenes = [
        { id: 'scene_a', name: 'Scene A', slot: 0, values: { '101:11': 80 } },
        { id: 'scene_b', name: 'Scene B', slot: 1, values: { '102:21': 40 } }
      ];
      chaserPalettes = [
        { id: 'pal_a', name: 'Palette A', slot: 0, values: { '101:11': 80 } },
        { id: 'pal_b', name: 'Palette B', slot: 1, values: { '102:21': 40 } }
      ];
      chaserPlanes = [
        DmxCommon.normalizeRoomPlane({ id: 'plane_a', name: 'Plane A', slot: 0, fixtures: [] }, 0),
        DmxCommon.normalizeRoomPlane({ id: 'plane_b', name: 'Plane B', slot: 1, fixtures: [] }, 1)
      ];
      renderChaseSlotMatrix();
      renderChaserSceneMatrix();
      renderChaserPaletteMatrix();
      chaserPlanesMatrix.render();
    });

    await expect(page.locator('#chaserGroupsMove')).toBeVisible();
    await expect(page.locator('#chaserGroupsRename')).toHaveCount(0);
    await expect(page.locator('#chaserGroupsDelete')).toHaveCount(0);
    await expect(page.locator('#chaserGroupsList [data-edit-group-tile="0"]')).toBeVisible();
    await expect(page.locator('#chaserGroupsList [data-delete-group-tile="0"]')).toBeVisible();
    await expect(page.locator('#moveChaseSlotsBtn')).toBeVisible();
    await expect(page.locator('#moveChaserScenesBtn')).toBeVisible();
    await expect(page.locator('#moveChaserPalettesBtn')).toBeVisible();
    await expect(page.locator('#moveChaserPlanesBtn')).toBeVisible();

    await page.locator('#chaserGroupsList [data-edit-group-tile="0"]').click();
    await expect(page.locator('#sharedGroupVisualModal')).toBeVisible();
    await page.locator('#sharedGroupVisualName').fill('Renamed Group A');
    await page.locator('#sharedGroupVisualColor').fill('#115577');
    await page.locator('#sharedGroupVisualSave').click();
    await expect(page.locator('#sharedGroupVisualModal')).toBeHidden();
    await expect.poll(() => page.evaluate(() => chaserGroupsBox.groups.find(group => group.id === 'grp_a').name)).toBe('Renamed Group A');
    await expect.poll(() => page.evaluate(() => chaserGroupsBox.groups.find(group => group.id === 'grp_a').visual?.color)).toBe('#115577');

    await page.locator('#moveChaseSlotsBtn').click();
    await page.locator('[data-chase-slot="0"]').click();
    await page.locator('[data-chase-slot="3"]').click();
    await expect.poll(() => page.evaluate(() => savedChases.find(chase => chase.id === 'chase_a').slot)).toBe(3);

    await page.locator('#moveChaserScenesBtn').click();
    await page.locator('[data-chaser-scene-slot="0"]').click();
    await page.locator('[data-chaser-scene-slot="3"]').click();
    await expect.poll(() => page.evaluate(() => chaserScenes.find(scene => scene.id === 'scene_a').slot)).toBe(3);

    await page.locator('#moveChaserPalettesBtn').click();
    await page.locator('[data-chaser-palette-slot="0"]').click();
    await page.locator('[data-chaser-palette-slot="3"]').click();
    await expect.poll(() => page.evaluate(() => chaserPalettes.find(palette => palette.id === 'pal_a').slot)).toBe(3);

    await page.locator('#moveChaserPlanesBtn').click();
    await page.locator('#chaserPlaneMatrix [data-plane-slot="0"]').click();
    await page.locator('#chaserPlaneMatrix [data-plane-slot="3"]').click();
    await expect.poll(() => page.evaluate(() => chaserPlanes.find(plane => plane.id === 'plane_a').slot)).toBe(3);

    await page.locator('#chaserGroupsMove').click();
    await page.locator('#chaserGroupsList [data-group-slot="0"]').click();
    await page.locator('#chaserGroupsList [data-group-slot="3"]').click();
    await expect.poll(() => page.evaluate(() => chaserGroupsBox.groups.find(group => group.id === 'grp_a').slot)).toBe(3);
  });

  test('Scenes toolbox matches Controller tiles and recalls a complete scene into the selected step', async ({ page }) => {
    await expect(page.locator('#chaserSceneBox')).toBeVisible();
    await expect(page.locator('#chaserSceneLayoutControls')).toBeVisible();
    await expect(page.locator('#moveChaserScenesBtn')).toBeVisible();

    await page.evaluate(() => {
      chaserGroupsBox.setGroups([{ id: 'grp_scene', name: 'Old target', slot: 0, fixtureIds: [101], values: {} }]);
      chaserScenes = [{
        id: 'scene_full',
        name: 'Full Look',
        slot: 0,
        values: { '101:11': 75, '102:21': 35 },
        visual: { type: 'visual', color: '#225a50', image: '' }
      }];
      steps = [makeStep('Existing step', { '101:12': { pan: 1234, tilt: 5678 } })];
      selectedStepIdx = 0;
      applyStepParticipating(steps[0]);
      renderChaserSceneMatrix();
      drawStepList();
      drawStepEditor();
    });

    await page.locator('#chaserGroupsList [data-group-index="0"]').click();
    await expect(page.locator('#chaserSceneMatrix [data-chaser-scene-slot="0"]')).toBeVisible();
    await expect(page.locator('#chaserSceneMatrix [data-visual-chaser-scene-slot="0"]')).toBeVisible();
    await expect(page.locator('#chaserSceneMatrix [data-del-chaser-scene="0"]')).toBeVisible();
    await page.locator('#chaserSceneMatrix [data-chaser-scene-slot="0"]').click();

    const recalled = await page.evaluate(() => ({
      values: steps[0].values,
      participating: [...activeStepValueKeys].sort(),
      selectedGroups: chaserGroupsBox.selectedGroups().map(group => group.id)
    }));
    expect(recalled.values).toEqual({ '101:11': 75, '102:21': 35 });
    expect(recalled.participating).toEqual(['101:11', '102:21']);
    expect(recalled.selectedGroups).toEqual([]);
    await expect(page.locator('#status')).toContainText('Recalled scene "Full Look" into step 1');
  });

  test('clicking a saved Plane opens its target modal and applies the current target to the step', async ({ page }) => {
    await page.evaluate(() => {
      chaserPlanes = [DmxCommon.normalizeRoomPlane({
        id: 'chaser_plane_modal',
        name: 'Chaser Modal Plane',
        slot: 0,
        points: [
          { id: 'A', x: 0, y: 0, z: 0 },
          { id: 'B', x: 10, y: 0, z: 0 },
          { id: 'C', x: 0, y: 10, z: 0 }
        ],
        target: { x: 5, y: 0, z: 0 },
        fixtures: [{
          id: 101,
          name: 'A 1',
          x: 1,
          y: 1,
          z: 0,
          cal: {
            A: { calibrated: true, pan: 1000, tilt: 2000 },
            B: { calibrated: true, pan: 3000, tilt: 4000 },
            C: { calibrated: true, pan: 5000, tilt: 6000 }
          }
        }]
      }, 0)];
      chaserPlanesMatrix.render();
    });

    await page.locator('#chaserPlaneMatrix [data-plane-slot="0"]').click();

    await expect(page.locator('#chaserPlaneModal')).toBeVisible();
    await expect.poll(() => page.evaluate(() => steps[selectedStepIdx]?.values?.['101:12'])).toEqual({ pan: 2000, tilt: 3000 });
  });

  test('Fan Out spread slider fills the shared toolbox width on Chaser', async ({ page }) => {
    const layout = await page.evaluate(() => {
      const slider = document.getElementById('fanSpread');
      const label = document.getElementById('fanSpreadWrap');
      const row = slider.closest('div');
      return {
        sliderWidth: slider.getBoundingClientRect().width,
        labelWidth: label.getBoundingClientRect().width,
        rowWidth: row.getBoundingClientRect().width
      };
    });

    expect(layout.sliderWidth).toBeGreaterThan(180);
    expect(layout.sliderWidth).toBeGreaterThan(layout.labelWidth * 0.9);
    expect(layout.labelWidth).toBeGreaterThan(layout.rowWidth * 0.55);
  });

  test('Pico Playback panel has a persistent collapse button', async ({ page }) => {
    await expect(page.locator('[data-panel-toggle="picoPanel"]')).toBeVisible();
    await expect(page.locator('#picoPanel .panel-body')).toBeVisible();

    await page.locator('[data-panel-toggle="picoPanel"]').click();
    await expect(page.locator('#picoPanel .panel-body')).toBeHidden();
    await expect(page.locator('[data-panel-toggle="picoPanel"]')).toHaveText('+');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#picoPanel .panel-body')).toBeHidden();
    await expect(page.locator('[data-panel-toggle="picoPanel"]')).toHaveText('+');
  });

  test('Pico Playback uses one state-aware Pause and Resume button', async ({ page }) => {
    let paused = false;
    const urls = [];
    await page.route('http://pico.test/**', async route => {
      const url = route.request().url();
      urls.push(url);
      if (url.includes('/chaser/pause/')) paused = true;
      if (url.includes('/chaser/resume/')) paused = false;
      const slot = { slot: 0, loaded: true, active: !paused, paused, loop: true, mode: 1, direction: 0, step_count: 2, speed_mult: 1 };
      const body = url.endsWith('/chaser/status')
        ? { ok: true, active_mask: paused ? 0 : 1, paused_mask: paused ? 1 : 0, step: 0, step_count: 2, elapsed_ms: 100 }
        : url.endsWith('/chaser/slots')
          ? { ok: true, slots: [slot] }
          : { ok: true };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.evaluate(() => {
      baseUrlEl.value = 'http://pico.test';
      renderChaserSlotStrip([
        { slot: 0, loaded: true, active: true, paused: false, loop: true, mode: 1, direction: 0, step_count: 2, speed_mult: 1 }
      ], 1);
    });

    await expect(page.locator('#btnPicoPauseSlot')).toHaveCount(0);
    await expect(page.locator('#btnPicoResumeSlot')).toHaveCount(0);
    const toggle = page.locator('#btnPicoPauseResumeSlot');
    await expect(toggle).toHaveText('Pause');
    await toggle.click();
    await expect(toggle).toHaveText('Resume');
    await toggle.click();
    await expect(toggle).toHaveText('Pause');
    expect(urls).toContain('http://pico.test/chaser/pause/0');
    expect(urls).toContain('http://pico.test/chaser/resume/0');
  });

  test('collapsing Participating Controls keeps the sticky header stable and moves Edit Step up', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 900 });
    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    const result = await page.evaluate(() => {
      const header = document.querySelector('header');
      const participation = document.getElementById('participationPanel');
      const editStep = document.getElementById('stepEditorSection');
      const btn = document.querySelector('[data-panel-toggle="participationPanel"]');
      if (participation.classList.contains('collapsed-panel')) btn.click();
      const before = {
        headerHeight: header.getBoundingClientRect().height,
        participationHeight: participation.getBoundingClientRect().height,
        editTop: editStep.getBoundingClientRect().top
      };
      btn.click();
      const after = {
        headerHeight: header.getBoundingClientRect().height,
        participationHeight: participation.getBoundingClientRect().height,
        editTop: editStep.getBoundingClientRect().top
      };
      return { before, after };
    });

    const panelShrink = result.before.participationHeight - result.after.participationHeight;
    const editMove = result.before.editTop - result.after.editTop;
    expect(result.after.headerHeight).toBeCloseTo(result.before.headerHeight, 0);
    expect(panelShrink).toBeGreaterThan(100);
    expect(editMove).toBeGreaterThan(panelShrink - 4);
  });

  test('Chase Steps toolbox is vertically resizable in the toolbox rail', async ({ page }) => {
    const state = await page.evaluate(() => {
      const box = document.getElementById('stepsBox');
      box.classList.add('collapsed');
      stepsToolbox.setCollapsed(false, false);
      const style = getComputedStyle(box);
      return {
        resize: style.resize,
        overflow: style.overflow,
        height: box.offsetHeight,
        bodyOverflow: getComputedStyle(document.getElementById('stepsBoxBody')).overflowY,
        resizeHandle: !!box.querySelector('.scene-toolbox__resize')
      };
    });

    expect(state.resize).toBe('none');
    expect(state.overflow).toBe('hidden');
    expect(state.height).toBeGreaterThan(200);
    expect(state.bodyOverflow).toBe('auto');
    expect(state.resizeHandle).toBe(true);
  });

  test('Chase Steps toolbox height can be changed with the touch resize handle', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    const result = await page.evaluate(async () => {
      const box = document.getElementById('stepsBox');
      stepsToolbox.setCollapsed(false, false);
      box.style.height = '320px';
      const handle = box.querySelector('.scene-toolbox__resize');
      const rect = handle.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const before = box.offsetHeight;
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y }));
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y + 120 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y + 120 }));
      await new Promise(resolve => setTimeout(resolve, 20));
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem('stepsBoxSize') || 'null'); } catch (_) {}
      return { before, after: box.offsetHeight, saved };
    });

    expect(result.after).toBeGreaterThan(result.before + 80);
    expect(result.saved.h).toBe(result.after);
  });

  test('All clears selected step/edit context but keeps existing steps', async ({ page }) => {
    const result = await page.evaluate(() => {
      const f = setup.fixtures[0];
      const c = fixtureProfile(f).controls[0];
      steps = [makeStep('Step 1', { [controlKey(f, c)]: 33 })];
      selectedStepIdx = 0;
      activeStepValueKeys = new Set(Object.keys(steps[0].values));
      sourceFixtureId = String(f.id);
      drawStepList();
      drawStepEditor();
      document.getElementById('btnSelAll').click();
      return {
        steps: steps.length,
        selectedStepIdx,
        activeStepValueKeys: activeStepValueKeys === null ? null : [...activeStepValueKeys],
        allParticipating: Object.values(participating).every(Boolean),
        status: document.getElementById('status').textContent
      };
    });

    expect(result.steps).toBe(1);
    expect(result.selectedStepIdx).toBe(-1);
    expect(result.activeStepValueKeys).toBeNull();
    expect(result.allParticipating).toBe(true);
    expect(result.status).toContain('existing steps are unchanged');
  });

  test('Group Edit can be available from participating controls without a selected step', async ({ page }) => {
    const state = await page.evaluate(() => {
      selectedStepIdx = -1;
      activeStepValueKeys = null;
      Object.keys(participating).forEach(k => participating[k] = false);
      setup.fixtures.forEach(f => {
        const p = fixtureProfile(f);
        if (!p) return;
        p.controls.forEach(c => {
          if (c.label === 'Dimmer') participating[controlKey(f, c)] = true;
        });
      });
      drawParticipation();
      refreshChaserGroupActions();
      return {
        fixtures: chaserGroupEditFixtures().map(f => f.id),
        controls: getChaserGroupEditableControls().map(chaserGroupKey),
        canEdit: chaserGroupEditFixtures().length >= 2 && getChaserGroupEditableControls().length > 0
      };
    });

    expect(state.fixtures.sort()).toEqual([101, 102]);
    expect(state.controls).toContain('Dimmer|slider8');
    expect(state.canEdit).toBe(true);
  });

  test('selected group uses its first fixture as the group edit source', async ({ page }) => {
    await page.evaluate(() => {
      chaserGroupsBox.setGroups([{ id: 'grp_reverse', name: 'Reverse Pair', fixtureIds: [102, 101], values: {} }]);
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      participating['102:21'] = true;
      steps = [makeStep('Source group step', { '101:11': 11, '102:21': 88 })];
      selectedStepIdx = 0;
      activeStepValueKeys = new Set(Object.keys(steps[0].values));
      sourceFixtureId = '101';
      drawParticipation();
      drawStepList();
      drawStepEditor();
    });
    await page.locator('#chaserGroupsBox [data-group-index="0"]').click();

    const state = await page.evaluate(() => {
      const control = getChaserGroupEditableControls().find(c => c.label === 'Dimmer');
      applyChaserGroupSourceValue(control);
      return {
        sourceFixtureId,
        selectedGroups: chaserGroupsBox.selectedGroups().map(g => g.id),
        sourceCards: [...document.querySelectorAll('#stepSurface .source-fixture')].map(card => ({
          fixtureId: card.dataset.sourceFixture,
          title: card.querySelector('h2')?.textContent.trim()
        })),
        values: steps[0].values
      };
    });

    expect(state.selectedGroups).toEqual(['grp_reverse']);
    expect(state.sourceFixtureId).toBe('102');
    expect(state.sourceCards).toEqual([{ fixtureId: '102', title: 'B 1 Source' }]);
    expect(state.values['101:11']).toBe(88);
    expect(state.values['102:21']).toBe(88);
  });

  test('Chaser Fan Out uses the shared common controller for step values', async ({ page }) => {
    const state = await page.evaluate(() => {
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      participating['102:21'] = true;
      steps = [makeStep('Fan step', { '101:11': 50, '102:21': 50 })];
      selectedStepIdx = 0;
      activeStepValueKeys = new Set(Object.keys(steps[0].values));
      sourceFixtureId = '101';
      drawParticipation();
      drawStepList();
      drawStepEditor();
      renderFanToolbox();

      const option = fanControlOptions().find(o => o.label === 'Dimmer');
      fanState.controlKey = option.key;
      fanState.mode = 'symmetric';
      fanState.spread = 100;
      fanState.inverted = false;
      applyFanToStep({ silent: true });

      return {
        commonApply: typeof chaserFanOut.apply,
        commonOptions: chaserFanOut.controlOptions(fanFixtureOrder()).map(o => o.label),
        values: steps[0].values
      };
    });

    expect(state.commonApply).toBe('function');
    expect(state.commonOptions).toContain('Dimmer');
    expect(state.values['101:11']).toBe(0);
    expect(state.values['102:21']).toBe(100);
  });

  test('Chaser Fan Out control selection resets spread offsets', async ({ page }) => {
    const state = await page.evaluate(() => {
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      participating['102:21'] = true;
      setup.profiles.find(p => p.id === 1).controls.push({ id: 13, type: 'wheel', label: 'Gobo', channel: 6, options: [{ name: 'Open', value: 0 }] });
      setup.profiles.find(p => p.id === 2).controls.push({ id: 23, type: 'wheel', label: 'Gobo', channel: 5, options: [{ name: 'Open', value: 0 }] });
      participating['101:13'] = true;
      participating['102:23'] = true;
      participating['101:12'] = true;
      steps = [makeStep('Fan reset step', {
        '101:11': 10,
        '102:21': 20,
        '101:13': 0,
        '102:23': 0
      })];
      selectedStepIdx = 0;
      activeStepValueKeys = new Set(Object.keys(steps[0].values));
      drawParticipation();
      drawStepList();
      drawStepEditor();
      renderFanToolbox();

      const options = fanControlOptions();
      fanState.controlKey = options[0].key;
      fanState.spread = 80;
      fanState.fromOffset = -40;
      fanState.toOffset = 40;
      const select = document.getElementById('fanControlSelect');
      select.value = options[1].key;
      select.dispatchEvent(new Event('change', { bubbles: true }));

      return {
        controlKey: fanState.controlKey,
        spread: fanState.spread,
        fromOffset: fanState.fromOffset,
        toOffset: fanState.toOffset
      };
    });

    expect(state.controlKey).toBeTruthy();
    expect(state.spread).toBe(0);
    expect(state.fromOffset).toBe(0);
    expect(state.toOffset).toBe(0);
  });

  test('Chaser Fan Out exposes the same actions and can save and recall a preset', async ({ page }) => {
    const state = await page.evaluate(async () => {
      DmxCommon.saveUiState = async () => ({ ok: true });
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      participating['102:21'] = true;
      steps = [makeStep('Fan preset step', { '101:11': 40, '102:21': 40 })];
      selectedStepIdx = 0;
      activeStepValueKeys = new Set(Object.keys(steps[0].values));
      sourceFixtureId = '101';
      drawParticipation();
      drawStepList();
      drawStepEditor();
      renderFanToolbox();

      const option = fanControlOptions().find(o => o.label === 'Dimmer');
      fanState.controlKey = option.key;
      fanState.mode = 'range';
      fanState.spread = 44;
      fanState.fromOffset = -20;
      fanState.toOffset = 60;
      fanState.inverted = true;

      const originalPrompt = window.prompt;
      window.prompt = () => 'Chaser Fan';
      saveFanPreset();
      fanState.mode = 'symmetric';
      fanState.spread = 0;
      fanState.fromOffset = 0;
      fanState.toOffset = 0;
      fanState.inverted = false;
      window.prompt = () => '1';
      recallFanPreset();
      window.prompt = originalPrompt;

      return {
        buttons: ['fanSave', 'fanRecall', 'fanSnapshot', 'fanApply', 'fanClear'].map(id => ({
          id,
          exists: !!document.getElementById(id),
          disabled: document.getElementById(id)?.disabled
        })),
        presetCount: fanPresets.length,
        state: {
          controlKey: fanState.controlKey,
          mode: fanState.mode,
          spread: fanState.spread,
          fromOffset: fanState.fromOffset,
          toOffset: fanState.toOffset,
          inverted: fanState.inverted
        }
      };
    });

    expect(state.buttons.every(button => button.exists)).toBe(true);
    expect(state.buttons.find(button => button.id === 'fanRecall').disabled).toBe(false);
    expect(state.presetCount).toBe(1);
    expect(state.state.mode).toBe('range');
    expect(state.state.spread).toBe(44);
    expect(state.state.fromOffset).toBe(-20);
    expect(state.state.toOffset).toBe(60);
    expect(state.state.inverted).toBe(false);
  });

  test('Chaser Fan Out can apply from participating fixtures without a selected step', async ({ page }) => {
    const state = await page.evaluate(() => {
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      participating['102:21'] = true;
      steps = [];
      selectedStepIdx = -1;
      activeStepValueKeys = null;
      sourceFixtureId = null;
      drawParticipation();
      drawStepList();
      drawStepEditor();
      renderFanToolbox();

      const option = fanControlOptions().find(o => o.label === 'Dimmer');
      fanState.controlKey = option.key;
      fanState.mode = 'symmetric';
      fanState.spread = 100;
      applyFanToStep({ silent: true });

      return {
        controlsDisabled: ['fanControlSelect', 'fanSpread', 'fanApply', 'fanSave'].map(id => document.getElementById(id).disabled),
        selectedStepIdx,
        steps: steps.length,
        activeKeys: [...activeStepValueKeys],
        values: steps[0]?.values
      };
    });

    expect(state.controlsDisabled.every(Boolean)).toBe(false);
    expect(state.selectedStepIdx).toBe(0);
    expect(state.steps).toBe(1);
    expect(state.activeKeys.sort()).toEqual(['101:11', '102:21']);
    expect(state.values['101:11']).toBe(0);
    expect(state.values['102:21']).toBe(50);
  });

  test('Chaser Group Edit modal updates values without redrawing the page behind it', async ({ page }) => {
    const state = await page.evaluate(() => {
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      participating['102:21'] = true;
      steps = [makeStep('Group modal step', { '101:11': 10, '102:21': 20 })];
      selectedStepIdx = 0;
      activeStepValueKeys = new Set(Object.keys(steps[0].values));
      sourceFixtureId = '101';
      drawParticipation();
      drawStepList();
      drawStepEditor();
      openChaserGroupModal();

      let redrawCount = 0;
      const originalDrawStepEditor = drawStepEditor;
      drawStepEditor = function patchedDrawStepEditor() {
        redrawCount += 1;
        return originalDrawStepEditor();
      };

      const slider = document.querySelector('#chaserGroupModalBody input[type="range"][data-cg]:not([data-axis]):not([data-part]):not([data-byte-part])');
      slider.value = '77';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      const duringModal = {
        redrawCount,
        modalReadout: document.querySelector('#chaserGroupModalBody [data-cg-readout]').textContent,
        values: { ...steps[0].values }
      };

      closeChaserGroupModal();
      const afterClose = {
        redrawCount,
        stepReadout: document.querySelector('#stepSurface [data-readoutf="101"][data-readoutc="11"]').textContent
      };
      drawStepEditor = originalDrawStepEditor;
      return { duringModal, afterClose };
    });

    expect(state.duringModal.redrawCount).toBe(0);
    expect(state.duringModal.modalReadout).toBe('77');
    expect(state.duringModal.values['101:11']).toBe(77);
    expect(state.duringModal.values['102:21']).toBe(77);
    expect(state.afterClose.redrawCount).toBeGreaterThan(0);
    expect(state.afterClose.stepReadout).toBe('77');
  });

  test('Chaser Group Edit follows the Controller modal visual language and step semantics', async ({ page }) => {
    await page.evaluate(() => {
      const controlsA = [
        { id: 11, type: 'slider8', label: 'Dimmer', channel: 1, defaultValue: 80, blackoutValue: 0 },
        { id: 12, type: 'panTilt16', label: 'Pan/Tilt', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 },
        { id: 13, type: 'rgb', label: 'Color', a: 6, b: 7, c: 8 },
        { id: 14, type: 'wheel', label: 'Gobo', channel: 9, options: [{ name: 'Open', value: 0 }, { name: 'Dots', value: 32 }] },
        { id: 15, type: 'slider16', label: 'Focus', channel: 10, fine: 11 }
      ];
      const controlsB = controlsA.map((control, index) => ({
        ...JSON.parse(JSON.stringify(control)),
        id: 21 + index,
        defaultValue: control.label === 'Dimmer' ? 90 : control.defaultValue,
        channel: control.channel === undefined ? control.channel : control.channel + 20,
        fine: control.fine === undefined ? control.fine : control.fine + 20,
        pan: control.pan === undefined ? control.pan : control.pan + 20,
        panFine: control.panFine === undefined ? control.panFine : control.panFine + 20,
        tilt: control.tilt === undefined ? control.tilt : control.tilt + 20,
        tiltFine: control.tiltFine === undefined ? control.tiltFine : control.tiltFine + 20,
        a: control.a === undefined ? control.a : control.a + 20,
        b: control.b === undefined ? control.b : control.b + 20,
        c: control.c === undefined ? control.c : control.c + 20
      }));
      setup = {
        baseUrl: '',
        profiles: [
          { id: 10, name: 'Profile A', mode: 'test', channels: 16, controls: controlsA },
          { id: 20, name: 'Profile B', mode: 'test', channels: 16, controls: controlsB }
        ],
        fixtures: [
          { id: 201, name: 'Spot A', profileId: 10, start: 1 },
          { id: 202, name: 'Spot B', profileId: 20, start: 21 }
        ]
      };
      participating = {};
      setup.fixtures.forEach(fixture => fixtureProfile(fixture).controls.forEach(control => {
        participating[controlKey(fixture, control)] = true;
      }));
      const values = {
        '201:11': 10, '201:12': { pan: 30000, tilt: 31000 }, '201:13': { a: 10, b: 20, c: 30 }, '201:14': 0, '201:15': 32000,
        '202:21': 20, '202:22': { pan: 32000, tilt: 33000 }, '202:23': { a: 20, b: 30, c: 40 }, '202:24': 0, '202:25': 33000
      };
      steps = [makeStep('Visual language', values)];
      selectedStepIdx = 0;
      activeStepValueKeys = new Set(Object.keys(values));
      sourceFixtureId = '201';
      drawParticipation();
      drawStepList();
      drawStepEditor();
      openChaserGroupModal();
    });

    await expect(page.locator('#chaserGroupModal')).toBeVisible();
    await expect(page.locator('#chaserGroupModalBody .control h3')).toHaveText(['Dimmer', 'Pan/Tilt', 'Color', 'Gobo', 'Focus']);
    await expect(page.locator('#chaserGroupModalBody .relative-control')).toHaveCount(11);
    await expect(page.locator('#chaserGroupModalBody .control', { hasText: 'Gobo' }).locator('.value-row input[type="number"]')).toBeVisible();
    await expect(page.locator('#chaserGroupModalBody .control', { hasText: 'Dimmer' })).toContainText('2 matching fixtures · Profile A, Profile B');
    await expect(page.locator('#defaultChaserGroupBtn')).toHaveText('Default');
    await expect(page.locator('#blackoutChaserGroupBtn')).toHaveText('Blackout');
    const layout = await page.evaluate(() => {
      const body = document.getElementById('chaserGroupModalBody');
      const readout = body.querySelector('.readout');
      return {
        modalWidth: document.querySelector('#chaserGroupModal .modal-card').getBoundingClientRect().width,
        overflowX: getComputedStyle(body).overflowX,
        overflowY: getComputedStyle(body).overflowY,
        readoutSize: getComputedStyle(readout).fontSize
      };
    });
    expect(layout.modalWidth).toBeLessThanOrEqual(762);
    expect(layout.overflowX).toBe('hidden');
    expect(layout.overflowY).toBe('auto');
    expect(layout.readoutSize).toBe('26px');

    const dimmer = page.locator('#chaserGroupModalBody .control', { hasText: 'Dimmer' });
    await dimmer.locator('[data-cg-relative-step]').fill('5');
    await dimmer.locator('[data-cg-relative][data-dir="1"]').click();
    expect(await page.evaluate(() => [steps[0].values['201:11'], steps[0].values['202:21']])).toEqual([15, 25]);

    await page.locator('#defaultChaserGroupBtn').click();
    expect(await page.evaluate(() => [steps[0].values['201:11'], steps[0].values['202:21']])).toEqual([80, 90]);
    await page.locator('#blackoutChaserGroupBtn').click();
    expect(await page.evaluate(() => [steps[0].values['201:11'], steps[0].values['202:21']])).toEqual([0, 0]);
  });

  test('Only selects one control type without reducing the fixture scope when no group filter is active', async ({ page }) => {
    const result = await page.evaluate(() => {
      document.getElementById('groupControlSelect').value = 'Dimmer|slider8';
      document.getElementById('btnGroupControlOnly').click();
      return {
        selectedGroups: chaserGroupsBox.selectedGroups().length,
        participatingKeys: Object.entries(participating).filter(([, v]) => v).map(([k]) => k),
        fixtures: getParticipatingList().map(item => item.f.id)
      };
    });

    expect(result.selectedGroups).toBe(0);
    expect(result.participatingKeys.sort()).toEqual(['101:11', '102:21']);
    expect([...new Set(result.fixtures)].sort()).toEqual([101, 102]);
  });

  test('Only keeps the selected group filter while changing participating controls', async ({ page }) => {
    await page.evaluate(() => {
      chaserGroupsBox.setGroups([{ id: 'grp_dimmer', name: 'Dimmer Pair', fixtureIds: [101, 102], values: {} }]);
    });
    await page.locator('#chaserGroupsBox [data-group-index="0"]').evaluate(element => element.click());

    const result = await page.evaluate(() => {
      document.getElementById('groupControlSelect').value = 'Dimmer|slider8';
      document.getElementById('btnGroupControlOnly').click();
      return {
        selectedGroups: chaserGroupsBox.selectedGroups().map(g => g.id),
        participatingKeys: Object.entries(participating).filter(([, v]) => v).map(([k]) => k),
        visibleFixtures: [...new Set(getParticipatingList().map(item => item.f.id))],
        status: document.getElementById('status').textContent
      };
    });

    expect(result.selectedGroups).toEqual(['grp_dimmer']);
    expect(result.participatingKeys.sort()).toEqual(['101:11', '102:21']);
    expect(result.visibleFixtures.sort()).toEqual([101, 102]);
    expect(result.status).toContain('Selected only');
  });

  test('None clears participating controls, collapses fixtures, and clears groups', async ({ page }) => {
    await page.evaluate(() => {
      chaserGroupsBox.setGroups([{ id: 'grp_dimmer', name: 'Dimmer Pair', fixtureIds: [101, 102], values: {} }]);
    });
    await page.locator('#chaserGroupsBox [data-group-index="0"]').evaluate(element => element.click());

    const result = await page.evaluate(() => {
      document.getElementById('btnSelNone').click();
      return {
        selectedGroups: chaserGroupsBox.selectedGroups().length,
        anyParticipating: Object.values(participating).some(Boolean),
        collapsed: [...collapsedPartFixtures].sort()
      };
    });

    expect(result.selectedGroups).toBe(0);
    expect(result.anyParticipating).toBe(false);
    expect(result.collapsed).toEqual([101, 102, 103]);
  });

  test('Add step uses default/fallback values for selected participating controls', async ({ page }) => {
    const result = await page.evaluate(() => {
      Object.keys(participating).forEach(k => participating[k] = false);
      setup.fixtures.forEach(f => {
        const p = fixtureProfile(f);
        if (!p) return;
        p.controls.forEach(c => {
          if (c.label === 'Dimmer') participating[controlKey(f, c)] = true;
        });
      });
      addStep();
      return {
        selectedStepIdx,
        values: steps[0].values,
        sourceFixtureId
      };
    });

    expect(result.selectedStepIdx).toBe(0);
    expect(result.values).toEqual({ '101:11': 0, '102:21': 0 });
    expect(result.sourceFixtureId).toBe('101');
  });

  test('Edit Step numeric inputs update values and stay in sync with sliders', async ({ page }) => {
    const result = await page.evaluate(() => {
      steps = [makeStep('Numeric edit', { '101:11': 10, '101:12': { pan: 32768, tilt: 32768 } })];
      selectedStepIdx = 0;
      activeStepValueKeys = new Set(Object.keys(steps[0].values));
      sourceFixtureId = '101';
      drawParticipation();
      drawStepList();
      drawStepEditor();

      const dimmerNumber = document.querySelector('input[type="number"][data-fi="101"][data-ci="11"]:not([data-axis]):not([data-part])');
      dimmerNumber.value = '123';
      dimmerNumber.dispatchEvent(new Event('input', { bubbles: true }));

      const panNumber = document.querySelector('input[type="number"][data-fi="101"][data-ci="12"][data-axis="pan"]');
      panNumber.value = '45678';
      panNumber.dispatchEvent(new Event('input', { bubbles: true }));

      return {
        dimmerValue: steps[0].values['101:11'],
        dimmerSlider: document.querySelector('input[type="range"][data-fi="101"][data-ci="11"]:not([data-axis]):not([data-part])').value,
        dimmerReadout: document.querySelector('[data-readoutf="101"][data-readoutc="11"]').textContent,
        panValue: steps[0].values['101:12'].pan,
        panSlider: document.querySelector('input[type="range"][data-fi="101"][data-ci="12"][data-axis="pan"]').value,
        panReadout: document.querySelector('[data-readoutf="101"][data-readoutc="12"]').textContent
      };
    });

    expect(result.dimmerValue).toBe(123);
    expect(result.dimmerSlider).toBe('123');
    expect(result.dimmerReadout).toBe('123');
    expect(result.panValue).toBe(45678);
    expect(result.panSlider).toBe('45678');
    expect(result.panReadout).toContain('Pan 45678');
  });

  test('Matrix controls are excluded from chaser participation until matrix step editing exists', async ({ page }) => {
    const state = await page.evaluate(() => {
      setup.profiles.push({
        id: 90,
        name: 'Matrix Profile',
        mode: '2x2',
        channels: 12,
        controls: [{ id: 91, type: 'matrixRgb', label: 'Pixels', channel: 1, width: 2, height: 2 }]
      });
      setup.fixtures.push({ id: 190, name: 'Matrix Fixture', profileId: 90, start: 101 });
      rebuildParticipation();
      return {
        hasMatrixParticipation: Object.keys(participating).some(key => key === '190:91'),
        listedControls: getParticipatingList().map(({ f, c }) => f.id + ':' + c.type),
        checkboxCount: document.querySelectorAll('#participationList input[data-key="190:91"]').length
      };
    });

    expect(state.hasMatrixParticipation).toBe(false);
    expect(state.listedControls).not.toContain('190:matrixRgb');
    expect(state.checkboxCount).toBe(0);
  });

  test('selecting a step rebuilds the edit scope from that step values', async ({ page }) => {
    const result = await page.evaluate(async () => {
      steps = [
        makeStep('Dimmer step', { '101:11': 10, '102:21': 20 }),
        makeStep('Gobo step', { '103:31': 40 })
      ];
      selectedStepIdx = -1;
      await selectStepForEdit(1);
      return {
        selectedStepIdx,
        list: getParticipatingList().map(({ f, c }) => f.id + ':' + c.id),
        activeKeys: [...activeStepValueKeys]
      };
    });

    expect(result.selectedStepIdx).toBe(1);
    expect(result.list).toEqual(['103:31']);
    expect(result.activeKeys).toEqual(['103:31']);
  });

  test('iPad Pan/Tilt step Center button stays anchored while values change digit length', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    const result = await page.evaluate(async () => {
      const f = setup.fixtures[0];
      const c = fixtureProfile(f).controls.find(ctrl => ctrl.type === 'panTilt16');
      Object.keys(participating).forEach(k => participating[k] = false);
      participating[controlKey(f, c)] = true;
      steps = [makeStep('Pan/Tilt step', { [controlKey(f, c)]: { pan: 1, tilt: 1 } })];
      selectedStepIdx = 0;
      activeStepValueKeys = new Set(Object.keys(steps[0].values));
      sourceFixtureId = String(f.id);
      drawParticipation();
      drawStepList();
      drawStepEditor();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const button = document.querySelector('#stepSurface [data-center="1"]');
      const readout = document.querySelector('#stepSurface [data-readoutf][data-readoutc]');
      const before = {
        buttonLeft: Math.round(button.getBoundingClientRect().left),
        readoutText: readout.textContent
      };
      setStepVal(f, c, { pan: 65535, tilt: 65535 });
      updateStepDisplay(f, c);
      await new Promise(resolve => requestAnimationFrame(resolve));
      return {
        before,
        after: {
          buttonLeft: Math.round(button.getBoundingClientRect().left),
          readoutText: readout.textContent
        }
      };
    });

    expect(result.before.readoutText).toContain('Pan 1');
    expect(result.after.readoutText).toContain('Pan 65535');
    expect(result.after.buttonLeft).toBe(result.before.buttonLeft);
  });

  test('Update chase only writes back to the last recalled chase', async ({ page }) => {
    const state = await page.evaluate(async () => {
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      saveChasesServer = async () => {};
      savedChases = [];
      steps = [makeStep('Saved step', { '101:11': 10 })];
      selectedStepIdx = 0;
      drawStepList();
      saveChaseToSlot(0, 'Recall target');
      const disabledAfterSave = document.getElementById('btnUpdateChase').disabled;

      await loadChaseSlot(savedChases[0]);
      const disabledAfterRecall = document.getElementById('btnUpdateChase').disabled;
      steps[0].label = 'Edited recalled step';
      steps[0].values['101:11'] = 77;
      await updateActiveRecalledChase();
      const buttonAfterUpdate = {
        text: document.getElementById('btnUpdateChase').textContent,
        success: document.getElementById('btnUpdateChase').classList.contains('button-feedback--success')
      };

      steps = [makeStep('New chase draft', { '101:11': 22 })];
      saveChaseToSlot(1, 'New draft');
      const disabledAfterNewSave = document.getElementById('btnUpdateChase').disabled;

      return {
        disabledAfterSave,
        disabledAfterRecall,
        updatedLabel: savedChases.find(c => c.slot === 0).data.steps[0].label,
        updatedValue: savedChases.find(c => c.slot === 0).data.steps[0].values['101:11'],
        buttonAfterUpdate,
        disabledAfterNewSave
      };
    });

    expect(state.disabledAfterSave).toBe(true);
    expect(state.disabledAfterRecall).toBe(false);
    expect(state.updatedLabel).toBe('Edited recalled step');
    expect(state.updatedValue).toBe(77);
    expect(state.buttonAfterUpdate.text).toBe('Updated');
    expect(state.buttonAfterUpdate.success).toBe(true);
    expect(state.disabledAfterNewSave).toBe(true);
  });

  test('recalling a chase and selecting a step immediately sends that step to DMX', async ({ page }) => {
    const batches = [];
    await page.route('http://127.0.0.1:18993/**', async route => {
      if (route.request().url().includes('/dmx/b')) batches.push(parseDmxBatch(route.request().postData()));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.evaluate(async () => {
      baseUrlEl.value = 'http://127.0.0.1:18993/';
      sentToPico = {};
      const chase = {
        id: 'dmx_recall_test',
        name: 'DMX Recall Test',
        slot: 0,
        data: {
          steps: [
            makeStep('Position A', { '101:11': 10, '101:12': { pan: 4660, tilt: 22136 } }),
            makeStep('Position B', { '101:11': 20, '101:12': { pan: 65535, tilt: 0 } })
          ]
        }
      };
      await loadChaseSlot(chase);
    });

    await expect.poll(() => batches.length).toBe(1);
    expect(batches[0]).toMatchObject({ 1: 10, 2: 18, 3: 52, 4: 86, 5: 120 });

    await page.evaluate(() => selectStepForEdit(1));
    await expect.poll(() => batches.length).toBe(2);
    expect(batches[1]).toMatchObject({ 1: 20, 2: 255, 3: 255, 4: 0, 5: 0 });
  });
});
