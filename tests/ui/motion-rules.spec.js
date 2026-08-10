const { test, expect } = require('@playwright/test');
const { openDmxPage, routeMotionCompactServerSetup, injectMotionCompactSetup } = require('./helpers/dmx-page');

test.describe('Effects established rules', () => {
  test.beforeEach(async ({ page }) => {
    await routeMotionCompactServerSetup(page);
    await page.route('**/group_setup.php**', async route => {
      if (route.request().method() !== 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, baseUrl: '', groups: [] })
      });
    });
    await page.route('**/ui_state.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, state: { toolboxes: { selectedGroupIds: [] } } })
      });
    });
    await page.route('**/room_plane_setup.php**', async route => {
      if (route.request().method() !== 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, points: [], fixtures: [], planes: [], planeCols: 3, planeRows: 3 })
      });
    });
    await page.addInitScript(() => sessionStorage.removeItem('dmxMotionWorkingState'));
    await openDmxPage(page, 'dmx_motion.html');
    await injectMotionCompactSetup(page);
  });

  test('Participating Controls card stays compact when collapsed', async ({ page }) => {
    const result = await page.evaluate(() => {
      const panel = document.getElementById('fxPanel');
      const btn = document.querySelector('[data-panel-toggle="fxPanel"]');
      if (panel.classList.contains('collapsed-panel')) btn.click();
      const expandedHeight = panel.getBoundingClientRect().height;
      btn.click();
      const collapsedHeight = panel.getBoundingClientRect().height;
      return {
        expandedHeight,
        collapsedHeight,
        bodyHidden: getComputedStyle(panel.querySelector('.panel-body')).display === 'none'
      };
    });

    expect(result.bodyHidden).toBe(true);
    expect(result.collapsedHeight).toBeLessThan(result.expandedHeight * 0.45);
    expect(result.collapsedHeight).toBeLessThanOrEqual(50);
  });

  test('Pico Effects panel has a persistent collapse button', async ({ page }) => {
    await expect(page.locator('[data-panel-toggle="picoMotionPanel"]')).toBeVisible();
    await expect(page.locator('#picoMotionPanel .panel-body')).toBeVisible();

    await page.locator('[data-panel-toggle="picoMotionPanel"]').click();
    await expect(page.locator('#picoMotionPanel .panel-body')).toBeHidden();
    await expect(page.locator('[data-panel-toggle="picoMotionPanel"]')).toHaveText('+');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#picoMotionPanel .panel-body')).toBeHidden();
    await expect(page.locator('[data-panel-toggle="picoMotionPanel"]')).toHaveText('+');
  });

  test('Effects exposes synchronized browser and Pico play modes with Loop as the default', async ({ page }) => {
    await expect(page.locator('#motionPlayMode')).toHaveValue('loop');
    await expect(page.locator('#picoMotionMode')).toHaveValue('loop');
    await expect(page.locator('#motionLoopCountField')).toBeHidden();
    await expect(page.locator('#picoMotionLoopCountField')).toBeHidden();

    await page.locator('#motionPlayMode').selectOption('loop_n');
    await page.locator('#motionLoopCount').fill('4');
    await expect(page.locator('#picoMotionMode')).toHaveValue('loop_n');
    await expect(page.locator('#motionLoopCountField')).toBeVisible();
    await expect(page.locator('#picoMotionLoopCountField')).toBeVisible();
    await expect(page.locator('#picoMotionLoopCount')).toHaveValue('4');

    const saved = await page.evaluate(() => ({
      body: serializeMotionForPico(),
      params: currentMotionEffectRecipe().params
    }));
    expect(saved.body).toContain('MODE loop_n');
    expect(saved.body).toContain('LOOPS 4');
    expect(saved.params.playMode).toBe('loop_n');
    expect(saved.params.loopCount).toBe(4);
  });

  test('Browser Effect pause and resume preserve elapsed phase and Loop N stops after its cycles', async ({ page }) => {
    await page.route('http://127.0.0.1:18991/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"ok":true}'
    }));

    const state = await page.evaluate(async () => {
      baseUrlEl.value = 'http://127.0.0.1:18991/';
      motionFixtures[0].enabled = true;
      document.getElementById('bpm').value = '60';
      document.getElementById('motionPlayMode').value = 'loop_n';
      document.getElementById('motionLoopCount').value = '2';
      await startMotion();
      startTime = performance.now() - 650;
      pauseMotion();
      const pausedElapsed = motionElapsedSeconds();
      await new Promise(resolve => setTimeout(resolve, 30));
      resumeMotion();
      const resumedElapsed = motionElapsedSeconds();
      startTime = performance.now() - 2050;
      tick();
      return {
        pausedElapsed,
        resumedElapsed,
        running,
        paused: motionPaused,
        button: document.getElementById('motionPauseResume').textContent,
        status: document.getElementById('status').textContent
      };
    });

    expect(state.pausedElapsed).toBeGreaterThan(0.5);
    expect(Math.abs(state.resumedElapsed - state.pausedElapsed)).toBeLessThan(0.1);
    expect(state.running).toBe(false);
    expect(state.paused).toBe(false);
    expect(state.button).toContain('Pause');
    expect(state.status).toContain('Completed 2 loops');
  });

  test('Pico Effect slot tiles report Single and Loop N modes', async ({ page }) => {
    const texts = await page.evaluate(() => {
      renderMotionSlotStrip([
        { slot: 0, loaded: true, active: false, paused: false, type: 0, bpm: 60, mode: 0, loop_count: 1, target_count: 1 },
        { slot: 1, loaded: true, active: true, paused: false, type: 1, bpm: 90, mode: 2, loop_count: 3, completed_loops: 1, target_count: 2 }
      ], 1 << 1, 0);
      return Array.from(document.querySelectorAll('#motionSlotStrip > div')).slice(0, 2).map(tile => tile.innerText);
    });

    expect(texts[0]).toContain('Mode Single');
    expect(texts[1]).toContain('Mode Loop N (3x)');
  });

  test('Pico Effect slot tiles show the saved effect name and icon', async ({ page }) => {
    const visual = { type: 'visual', color: '#1d6b8f', image: 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E' };
    await page.evaluate(savedVisual => {
      linkedMotionPlaybacks = [{
        id: 'named-effect',
        logicalSlot: 3,
        label: 'Blue Orbit',
        visual: savedVisual,
        members: [{ outputId: 'primary', slot: 3, payload: 'FX 1\nEND' }]
      }];
      const slots = Array.from({ length: 4 }, (_, slot) => ({ slot, loaded: false, active: false, paused: false }));
      slots[3] = { slot: 3, loaded: true, active: false, paused: false, type: 1, bpm: 90, mode: 1, loop_count: 1, target_count: 2 };
      renderMotionSlotStrip(slots, 0, 0);
    }, visual);

    const tile = page.locator('#motionSlotStrip > div').nth(3);
    await expect(tile).toContainText('Blue Orbit');
    await expect(tile.locator('.palette-visual')).toHaveCount(1);
  });

  test('uploads one linked effect payload per involved Pico to the same logical slot', async ({ page }) => {
    const picoCalls = [];
    let savedPlayback = null;
    const routePico = async (route, outputId) => {
      const url = route.request().url();
      if (url.endsWith('/motion/slots')) {
        const slots = Array.from({ length: 64 }, (_, slot) => ({
          slot,
          loaded: outputId === 'rear' && slot === 0,
          active: false,
          paused: false
        }));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, slots }) });
        return;
      }
      picoCalls.push({ outputId, url, body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    };
    await page.route('http://front-pico.test/**', route => routePico(route, 'front'));
    await page.route('http://rear-pico.test/**', route => routePico(route, 'rear'));
    await page.route('**/motion_setup.php?playback', async route => {
      savedPlayback = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.evaluate(() => {
      setup.dmxOutputs = [
        { id: 'front', name: 'Front Pico', universe: 1, baseUrl: 'http://front-pico.test/' },
        { id: 'rear', name: 'Rear Pico', universe: 2, baseUrl: 'http://rear-pico.test/' }
      ];
      setup.fixtures.find(f => f.id === 101).outputId = 'front';
      setup.fixtures.find(f => f.id === 102).outputId = 'rear';
      baseUrlEl.value = 'http://front-pico.test';
      const dimmers = motionFixtures.filter(mf => mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(dimmers[0].control);
      motionFixtures.forEach(mf => mf.enabled = dimmers.includes(mf));
      document.getElementById('motionControlFilter').value = selectedMotionTargetKey;
      motionEffects = [{ slot: 2, name: 'Blue Orbit', visual: { type: 'visual', color: '#1d6b8f', image: '' } }];
      activeRecalledMotionEffectSlot = 2;
    });

    await page.evaluate(() => uploadCurrentMotionToSlot(4, false));

    expect(picoCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ outputId: 'front', url: 'http://front-pico.test/motion/load/4' }),
      expect.objectContaining({ outputId: 'rear', url: 'http://rear-pico.test/motion/load/4' })
    ]));
    const frontBody = picoCalls.find(call => call.url.endsWith('/motion/load/4')).body;
    const rearBody = picoCalls.find(call => call.outputId === 'rear' && call.url.endsWith('/motion/load/4')).body;
    expect(frontBody).toContain('TARGET scalar8 1 1 ');
    expect(frontBody).not.toContain('TARGET scalar8 1 21 ');
    expect(rearBody).toContain('TARGET scalar8 1 21 ');
    expect(rearBody).not.toContain('TARGET scalar8 1 1 ');
    expect(savedPlayback.members.map(member => ({ outputId: member.outputId, slot: member.slot }))).toEqual([
      { outputId: 'front', slot: 4 },
      { outputId: 'rear', slot: 4 }
    ]);
    expect(savedPlayback.label).toBe('Blue Orbit');
    expect(savedPlayback.visual).toEqual({ type: 'visual', color: '#1d6b8f', image: '' });

    picoCalls.length = 0;
    await page.locator('#btnPicoMotionStartSlot').click();
    await expect.poll(() => picoCalls.map(call => call.url)).toEqual(expect.arrayContaining([
      'http://front-pico.test/motion/start/4',
      'http://rear-pico.test/motion/start/4'
    ]));
  });

  test('offers to overwrite the matching peer slot when a linked Pico has no empty slots', async ({ page }) => {
    const picoCalls = [];
    const routePico = async (route, outputId) => {
      const url = route.request().url();
      if (url.endsWith('/motion/slots')) {
        const slots = Array.from({ length: 64 }, (_, slot) => ({
          slot,
          loaded: outputId === 'rear',
          active: false,
          paused: false
        }));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, slots }) });
        return;
      }
      picoCalls.push({ outputId, url });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    };
    await page.route('http://front-pico.test/**', route => routePico(route, 'front'));
    await page.route('http://rear-pico.test/**', route => routePico(route, 'rear'));
    await page.route('**/motion_setup.php?playback', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    page.on('dialog', dialog => dialog.accept());

    await page.evaluate(() => {
      setup.dmxOutputs = [
        { id: 'front', name: 'Front Pico', universe: 1, baseUrl: 'http://front-pico.test/' },
        { id: 'rear', name: 'Rear Pico', universe: 2, baseUrl: 'http://rear-pico.test/' }
      ];
      setup.fixtures.find(f => f.id === 101).outputId = 'front';
      setup.fixtures.find(f => f.id === 102).outputId = 'rear';
      baseUrlEl.value = 'http://front-pico.test';
      const dimmers = motionFixtures.filter(mf => mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(dimmers[0].control);
      motionFixtures.forEach(mf => mf.enabled = dimmers.includes(mf));
    });

    await page.evaluate(() => uploadCurrentMotionToSlot(24, false));

    expect(picoCalls).toEqual(expect.arrayContaining([
      { outputId: 'front', url: 'http://front-pico.test/motion/load/24' },
      { outputId: 'rear', url: 'http://rear-pico.test/motion/load/24' }
    ]));
  });

  test('normalizes legacy linked effect slots only after creating a backup', async ({ page }) => {
    const calls = [];
    const routePico = async (route, outputId) => {
      const url = route.request().url();
      if (url.endsWith('/motion/slots')) {
        const slots = Array.from({ length: 64 }, (_, slot) => ({ slot, loaded: (outputId === 'front' && slot === 4) || (outputId === 'rear' && slot === 1) }));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, slots }) });
        return;
      }
      calls.push(url);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    };
    await page.route('http://front-pico.test/**', route => routePico(route, 'front'));
    await page.route('http://rear-pico.test/**', route => routePico(route, 'rear'));
    await page.route('**/motion_setup.php?backup_playbacks', async route => {
      calls.push('backup');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"backup":"backups/motion.json"}' });
    });
    await page.route('**/motion_setup.php?playback', async route => {
      calls.push(JSON.parse(route.request().postData() || '{}'));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    const result = await page.evaluate(() => DmxCommon.migrateLinkedPicoPlaybacks({
      kind: 'motion',
      serverEndpoint: 'motion_setup.php',
      playbacks: [{
        id: 'legacy',
        kind: 'motion',
        members: [
          { outputId: 'front', baseUrl: 'http://front-pico.test/', slot: 4, payload: 'FX 1\nEND' },
          { outputId: 'rear', baseUrl: 'http://rear-pico.test/', slot: 1, payload: 'FX 1\nEND' }
        ]
      }]
    }));

    expect(calls.indexOf('backup')).toBeLessThan(calls.indexOf('http://rear-pico.test/motion/clear/1'));
    expect(calls).toContain('http://rear-pico.test/motion/load/4');
    expect(result.playbacks[0].logicalSlot).toBe(4);
    expect(result.playbacks[0].members.map(member => member.slot)).toEqual([4, 4]);
    expect(calls.find(call => typeof call === 'object').members.map(member => member.slot)).toEqual([4, 4]);
  });

  test('reports a manifest-matched logical slot as ready without requiring uninvolved Picos to load it', async ({ page }) => {
    await page.route('http://front-pico.test/motion/slots', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, slots: Array.from({ length: 64 }, (_, slot) => ({ slot, loaded: slot === 7 })) })
    }));
    await page.route('http://rear-pico.test/motion/slots', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, slots: Array.from({ length: 64 }, (_, slot) => ({ slot, loaded: false })) })
    }));
    const states = await page.evaluate(async () => {
      const outputs = [
        { id: 'front', name: 'Front', universe: 1, baseUrl: 'http://front-pico.test/' },
        { id: 'rear', name: 'Rear', universe: 2, baseUrl: 'http://rear-pico.test/' }
      ];
      const playback = { logicalSlot: 7, members: [{ baseUrl: 'http://front-pico.test/', slot: 7 }] };
      const matched = await DmxCommon.fetchFleetPicoSlots('motion', outputs, { slotCount: 64, playbacks: [playback] });
      const unmanaged = await DmxCommon.fetchFleetPicoSlots('motion', outputs, { slotCount: 64, playbacks: [] });
      return { matched: matched.slots[7].fleetState, unmanaged: unmanaged.slots[7].fleetState };
    });
    expect(states).toEqual({ matched: 'ready', unmanaged: 'partial' });
  });

  test('synchronizes saved effects and clears stale physical slots across the Pico fleet', async ({ page }) => {
    const calls = [];
    const routePico = async (route, outputId) => {
      const url = route.request().url();
      if (url.endsWith('/motion/slots')) {
        const slots = Array.from({ length: 64 }, (_, slot) => ({
          slot,
          loaded: outputId === 'rear' && (slot === 3 || slot === 9)
        }));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, slots }) });
        return;
      }
      calls.push({ outputId, url, body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    };
    await page.route('http://front-pico.test/**', route => routePico(route, 'front'));
    await page.route('http://rear-pico.test/**', route => routePico(route, 'rear'));
    await page.route('**/motion_setup.php?slots', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        pico_slots: Array(64).fill(null),
        pico_playbacks: [{
          id: 'effect-3',
          logicalSlot: 3,
          members: [{ outputId: 'front', baseUrl: 'http://front-pico.test/', slot: 3, payload: 'FX 1\nEND' }]
        }]
      })
    }));
    page.on('dialog', dialog => dialog.accept());
    await page.evaluate(() => {
      setup.dmxOutputs = [
        { id: 'front', name: 'Front Pico', universe: 1, baseUrl: 'http://front-pico.test/' },
        { id: 'rear', name: 'Rear Pico', universe: 2, baseUrl: 'http://rear-pico.test/' }
      ];
      baseUrlEl.value = 'http://front-pico.test';
      return restoreAllMotionSlots();
    });
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ outputId: 'front', url: 'http://front-pico.test/motion/load/3', body: 'FX 1\nEND' }),
      expect.objectContaining({ outputId: 'rear', url: 'http://rear-pico.test/motion/clear/3' }),
      expect.objectContaining({ outputId: 'rear', url: 'http://rear-pico.test/motion/clear/9' })
    ]));
  });

  test('cancels slot synchronization before writes when a configured Pico is unreachable', async ({ page }) => {
    const mutations = [];
    await page.route('http://front-pico.test/**', async route => {
      const url = route.request().url();
      if (url.endsWith('/motion/slots')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, slots: Array.from({ length: 64 }, (_, slot) => ({ slot, loaded: false })) })
        });
        return;
      }
      mutations.push(url);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route('http://rear-pico.test/**', route => route.abort('failed'));
    const error = await page.evaluate(async () => {
      try {
        await DmxCommon.synchronizeSavedPicoSlots({
          kind: 'motion',
          slotCount: 64,
          outputs: [
            { id: 'front', name: 'Front Pico', universe: 1, baseUrl: 'http://front-pico.test/' },
            { id: 'rear', name: 'Rear Pico', universe: 2, baseUrl: 'http://rear-pico.test/' }
          ],
          playbacks: [{ logicalSlot: 3, members: [{ baseUrl: 'http://front-pico.test/', slot: 3, payload: 'FX 1\nEND' }] }],
          legacySlots: []
        });
        return '';
      } catch (caught) {
        return caught.message;
      }
    });
    expect(error).toContain('cancelled before changes');
    expect(error).toContain('Rear Pico');
    expect(mutations).toEqual([]);
  });

  test('recalling an Effect tile restores its preview parameters after changing target family', async ({ page }) => {
    const beforePreview = await page.evaluate(() => {
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(scalar.control);
      populateMotionControlFilter();
      populateEffectTypeFilter('sine');
      motionFixtures.forEach(mf => mf.enabled = mf === scalar);
      document.getElementById('panAmp').value = '91';
      document.getElementById('panAmpVal').textContent = '91';
      drawPathPreview();

      const panTilt = motionFixtures.find(mf => mf.kind === 'panTilt');
      motionEffects = [{
        id: 'preview_recall',
        name: 'Saved Circle',
        slot: 0,
        recipe: {
          targetKey: motionControlKey(panTilt.control),
          params: { effectType: 'circle', bpm: 123, panAmp: 37, tiltAmp: 63, phaseSpread: 90, updateRate: 30 },
          fixtures: [{ fixtureId: panTilt.fixture.id, controlId: panTilt.control.id, phaseOffset: 15 }]
        }
      }];
      renderMotionEffectMatrix();
      return document.getElementById('pathCanvas').toDataURL();
    });

    await page.locator('[data-motion-effect-slot="0"]').click();

    await expect(page.locator('#effectType')).toHaveValue('circle');
    await expect(page.locator('#bpm')).toHaveValue('123');
    await expect(page.locator('#panAmp')).toHaveValue('37');
    await expect(page.locator('#tiltAmp')).toHaveValue('63');
    await expect(page.locator('#phaseSpread')).toHaveValue('90');
    await expect(page.locator('#updateRate')).toHaveValue('30');
    await expect(page.locator('#status')).toContainText('Recalled effect "Saved Circle"');

    const recalled = await page.evaluate(() => ({
      enabled: motionFixtures.filter(mf => mf.enabled).map(mf => mf.kind),
      phaseOffset: motionFixtures.find(mf => mf.enabled)?.phaseOffset,
      preview: document.getElementById('pathCanvas').toDataURL(),
      running
    }));
    expect(recalled.enabled).toEqual(['panTilt']);
    expect(recalled.phaseOffset).toBe(15);
    expect(recalled.preview).not.toBe(beforePreview);
    expect(recalled.running).toBe(false);
  });

  test('recalling an Effect tile restarts an active browser preview with the recalled update rate', async ({ page }) => {
    const initial = await page.evaluate(() => {
      const panTilt = motionFixtures.find(mf => mf.kind === 'panTilt');
      motionEffects = [{
        id: 'running_preview_recall',
        name: 'Fast Circle',
        slot: 0,
        recipe: {
          targetKey: motionControlKey(panTilt.control),
          params: { effectType: 'circle', bpm: 140, panAmp: 42, tiltAmp: 31, phaseSpread: 0, updateRate: 25 },
          fixtures: [{ fixtureId: panTilt.fixture.id, controlId: panTilt.control.id, phaseOffset: 0 }]
        }
      }];
      renderMotionEffectMatrix();
      running = true;
      startTime = performance.now() - 5000;
      sentToPico = { 1: 99 };
      intervalId = setInterval(() => {}, 1000);
      document.getElementById('startStop').textContent = '■ Stop';
      document.getElementById('startStop').className = 'stop';
      return { startTime, intervalId };
    });

    await page.locator('[data-motion-effect-slot="0"]').click();

    await expect(page.locator('#startStop')).toHaveText('■ Stop');
    await expect(page.locator('#startStop')).toHaveClass('stop');
    await expect(page.locator('#status')).toContainText('Running recalled effect "Fast Circle"');
    const recalled = await page.evaluate(() => {
      const state = {
        running,
        startTime,
        intervalId,
        sentToPico: { ...sentToPico },
        updateRate: document.getElementById('updateRate').value
      };
      clearInterval(intervalId);
      running = false;
      return state;
    });
    expect(recalled.running).toBe(true);
    expect(recalled.startTime).toBeGreaterThan(initial.startTime);
    expect(recalled.intervalId).not.toBe(initial.intervalId);
    expect(recalled.sentToPico).toEqual({});
    expect(recalled.updateRate).toBe('25');
  });

  test('Effects Toolboxes Edit enables moving in every tile matrix', async ({ page }) => {
    await page.evaluate(() => {
      motionGroupsBox.setGroups([
        { id: 'grp_a', name: 'Group A', slot: 0, fixtureIds: [101], values: {} },
        { id: 'grp_b', name: 'Group B', slot: 1, fixtureIds: [102], values: {} }
      ]);
      motionEffects = [
        { id: 'fx_a', name: 'Effect A', slot: 0, recipe: { targetKey: '', params: {}, fixtures: [] } },
        { id: 'fx_b', name: 'Effect B', slot: 1, recipe: { targetKey: '', params: {}, fixtures: [] } }
      ];
      motionScenes = [
        { id: 'scene_a', name: 'Scene A', slot: 0, values: { '101:11': 80 } },
        { id: 'scene_b', name: 'Scene B', slot: 1, values: { '102:21': 40 } }
      ];
      motionPalettes = [
        { id: 'pal_a', name: 'Palette A', slot: 0, values: { '101:11': 80 } },
        { id: 'pal_b', name: 'Palette B', slot: 1, values: { '102:21': 40 } }
      ];
      motionPlanes = [
        DmxCommon.normalizeRoomPlane({ id: 'plane_a', name: 'Plane A', slot: 0, fixtures: [] }, 0),
        DmxCommon.normalizeRoomPlane({ id: 'plane_b', name: 'Plane B', slot: 1, fixtures: [] }, 1)
      ];
      renderMotionEffectMatrix();
      renderMotionSlotGrid();
      renderMotionPaletteMatrix();
      motionPlanesMatrix.render();
    });

    await page.locator('.toolbox-rail-edit').click();
    await expect(page.locator('#motionGroupsMove')).toBeHidden();
    await expect(page.locator('#motionGroupsMove')).toHaveClass(/active/);
    await expect(page.locator('#motionGroupsRename')).toHaveCount(0);
    await expect(page.locator('#motionGroupsDelete')).toHaveCount(0);
    await expect(page.locator('#motionGroupsList [data-edit-group-tile="0"]')).toBeVisible();
    await expect(page.locator('#motionGroupsList [data-delete-group-tile="0"]')).toBeVisible();
    await expect(page.locator('#moveMotionEffectsBtn')).toBeHidden();
    await expect(page.locator('#moveMotionScenesBtn')).toBeHidden();
    await expect(page.locator('#moveMotionPalettesBtn')).toBeHidden();
    await expect(page.locator('#moveMotionPlanesBtn')).toBeHidden();

    await page.locator('[data-motion-effect-slot="0"]').click();
    await page.locator('[data-motion-effect-slot="3"]').click();
    await expect.poll(() => page.evaluate(() => motionEffects.find(effect => effect.id === 'fx_a').slot)).toBe(3);

    await page.locator('[data-mslot="0"]').click();
    await page.locator('[data-mslot="3"]').click();
    await expect.poll(() => page.evaluate(() => motionScenes.find(scene => scene.id === 'scene_a').slot)).toBe(3);

    await page.locator('[data-motion-palette-slot="0"]').click();
    await page.locator('[data-motion-palette-slot="3"]').click();
    await expect.poll(() => page.evaluate(() => motionPalettes.find(palette => palette.id === 'pal_a').slot)).toBe(3);

    await page.locator('#motionPlaneMatrix [data-plane-slot="0"]').click();
    await page.locator('#motionPlaneMatrix [data-plane-slot="3"]').click();
    await expect.poll(() => page.evaluate(() => motionPlanes.find(plane => plane.id === 'plane_a').slot)).toBe(3);

    await page.locator('#motionGroupsList [data-group-slot="0"]').click();
    await page.locator('#motionGroupsList [data-group-slot="3"]').click();
    await expect.poll(() => page.evaluate(() => motionGroupsBox.groups.find(group => group.id === 'grp_a').slot)).toBe(3);
  });

  test('clicking a saved Plane opens its target modal and applies the current target', async ({ page }) => {
    const expected = await page.evaluate(() => {
      const panTilt = motionFixtures.find(mf => mf.kind === 'panTilt');
      setMotionTarget(motionControlKey(panTilt.control));
      motionFixtures.forEach(mf => { mf.enabled = mf === panTilt; });
      panTilt.basePan = 1111;
      panTilt.baseTilt = 2222;
      motionPlanes = [DmxCommon.normalizeRoomPlane({
        id: 'plane_modal',
        name: 'Modal Plane',
        slot: 0,
        points: [
          { id: 'A', x: 0, y: 0, z: 0 },
          { id: 'B', x: 5, y: 0, z: 0 },
          { id: 'C', x: 0, y: 3, z: 0 },
          { id: 'D', x: 5, y: 3, z: 0 },
          { id: 'E', x: 2.5, y: 1.5, z: 0 }
        ],
        target: { x: 1, y: 1, z: 0 },
        fixtures: [{
          id: panTilt.fixture.id,
          name: panTilt.fixture.name,
          x: 2,
          y: 2,
          z: 0,
          cal: {
            A: { calibrated: true, pan: 10000, tilt: 20000 },
            B: { calibrated: true, pan: 20000, tilt: 30000 },
            C: { calibrated: true, pan: 30000, tilt: 40000 }
          }
        }]
      }, 0)];
      motionPlanesMatrix.render();
      const weights = DmxCommon.roomPlaneWeights(motionPlanes[0]);
      const output = DmxCommon.roomPlaneInterpolateFixture(motionPlanes[0], motionPlanes[0].fixtures[0], weights);
      return { basePan: Math.round(output.pan), baseTilt: Math.round(output.tilt) };
    });

    await page.locator('#motionPlaneMatrix [data-plane-slot="0"]').click();

    await expect(page.locator('#motionPlaneModal')).toBeVisible();
    await expect(page.locator('#motionPlanePad .controller-plane-point:not(.controller-plane-fixture)')).toHaveText(['A', 'B', 'C', 'D', 'E']);
    const afterOpen = await page.evaluate(() => {
      const panTilt = motionFixtures.find(mf => mf.kind === 'panTilt');
      return { basePan: panTilt.basePan, baseTilt: panTilt.baseTilt };
    });
    expect(afterOpen).toEqual(expected);
  });

  test('Effect Parameters + all keeps the clicked button anchored after expanding toolboxes', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 900 });

    const result = await page.evaluate(async () => {
      const waitFrames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rail = document.getElementById('motionToolboxRail');
      const scrollHost = rail?.querySelector('.toolbox-rail-scroll');
      const button = document.querySelector('#motionEffectBox [data-collapse-group="motion-effects"]');
      const effectBox = document.getElementById('motionEffectBox');
      const savedBox = document.getElementById('motionSavedEffectBox');
      if (!rail || !scrollHost || !button || !effectBox || !savedBox) throw new Error('Effects toolboxes missing');

      if (!effectBox.classList.contains('collapsed') || !savedBox.classList.contains('collapsed')) {
        button.click();
        await waitFrames();
      }

      scrollHost.scrollTop = Math.max(0, effectBox.offsetTop - 18);
      await waitFrames();
      const beforeTop = button.getBoundingClientRect().top;
      button.click();
      await waitFrames();
      const afterTop = button.getBoundingClientRect().top;

      return {
        beforeTop,
        afterTop,
        text: button.textContent,
        effectCollapsed: effectBox.classList.contains('collapsed'),
        savedCollapsed: savedBox.classList.contains('collapsed')
      };
    });

    expect(result.effectCollapsed).toBe(false);
    expect(result.savedCollapsed).toBe(false);
    expect(result.text).toBe('-- all');
    expect(result.afterTop).toBeCloseTo(result.beforeTop, 0);
  });

  test('individual toolbox + keeps the clicked button anchored after expanding', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 620 });

    const result = await page.evaluate(async () => {
      const waitFrames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rail = document.getElementById('motionToolboxRail');
      const scrollHost = rail?.querySelector('.toolbox-rail-scroll');
      const box = document.getElementById('motionSavedEffectBox');
      const button = document.getElementById('motionSavedEffectBoxToggle');
      if (!rail || !scrollHost || !box || !button) throw new Error('Effects toolbox missing');

      if (!box.classList.contains('collapsed')) {
        button.click();
        await waitFrames();
      }

      scrollHost.scrollTop = Math.max(0, box.offsetTop - 220);
      await waitFrames();
      const beforeTop = button.getBoundingClientRect().top;
      button.click();
      await waitFrames();
      const afterTop = button.getBoundingClientRect().top;

      return {
        beforeTop,
        afterTop,
        text: button.textContent,
        collapsed: box.classList.contains('collapsed'),
        scrollable: scrollHost.scrollHeight > scrollHost.clientHeight
      };
    });

    expect(result.scrollable).toBe(true);
    expect(result.collapsed).toBe(false);
    expect(result.text).toBe('—');
    expect(result.afterTop).toBeCloseTo(result.beforeTop, 0);
  });

  test('collapsing Participating Controls keeps the sticky header height stable', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 900 });
    await routeMotionCompactServerSetup(page);
    await page.route('**/group_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, baseUrl: '', groups: [] })
      });
    });
    await page.route('**/ui_state.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, state: { toolboxes: { selectedGroupIds: [] } } })
      });
    });
    await page.addInitScript(() => sessionStorage.removeItem('dmxMotionWorkingState'));
    await openDmxPage(page, 'dmx_motion.html');
    await injectMotionCompactSetup(page);

    const result = await page.evaluate(() => {
      const header = document.querySelector('header');
      const panel = document.getElementById('fxPanel');
      const btn = document.querySelector('[data-panel-toggle="fxPanel"]');
      if (panel.classList.contains('collapsed-panel')) btn.click();
      const before = {
        headerHeight: header.getBoundingClientRect().height,
        panelHeight: panel.getBoundingClientRect().height
      };
      btn.click();
      const after = {
        headerHeight: header.getBoundingClientRect().height,
        panelHeight: panel.getBoundingClientRect().height
      };
      return { before, after };
    });

    expect(result.after.headerHeight).toBeCloseTo(result.before.headerHeight, 0);
    expect(result.after.panelHeight).toBeLessThan(result.before.panelHeight * 0.45);
  });

  [
    { name: 'desktop rail', width: 1180, height: 900 },
    { name: 'iPad landscape', width: 1024, height: 768 },
    { name: 'iPad portrait', width: 820, height: 1180 }
  ].forEach(viewport => {
    test(`running status text does not move the sticky header toolbar on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const result = await page.evaluate(() => {
        const toolbar = document.querySelector('header .toolbar');
        const status = document.getElementById('status');
        status.textContent = 'Running · 1.0s · 8 ch/s';
        const before = toolbar.getBoundingClientRect();
        status.textContent = 'Running · 1234567.0s · 999999 ch/s';
        const after = toolbar.getBoundingClientRect();
        return {
          beforeLeft: before.left,
          beforeTop: before.top,
          beforeRight: before.right,
          afterLeft: after.left,
          afterTop: after.top,
          afterRight: after.right
        };
      });

      expect(result.afterLeft).toBeCloseTo(result.beforeLeft, 0);
      expect(result.afterTop).toBeCloseTo(result.beforeTop, 0);
      expect(result.afterRight).toBeCloseTo(result.beforeRight, 0);
    });
  });

  test('Effect Target starts at None and does not enable fixtures automatically', async ({ page }) => {
    const initial = await page.evaluate(() => ({
      target: selectedMotionTargetKey,
      filterValue: document.getElementById('motionControlFilter').value,
      effectDisabled: document.getElementById('effectType').disabled,
      enabled: motionFixtures.filter(mf => mf.enabled).length,
      groupEdit: getMotionGroupCommonControls().length > 0
    }));

    expect(initial.target).toBe('');
    expect(initial.filterValue).toBe('');
    expect(initial.effectDisabled).toBe(true);
    expect(initial.enabled).toBe(0);
    expect(initial.groupEdit).toBe(false);

    const afterTarget = await page.evaluate(() => {
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      document.getElementById('motionControlFilter').value = motionControlKey(scalar.control);
      document.getElementById('motionControlFilter').dispatchEvent(new Event('change'));
      return {
        target: selectedMotionTargetKey,
        enabled: motionFixtures.filter(mf => mf.enabled).length,
        visible: [...document.querySelectorAll('#fixtureList [data-mf] .motion-tile-title')].map(el => el.textContent),
        groupEdit: getMotionGroupCommonControls().length > 0
      };
    });

    expect(afterTarget.target).toContain('Dimmer');
    expect(afterTarget.enabled).toBe(0);
    expect(afterTarget.visible.sort()).toEqual(['A 1', 'B 1']);
    expect(afterTarget.groupEdit).toBe(true);
  });

  test('choosing Dimmer after reload enables Group Edit across different fixture types without enabling playback', async ({ page }) => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await injectMotionCompactSetup(page);

    const result = await page.evaluate(() => {
      const sel = document.getElementById('motionControlFilter');
      const dimmer = [...sel.options].find(o => o.textContent.includes('Dimmer'));
      sel.value = dimmer.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        selectedTarget: selectedMotionTargetKey,
        enabledFixtures: motionFixtures.filter(mf => mf.enabled).length,
        editFixtures: motionGroupEditFixtures().map(mf => ({
          fixture: mf.fixture.id,
          profile: fixtureProfile(mf.fixture)?.name,
          label: mf.control.label
        })),
        controls: getMotionGroupCommonControls().map(motionGroupKey),
        groupEditDisabled: document.getElementById('motionGroupsEdit')?.disabled
      };
    });

    expect(result.selectedTarget).toContain('Dimmer');
    expect(result.enabledFixtures).toBe(0);
    expect(result.editFixtures.map(f => f.fixture).sort()).toEqual([101, 102]);
    expect(new Set(result.editFixtures.map(f => f.profile)).size).toBe(2);
    expect(result.controls).toEqual(['slider8:Dimmer:value']);
    expect(result.groupEditDisabled).toBe(false);
  });

  test('effect dropdown is filtered by the selected target family', async ({ page }) => {
    const result = await page.evaluate(() => {
      const pan = motionFixtures.find(mf => mf.kind === 'panTilt');
      selectedMotionTargetKey = motionControlKey(pan.control);
      populateEffectTypeFilter();
      const panOptions = [...document.getElementById('effectType').options].map(o => o.value);
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(scalar.control);
      populateEffectTypeFilter();
      const scalarOptions = [...document.getElementById('effectType').options].map(o => o.value);
      return { panOptions, scalarOptions };
    });

    expect(result.panOptions).toEqual(['circle', 'figure8', 'panSwing', 'tiltSwing', 'panPulse', 'tiltPulse']);
    expect(result.scalarOptions).toEqual(['sine', 'pulse']);
  });

  test('pan and tilt pulse effects preview and upload only their selected axis', async ({ page }) => {
    const result = await page.evaluate(() => {
      const pan = motionFixtures.find(mf => mf.kind === 'panTilt');
      setMotionTarget(motionControlKey(pan.control));
      const effect = document.getElementById('effectType');
      const sample = type => {
        effect.value = type;
        effect.dispatchEvent(new Event('change'));
        return {
          offsetHigh: effectOffset(Math.PI / 2, type),
          offsetLow: effectOffset(3 * Math.PI / 2, type),
          typeLine: serializeMotionForPico().split('\n').find(line => line.startsWith('TYPE ')),
          amp1: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP1 ')),
          amp2: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP2 '))
        };
      };
      effect.value = 'panPulse';
      effect.dispatchEvent(new Event('change'));
      document.getElementById('pulsePositionOffset').value = -25;
      document.getElementById('pulseDirection').value = -100;
      const shaped = {
        negative: pulsePositionValue(-1, -1, -.25),
        positive: pulsePositionValue(1, -1, -.25),
        midpoint: pulsePositionValue(1, -.5, 0),
        offsetLine: serializeMotionForPico().split('\n').find(line => line.startsWith('PULSE_OFFSET ')),
        directionLine: serializeMotionForPico().split('\n').find(line => line.startsWith('PULSE_DIRECTION ')),
        params: motionData().params,
        recipeParams: currentMotionEffectRecipe().params,
        controlsVisible: getComputedStyle(document.getElementById('pulseShapeFields')).display !== 'none'
      };
      effect.value = 'panSwing';
      effect.dispatchEvent(new Event('change'));
      shaped.hiddenForSine = getComputedStyle(document.getElementById('pulseShapeFields')).display === 'none';
      return { panPulse: sample('panPulse'), tiltPulse: sample('tiltPulse'), shaped };
    });

    expect(result.panPulse).toMatchObject({
      offsetHigh: { pan: 1, tilt: 0 },
      offsetLow: { pan: -1, tilt: 0 },
      typeLine: 'TYPE 6',
      amp2: 'AMP2 0.000000'
    });
    expect(result.panPulse.amp1).not.toBe('AMP1 0.000000');
    expect(result.tiltPulse).toMatchObject({
      offsetHigh: { pan: 0, tilt: 1 },
      offsetLow: { pan: 0, tilt: -1 },
      typeLine: 'TYPE 7',
      amp1: 'AMP1 0.000000'
    });
    expect(result.tiltPulse.amp2).not.toBe('AMP2 0.000000');
    expect(result.shaped).toMatchObject({
      negative: -1.25,
      positive: -0.25,
      midpoint: 0.5,
      offsetLine: 'PULSE_OFFSET -0.250000',
      directionLine: 'PULSE_DIRECTION -1.000000',
      controlsVisible: true,
      hiddenForSine: true,
      params: { pulsePositionOffset: -25, pulseDirection: -100 },
      recipeParams: { pulsePositionOffset: -25, pulseDirection: -100 }
    });
  });

  test('scalar targets show one amplitude slider and force hidden tilt amplitude to zero', async ({ page }) => {
    const result = await page.evaluate(() => {
      document.getElementById('panAmp').value = 22;
      document.getElementById('panAmpVal').textContent = '22';
      document.getElementById('tiltAmp').value = 37;
      document.getElementById('tiltAmpVal').textContent = '37';
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      setMotionTarget(motionControlKey(scalar.control));
      const scalarState = {
        panLabel: document.getElementById('panAmpLabel').childNodes[0].nodeValue.trim(),
        tiltDisplay: getComputedStyle(document.getElementById('tiltAmpLabel')).display,
        tiltValue: document.getElementById('tiltAmp').value,
        tiltText: document.getElementById('tiltAmpVal').textContent,
        serializedAmp2: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP2 '))
      };

      const pan = motionFixtures.find(mf => mf.kind === 'panTilt');
      setMotionTarget(motionControlKey(pan.control));
      const panTiltState = {
        panLabel: document.getElementById('panAmpLabel').childNodes[0].nodeValue.trim(),
        panDisplay: getComputedStyle(document.getElementById('panAmpLabel')).display,
        panValue: document.getElementById('panAmp').value,
        tiltDisplay: getComputedStyle(document.getElementById('tiltAmpLabel')).display,
        tiltValue: document.getElementById('tiltAmp').value,
        serializedAmp1: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP1 ')),
        serializedAmp2: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP2 '))
      };
      return { scalarState, panTiltState };
    });

    expect(result.scalarState.panLabel).toBe('Amplitude');
    expect(result.scalarState.tiltDisplay).toBe('none');
    expect(result.scalarState.tiltValue).toBe('0');
    expect(result.scalarState.tiltText).toBe('0');
    expect(result.scalarState.serializedAmp2).toBe('AMP2 0.000000');
    expect(result.panTiltState.panLabel).toBe('Pan amp');
    expect(result.panTiltState.panDisplay).not.toBe('none');
    expect(result.panTiltState.panValue).toBe('22');
    expect(result.panTiltState.tiltDisplay).not.toBe('none');
    expect(result.panTiltState.tiltValue).toBe('37');
    expect(result.panTiltState.serializedAmp1).toBe('AMP1 0.220000');
    expect(result.panTiltState.serializedAmp2).toBe('AMP2 0.370000');
  });

  test('Pico Effects Pan/Tilt target serializes swapped channels and reverse flags', async ({ page }) => {
    const result = await page.evaluate(() => {
      const pan = motionFixtures.find(mf => mf.kind === 'panTilt');
      Object.assign(pan.control, {
        panReverse: true,
        tiltReverse: true,
        panTiltSwap: true
      });
      motionFixtures.forEach(mf => {
        mf.enabled = mf === pan;
      });
      setMotionTarget(motionControlKey(pan.control), { enableMatches: false });
      pan.enabled = true;
      return serializeMotionForPico().split('\n').find(line => line.startsWith('TARGET pantilt16 '));
    });

    expect(result).toBe('TARGET pantilt16 1 4 5 2 3 0.00 1 1');
  });

  test('stopping browser motion restores the base position instead of adopting the moving output', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const sent = [];
      const originalFetch = window.fetch;
      window.fetch = async (url, options = {}) => {
        const text = String(url);
        if (text.includes('/dmx/b')) {
          sent.push({ url: text, body: options.body || '' });
          return { ok: true, json: async () => ({ ok: true }) };
        }
        return originalFetch(url, options);
      };
      baseUrlEl.value = location.origin;
      const pan = motionFixtures.find(mf => mf.kind === 'panTilt');
      motionFixtures.forEach(mf => { mf.enabled = mf === pan; });
      selectedMotionTargetKey = motionControlKey(pan.control);
      pan.basePan = 0x1234;
      pan.baseTilt = 0xabcd;
      sentToPico = {
        2: 0x99,
        3: 0x88,
        4: 0x77,
        5: 0x66
      };
      running = true;
      intervalId = setInterval(() => {}, 1000);
      stopMotion();
      await new Promise(resolve => setTimeout(resolve, 0));
      window.fetch = originalFetch;
      return {
        sent,
        basePan: pan.basePan,
        baseTilt: pan.baseTilt,
        running
      };
    });

    expect(result.running).toBe(false);
    expect(result.basePan).toBe(0x1234);
    expect(result.baseTilt).toBe(0xabcd);
    expect(result.sent).toHaveLength(1);
    expect(result.sent[0].body).toBe('2:18,3:52,4:171,5:205');
  });

  test('phase spread spans from the first to the last enabled fixture', async ({ page }) => {
    const result = await page.evaluate(() => {
      const degrees = value => Math.round(value * 180 / Math.PI);
      const fullSpread = Math.PI * 2;
      return {
        oneFixture: [0].map(i => degrees(window.motionAutoPhase(fullSpread, i, 1))),
        twoFixtures: [0, 1].map(i => degrees(window.motionAutoPhase(fullSpread, i, 2))),
        threeFixtures: [0, 1, 2].map(i => degrees(window.motionAutoPhase(fullSpread, i, 3)))
      };
    });

    expect(result.oneFixture).toEqual([0]);
    expect(result.twoFixtures).toEqual([0, 360]);
    expect(result.threeFixtures).toEqual([0, 180, 360]);
  });

  test('scene center changes publish Effects values to shared live values', async ({ page }) => {
    let postedValues = null;
    await page.unroute('**/fixture_setup.php**');
    await page.route('**/fixture_setup.php**', async route => {
      const url = route.request().url();
      if (url.includes('livevalues')) {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true, exists: true, values: { '102:21': 55 } })
          });
          return;
        }
        postedValues = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, setup: { baseUrl: '', profiles: [], fixtures: [], values: {} } })
      });
    });

    await page.evaluate(() => {
      applySceneAsCenter({
        name: 'Position Center',
        values: {
          '101:12': { pan: 1234, tilt: 5678 }
        }
      });
    });

    await expect.poll(() => postedValues).toMatchObject({
      '102:21': 55,
      '101:12': { pan: 1234, tilt: 5678 }
    });
  });

  test('one-axis pan and tilt swing effects hide and zero the unused axis without losing two-axis values', async ({ page }) => {
    const result = await page.evaluate(() => {
      const pan = motionFixtures.find(mf => mf.kind === 'panTilt');
      setMotionTarget(motionControlKey(pan.control));
      document.getElementById('panAmp').value = 44;
      document.getElementById('panAmpVal').textContent = '44';
      document.getElementById('tiltAmp').value = 66;
      document.getElementById('tiltAmpVal').textContent = '66';

      const effect = document.getElementById('effectType');
      effect.value = 'panSwing';
      effect.dispatchEvent(new Event('change'));
      const panSwing = {
        panDisplay: getComputedStyle(document.getElementById('panAmpLabel')).display,
        panValue: document.getElementById('panAmp').value,
        tiltDisplay: getComputedStyle(document.getElementById('tiltAmpLabel')).display,
        tiltValue: document.getElementById('tiltAmp').value,
        amp1: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP1 ')),
        amp2: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP2 '))
      };

      effect.value = 'tiltSwing';
      effect.dispatchEvent(new Event('change'));
      const tiltSwing = {
        panDisplay: getComputedStyle(document.getElementById('panAmpLabel')).display,
        panValue: document.getElementById('panAmp').value,
        tiltDisplay: getComputedStyle(document.getElementById('tiltAmpLabel')).display,
        tiltValue: document.getElementById('tiltAmp').value,
        amp1: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP1 ')),
        amp2: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP2 '))
      };

      effect.value = 'circle';
      effect.dispatchEvent(new Event('change'));
      const circle = {
        panDisplay: getComputedStyle(document.getElementById('panAmpLabel')).display,
        panValue: document.getElementById('panAmp').value,
        tiltDisplay: getComputedStyle(document.getElementById('tiltAmpLabel')).display,
        tiltValue: document.getElementById('tiltAmp').value,
        amp1: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP1 ')),
        amp2: serializeMotionForPico().split('\n').find(line => line.startsWith('AMP2 '))
      };
      return { panSwing, tiltSwing, circle };
    });

    expect(result.panSwing.panDisplay).not.toBe('none');
    expect(result.panSwing.panValue).toBe('44');
    expect(result.panSwing.tiltDisplay).toBe('none');
    expect(result.panSwing.tiltValue).toBe('0');
    expect(result.panSwing.amp1).toBe('AMP1 0.440000');
    expect(result.panSwing.amp2).toBe('AMP2 0.000000');

    expect(result.tiltSwing.panDisplay).toBe('none');
    expect(result.tiltSwing.panValue).toBe('0');
    expect(result.tiltSwing.tiltDisplay).not.toBe('none');
    expect(result.tiltSwing.tiltValue).toBe('66');
    expect(result.tiltSwing.amp1).toBe('AMP1 0.000000');
    expect(result.tiltSwing.amp2).toBe('AMP2 0.660000');

    expect(result.circle.panDisplay).not.toBe('none');
    expect(result.circle.panValue).toBe('44');
    expect(result.circle.tiltDisplay).not.toBe('none');
    expect(result.circle.tiltValue).toBe('66');
    expect(result.circle.amp1).toBe('AMP1 0.440000');
    expect(result.circle.amp2).toBe('AMP2 0.660000');
  });

  test('All enables every fixture for the current effect target and clears group filtering', async ({ page }) => {
    await page.locator('#motionGroupsBox [data-group-index="0"]').click();
    const result = await page.evaluate(() => {
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(scalar.control);
      document.getElementById('btnMotionAll').click();
      return {
        selectedGroups: motionGroupsBox.selectedGroups().length,
        enabledFixtures: motionFixtures
          .filter(mf => mf.enabled && motionControlKey(mf.control) === selectedMotionTargetKey)
          .map(mf => mf.fixture.id)
      };
    });

    expect(result.selectedGroups).toBe(0);
    expect(result.enabledFixtures.sort()).toEqual([101, 102]);
  });

  test('Group Edit uses the selected effect target and matching participating fixtures', async ({ page }) => {
    const result = await page.evaluate(() => {
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(scalar.control);
      motionFixtures.forEach(mf => mf.enabled = motionControlKey(mf.control) === selectedMotionTargetKey);
      refreshMotionGroupActions();
      return {
        fixtures: motionGroupFixtureIds().sort(),
        controls: getMotionGroupCommonControls().map(motionGroupKey)
      };
    });

    expect(result.fixtures).toEqual([101, 102]);
    expect(result.controls).toEqual(['slider8:Dimmer:value']);
  });

  test('Effects Group Edit works for a single Pan/Tilt fixture with source and relative controls', async ({ page }) => {
    const state = await page.evaluate(() => {
      const pan = motionFixtures.find(mf => mf.kind === 'panTilt');
      selectedMotionTargetKey = motionControlKey(pan.control);
      motionFixtures.forEach(mf => {
        mf.enabled = mf === pan;
        if (mf === pan) {
          mf.basePan = 33000;
          mf.baseTilt = 34000;
        }
      });
      drawFixtureList();
      refreshMotionGroupActions();
      return {
        source: motionSourceFixtureId,
        controls: getMotionGroupCommonControls().map(motionGroupKey),
        groupEditDisabled: document.getElementById('motionGroupsEdit').disabled
      };
    });

    expect(state.source).toBe('101');
    expect(state.controls).toEqual(['panTilt16:Pan/Tilt:panTilt']);
    expect(state.groupEditDisabled).toBe(false);

    await page.locator('#motionGroupsEdit').click();
    await expect(page.locator('#motionGroupModal')).toBeVisible();
    await expect(page.locator('#motionGroupModalBody')).toContainText('Source: A 1');
    await expect(page.locator('#motionGroupModalBody')).toContainText('Pan coarse relative');
    await expect(page.locator('#motionGroupModalBody')).toContainText('Pan fine relative');
    await expect(page.locator('#motionGroupModalBody')).toContainText('Tilt coarse relative');
    await expect(page.locator('#motionGroupModalBody')).toContainText('Tilt fine relative');
    await expect(page.locator('#motionGroupModalBody input[data-axis]')).toHaveCount(0);
  });

  test('Effects Group Edit shows the source fixture and relative nudges keep fixture offsets', async ({ page }) => {
    await page.evaluate(() => {
      const scalarKey = motionControlKey(motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer').control);
      selectedMotionTargetKey = scalarKey;
      motionFixtures.forEach(mf => {
        if (motionControlKey(mf.control) !== scalarKey) return;
        mf.enabled = true;
        mf.baseValue = mf.fixture.id === 101 ? 10 : 80;
      });
      drawFixtureList();
      refreshMotionGroupActions();
    });

    await expect(page.locator('#fixtureList [data-fix-id="101"]')).toHaveClass(/source-fixture/);
    await page.locator('#fixtureList [data-fix-id="102"]').click();
    await expect(page.locator('#fixtureList [data-fix-id="102"]')).toHaveClass(/source-fixture/);

    await page.locator('#motionGroupsEdit').click();
    await expect(page.locator('#motionGroupModalBody')).toContainText('Source: B 1');
    await page.locator('#motionGroupModalBody input[data-relative-step]').fill('5');
    await page.locator('#motionGroupModalBody button[data-relative-dir="1"][data-relative-part="value"]').click();

    const result = await page.evaluate(() => ({
      source: motionSourceFixtureId,
      values: motionFixtures
        .filter(mf => motionGroupKey(mf.control) === selectedMotionTargetKey)
        .map(mf => ({ fixture: mf.fixture.id, value: mf.baseValue }))
        .sort((a, b) => a.fixture - b.fixture),
      readout: document.querySelector('#motionGroupModalBody [data-mg-readout]')?.textContent
    }));

    expect(result.source).toBe('102');
    expect(result.values).toEqual([
      { fixture: 101, value: 15 },
      { fixture: 102, value: 85 }
    ]);
    expect(result.readout).toBe('85');
  });

  test('None disables every visible fixture for the current effect target', async ({ page }) => {
    const result = await page.evaluate(() => {
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(scalar.control);
      setMotionParticipationByKey(selectedMotionTargetKey, 'all');
      document.getElementById('btnMotionNone').click();
      return motionFixtures
        .filter(mf => motionControlKey(mf.control) === selectedMotionTargetKey)
        .map(mf => ({ id: mf.fixture.id, enabled: mf.enabled }));
    });

    expect(result).toEqual([
      { id: 101, enabled: false },
      { id: 102, enabled: false }
    ]);
  });

  test('selected groups filter the fixture matrix for the current target', async ({ page }) => {
    await page.evaluate(() => {
      motionGroupsBox.setGroups([{ id: 'grp_a', name: 'A only', fixtureIds: [101], values: {} }]);
      const scalar = motionFixtures.find(mf => mf.kind !== 'panTilt' && mf.control.label === 'Dimmer');
      selectedMotionTargetKey = motionControlKey(scalar.control);
      setMotionParticipationByKey(selectedMotionTargetKey, 'all');
    });
    await page.locator('#motionGroupsBox [data-group-index="0"]').click();

    const visible = await page.evaluate(() =>
      [...document.querySelectorAll('#fixtureList [data-mf] .motion-tile-title')].map(el => el.textContent)
    );

    expect(visible).toEqual(['A 1']);
  });
});

test.describe('Effects navigation rules', () => {
  test('restored selected target fixtures keep Group Edit enabled after navigating away and back', async ({ page }) => {
    const profiles = [{
      id: 1,
      name: 'Profile A',
      mode: 'test',
      channels: 8,
      controls: [
        { id: 12, type: 'panTilt16', label: 'Pan/Tilt', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 }
      ]
    }];
    const fixtures = [
      { id: 101, name: 'A 1', profileId: 1, start: 1 },
      { id: 102, name: 'A 2', profileId: 1, start: 21 }
    ];
    const targetKey = 'panTilt16:Pan/Tilt:panTilt';
    const motionState = {
      baseUrl: '',
      targetKey,
      params: { effectType: 'circle', bpm: 60, panAmp: 25, tiltAmp: 25, phaseSpread: 0, updateRate: 20 },
      effects: [],
      fixtures: fixtures.map(f => ({
        fixtureId: f.id,
        controlId: 12,
        kind: 'panTilt',
        enabled: true,
        phaseOffset: 0,
        basePan: 32768,
        baseTilt: 32768
      }))
    };

    await page.route('**/fixture_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, setup: { baseUrl: '', profiles, fixtures, values: {} } })
      });
    });
    await page.route('**/motion_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, motion: motionState, pico_slots: [] })
      });
    });
    await page.route('**/group_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, baseUrl: '', groups: [] })
      });
    });
    await page.route('**/ui_state.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, state: { toolboxes: { selectedGroupIds: [] } } })
      });
    });

    await openDmxPage(page, 'dmx_motion.html');
    await page.locator('#btnMotionLoad').click();
    await expect(page.locator('#motionControlFilter')).toHaveValue(targetKey);
    await expect(page.locator('#motionGroupsEdit')).toBeEnabled();

    await page.locator('header a[href="dmx_chaser.html"]').click();
    await expect(page.locator('header h1')).toContainText('DMX Chaser');
    await page.locator('header a[href="dmx_motion.html"]').click();
    await expect(page.locator('header h1')).toHaveText(/Effects/);
    await expect(page.locator('#motionControlFilter')).toHaveValue(targetKey);

    const state = await page.evaluate(() => ({
      enabledFixtures: motionFixtures.filter(mf => mf.enabled && motionControlKey(mf.control) === selectedMotionTargetKey).map(mf => mf.fixture.id),
      commonControls: getMotionGroupCommonControls().map(motionGroupKey),
      groupEditDisabled: document.getElementById('motionGroupsEdit').disabled
    }));

    expect(state.enabledFixtures.sort()).toEqual([101, 102]);
    expect(state.commonControls).toEqual([targetKey]);
    expect(state.groupEditDisabled).toBe(false);
  });

  test('hard reload restores the saved Effect Target and participating fixtures', async ({ page }) => {
    const profiles = [{
      id: 1,
      name: 'Profile A',
      mode: 'test',
      channels: 8,
      controls: [
        { id: 12, type: 'panTilt16', label: 'Pan/Tilt', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 }
      ]
    }];
    const fixtures = [
      { id: 101, name: 'A 1', profileId: 1, start: 1 },
      { id: 102, name: 'A 2', profileId: 1, start: 21 }
    ];
    const targetKey = 'panTilt16:Pan/Tilt:panTilt';
    const motionState = {
      baseUrl: '',
      targetKey,
      params: { effectType: 'circle', bpm: 60, panAmp: 25, tiltAmp: 25, phaseSpread: 0, updateRate: 20 },
      effects: [{ id: 'fx_1', name: 'Circle', slot: 0, recipe: { targetKey, params: {}, fixtures: [] } }],
      fixtures: fixtures.map(f => ({
        fixtureId: f.id,
        controlId: 12,
        kind: 'panTilt',
        enabled: true,
        phaseOffset: 0,
        basePan: 32768,
        baseTilt: 32768
      }))
    };

    await page.route('**/fixture_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, setup: { baseUrl: '', profiles, fixtures, values: {} } })
      });
    });
    await page.route('**/motion_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, motion: motionState, pico_slots: [] })
      });
    });
    await page.route('**/group_setup.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, baseUrl: '', groups: [] })
      });
    });
    await page.route('**/ui_state.php**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, state: { toolboxes: { selectedGroupIds: [] } } })
      });
    });

    await openDmxPage(page, 'dmx_motion.html');
    await page.locator('#btnMotionLoad').click();
    await expect(page.locator('#motionControlFilter')).toHaveValue(targetKey);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#motionControlFilter')).toHaveValue(targetKey);
    await expect(page.locator('#motionEffectMatrix .slot.filled')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() =>
      motionFixtures.filter(mf => mf.enabled && motionControlKey(mf.control) === selectedMotionTargetKey).length
    )).toBe(2);
  });
});
