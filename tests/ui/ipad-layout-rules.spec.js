const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('iPad layout rules', () => {
  test('iPad landscape keeps the toolbox rail as a right-side workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openDmxPage(page, '');

    const layout = await page.evaluate(() => {
      const rail = document.querySelector('.toolbox-rail');
      const main = document.querySelector('main');
      const resizer = document.querySelector('.toolbox-rail-resizer');
      const railRect = rail.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      return {
        railTop: Math.round(railRect.top),
        railRight: Math.round(window.innerWidth - railRect.right),
        railHeight: Math.round(railRect.height),
        railWidth: Math.round(railRect.width),
        mainWidth: Math.round(mainRect.width),
        resizerDisplay: getComputedStyle(resizer).display,
        resizerWidth: parseFloat(getComputedStyle(resizer).width),
        groupsBodyOverflow: (() => {
          const body = document.querySelector('#groupsBox .scene-toolbox__body');
          return body ? body.scrollWidth - body.clientWidth : 0;
        })()
      };
    });

    expect(layout.railTop).toBe(0);
    expect(layout.railRight).toBe(0);
    expect(layout.railHeight).toBe(768);
    expect(layout.railWidth).toBeGreaterThanOrEqual(360);
    expect(layout.mainWidth).toBeLessThan(1024);
    expect(layout.resizerDisplay).not.toBe('none');
    expect(layout.resizerWidth).toBeGreaterThanOrEqual(20);
    expect(layout.groupsBodyOverflow).toBeLessThanOrEqual(1);
  });

  test('iPad portrait uses the bottom toolbox rail and keeps touch targets finger-sized', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await openDmxPage(page, '');

    const layout = await page.evaluate(() => {
      document.querySelectorAll('.scene-toolbox.collapsed .scene-toolbox__toggle').forEach(btn => btn.click());
      const rail = document.querySelector('.toolbox-rail');
      const main = document.querySelector('main');
      const nav = document.querySelector('a.nav');
      const icon = document.querySelector('.icon-btn');
      const toggle = document.querySelector('.scene-toolbox__toggle');
      const slot = Array.from(document.querySelectorAll('.slot')).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const railRect = rail.getBoundingClientRect();
      const mainStyle = getComputedStyle(main);
      const rect = el => {
        const r = el.getBoundingClientRect();
        return { width: Math.round(r.width), height: Math.round(r.height) };
      };
      return {
        railLeft: Math.round(railRect.left),
        railBottom: Math.round(window.innerHeight - railRect.bottom),
        railWidth: Math.round(railRect.width),
        railHeight: Math.round(railRect.height),
        mainWidth: Math.round(main.getBoundingClientRect().width),
        mainOverflow: mainStyle.overflowY,
        nav: rect(nav),
        icon: rect(icon),
        toggle: rect(toggle),
        slot: rect(slot)
      };
    });

    expect(layout.railLeft).toBe(0);
    expect(layout.railBottom).toBe(0);
    expect(layout.railWidth).toBe(768);
    expect(layout.railHeight).toBeGreaterThan(360);
    expect(layout.mainWidth).toBe(768);
    expect(layout.mainOverflow).toBe('visible');
    [layout.nav, layout.icon, layout.toggle, layout.slot].forEach(target => {
      expect(target.height).toBeGreaterThanOrEqual(44);
    });
  });
});
