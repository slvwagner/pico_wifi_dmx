const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Modal visual rules', () => {
  test('shared modal styles and helpers are used by page modals', async ({ page }) => {
    await openDmxPage(page, '');

    const state = await page.evaluate(() => {
      DmxCommon.showModal('paletteVisualModal');
      const overlay = document.getElementById('paletteVisualModal');
      const modal = overlay.querySelector('.modal');
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
        overlayZ,
        modalWidth,
        modalMaxWidth,
        modalShadow,
        bodyOverflowY
      };
    });

    expect(state.openDisplay).toBe('flex');
    expect(state.closedDisplay).toBe('none');
    expect(state.overlayZ).toBe('500');
    expect(state.modalMaxWidth).toBe('760px');
    expect(state.modalShadow).not.toBe('none');
    expect(state.bodyOverflowY).toBe('auto');
    expect(parseFloat(state.modalWidth)).toBeLessThanOrEqual(760);
  });
});
