const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('GPIO established rules', () => {
  test.beforeEach(async ({ page }) => {
    await openDmxPage(page, 'dmx_gpio.html');
  });

  test('ADC mapping only offers Pico ADC-capable GPIO pins', async ({ page }) => {
    const pins = await page.evaluate(() => {
      mappings = [];
      adcMappings = [];
      document.getElementById('addAdcMapping').click();
      return [...document.querySelectorAll('[data-adc-field="pin"] option')].map(o => ({
        value: Number(o.value),
        text: o.textContent
      }));
    });

    expect(pins.map(p => p.value)).toEqual([26, 27, 28]);
    expect(pins.map(p => p.text)).toEqual(['GPIO26 / ADC0', 'GPIO27 / ADC1', 'GPIO28 / ADC2']);
  });

  test('used pins are marked disabled in other mapping dropdowns', async ({ page }) => {
    const result = await page.evaluate(() => {
      mappings = [
        { pin: 16, pull: 'pullup', trigger: 'falling', action: 'dmx_clear', slot: 0, debounce_ms: 30 },
        { pin: 17, pull: 'pullup', trigger: 'falling', action: 'chaser_toggle', slot: 0, debounce_ms: 30 }
      ];
      adcMappings = [];
      render();
      const select = document.querySelector('[data-idx="1"] [data-field="pin"]');
      const options = [...select.options].map(o => ({ value: Number(o.value), disabled: o.disabled }));
      return {
        values: options.map(o => o.value),
        disabled: options.filter(o => o.disabled).map(o => o.value)
      };
    });

    expect(result.values).not.toEqual(expect.arrayContaining([0, 1, 2, 3, 4, 23, 24, 25]));
    expect(result.disabled).toContain(16);
    expect(result.disabled).not.toContain(17);
  });

  test('loads saved GPIO mappings from the XAMPP server on a fresh browser reload', async ({ page }) => {
    await page.route('**/gpio_setup.php**', async route => {
      if (route.request().method() !== 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          exists: true,
          baseUrl: '',
          enabled: true,
          mappings: [16, 17, 18, 19].map((pin, i) => ({
            pin,
            pull: 'pullup',
            trigger: 'falling',
            action: ['dmx_clear', 'chaser_toggle', 'chaser_pause', 'chaser_pause_toggle'][i],
            slot: 0,
            debounce_ms: 30
          })),
          adcMappings: []
        })
      });
    });
    await page.addInitScript(() => localStorage.removeItem('dmxGPIOConfig'));
    await openDmxPage(page, 'dmx_gpio.html');

    await expect(page.locator('#mappingList [data-idx]')).toHaveCount(4);
    await expect(page.locator('#mappingList .mapping-head strong')).toHaveText([
      'Mapping 1',
      'Mapping 2',
      'Mapping 3',
      'Mapping 4'
    ]);
  });

  test('autosaves edited GPIO mappings so another device reloads the same server setup', async ({ page }) => {
    let saved = {
      ok: true,
      exists: true,
      baseUrl: '',
      enabled: true,
      mappings: [
        { pin: 16, pull: 'pullup', trigger: 'falling', action: 'dmx_clear', slot: 0, debounce_ms: 30 },
        { pin: 17, pull: 'pullup', trigger: 'falling', action: 'chaser_toggle', slot: 0, debounce_ms: 30 }
      ],
      adcMappings: []
    };
    let postCount = 0;

    await page.route('**/gpio_setup.php**', async route => {
      if (route.request().method() === 'POST') {
        postCount += 1;
        const posted = route.request().postDataJSON();
        saved = { ok: true, exists: true, ...posted };
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(saved) });
    });

    await page.addInitScript(() => localStorage.removeItem('dmxGPIOConfig'));
    await openDmxPage(page, 'dmx_gpio.html');
    await expect(page.locator('#mappingList [data-idx]')).toHaveCount(2);

    await page.locator('#addMapping').click();
    await page.locator('#addMapping').click();

    await expect.poll(() => postCount).toBeGreaterThanOrEqual(1);
    expect(saved.mappings.map(m => m.pin)).toEqual([16, 17, 0, 1]);

    await page.addInitScript(() => localStorage.removeItem('dmxGPIOConfig'));
    await openDmxPage(page, 'dmx_gpio.html');

    await expect(page.locator('#mappingList [data-idx]')).toHaveCount(4);
    await expect.poll(async () => page.locator('#mappingList [data-field="pin"]').evaluateAll(items => items.map(item => item.value)))
      .toEqual(['16', '17', '0', '1']);
  });

  test('iPad layout keeps all GPIO mapping tiles reachable without horizontal overflow', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('dmxGPIOConfig', JSON.stringify({
        baseUrl: '',
        enabled: true,
        mappings: [16, 17, 18, 19].map((pin, i) => ({
          pin,
          pull: 'pullup',
          trigger: 'falling',
          action: ['dmx_clear', 'chaser_toggle', 'chaser_pause', 'chaser_pause_toggle'][i],
          slot: 0,
          debounce_ms: 30
        })),
        adcMappings: []
      }));
    });
    for (const viewport of [
      { width: 768, height: 1024 },
      { width: 390, height: 844 }
    ]) {
      await page.setViewportSize(viewport);
      await openDmxPage(page, 'dmx_gpio.html');

      const layout = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#mappingList [data-idx]')].map(card => {
          const rect = card.getBoundingClientRect();
          return {
            title: card.querySelector('strong')?.textContent,
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width)
          };
        });
        return {
          cards,
          pageOverflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
          listOverflowX: document.getElementById('mappingList').scrollWidth - document.getElementById('mappingList').clientWidth,
          viewportWidth: window.innerWidth
        };
      });

      expect(layout.cards).toHaveLength(4);
      expect(layout.cards.map(card => card.title)).toEqual(['Mapping 1', 'Mapping 2', 'Mapping 3', 'Mapping 4']);
      expect(layout.pageOverflowX).toBeLessThanOrEqual(1);
      expect(layout.listOverflowX).toBeLessThanOrEqual(1);
      layout.cards.forEach(card => expect(card.width).toBeLessThanOrEqual(layout.viewportWidth - 40));
    }
  });
});
