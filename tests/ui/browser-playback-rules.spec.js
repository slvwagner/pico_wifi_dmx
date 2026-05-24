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
      document.getElementById('loopCheck').checked = false;
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
});

