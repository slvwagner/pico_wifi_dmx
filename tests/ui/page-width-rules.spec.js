const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

const APP_PAGES = [
  '',
  'dmx_show.html',
  'dmx_chaser.html',
  'dmx_motion.html',
  'dmx_gpio.html',
  'dmx_monitor.html',
  'dmx_room_plane.html',
  'dmx_midi_emulator.html',
  'test/'
];

test.describe('Shared page width rules', () => {
  test('every application page uses all width available to its main workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });

    for (const path of APP_PAGES) {
      await openDmxPage(page, path);

      const layout = await page.locator('main').evaluate(element => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const hasToolboxRail = (
          document.body.classList.contains('toolbox-rail-layout')
          || document.body.classList.contains('show-sidebar-active')
        ) && !document.body.classList.contains('toolbox-rail-collapsed');
        return {
          maxWidth: style.maxWidth,
          marginLeft: style.marginLeft,
          marginRight: style.marginRight,
          left: box.left,
          right: box.right,
          width: box.width,
          viewportWidth: window.innerWidth,
          hasToolboxRail
        };
      });

      expect(layout.maxWidth, `${path || 'Controller'} main max-width`).toBe('none');
      expect(layout.marginLeft, `${path || 'Controller'} main left margin`).toBe('0px');
      expect(layout.marginRight, `${path || 'Controller'} main right margin`).toBe('0px');
      expect(layout.left, `${path || 'Controller'} main left edge`).toBeCloseTo(0, 0);
      expect(layout.right, `${path || 'Controller'} main exceeds viewport`).toBeLessThanOrEqual(layout.viewportWidth + 1);

      if (!layout.hasToolboxRail) {
        expect(layout.width, `${path || 'Controller'} main width`).toBeCloseTo(layout.viewportWidth, 0);
      }
    }
  });
});
