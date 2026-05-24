const { test, expect } = require('@playwright/test');
const { openDmxPage, injectChaserCompactSetup } = require('./helpers/dmx-page');

function parseBatchBody(body) {
  return Object.fromEntries(String(body || '').split(',').filter(Boolean).map(pair => {
    const [ch, val] = pair.split(':').map(Number);
    return [ch, val];
  }));
}

test.describe('Browser playback established rules', () => {
  test('Chase Playback sends fade interpolation at the configured update rate', async ({ page }) => {
    const batches = [];
    await page.route('http://127.0.0.1:18991/**', async route => {
      const req = route.request();
      if (req.url().includes('/dmx/b')) {
        batches.push({ at: Date.now(), body: req.postData() || '' });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"ok":true}'
      });
    });

    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    await page.evaluate(() => {
      baseUrlEl.value = 'http://127.0.0.1:18991/';
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      steps = [makeStep('Fade dimmer', { '101:11': 100 })];
      steps[0].duration = 420;
      steps[0].fade = 100;
      selectedStepIdx = 0;
      activeStepValueKeys = new Set(['101:11']);
      sourceFixtureId = '101';
      document.getElementById('browserPlayMode').value = 'single';
      document.getElementById('updateRate').value = 20;
      drawParticipation();
      drawStepList();
      drawStepEditor();
      startPlayback();
    });

    await page.waitForTimeout(330);
    await page.evaluate(() => stopPlayback());

    const values = batches.map(b => parseBatchBody(b.body)[1]).filter(v => Number.isFinite(v));
    const intervals = batches.slice(1).map((b, i) => b.at - batches[i].at);

    expect(values.some(v => v > 0 && v < 100)).toBe(true);
    expect(Math.max(...values)).toBeLessThanOrEqual(100);
    expect(intervals.length).toBeGreaterThanOrEqual(3);
    expect(intervals.every(ms => ms >= 25 && ms <= 90)).toBe(true);
  });

  test('Ping Pong playback reverses at the end and reverse direction starts from the last step', async ({ page }) => {
    await page.route('http://127.0.0.1:18991/**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    const forwardPingPong = await page.evaluate(() => {
      baseUrlEl.value = 'http://127.0.0.1:18991/';
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      steps = [
        makeStep('A', { '101:11': 10 }),
        makeStep('B', { '101:11': 20 }),
        makeStep('C', { '101:11': 30 })
      ];
      selectedStepIdx = 0;
      activeStepValueKeys = new Set(['101:11']);
      sourceFixtureId = '101';
      document.getElementById('browserPlayMode').value = 'ping_pong';
      document.getElementById('browserDirection').value = 'forward';
      drawParticipation();
      drawStepList();
      drawStepEditor();
      startPlayback();
      const seen = [activeStepIdx];
      advanceStep(); seen.push(activeStepIdx);
      advanceStep(); seen.push(activeStepIdx);
      advanceStep(); seen.push(activeStepIdx);
      stopPlayback();
      return seen;
    });

    expect(forwardPingPong).toEqual([0, 1, 2, 1]);

    const reverseStart = await page.evaluate(() => {
      document.getElementById('browserPlayMode').value = 'single';
      document.getElementById('browserDirection').value = 'reverse';
      startPlayback();
      const first = activeStepIdx;
      advanceStep();
      const second = activeStepIdx;
      stopPlayback();
      return [first, second];
    });

    expect(reverseStart).toEqual([2, 1]);
  });

  test('Browser Loop N stops after the configured number of completed loops', async ({ page }) => {
    await page.route('http://127.0.0.1:18991/**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    const state = await page.evaluate(() => {
      baseUrlEl.value = 'http://127.0.0.1:18991/';
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      steps = [makeStep('A', { '101:11': 10 }), makeStep('B', { '101:11': 20 })];
      document.getElementById('browserPlayMode').value = 'loop_n';
      document.getElementById('browserLoopCount').value = '2';
      document.getElementById('browserDirection').value = 'forward';
      drawParticipation();
      drawStepList();
      drawStepEditor();
      startPlayback();
      const seen = [activeStepIdx];
      advanceStep(); seen.push(activeStepIdx);
      advanceStep(); seen.push(activeStepIdx);
      advanceStep(); seen.push(activeStepIdx);
      advanceStep(); seen.push(activeStepIdx);
      return { seen, playing, playbackInfo: document.getElementById('playbackInfo').textContent };
    });

    expect(state.seen).toEqual([0, 1, 0, 1, -1]);
    expect(state.playing).toBe(false);
    expect(state.playbackInfo).toBe('Stopped');
  });

  test('Pico chaser serialization uses browser playback mode, loop count, and direction', async ({ page }) => {
    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    const pingPongBody = await page.evaluate(() => {
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      steps = [makeStep('A', { '101:11': 10 }), makeStep('B', { '101:11': 20 })];
      document.getElementById('browserPlayMode').value = 'ping_pong';
      document.getElementById('browserDirection').value = 'reverse';
      syncPicoPlaybackControlsFromBrowser();
      drawParticipation();
      drawStepList();
      return serializeChaserForPico();
    });

    expect(pingPongBody).toContain('MODE ping_pong');
    expect(pingPongBody).toContain('DIR reverse');

    const loopNBody = await page.evaluate(() => {
      document.getElementById('browserPlayMode').value = 'loop_n';
      document.getElementById('browserLoopCount').value = '4';
      document.getElementById('browserDirection').value = 'forward';
      syncPicoPlaybackControlsFromBrowser();
      return serializeChaserForPico();
    });

    expect(loopNBody).toContain('MODE loop_n');
    expect(loopNBody).toContain('LOOPS 4');
    expect(loopNBody).toContain('DIR forward');
  });

  test('Pico slot strip describes loop state, ping pong mode, and direction explicitly', async ({ page }) => {
    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    const text = await page.evaluate(() => {
      savedPicoChaserSlotInfo = Array.from({ length: PICO_SLOT_COUNT }, () => null);
      renderChaserSlotStrip([
        { slot: 0, loaded: true, active: false, paused: false, loop: false, mode: 0, direction: 0, loop_count: 1, step_count: 2, speed_mult: 1 },
        { slot: 1, loaded: true, active: false, paused: false, loop: true, mode: 2, direction: 1, loop_count: 3, step_count: 4, speed_mult: 1.25 },
        { slot: 2, loaded: true, active: true, paused: false, loop: true, mode: 3, direction: 1, loop_count: 1, step_count: 5, speed_mult: 0.5 }
      ], 1 << 2);
      return Array.from(document.querySelectorAll('#chaserSlotStrip > div')).slice(0, 3).map(el => el.innerText);
    });

    expect(text[0]).toContain('Loop off');
    expect(text[0]).toContain('Forward');
    expect(text[0]).toContain('Ping Pong off');
    expect(text[1]).toContain('Loop 3x');
    expect(text[1]).toContain('Reverse');
    expect(text[1]).toContain('Ping Pong off');
    expect(text[2]).toContain('Loop on');
    expect(text[2]).toContain('Reverse');
    expect(text[2]).toContain('Ping Pong on');
    expect(text[2]).toContain('LIVE');
  });

  test('Saved chase toolbox data preserves ping pong playback settings without changing tile text', async ({ page }) => {
    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    const state = await page.evaluate(() => {
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      steps = [makeStep('A', { '101:11': 10 }), makeStep('B', { '101:11': 20 })];
      savedChases = [];
      saveChasesServer = async () => {};
      document.getElementById('browserPlayMode').value = 'ping_pong';
      document.getElementById('browserDirection').value = 'reverse';
      syncPicoPlaybackControlsFromBrowser();
      saveChaseToSlot(0, 'Ping chase');
      const saved = savedChases[0]?.data?.playback;
      const tileText = document.querySelector('[data-chase-slot="0"]')?.innerText || '';
      return { saved, tileText };
    });

    expect(state.saved).toMatchObject({ mode: 'ping_pong', direction: 'reverse' });
    expect(state.tileText).toContain('Ping chase');
    expect(state.tileText).not.toContain('Ping Pong');
    expect(state.tileText).not.toContain('Reverse');
  });

  test('Loading a saved chase restores ping pong playback controls without adding playback text to the chase tile', async ({ page }) => {
    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    const state = await page.evaluate(async () => {
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      steps = [makeStep('A', { '101:11': 10 }), makeStep('B', { '101:11': 20 })];
      savedChases = [];
      saveChasesServer = async () => {};
      document.getElementById('browserPlayMode').value = 'ping_pong';
      document.getElementById('browserDirection').value = 'reverse';
      syncPicoPlaybackControlsFromBrowser();
      saveChaseToSlot(0, 'Recall ping');

      document.getElementById('picoChaserMode').value = 'loop';
      document.getElementById('picoDirection').value = 'forward';
      document.getElementById('picoLoopCount').value = '1';
      document.getElementById('browserPlayMode').value = 'loop';
      document.getElementById('browserDirection').value = 'forward';

      await loadChaseSlot(savedChases[0]);
      return {
        picoMode: document.getElementById('picoChaserMode').value,
        picoDirection: document.getElementById('picoDirection').value,
        picoLoopCount: document.getElementById('picoLoopCount').value,
        browserMode: document.getElementById('browserPlayMode').value,
        browserLoopCount: document.getElementById('browserLoopCount').value,
        browserDirection: document.getElementById('browserDirection').value,
        tileText: document.querySelector('[data-chase-slot="0"]')?.innerText || ''
      };
    });

    expect(state.picoMode).toBe('ping_pong');
    expect(state.picoDirection).toBe('reverse');
    expect(state.browserMode).toBe('ping_pong');
    expect(state.browserDirection).toBe('reverse');
    expect(state.tileText).toContain('Recall ping');
    expect(state.tileText).not.toContain('Ping Pong');
  });

  test('Uploaded Pico slot tile uses the saved ping pong payload when live status is stale', async ({ page }) => {
    const savedBodies = [];
    await page.route('http://127.0.0.1:18991/**', async route => {
      const url = route.request().url();
      if (url.includes('/chaser/load/4')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      if (url.includes('/chaser/status')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"active_mask":0,"loaded_mask":16,"paused_mask":0,"step":0,"step_count":2,"elapsed_ms":0}' });
        return;
      }
      if (url.includes('/chaser/slots')) {
        const slots = Array.from({ length: 32 }, (_, i) => ({ slot: i, loaded: false, active: false, paused: false, loop: false, mode: 0, direction: 0, loop_count: 1, step_count: 0, speed_mult: 1 }));
        slots[4] = { slot: 4, loaded: true, active: false, paused: false, loop: true, mode: 1, direction: 0, loop_count: 1, step_count: 2, speed_mult: 1 };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, slots }) });
        return;
      }
      if (url.includes('/motion/stop') || url.includes('/chaser/stop')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route('**/chaser_setup.php?slot=4**', async route => {
      savedBodies.push(route.request().postData() || '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await openDmxPage(page, 'dmx_chaser.html');
    await injectChaserCompactSetup(page);

    const state = await page.evaluate(async () => {
      baseUrlEl.value = 'http://127.0.0.1:18991/';
      Object.keys(participating).forEach(k => participating[k] = false);
      participating['101:11'] = true;
      steps = [makeStep('A', { '101:11': 10 }), makeStep('B', { '101:11': 20 })];
      document.getElementById('browserPlayMode').value = 'ping_pong';
      document.getElementById('browserDirection').value = 'reverse';
      syncPicoPlaybackControlsFromBrowser();
      await uploadCurrentChaseToSlot(4, false);
      await new Promise(resolve => setTimeout(resolve, 50));
      return document.querySelectorAll('#chaserSlotStrip > div')[4]?.innerText || '';
    });

    expect(savedBodies[0]).toContain('MODE ping_pong');
    expect(savedBodies[0]).toContain('DIR reverse');
    expect(state).toContain('Loop on');
    expect(state).toContain('Reverse');
    expect(state).toContain('Ping Pong on');
  });
});

