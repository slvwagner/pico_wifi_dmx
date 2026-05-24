const { test, expect } = require('@playwright/test');
const { openDmxPage, injectChaserCompactSetup } = require('./helpers/dmx-page');

test.describe('Chaser established rules', () => {
  test.beforeEach(async ({ page }) => {
    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);
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

  test('None clears participating controls, collapses fixtures, and clears groups', async ({ page }) => {
    await page.evaluate(() => {
      chaserGroupsBox.groups.length = 0;
      chaserGroupsBox.groups.push({ id: 'grp_dimmer', name: 'Dimmer Pair', fixtureIds: [101, 102], values: {} });
      chaserGroupsBox.render();
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
});
