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
});
