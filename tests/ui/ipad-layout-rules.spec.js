const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');
const { loadPathConfig } = require('./helpers/pathconfig');

async function touchDrag(context, page, x, y, deltaY) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }]
  });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y + (deltaY * i / 8), id: 1 }]
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
}

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

  test('iPad toolbox reorder uses pointer dragging instead of native browser drag', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openDmxPage(page, 'dmx_chaser.html');

    const result = await page.evaluate(async () => {
      const rail = document.querySelector('.toolbox-rail');
      const boxes = () => [...rail.querySelectorAll('.scene-toolbox[data-toolbox-type]')];
      const first = boxes()[0];
      const second = boxes()[1];
      const header = first.querySelector('.scene-toolbox__header');
      const start = header.getBoundingClientRect();
      const target = second.getBoundingClientRect();
      const nativeDragPrevented = (() => {
        const ev = new DragEvent('dragstart', { bubbles: true, cancelable: true });
        header.dispatchEvent(ev);
        return ev.defaultPrevented;
      })();
      header.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 31,
        pointerType: 'touch',
        clientX: start.left + start.width / 2,
        clientY: start.top + start.height / 2
      }));
      rail.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 31,
        pointerType: 'touch',
        clientX: target.left + target.width / 2,
        clientY: target.bottom - 4
      }));
      rail.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 31,
        pointerType: 'touch',
        clientX: target.left + target.width / 2,
        clientY: target.bottom - 4
      }));
      await new Promise(resolve => setTimeout(resolve, 20));
      return {
        nativeDragPrevented,
        headerDraggable: header.draggable,
        before: first.dataset.toolboxType,
        order: boxes().map(box => box.dataset.toolboxType),
        saved: JSON.parse(localStorage.getItem('toolboxRailOrder') || '[]')
      };
    });

    expect(result.nativeDragPrevented).toBe(true);
    expect(result.headerDraggable).toBe(false);
    expect(result.order[1]).toBe(result.before);
    expect(result.saved[1]).toBe(result.before);
  });

  test('toolbox divider stays visible while the toolbox rail is scrolled', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openDmxPage(page, 'dmx_chaser.html');

    const layout = await page.evaluate(async () => {
      const rail = document.querySelector('.toolbox-rail');
      const resizer = document.querySelector('.toolbox-rail-resizer');
      const stepsBox = document.getElementById('stepsBox');
      if (stepsBox) stepsBox.style.height = '900px';
      rail.scrollTop = 600;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const railRect = rail.getBoundingClientRect();
      const resizerRect = resizer.getBoundingClientRect();
      const lineWidth = parseFloat(getComputedStyle(resizer, '::after').width);
      return {
        railScrollTop: rail.scrollTop,
        railLeft: Math.round(railRect.left),
        resizerTop: Math.round(resizerRect.top),
        resizerBottom: Math.round(resizerRect.bottom),
        resizerLeft: Math.round(resizerRect.left),
        resizerRight: Math.round(resizerRect.right),
        lineWidth
      };
    });

    expect(layout.railScrollTop).toBeGreaterThan(100);
    expect(layout.resizerTop).toBe(0);
    expect(layout.resizerBottom).toBe(768);
    expect(layout.resizerLeft).toBeLessThan(layout.railLeft);
    expect(layout.resizerRight).toBeGreaterThan(layout.railLeft);
    expect(layout.lineWidth).toBeGreaterThanOrEqual(6);
  });

  test('Controller fixture tiles keep a usable layout after resizing the toolbox rail wide', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openDmxPage(page, '');

    const layout = await page.evaluate(async () => {
      await new Promise(resolve => setTimeout(resolve, 250));
      const resizer = document.querySelector('.toolbox-rail-resizer');
      const rect = resizer.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      resizer.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 10, pointerType: 'touch', clientX: x, clientY: y }));
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 10, pointerType: 'touch', clientX: 20, clientY: y }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 10, pointerType: 'touch', clientX: 20, clientY: y }));
      await new Promise(resolve => setTimeout(resolve, 220));
      const surface = document.getElementById('surface');
      const columns = document.querySelector('.columns');
      const rail = document.querySelector('.toolbox-rail');
      const cards = Array.from(document.querySelectorAll('[data-fixture-card]')).slice(0, 4).map(card => {
        const r = card.getBoundingClientRect();
        const actions = card.querySelector('.fixture-actions');
        const readout = card.querySelector('.readout');
        const xyPad = card.querySelector('.xy-pad');
        const xyRect = xyPad?.getBoundingClientRect();
        return {
          width: Math.round(r.width),
          left: Math.round(r.left),
          right: Math.round(r.right),
          overflow: card.scrollWidth - card.clientWidth,
          actionOverflow: actions ? actions.scrollWidth - actions.clientWidth : 0,
          readoutLines: readout ? Math.round(readout.getBoundingClientRect().height / parseFloat(getComputedStyle(readout).lineHeight || '1')) : 0,
          xyWidth: xyRect ? Math.round(xyRect.width) : 0,
          xyHeight: xyRect ? Math.round(xyRect.height) : 0
        };
      });
      const surfaceRect = surface.getBoundingClientRect();
      return {
        railWidth: Math.round(rail.getBoundingClientRect().width),
        mainWidth: Math.round(document.querySelector('main').getBoundingClientRect().width),
        surfaceWidth: Math.round(surfaceRect.width),
        surfaceOverflow: surface.scrollWidth - surface.clientWidth,
        columnsOverflow: columns.scrollWidth - columns.clientWidth,
        cards
      };
    });

    expect(layout.railWidth).toBeLessThanOrEqual(564);
    expect(layout.mainWidth).toBeGreaterThanOrEqual(460);
    expect(layout.surfaceWidth).toBeGreaterThanOrEqual(360);
    expect(layout.surfaceOverflow).toBeLessThanOrEqual(1);
    expect(layout.columnsOverflow).toBeLessThanOrEqual(1);
    for (const card of layout.cards) {
      expect(card.width).toBeLessThanOrEqual(layout.surfaceWidth + 1);
      expect(card.overflow).toBeLessThanOrEqual(1);
      expect(card.actionOverflow).toBeLessThanOrEqual(1);
      expect(card.readoutLines).toBeLessThanOrEqual(1);
      if (card.xyWidth) {
        expect(card.xyWidth).toBeLessThanOrEqual(card.width - 30);
        expect(card.xyHeight).toBeGreaterThan(150);
        expect(card.xyHeight).toBeLessThan(260);
        expect(card.xyWidth / card.xyHeight).toBeCloseTo(1.55, 1);
      }
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

  test('iPad bottom toolbox rail scrolls the full last toolbox without nested body clipping', async ({ page }) => {
    for (const cfg of [
      { label: 'Controller', path: '' },
      { label: 'Chaser', path: 'dmx_chaser.html' },
      { label: 'Motion', path: 'dmx_motion.html' }
    ]) {
      await page.setViewportSize({ width: 768, height: 1024 });
      await openDmxPage(page, cfg.path);
      const layout = await page.evaluate(async label => {
        const rail = document.querySelector('.toolbox-rail');
        document.querySelectorAll('.toolbox-rail .scene-toolbox.collapsed .scene-toolbox__toggle').forEach(btn => btn.click());
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const boxes = Array.from(rail.querySelectorAll('.scene-toolbox')).filter(box => getComputedStyle(box).display !== 'none');
        const last = boxes[boxes.length - 1];
        const body = last.querySelector('.scene-toolbox__body');
        rail.scrollTop = Math.max(0, last.offsetTop - 24);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const railRectAtTop = rail.getBoundingClientRect();
        const lastRectAtTop = last.getBoundingClientRect();
        const firstChild = body?.firstElementChild;
        const firstChildRect = firstChild?.getBoundingClientRect();
        rail.scrollTop = rail.scrollHeight;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const railRect = rail.getBoundingClientRect();
        const lastRect = last.getBoundingClientRect();
        const lastChild = body?.lastElementChild;
        const lastChildRect = lastChild?.getBoundingClientRect();
        return {
          label,
          lastId: last.id,
          railTopAtStart: Math.round(railRectAtTop.top),
          lastTopAtStart: Math.round(lastRectAtTop.top),
          firstChildTopAtStart: firstChildRect ? Math.round(firstChildRect.top) : null,
          firstChildBottomAtStart: firstChildRect ? Math.round(firstChildRect.bottom) : null,
          railTop: Math.round(railRect.top),
          railBottom: Math.round(railRect.bottom),
          railHeight: Math.round(railRect.height),
          lastTop: Math.round(lastRect.top),
          lastBottom: Math.round(lastRect.bottom),
          lastHeight: Math.round(lastRect.height),
          lastChildTop: lastChildRect ? Math.round(lastChildRect.top) : null,
          lastChildBottom: lastChildRect ? Math.round(lastChildRect.bottom) : null,
          lastBodyOverflowY: getComputedStyle(body).overflowY
        };
      }, cfg.label);

      expect(layout.lastTopAtStart, layout.label + ' ' + layout.lastId).toBeGreaterThanOrEqual(layout.railTopAtStart + 18);
      expect(layout.firstChildBottomAtStart, layout.label + ' ' + layout.lastId).toBeGreaterThan(layout.railTopAtStart);
      expect(layout.lastChildTop, layout.label + ' ' + layout.lastId).toBeLessThan(layout.railBottom);
      expect(layout.lastChildBottom, layout.label + ' ' + layout.lastId).toBeLessThanOrEqual(layout.railBottom - 18);
      expect(layout.lastBodyOverflowY, layout.label + ' ' + layout.lastId).toBe('visible');
    }
  });

  test('iPad bottom toolbox rail scrolls expanded last toolbox into view', async ({ page }) => {
    for (const cfg of [
      { label: 'Controller', path: '' },
      { label: 'Chaser', path: 'dmx_chaser.html' },
      { label: 'Motion', path: 'dmx_motion.html' }
    ]) {
      await page.setViewportSize({ width: 768, height: 1024 });
      await openDmxPage(page, cfg.path);
      const layout = await page.evaluate(async label => {
        const rail = document.querySelector('.toolbox-rail');
        const boxes = Array.from(rail.querySelectorAll('.scene-toolbox')).filter(box => getComputedStyle(box).display !== 'none');
        boxes.forEach(box => {
          if (!box.classList.contains('collapsed')) box.querySelector('.scene-toolbox__toggle')?.click();
        });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const last = boxes[boxes.length - 1];
        const toggle = last.querySelector('.scene-toolbox__toggle');
        const before = last.classList.contains('collapsed');
        toggle.click();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const railRect = rail.getBoundingClientRect();
        const lastRect = last.getBoundingClientRect();
        return {
          label,
          lastId: last.id,
          before,
          after: last.classList.contains('collapsed'),
          railTop: Math.round(railRect.top),
          railBottom: Math.round(railRect.bottom),
          lastTop: Math.round(lastRect.top),
          lastBottom: Math.round(lastRect.bottom),
          scrollTop: rail.scrollTop,
          bodyDisplay: getComputedStyle(last.querySelector('.scene-toolbox__body')).display
        };
      }, cfg.label);

      expect(layout.before, layout.label + ' ' + layout.lastId).toBe(true);
      expect(layout.after, layout.label + ' ' + layout.lastId).toBe(false);
      expect(layout.lastTop, layout.label + ' ' + layout.lastId).toBeGreaterThanOrEqual(layout.railTop + 8);
      expect(layout.lastTop, layout.label + ' ' + layout.lastId).toBeLessThanOrEqual(layout.railBottom - 120);
      expect(layout.lastBottom, layout.label + ' ' + layout.lastId).toBeGreaterThan(layout.lastTop + 80);
      expect(layout.bodyDisplay, layout.label + ' ' + layout.lastId).not.toBe('none');
      expect(layout.scrollTop, layout.label + ' ' + layout.lastId).toBeGreaterThan(0);
    }
  });

  test('iPad touch scroll containers keep real bottom scroll space on every toolbox page', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: loadPathConfig().xamppBaseUrl,
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true
    });
    const page = await context.newPage();
    try {
      for (const cfg of [
        { label: 'Controller', path: '' },
        { label: 'Chaser', path: 'dmx_chaser.html' },
        { label: 'Motion', path: 'dmx_motion.html' }
      ]) {
        await openDmxPage(page, cfg.path);
        const layout = await page.evaluate(async label => {
          const rail = document.querySelector('.toolbox-rail');
          const main = document.querySelector('main');
          document.querySelectorAll('.toolbox-rail .scene-toolbox.collapsed .scene-toolbox__toggle').forEach(btn => btn.click());
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          rail.scrollTop = rail.scrollHeight;
          main.scrollTop = main.scrollHeight;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const boxes = Array.from(rail.querySelectorAll('.scene-toolbox')).filter(box => getComputedStyle(box).display !== 'none');
          const last = boxes[boxes.length - 1];
          const railRect = rail.getBoundingClientRect();
          const mainRect = main.getBoundingClientRect();
          const lastRect = last.getBoundingClientRect();
          return {
            label,
            coarse: matchMedia('(pointer:coarse)').matches,
            mainAfterDisplay: getComputedStyle(main, '::after').display,
            mainAfterHeight: parseFloat(getComputedStyle(main, '::after').height),
            railAfterDisplay: getComputedStyle(rail, '::after').display,
            railAfterHeight: parseFloat(getComputedStyle(rail, '::after').height),
            railBottom: Math.round(railRect.bottom),
            lastBottom: Math.round(lastRect.bottom),
            mainBottom: Math.round(mainRect.bottom),
            mainScrollTop: main.scrollTop,
            railScrollTop: rail.scrollTop
          };
        }, cfg.label);

        expect(layout.coarse, cfg.label).toBe(true);
        expect(layout.mainAfterDisplay, cfg.label).toBe('block');
        expect(layout.railAfterDisplay, cfg.label).toBe('block');
        expect(layout.mainAfterHeight, cfg.label).toBeGreaterThanOrEqual(90);
        expect(layout.railAfterHeight, cfg.label).toBeGreaterThanOrEqual(180);
        expect(layout.lastBottom, cfg.label).toBeLessThan(layout.railBottom);
        expect(layout.railScrollTop, cfg.label).toBeGreaterThan(0);
      }
    } finally {
      await context.close();
    }
  });

  test('all pages expose their expected toolboxes in the toolbox rail', async ({ page }) => {
    for (const cfg of [
      {
        path: '',
        rail: 'fixtureToolboxRail',
        boxes: ['groupsBox', 'sceneBox', 'paletteBox', 'fanToolbox']
      },
      {
        path: 'dmx_chaser.html',
        rail: 'chaserToolboxRail',
        boxes: ['chaserGroupsBox', 'chaseBox', 'stepsBox', 'chaserPaletteBox', 'fanToolbox', 'browserPlaybackBox']
      },
      {
        path: 'dmx_motion.html',
        rail: 'motionToolboxRail',
        boxes: ['motionGroupsBox', 'motionEffectBox', 'motionSavedEffectBox', 'motionSceneBox', 'motionPaletteBox']
      }
    ]) {
      await openDmxPage(page, cfg.path);
      const state = await page.evaluate(({ railId, boxIds }) => {
        const rail = document.getElementById(railId);
        return {
          hasRail: !!rail,
          missing: boxIds.filter(id => !document.getElementById(id)),
          outsideRail: boxIds.filter(id => {
            const box = document.getElementById(id);
            return box && rail && !rail.contains(box);
          }),
          toolboxCount: rail ? rail.querySelectorAll('.scene-toolbox').length : 0
        };
      }, { railId: cfg.rail, boxIds: cfg.boxes });

      expect(state.hasRail).toBe(true);
      expect(state.missing).toEqual([]);
      expect(state.outsideRail).toEqual([]);
      expect(state.toolboxCount).toBeGreaterThanOrEqual(cfg.boxes.length);
    }
  });

  test('Controller iPad touch drag scrolls the Group Edit modal even when starting on an XY pad', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: loadPathConfig().xamppBaseUrl,
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

      await touchDrag(context, page, before.x, before.y, -440);

      const after = await page.evaluate(() => document.getElementById('groupModalBody').scrollTop);
      expect(after).toBeGreaterThan(180);
    } finally {
      await context.close();
    }
  });

  test('Chaser iPad touch drag scrolls the Group Edit modal even when starting on an XY pad', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: loadPathConfig().xamppBaseUrl,
      viewport: { width: 768, height: 1024 },
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    try {
      await openDmxPage(page, 'dmx_chaser.html');
      await page.evaluate(() => {
        const controls = [
          { id: 11, type: 'slider8', label: 'Dimmer', channel: 1 },
          { id: 12, type: 'panTilt16', label: 'Pan/Tilt', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 },
          ...Array.from({ length: 30 }, (_, i) => ({ id: 1000 + i, type: 'slider8', label: 'Modal Scroll Control ' + i, channel: 6 }))
        ];
        setup = {
          baseUrl: '',
          profiles: [{ id: 1, name: 'iPad Chaser Profile', mode: 'test', channels: 64, controls }],
          fixtures: [
            { id: 101, name: 'Chaser A', profileId: 1, start: 1 },
            { id: 102, name: 'Chaser B', profileId: 1, start: 81 }
          ],
          values: {}
        };
        steps = [];
        selectedStepIdx = -1;
        activeStepValueKeys = null;
        sourceFixtureId = null;
        participating = {};
        setup.fixtures.forEach(f => controls.forEach(c => participating[controlKey(f, c)] = true));
        chaserGroupsBox.groups.length = 0;
        chaserGroupsBox.clearSelection();
        drawParticipation();
        drawStepList();
        drawStepEditor();
        openChaserGroupModal();
      });

      const before = await page.evaluate(() => {
        const body = document.getElementById('chaserGroupModalBody');
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
      await touchDrag(context, page, before.x, before.y, -440);
      const after = await page.evaluate(() => document.getElementById('chaserGroupModalBody').scrollTop);
      expect(after).toBeGreaterThan(180);
    } finally {
      await context.close();
    }
  });

  test('Motion iPad touch drag scrolls the Group Edit modal even when starting on an XY pad', async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: loadPathConfig().xamppBaseUrl,
      viewport: { width: 768, height: 1024 },
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();
    try {
      await openDmxPage(page, 'dmx_motion.html');
      await page.evaluate(() => {
        const control = { id: 11, type: 'panTilt16', label: 'Pan/Tilt', pan: 1, panFine: 2, tilt: 3, tiltFine: 4 };
        setup = {
          baseUrl: '',
          profiles: [{ id: 1, name: 'iPad Motion Profile', mode: 'test', channels: 8, controls: [control] }],
          fixtures: [
            { id: 101, name: 'Motion A', profileId: 1, start: 1 },
            { id: 102, name: 'Motion B', profileId: 1, start: 21 }
          ],
          values: {}
        };
        motionFixtures = [];
        setup.fixtures.forEach(f => {
          motionFixtures.push({
            fixture: f,
            control,
            kind: motionControlKind(control),
            enabled: true,
            phaseOffset: 0,
            basePan: 32768,
            baseTilt: 32768,
            baseValue: 0
          });
        });
        motionGroupsBox.groups.length = 0;
        motionGroupsBox.clearSelection();
        selectedMotionTargetKey = motionControlKey(control);
        drawFixtureList();
        openMotionGroupModal();
      });

      const before = await page.evaluate(() => {
        const body = document.getElementById('motionGroupModalBody');
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

      expect(before.scrollHeight).toBeGreaterThan(before.clientHeight + 100);
      expect(before.touchAction).toContain('pan-y');
      await touchDrag(context, page, before.x, before.y, -260);
      const after = await page.evaluate(() => document.getElementById('motionGroupModalBody').scrollTop);
      expect(after).toBeGreaterThan(80);
    } finally {
      await context.close();
    }
  });
});
