const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Toolbox visual tile rules', () => {
  test('user visual is rendered as a large borderless centered layer under the tile text', async ({ page }) => {
    await openDmxPage(page, '');

    const state = await page.evaluate(() => {
      const item = {
        visual: {
          type: 'visual',
          color: '#325a36',
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGOSHzRgAAAAABJRU5ErkJggg=='
        }
      };
      const host = document.createElement('div');
      host.innerHTML = `<div class="slot filled" style="${DmxCommon.slotVisualStyle(item)}"><div class="palette-slot-content">${DmxCommon.slotVisualHtml(item)}<span class="palette-slot-name">Palette</span></div></div>`;
      document.body.appendChild(host);

      const visual = host.querySelector('.palette-visual');
      const label = host.querySelector('.palette-slot-name');
      const visualStyle = getComputedStyle(visual);
      const labelStyle = getComputedStyle(label);

      return {
        visualPosition: visualStyle.position,
        visualInset: [visualStyle.top, visualStyle.right, visualStyle.bottom, visualStyle.left],
        visualBorder: visualStyle.borderTopWidth,
        visualBackgroundSize: visualStyle.backgroundSize,
        visualPointerEvents: visualStyle.pointerEvents,
        labelPosition: labelStyle.position,
        labelAlignSelf: labelStyle.alignSelf,
        labelZIndex: labelStyle.zIndex
      };
    });

    expect(state.visualPosition).toBe('absolute');
    expect(state.visualInset).toEqual(['4px', '4px', '4px', '4px']);
    expect(state.visualBorder).toBe('0px');
    expect(state.visualBackgroundSize).toBe('contain');
    expect(state.visualPointerEvents).toBe('none');
    expect(state.labelPosition).toBe('relative');
    expect(state.labelAlignSelf).toBe('end');
    expect(state.labelZIndex).toBe('1');
  });
});
