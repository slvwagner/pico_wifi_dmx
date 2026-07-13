const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Pico Performance Test established rules', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://127.0.0.1:18992/status.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, dmx: { running: true, channels: 512, frame_count: 1234 } })
    }));
    await page.route('http://127.0.0.1:18992/logs.txt', route => route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: [
        'Core0 perf: samples=200 work_us mean=109 peak=271 slack_us mean=9890 min=9729 late=0 peak_late=0',
        'Core0 dmx: frames=499 skipped=1 prime_timeouts=0 frame_timeouts=1 resyncs=1',
        'Core1 perf: samples=1 work_us mean=1203 peak=1203 slack_us mean=1997463 min=1997463 late=0 peak_late=0',
        'Core1 http: calls=2 work_us mean=130 peak=138'
      ].join('\n')
    }));
    await page.route('http://127.0.0.1:18992/perf/status.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        memory: { free_ram_bytes: 98304 },
        core0: { valid: true, period_us: 10000, target_hz: 100, samples: 200, work_us: { mean: 109, peak: 271 }, slack_us: { mean: 9890, min: 9729 }, late: { count: 0, peak_us: 0 }, headroom_percent: 97 },
        core1: { valid: true, period_us: 2000000, samples: 1, work_us: { mean: 1203, peak: 1203 }, slack_us: { mean: 1997463, min: 1997463 }, late: { count: 0, peak_us: 0 } },
        http: { valid: true, calls: 2, work_us: { mean: 130, peak: 138 } },
        dmx: { running: true, channels: 512, refresh_rate: 40, frame_count: 499, skipped_callbacks: 1, prime_timeouts: 0, frame_timeouts: 1, auto_resyncs: 1 }
      })
    }));
    await page.route('http://127.0.0.1:18992/dmx/b**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"ok":true}'
    }));
    await page.route('http://127.0.0.1:18992/dmx/set/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"ok":true}'
    }));
    const values = Array.from({ length: 512 }, () => 73);
    await page.route('http://127.0.0.1:18992/dmx/output.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, channels: 512, frame_count: 1235, values })
    }));
    await page.route('http://127.0.0.1:18992/dmx/base', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(values)
    }));
  });

  test('checks Pico logs and buffer readback from the configured base URL', async ({ page }) => {
    await openDmxPage(page, 'test/');
    await expect(page.locator('header h1')).toContainText('Pico Performance Test');

    await page.locator('#baseUrl').fill('http://127.0.0.1:18992/');
    await page.locator('#btnCheckPico').click();
    await expect(page.locator('#checkMemory .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkMemory .check-detail')).toContainText('96 KB');
    await expect(page.locator('#checkHeadroom .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkHeadroom .check-detail')).toContainText('9729us');
    await expect(page.locator('#checkCore1Headroom .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkCore1Headroom .check-detail')).toContainText('1997463us');
    await expect(page.locator('#checkCore0 .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkCore1 .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkHttp .check-detail')).toContainText('peak 138us');
    await expect(page.locator('#timingHistoryBody tr')).toHaveCount(1);
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('Minimum 9729us left before missing the 10ms update budget');
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('97% of 10ms left');
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('Minimum 1997463us left before missing the Core1 service budget');
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('138us');

    await page.locator('#btnBufferReadback').click();
    await expect(page.locator('#checkBuffer .check-state')).toHaveText('Pass');
    await expect(page.locator('#bufferResult')).toContainText('512 channels from 1');
  });

  test('full test keeps write checks useful when old firmware blocks logs or base readback', async ({ page }) => {
    await page.route('http://127.0.0.1:18992/logs.txt', route => route.fulfill({
      status: 500,
      contentType: 'text/plain',
      body: 'logs unavailable'
    }));
    await page.route('http://127.0.0.1:18992/perf/status.json', route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: '{"ok":false}'
    }));
    await page.route('http://127.0.0.1:18992/dmx/base', route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: '{"ok":false}'
    }));

    await openDmxPage(page, 'test/');
    await page.locator('#baseUrl').fill('http://127.0.0.1:18992/');
    await page.locator('#chPerReq').fill('16');
    await page.locator('#reqCount').fill('10');
    await page.locator('#btnRunFull').click();

    await expect(page.locator('#btnRunFull')).toBeEnabled();
    await expect(page.locator('#checkStatus .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkCore0 .check-state')).toHaveText('Warn');
    await expect(page.locator('#checkBuffer .check-state')).toHaveText('Warn');
    await expect(page.locator('#checkWrite .check-state')).toHaveText('Pass');
    await expect(page.locator('#timingHistoryBody tr')).toHaveCount(1);
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('WARN');
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('logs unavailable');
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('no base');
  });

  test('runs playback plus palette stress using only temporary empty Pico slots', async ({ page }) => {
    const loadedRequests = [];
    const playbackRequests = [];
    const clearRequests = [];
    const uiStatePosts = [];
    const state = {
      uiState: {},
      chaserSlots: [
        { slot: 0, loaded: true, active: true, step_count: 2 },
        { slot: 1, loaded: false, active: false, step_count: 0 }
      ],
      motionSlots: [
        { slot: 0, loaded: true, active: true, target_count: 8 },
        { slot: 1, loaded: false, active: false, target_count: 0 }
      ]
    };
    await page.route('**/ui_state.php', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        uiStatePosts.push(body);
        state.uiState[body.page] = { ...(state.uiState[body.page] || {}), ...(body.state || {}) };
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, state: state.uiState })
      });
    });
    await page.route('http://127.0.0.1:18992/chaser/slots', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, slots: state.chaserSlots })
    }));
    await page.route('http://127.0.0.1:18992/motion/slots', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, slots: state.motionSlots })
    }));
    await page.route(/http:\/\/127\.0\.0\.1:18992\/(chaser|motion)\/(load|play|start|stop).*/, route => {
      const url = route.request().url();
      if (/\/load\//.test(url)) loadedRequests.push(url);
      if (/\/(play|start)\//.test(url)) playbackRequests.push(url);
      if (url.endsWith('/chaser/load/1')) state.chaserSlots[1] = { ...state.chaserSlots[1], loaded: true, step_count: 2 };
      if (url.endsWith('/motion/load/1')) state.motionSlots[1] = { ...state.motionSlots[1], loaded: true, target_count: 8 };
      if (url.endsWith('/chaser/play/0')) state.chaserSlots[0] = { ...state.chaserSlots[0], active: true };
      if (url.endsWith('/chaser/play/1')) state.chaserSlots[1] = { ...state.chaserSlots[1], active: true };
      if (url.endsWith('/motion/start/0')) state.motionSlots[0] = { ...state.motionSlots[0], active: true };
      if (url.endsWith('/motion/start/1')) state.motionSlots[1] = { ...state.motionSlots[1], active: true };
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"ok":true}'
      });
    });
    await page.route(/http:\/\/127\.0\.0\.1:18992\/(chaser|motion)\/clear\/.*/, route => {
      const url = route.request().url();
      clearRequests.push(url);
      if (url.endsWith('/chaser/clear/1')) state.chaserSlots[1] = { slot: 1, loaded: false, active: false, step_count: 0 };
      if (url.endsWith('/motion/clear/1')) state.motionSlots[1] = { slot: 1, loaded: false, active: false, target_count: 0 };
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route('http://127.0.0.1:18992/dmx/clear', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('http://127.0.0.1:18992/dmx/master/clear', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('http://127.0.0.1:18992/dmx/blackout/clear', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));

    await openDmxPage(page, 'test/');
    await page.locator('#baseUrl').fill('http://127.0.0.1:18992/');
    await page.locator('#btnRunPlaybackPaletteStress').click();

    await expect(page.locator('#btnRunPlaybackPaletteStress')).toBeEnabled({ timeout: 15000 });
    await expect(page.locator('#checkWrite .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkWrite .check-detail')).toContainText('80 palette recalls');
    await expect(page.locator('#checkWrite .check-detail')).toContainText('2 chaser and 2 effect slots');
    await expect(page.locator('#timingHistoryBody tr')).toHaveCount(1);
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('Minimum 9729us left before missing the 10ms update budget');
    expect(loadedRequests).toEqual([
      'http://127.0.0.1:18992/chaser/load/1',
      'http://127.0.0.1:18992/motion/load/1'
    ]);
    expect(playbackRequests).toEqual([
      'http://127.0.0.1:18992/chaser/play/0',
      'http://127.0.0.1:18992/chaser/play/1',
      'http://127.0.0.1:18992/motion/start/0',
      'http://127.0.0.1:18992/motion/start/1'
    ]);
    expect(clearRequests).toEqual([
      'http://127.0.0.1:18992/chaser/clear/1',
      'http://127.0.0.1:18992/motion/clear/1'
    ]);
    expect(uiStatePosts[0]).toMatchObject({
      page: 'performanceTest',
      state: {
        temporaryPlaybackStress: {
          chaserSlots: [1],
          motionSlots: [1]
        }
      }
    });
    expect(uiStatePosts.at(-1)).toEqual({
      page: 'performanceTest',
      state: { temporaryPlaybackStress: null }
    });
  });

  test('clears recorded temporary stress slots before starting a new stress run', async ({ page }) => {
    const clearRequests = [];
    const uiStatePosts = [];
    const state = {
      uiState: {
        performanceTest: {
          temporaryPlaybackStress: {
            chaserSlots: [5],
            motionSlots: [9]
          }
        }
      },
      chaserSlots: [
        { slot: 0, loaded: true, active: true, step_count: 2 },
        { slot: 1, loaded: false, active: false, step_count: 0 }
      ],
      motionSlots: [
        { slot: 0, loaded: true, active: true, target_count: 8 },
        { slot: 1, loaded: false, active: false, target_count: 0 }
      ]
    };
    await page.route('**/ui_state.php', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        uiStatePosts.push(body);
        state.uiState[body.page] = { ...(state.uiState[body.page] || {}), ...(body.state || {}) };
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, exists: true, state: state.uiState })
      });
    });
    await page.route('http://127.0.0.1:18992/chaser/slots', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, slots: state.chaserSlots }) }));
    await page.route('http://127.0.0.1:18992/motion/slots', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, slots: state.motionSlots }) }));
    await page.route(/http:\/\/127\.0\.0\.1:18992\/(chaser|motion)\/clear\/.*/, route => {
      clearRequests.push(route.request().url());
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route(/http:\/\/127\.0\.0\.1:18992\/(chaser|motion)\/(load|play|start|stop).*/, route => {
      const url = route.request().url();
      if (url.endsWith('/chaser/load/1')) state.chaserSlots[1] = { ...state.chaserSlots[1], loaded: true, step_count: 2 };
      if (url.endsWith('/motion/load/1')) state.motionSlots[1] = { ...state.motionSlots[1], loaded: true, target_count: 8 };
      if (url.endsWith('/chaser/play/1')) state.chaserSlots[1] = { ...state.chaserSlots[1], active: true };
      if (url.endsWith('/motion/start/1')) state.motionSlots[1] = { ...state.motionSlots[1], active: true };
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route('http://127.0.0.1:18992/dmx/clear', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('http://127.0.0.1:18992/dmx/master/clear', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
    await page.route('http://127.0.0.1:18992/dmx/blackout/clear', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));

    await openDmxPage(page, 'test/');
    await page.locator('#baseUrl').fill('http://127.0.0.1:18992/');
    await page.locator('#btnRunPlaybackPaletteStress').click();

    await expect(page.locator('#btnRunPlaybackPaletteStress')).toBeEnabled({ timeout: 15000 });
    expect(clearRequests.slice(0, 2)).toEqual([
      'http://127.0.0.1:18992/chaser/clear/5',
      'http://127.0.0.1:18992/motion/clear/9'
    ]);
    expect(uiStatePosts.some(post => post.state?.temporaryPlaybackStress === null)).toBe(true);
    expect(clearRequests.slice(-2)).toEqual([
      'http://127.0.0.1:18992/chaser/clear/1',
      'http://127.0.0.1:18992/motion/clear/1'
    ]);
  });
});
