const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('DMX Buffer Monitor established rules', () => {
  test('reads and clears the selected DMX Output instead of always using the first Pico', async ({ page }) => {
    const requests = [];
    await page.route('**/fixture_setup.php**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        exists: true,
        setup: {
          dmxOutputs: [
            { id: 'front', name: 'Front Pico', universe: 1, baseUrl: 'http://192.0.2.31/' },
            { id: 'rear', name: 'Rear Pico', universe: 2, baseUrl: 'http://192.0.2.32/' }
          ],
          fixtures: []
        }
      })
    }));
    for (const [root, value] of [['http://192.0.2.31', 11], ['http://192.0.2.32', 22]]) {
      await page.route(root + '/dmx/output.json', route => {
        requests.push(route.request().url());
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, channels: 512, frame_count: value, values: [value, ...Array(511).fill(0)] })
        });
      });
      await page.route(root + '/dmx/base.json', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([value, ...Array(511).fill(0)])
      }));
      await page.route(root + '/dmx/clear', route => {
        requests.push(route.request().url());
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      });
    }

    await openDmxPage(page, 'dmx_monitor.html');
    await page.locator('#autoRefresh').uncheck();
    await expect(page.locator('#monitorOutput option')).toHaveText([
      'Front Pico · Universe 1',
      'Rear Pico · Universe 2'
    ]);
    await expect(page.locator('#monitorOutput')).toHaveValue('front');

    await page.locator('#monitorOutput').selectOption('rear');
    await page.locator('#refreshBtn').click();
    await expect(page.locator('.dmx-val').first()).toHaveText('22');
    await expect(page.locator('#frameCount')).toHaveText('22');
    await page.locator('#clearAllBtn').click();

    expect(requests).toContain('http://192.0.2.32/dmx/output.json');
    expect(requests).toContain('http://192.0.2.32/dmx/clear');
    expect(requests).not.toContain('http://192.0.2.31/dmx/clear');
  });

  test('Refresh ms and Refresh Hz stay synchronized both ways', async ({ page }) => {
    await openDmxPage(page, 'dmx_monitor.html');

    await expect(page.locator('#refreshMs')).toHaveValue('50');
    await expect(page.locator('#refreshHz')).toHaveValue('20');

    await page.locator('#refreshMs').fill('250');
    await page.locator('#refreshMs').dispatchEvent('change');
    await expect(page.locator('#refreshHz')).toHaveValue('4');

    await page.locator('#refreshHz').fill('2');
    await page.locator('#refreshHz').dispatchEvent('change');
    await expect(page.locator('#refreshMs')).toHaveValue('500');
  });

  test('Clear all sends the Pico clear command and resets the displayed buffer', async ({ page }) => {
    let clearCalled = false;
    let cleared = false;
    await page.route('**/fixture_setup.php**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        exists: true,
        setup: {
          baseUrl: 'http://192.0.2.24/',
          dmxOutputs: [
            { id: 'monitor-pico', name: 'Monitor Pico', universe: 1, baseUrl: 'http://192.0.2.24/' }
          ],
          profiles: [],
          fixtures: [],
          values: {}
        }
      })
    }));
    await page.route('http://192.0.2.24/status.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ firmware_version: '1.0.1', dmx: { channels: 512, frame_count: 42 } })
    }));
    await page.route('http://192.0.2.24/dmx/output.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        channels: 512,
        frame_count: 42,
        values: cleared ? Array(512).fill(0) : [12, 34, ...Array(510).fill(0)]
      })
    }));
    await page.route('http://192.0.2.24/dmx/clear', route => {
      clearCalled = true;
      cleared = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await openDmxPage(page, 'dmx_monitor.html');
    await expect(page.locator('#baseUrl')).toHaveValue('http://192.0.2.24/');
    await page.locator('#refreshBtn').click();
    await expect(page.locator('.dmx-val').first()).toHaveText('12');

    await page.locator('#clearAllBtn').click();

    await expect(page.locator('.dmx-val').first()).toHaveText('0');
    await expect(page.locator('#changedCount')).toHaveText('0');
    expect(clearCalled).toBe(true);
  });
});
