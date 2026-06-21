const { test, expect } = require('@playwright/test');
const { openDmxPage, injectChaserCompactSetup } = require('./helpers/dmx-page');
const fs = require('fs');
const path = require('path');

test.describe('Chaser established rules', () => {
  test.beforeEach(async ({ page }) => {
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
    expect(state.state.inverted).toBe(true);
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
    await page.locator('#chaserGroupsBox [data-group-index="0"]').click();

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
    await page.locator('#chaserGroupsBox [data-group-index="0"]').click();

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
});
