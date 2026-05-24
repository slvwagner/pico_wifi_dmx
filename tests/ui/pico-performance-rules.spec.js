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
    await expect(page.locator('#checkCore0 .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkCore1 .check-state')).toHaveText('Pass');
    await expect(page.locator('#checkHttp .check-detail')).toContainText('peak 138us');
    await expect(page.locator('#timingHistoryBody tr')).toHaveCount(1);
    await expect(page.locator('#timingHistoryBody tr').first()).toContainText('9729us');
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
});
