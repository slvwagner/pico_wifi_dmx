const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Modal visual rules', () => {
  test('shared modal styles and helpers are used by page modals', async ({ page }) => {
    await openDmxPage(page, '');

    const state = await page.evaluate(() => {
      DmxCommon.showModal('paletteVisualModal');
      const overlay = document.getElementById('paletteVisualModal');
      const modal = overlay.querySelector('.modal-card');
      const body = overlay.querySelector('.modal-body');
      const overlayStyle = getComputedStyle(overlay);
      const modalStyle = getComputedStyle(modal);
      const bodyStyle = getComputedStyle(body);
      const openDisplay = overlayStyle.display;
      const overlayZ = overlayStyle.zIndex;
      const modalWidth = modalStyle.width;
      const modalMaxWidth = modalStyle.maxWidth;
      const modalShadow = modalStyle.boxShadow;
      const bodyOverflowY = bodyStyle.overflowY;
      DmxCommon.hideModal('paletteVisualModal');
      return {
        openDisplay,
        closedDisplay: getComputedStyle(overlay).display,
        overlayClass: overlay.className,
        legacyModalCount: overlay.querySelectorAll(':scope > .modal').length,
        headCount: overlay.querySelectorAll('.modal-head').length,
        actionsCount: overlay.querySelectorAll('.modal-actions').length,
        overlayZ,
        modalWidth,
        modalMaxWidth,
        modalShadow,
        bodyOverflowY
      };
    });

    expect(state.openDisplay).toBe('flex');
    expect(state.closedDisplay).toBe('none');
    expect(state.overlayClass).toContain('visual-editor-modal');
    expect(state.legacyModalCount).toBe(0);
    expect(state.headCount).toBe(1);
    expect(state.actionsCount).toBe(1);
    expect(state.overlayZ).toBe('500');
    expect(state.modalMaxWidth).toBe('760px');
    expect(state.modalShadow).not.toBe('none');
    expect(state.bodyOverflowY).toBe('auto');
    expect(parseFloat(state.modalWidth)).toBeLessThanOrEqual(760);
  });

  test('all page modals require an explicit close action and ignore backdrop clicks', async ({ page }) => {
    for (const path of ['', 'dmx_show.html', 'dmx_chaser.html', 'dmx_motion.html', 'dmx_room_plane.html']) {
      await openDmxPage(page, path);
      const results = await page.evaluate(() => [...document.querySelectorAll('.modal-overlay')].map(overlay => {
        DmxCommon.showModal(overlay);
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        const result = {
          id: overlay.id,
          displayAfterBackdropClick: getComputedStyle(overlay).display,
          explicitCloseOnly: overlay.dataset.explicitCloseOnly
        };
        DmxCommon.hideModal(overlay);
        return result;
      }));

      expect(results.length, `${path || 'index.html'} should expose modal overlays`).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.displayAfterBackdropClick, `${path || 'index.html'}#${result.id}`).toBe('flex');
        expect(result.explicitCloseOnly, `${path || 'index.html'}#${result.id}`).toBe('1');
      }
    }
  });
});
