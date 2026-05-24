const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('iPad layout rules', () => {
  for (const [label, path] of [
    ['Controller', ''],
    ['Chaser', 'dmx_chaser.html'],
    ['Motion', 'dmx_motion.html']
  ]) {
    test(`${label} iPad landscape shares the same draggable toolbox divider`, async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await openDmxPage(page, path);

      const result = await page.evaluate(async () => {
        const rail = document.querySelector('.toolbox-rail');
        const resizer = document.querySelector('.toolbox-rail-resizer');
        localStorage.removeItem('toolboxRailWidth');
        document.documentElement.style.removeProperty('--toolbox-rail-width');
        const before = Math.round(rail.getBoundingClientRect().width);
        const rect = resizer.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        resizer.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: x, clientY: y }));
        window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: x - 80, clientY: y }));
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: x - 80, clientY: y }));
        await new Promise(resolve => setTimeout(resolve, 20));
        return {
          before,
          after: Math.round(rail.getBoundingClientRect().width),
          hitWidth: parseFloat(getComputedStyle(resizer).width),
          visibleWidth: parseFloat(getComputedStyle(resizer, '::after').width),
          saved: parseInt(localStorage.getItem('toolboxRailWidth') || '0', 10)
        };
      });

      expect(result.hitWidth).toBeGreaterThanOrEqual(32);
      expect(result.visibleWidth).toBeGreaterThanOrEqual(6);
      expect(result.after).toBeGreaterThan(result.before + 40);
      expect(result.saved).toBe(result.after);
    });
  }

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
    expect(layout.resizerWidth).toBeGreaterThanOrEqual(32);
    expect(layout.groupsBodyOverflow).toBeLessThanOrEqual(1);
  });

  test('Controller fixture tiles stay inside the control surface after resizing the toolbox rail wide', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openDmxPage(page, '');

    const layout = await page.evaluate(() => {
      document.documentElement.style.setProperty('--toolbox-rail-width', '640px');
      window.dispatchEvent(new Event('resize'));
      const surface = document.getElementById('surface');
      const columns = document.querySelector('.columns');
      const cards = Array.from(document.querySelectorAll('[data-fixture-card]')).slice(0, 4).map(card => {
        const r = card.getBoundingClientRect();
        return {
          width: Math.round(r.width),
          left: Math.round(r.left),
          right: Math.round(r.right),
          overflow: card.scrollWidth - card.clientWidth
        };
      });
      const surfaceRect = surface.getBoundingClientRect();
      return {
        surfaceWidth: Math.round(surfaceRect.width),
        surfaceOverflow: surface.scrollWidth - surface.clientWidth,
        columnsOverflow: columns.scrollWidth - columns.clientWidth,
        cards
      };
    });

    expect(layout.surfaceWidth).toBeLessThan(360);
    expect(layout.surfaceOverflow).toBeLessThanOrEqual(1);
    expect(layout.columnsOverflow).toBeLessThanOrEqual(1);
    for (const card of layout.cards) {
      expect(card.width).toBeLessThanOrEqual(layout.surfaceWidth + 1);
      expect(card.overflow).toBeLessThanOrEqual(1);
    }
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

  test('iPad touch drag scrolls the Group Edit modal even when starting on an XY pad', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: require('./helpers/pathconfig').loadPathConfig().xamppBaseUrl,
      viewport: { width: 768, height: 1024 },
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    try {
      await openDmxPage(page, '');
      await page.evaluate(() => {
        const extra = Array.from({ length: 36 }, (_, i) => ({
          id: 1000 + i,
          type: 'slider8',
          label: 'Modal Scroll Control ' + i,
          channel: 6
        }));
        profiles = [{
          id: 1,
          name: 'iPad Profile',
          mode: 'test',
          channels: 64,
          controls: [
            { id: 11, type: 'slider8', label: 'Dimmer', channel: 1 },
            { id: 12, type: 'panTilt16', label: 'Pan/Tilt', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 },
            ...extra
          ]
        }];
        fixtures = [
          { id: 101, name: 'iPad A', profileId: 1, start: 1 },
          { id: 102, name: 'iPad B', profileId: 1, start: 81 }
        ];
        Object.keys(values).forEach(key => delete values[key]);
        savedGroups = [];
        activeSavedGroupIds.clear();
        sceneFixtureFilterActive = false;
        activeControlScopeKeys.clear();
        fanAffectedKeys.clear();
        drawProfiles();
        drawPatched();
        renderSavedGroupsList();
        drawSurface();
        selectAllFixtures();
        openGroupModal();
      });

      const before = await page.evaluate(() => {
        const body = document.getElementById('groupModalBody');
        const pad = body.querySelector('.xy-pad');
        const rect = pad.getBoundingClientRect();
        return {
          scrollTop: body.scrollTop,
          clientHeight: body.clientHeight,
          scrollHeight: body.scrollHeight,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          touchAction: getComputedStyle(body).touchAction
        };
      });

      expect(before.scrollHeight).toBeGreaterThan(before.clientHeight + 500);
      expect(before.touchAction).toContain('pan-y');

      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: before.x, y: before.y, id: 1 }]
      });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: before.x, y: before.y - i * 55, id: 1 }]
        });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(100);

      const after = await page.evaluate(() => document.getElementById('groupModalBody').scrollTop);
      expect(after).toBeGreaterThan(180);
    } finally {
      await context.close();
    }
  });
});
