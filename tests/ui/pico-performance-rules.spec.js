const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Pico Performance Test established rules', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/VERSION', route => route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: '1.0.1\n'
    }));
    await page.route('**/fixture_setup.php**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        exists: true,
        setup: {
          baseUrl: 'http://127.0.0.1:18992/',
          dmxOutputs: [{ id: 'performance-pico', name: 'Performance Pico', universe: 1, baseUrl: 'http://127.0.0.1:18992/' }],
          profiles: [],
          fixtures: []
        }
      })
    }));
    await page.route('http://127.0.0.1:18992/status.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, firmware_version: '1.0.1', dmx: { running: true, channels: 512, frame_count: 1234 } })
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
        dmx: {
          running: true,
          channels: 512,
          refresh_rate: 43,
          frame_count: 499,
          skipped_callbacks: 1,
          prime_timeouts: 0,
          frame_timeouts: 1,
          auto_resyncs: 1,
          frame_interval_us: { expected: 23255, last: 23270, min: 23240, max: 23290, samples: 498 },
          late_intervals: { tolerance_us: 1000, count: 0, peak_us: 35 },
          doubled_intervals: 0
        }
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
    await expect(page.locator('#connectionTimingPanel + #timingHistoryPanel')).toBeVisible();

    await expect(page.locator('#baseUrl')).toHaveValue('http://127.0.0.1:18992/');
    await page.locator('#btnCheckPico').click();
    await expect(page.locator('#checkFirmwareVersion .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkFirmwareVersion .check-detail')).toContainText('Installed 1.0.1');
    await expect(page.locator('#checkMemory .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkMemory .check-detail')).toContainText('96 KB');
    await expect(page.locator('#checkHeadroom .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkHeadroom .check-detail')).toContainText('9729us');
    await expect(page.locator('#checkCore1Headroom .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkCore1Headroom .check-detail')).toContainText('1997463us');
    await expect(page.locator('#checkCore0 .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkCore1 .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkHttp .check-detail')).toContainText('peak 138us');
    await expect(page.locator('#checkDmxInterval .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkDmxInterval .check-detail')).toContainText('max 23290us');
    await expect(page.locator('#checkDmxInterval .check-detail')).toContainText('doubled 0');
    await expect(page.locator('#timingHistoryBody tr')).toHaveCount(1);
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('Minimum 9729us left before missing the 10ms update budget');
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('97% of 10ms left');
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('Minimum 1997463us left before missing the Core1 service budget');
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('138us');

    await page.locator('#btnBufferReadback').click();
    await expect(page.locator('#checkBuffer .check-state')).toHaveText('Pass');
    await expect(page.locator('#bufferResult')).toContainText('512 channels from 1');
  });

  test('fails clearly when the Pico firmware version does not match the deployed application', async ({ page }) => {
    await page.unroute('http://127.0.0.1:18992/status.json');
    await page.route('http://127.0.0.1:18992/status.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        firmware_version: '1.0.0',
        dmx: { running: true, channels: 512, frame_count: 1234 }
      })
    }));

    await openDmxPage(page, 'test/');
    await page.locator('#btnCheckPico').click();

    await expect(page.locator('#checkFirmwareVersion .check-state')).toHaveText('Fail');
    await expect(page.locator('#checkFirmwareVersion .check-detail')).toContainText('Installed 1.0.0');
    await expect(page.locator('#checkFirmwareVersion .check-detail')).toContainText('expected 1.0.1');
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('FAIL Installed 1.0.0; expected 1.0.1');
  });

  test('fails the DMX interval check when firmware reports a doubled frame gap', async ({ page }) => {
    await page.route('http://127.0.0.1:18992/perf/status.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        memory: { free_ram_bytes: 98304 },
        core0: { valid: true, period_us: 10000, samples: 200, work_us: { mean: 109, peak: 271 }, slack_us: { mean: 9890, min: 9729 }, late: { count: 0, peak_us: 0 }, headroom_percent: 97 },
        core1: { valid: true, period_us: 2000000, samples: 1, work_us: { mean: 1203, peak: 1203 }, slack_us: { mean: 1997463, min: 1997463 }, late: { count: 0, peak_us: 0 } },
        http: { valid: true, calls: 2, work_us: { mean: 130, peak: 138 } },
        dmx: {
          running: true,
          channels: 512,
          refresh_rate: 43,
          frame_count: 499,
          skipped_callbacks: 1,
          prime_timeouts: 0,
          frame_timeouts: 0,
          auto_resyncs: 0,
          frame_interval_us: { expected: 23255, last: 46520, min: 23240, max: 46520, samples: 498 },
          late_intervals: { tolerance_us: 1000, count: 1, peak_us: 23265 },
          doubled_intervals: 1
        }
      })
    }));

    await openDmxPage(page, 'test/');
    await page.locator('#btnCheckPico').click();
    await expect(page.locator('#checkDmxInterval .check-state')).toHaveText('Fail');
    await expect(page.locator('#checkDmxInterval .check-detail')).toContainText('max 46520us');
    await expect(page.locator('#checkDmxInterval .check-detail')).toContainText('doubled 1');
  });

  test('runs the complete performance measurement for every configured Pico', async ({ page }) => {
    const requests = new Map([
      ['http://127.0.0.1:18992/', []],
      ['http://127.0.0.1:18993/', []]
    ]);
    await page.route('**/fixture_setup.php**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        exists: true,
        setup: {
          dmxOutputs: [
            { id: 'front', name: 'Front Pico', universe: 1, baseUrl: 'http://127.0.0.1:18992/' },
            { id: 'pixels', name: 'Pixel Pico', universe: 2, baseUrl: 'http://127.0.0.1:18993/' }
          ],
          profiles: [],
          fixtures: []
        }
      })
    }));
    for (const root of requests.keys()) {
      const values = Array.from({ length: 512 }, () => 73);
      let frame = root.includes('18993') ? 2200 : 1200;
      await page.route(root + '**', route => {
        const url = new URL(route.request().url());
        requests.get(root).push(url.pathname);
        const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname === '/status.json') return json({ ok: true, dmx: { running: true, channels: 512, refresh_rate: 43, frame_count: ++frame } });
        if (url.pathname === '/perf/status.json') return json({
          ok: true,
          memory: { free_ram_bytes: 98304 },
          core0: { valid: true, period_us: 10000, target_hz: 100, samples: 200, work_us: { mean: 109, peak: 271 }, slack_us: { mean: 9890, min: 9729 }, late: { count: 0, peak_us: 0 }, headroom_percent: 97 },
          core1: { valid: true, period_us: 2000000, samples: 1, work_us: { mean: 1203, peak: 1203 }, slack_us: { mean: 1997463, min: 1997463 }, late: { count: 0, peak_us: 0 } },
          http: { valid: true, calls: 2, work_us: { mean: 130, peak: 138 } },
          dmx: { running: true, channels: 512, refresh_rate: 40, frame_count: frame, skipped_callbacks: 1, prime_timeouts: 0, frame_timeouts: 1, auto_resyncs: 1 }
        });
        if (url.pathname === '/dmx/output.json') return json({ ok: true, channels: 512, frame_count: frame, values });
        if (url.pathname === '/dmx/base') return json(values);
        if (url.pathname === '/dmx/b') {
          (route.request().postData() || '').split(',').forEach(pair => {
            const match = pair.match(/^(\d+):(\d+)$/);
            if (match) values[Number(match[1]) - 1] = Number(match[2]);
          });
          return json({ ok: true });
        }
        if (url.pathname.startsWith('/dmx/set/')) return json({ ok: true });
        return json({ ok: true });
      });
    }

    await openDmxPage(page, 'test/');
    await expect(page.locator('#picoTarget option')).toHaveText([
      'All configured Picos (2)',
      'Front Pico · Universe 1',
      'Pixel Pico · Universe 2'
    ]);
    await expect(page.locator('#picoTarget')).toHaveValue('__all__');
    await page.locator('#chPerReq').fill('16');
    await page.locator('#reqCount').fill('1');
    await page.locator('#midiLatencySamples').fill('1');
    await page.locator('#btnRunFull').click();

    await expect(page.locator('#btnRunFull')).toBeEnabled({ timeout: 15000 });
    await expect(page.locator('#timingHistoryBody tr')).toHaveCount(2);
    await expect(page.locator('#timingHistoryBody tr').nth(0)).toContainText('Front Pico');
    await expect(page.locator('#timingHistoryBody tr').nth(0)).toContainText('Universe 1');
    await expect(page.locator('#timingHistoryBody tr').nth(1)).toContainText('Pixel Pico');
    await expect(page.locator('#timingHistoryBody tr').nth(1)).toContainText('Universe 2');
    await expect(page.locator('#historyBody tr')).toHaveCount(2);
    await expect(page.locator('#historyBody tr').nth(0)).toContainText('Front Pico');
    await expect(page.locator('#historyBody tr').nth(1)).toContainText('Pixel Pico');
    for (const paths of requests.values()) {
      expect(paths).toContain('/perf/status.json');
      expect(paths).toContain('/dmx/output.json');
      expect(paths).toContain('/dmx/base');
      expect(paths).toContain('/dmx/b');
    }
  });

  test('Full Test skips and identifies an unavailable configured Pico', async ({ page }) => {
    await page.route('**/fixture_setup.php**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        exists: true,
        setup: {
          dmxOutputs: [
            { id: 'front', name: 'Front Pico', universe: 1, baseUrl: 'http://127.0.0.1:18992/' },
            { id: 'pixels', name: 'Pixel Pico', universe: 2, baseUrl: 'http://127.0.0.1:18993/' }
          ],
          profiles: [],
          fixtures: []
        }
      })
    }));

    let frame = 1200;
    const values = Array.from({ length: 512 }, () => 73);
    await page.route('http://127.0.0.1:18992/**', route => {
      const url = new URL(route.request().url());
      const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if(url.pathname === '/status.json')return json({ ok: true, dmx: { running: true, channels: 512, refresh_rate: 43, frame_count: ++frame } });
      if(url.pathname === '/perf/status.json')return json({
        ok: true,
        memory: { free_ram_bytes: 98304 },
        core0: { valid: true, period_us: 10000, target_hz: 100, samples: 200, work_us: { mean: 109, peak: 271 }, slack_us: { mean: 9890, min: 9729 }, late: { count: 0, peak_us: 0 }, headroom_percent: 97 },
        core1: { valid: true, period_us: 2000000, samples: 1, work_us: { mean: 1203, peak: 1203 }, slack_us: { mean: 1997463, min: 1997463 }, late: { count: 0, peak_us: 0 } },
        http: { valid: true, calls: 2, work_us: { mean: 130, peak: 138 } },
        dmx: { running: true, channels: 512, refresh_rate: 43, frame_count: frame, skipped_callbacks: 0, prime_timeouts: 0, frame_timeouts: 0, auto_resyncs: 0 }
      });
      if(url.pathname === '/dmx/output.json')return json({ ok: true, channels: 512, frame_count: frame, values });
      if(url.pathname === '/dmx/base')return json(values);
      if(url.pathname === '/dmx/b')return json({ ok: true });
      if(url.pathname.startsWith('/dmx/set/'))return json({ ok: true });
      return json({ ok: true });
    });

    const unavailablePaths = [];
    await page.route('http://127.0.0.1:18993/**', route => {
      unavailablePaths.push(new URL(route.request().url()).pathname);
      return route.abort('failed');
    });

    await openDmxPage(page, 'test/');
    await page.locator('#chPerReq').fill('16');
    await page.locator('#reqCount').fill('1');
    await page.locator('#midiLatencySamples').fill('1');
    await page.locator('#btnRunFull').click();

    await expect(page.locator('#btnRunFull')).toBeEnabled({ timeout: 15000 });
    await expect(page.locator('#status')).toContainText('Full test complete on 1 of 2 configured Picos');
    await expect(page.locator('#status')).toContainText('Pixel Pico · Universe 2');
    await expect(page.locator('#checkStatus .check-state')).toHaveText('Warn');
    await expect(page.locator('#historyBody tr')).toHaveCount(1);
    expect(unavailablePaths).not.toContain('/dmx/output.json');
    expect(unavailablePaths).not.toContain('/dmx/b');
  });

  test('uses the show Pico and measures USB or emulated MIDI through a confirmed DMX frame', async ({ page, context }) => {
    await page.addInitScript(() => {
      const input = {
        id: 'launch-control-xl-test',
        name: 'Launch Control XL',
        manufacturer: 'Novation',
        state: 'connected',
        onmidimessage: null,
        open: async () => input
      };
      window.__midiLatencyInput = input;
      window.__emitMidiLatency = data => input.onmidimessage?.({
        data,
        receivedTime: performance.now(),
        target: input
      });
      Object.defineProperty(navigator, 'requestMIDIAccess', {
        configurable: true,
        value: async () => ({
          inputs: new Map([[input.id, input]]),
          outputs: new Map(),
          onstatechange: null
        })
      });
    });

    let frameCount = 1400;
    const outputValues = Array.from({ length: 512 }, () => 73);
    const writes = [];
    await page.unroute('http://127.0.0.1:18992/status.json');
    await page.unroute('http://127.0.0.1:18992/dmx/output.json');
    await page.unroute('http://127.0.0.1:18992/dmx/base');
    await page.unroute('http://127.0.0.1:18992/dmx/b**');
    await page.route('http://127.0.0.1:18992/status.json', route => {
      frameCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, dmx: { running: true, channels: 512, refresh_rate: 43, frame_count: frameCount } })
      });
    });
    await page.route('http://127.0.0.1:18992/dmx/output.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        channels: 512,
        frame_count: frameCount,
        values: outputValues
      })
    }));
    await page.route('http://127.0.0.1:18992/dmx/base', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(outputValues)
    }));
    await page.route('http://127.0.0.1:18992/dmx/b**', route => {
      const body = route.request().postData() || '';
      if (route.request().method() === 'POST') writes.push(body);
      body.split(',').forEach(pair => {
        const match = pair.match(/^(\d+):(\d+)$/);
        if (match && Number(match[1]) >= 1 && Number(match[1]) <= 512) outputValues[Number(match[1]) - 1] = Number(match[2]);
      });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await openDmxPage(page, 'test/');
    await expect(page.locator('#baseUrl')).toHaveValue('http://127.0.0.1:18992/');

    await page.locator('#btnMidiLatencyConnect').click();
    await expect(page.locator('#midiLatencyInput')).toHaveValue('launch-control-xl-test');
    await page.locator('#midiLatencySamples').fill('2');
    await page.locator('#btnMidiLatencyStart').click();
    await expect(page.locator('#midiLatencyStatus')).toContainText('Move a MIDI control');

    await page.evaluate(() => window.__emitMidiLatency([0xb0, 21, 64]));
    await expect(page.locator('#midiLatencyResultsBody tr')).toHaveCount(1);
    await expect(page.locator('#midiLatencyResultsBody tr').first()).toContainText('CC 21');
    await expect(page.locator('#midiLatencyResultsBody tr').first()).toContainText('129');
    await expect(page.locator('#midiLatencyStatus')).toContainText('Move again');

    await page.evaluate(() => window.__emitMidiLatency([0xb0, 21, 100]));
    await expect(page.locator('#midiLatencyResultsBody tr')).toHaveCount(2);
    await expect(page.locator('#midiLatencyStatus')).toContainText('Complete');
    await expect(page.locator('#midiLatencyMedian')).not.toHaveText('—');
    await expect(page.locator('#midiLatencyP95')).not.toHaveText('—');
    await expect(page.locator('#midiLatencyTransportP95')).not.toHaveText('—');
    await expect(page.locator('#btnMidiLatencyStart')).toBeEnabled();
    await expect(page.locator('#checkMidiLatency .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkMidiLatency .check-detail')).toContainText('MIDI-to-POST median');
    expect(writes.slice(0, 2)).toEqual(['512:129', '512:201']);
    expect(writes.at(-1)).toBe('512:73');

    await page.locator('#midiLatencySamples').fill('1');
    await page.locator('#chPerReq').fill('16');
    await page.locator('#reqCount').fill('10');
    await page.locator('#btnRunFull').click();
    await expect(page.locator('#midiLatencyStatus')).toContainText('Ready. Move', { timeout: 10000 });
    await page.evaluate(() => window.__emitMidiLatency([0xb0, 21, 80]));
    await expect(page.locator('#btnRunFull')).toBeEnabled({ timeout: 10000 });
    await expect(page.locator('#checkMidiLatency .check-state')).toHaveText('Pass');
    await expect(page.locator('#timingHistoryBody tr')).toHaveCount(1);
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('POST median');
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('p95');

    const emulator = await context.newPage();
    await emulator.goto(new URL('../dmx_midi_emulator.html?latency=' + Date.now(), page.url()).href);
    await expect(page.locator('#midiLatencyInput option[value="launch-control-xl-emulator"]')).toHaveCount(1);
    await page.locator('#midiLatencyInput').selectOption('launch-control-xl-emulator');
    await page.locator('#midiLatencySamples').fill('1');
    await page.locator('#btnMidiLatencyStart').click();
    await expect(page.locator('#midiLatencyStatus')).toContainText('Ready. Move');
    await emulator.locator('[data-midi-cc="77"]').fill('90');
    await expect(page.locator('#midiLatencyStatus')).toContainText('Complete');
    await expect(page.locator('#checkMidiLatency .check-detail')).toContainText('Launch Control XL Emulator');
    await emulator.close();
  });

  test('Full Test uses the emulator when Web MIDI is unavailable', async ({ page, context }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'requestMIDIAccess', {
        configurable: true,
        value: undefined
      });
    });

    await openDmxPage(page, 'test/');
    await expect(page.locator('#baseUrl')).toHaveValue('http://127.0.0.1:18992/');
    await page.locator('#chPerReq').fill('16');
    await page.locator('#reqCount').fill('1');
    await page.locator('#midiLatencySamples').fill('3');

    let frameCount = 1500;
    const outputValues = Array.from({ length: 512 }, () => 73);
    await page.unroute('http://127.0.0.1:18992/status.json');
    await page.unroute('http://127.0.0.1:18992/dmx/output.json');
    await page.unroute('http://127.0.0.1:18992/dmx/b**');
    await page.route('http://127.0.0.1:18992/status.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, dmx: { running: true, channels: 512, refresh_rate: 43, frame_count: ++frameCount } })
    }));
    await page.route('http://127.0.0.1:18992/dmx/output.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, channels: 512, frame_count: frameCount, values: outputValues })
    }));
    await page.route('http://127.0.0.1:18992/dmx/b**', route => {
      (route.request().postData() || '').split(',').forEach(pair => {
        const match = pair.match(/^(\d+):(\d+)$/);
        if(match)outputValues[Number(match[1])-1]=Number(match[2]);
      });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    const pageCount = context.pages().length;
    await page.locator('#btnRunFull').click();
    await expect(page.locator('#midiLatencyStatus')).toContainText('Complete: 3 samples measured', { timeout: 10000 });
    await expect(page.locator('#midiLatencyEmulatorFrame')).toHaveCount(1);
    expect(context.pages()).toHaveLength(pageCount);
    await expect(page.locator('#btnRunFull')).toBeEnabled({ timeout: 10000 });
    await expect(page.locator('#checkMidiLatency .check-detail')).toContainText('Launch Control XL Emulator');
    await expect(page.locator('#checkMidiLatency .check-detail')).toContainText('3 samples');
    await expect(page.locator('#checkMidiLatency .check-detail')).not.toContainText('Web MIDI is unavailable');

    await page.locator('#btnRunFull').click();
    await expect(page.locator('#midiLatencyStatus')).toContainText('Complete: 3 samples measured', { timeout: 10000 });
    await expect(page.locator('#btnRunFull')).toBeEnabled({ timeout: 10000 });
    await expect(page.locator('#historyBody tr')).toHaveCount(2);
  });

  test('Full Test releases its button when the final Pico refresh stalls', async ({ page }) => {
    await page.addInitScript(() => {
      const appendChild = Element.prototype.appendChild;
      Element.prototype.appendChild = function(child) {
        if(child?.id === 'midiLatencyEmulatorFrame') return child;
        return appendChild.call(this, child);
      };
      Object.defineProperty(navigator, 'requestMIDIAccess', {
        configurable: true,
        value: undefined
      });
    });

    await openDmxPage(page, 'test/');
    await page.evaluate(() => {
      const originalFetchPicoJson = window.fetchPicoJson;
      window.__benchmarkStatusCalls = 0;
      window.fetchPicoJson = path => {
        if(path === '/status.json') {
          window.__benchmarkStatusCalls++;
          if(window.__benchmarkStatusCalls >= 2)return new Promise(() => {});
        }
        return originalFetchPicoJson(path);
      };
    });
    await page.locator('#chPerReq').fill('16');
    await page.locator('#reqCount').fill('1');
    await page.locator('#btnRunFull').click();

    await expect(page.locator('#btnRunFull')).toBeEnabled({ timeout: 12000 });
    expect(await page.evaluate(() => window.__benchmarkStatusCalls)).toBe(2);
  });

  test('full test keeps write checks useful when old firmware blocks logs or base readback', async ({ page }) => {
    await page.addInitScript(() => {
      const appendChild = Element.prototype.appendChild;
      Element.prototype.appendChild = function(child) {
        if(child?.id === 'midiLatencyEmulatorFrame') return child;
        return appendChild.call(this, child);
      };
      Object.defineProperty(navigator, 'requestMIDIAccess', {
        configurable: true,
        value: undefined
      });
    });
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
    await expect(page.locator('#baseUrl')).toHaveValue('http://127.0.0.1:18992/');
    await page.locator('#chPerReq').fill('16');
    await page.locator('#reqCount').fill('10');
    await page.locator('#btnRunFull').click();

    await expect(page.locator('#btnRunFull')).toBeEnabled({ timeout: 10000 });
    await expect(page.locator('#checkStatus .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkCore0 .check-state')).toHaveText('Warn');
    await expect(page.locator('#checkBuffer .check-state')).toHaveText('Warn');
    await expect(page.locator('#checkWrite .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkMidiLatency .check-state')).toHaveText('Warn');
    await expect(page.locator('#checkMidiLatency .check-detail')).toContainText('MIDI phase skipped');
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
    await expect(page.locator('#baseUrl')).toHaveValue('http://127.0.0.1:18992/');
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
    await expect(page.locator('#baseUrl')).toHaveValue('http://127.0.0.1:18992/');
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
