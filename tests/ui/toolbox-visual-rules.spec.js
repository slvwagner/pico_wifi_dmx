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
        visualBackgroundPosition: visualStyle.backgroundPosition,
        visualPointerEvents: visualStyle.pointerEvents,
        labelPosition: labelStyle.position,
        labelAlignSelf: labelStyle.alignSelf,
        labelZIndex: labelStyle.zIndex
      };
    });

    expect(state.visualPosition).toBe('absolute');
    expect(state.visualInset).toEqual(['4px', '4px', '16px', '4px']);
    expect(state.visualBorder).toBe('0px');
    expect(state.visualBackgroundSize).toBe('contain');
    expect(state.visualBackgroundPosition).toBe('50% 0%');
    expect(state.visualPointerEvents).toBe('none');
    expect(state.labelPosition).toBe('relative');
    expect(state.labelAlignSelf).toBe('end');
    expect(state.labelZIndex).toBe('1');
  });

  test('filled tile highlight remains visible when the user set a custom color', async ({ page }) => {
    await openDmxPage(page, '');

    const state = await page.evaluate(() => {
      const host = document.createElement('div');
      const red = { visual: { type: 'visual', color: '#b91c1c', image: '' } };
      host.innerHTML = `<div class="slot filled active" style="${DmxCommon.slotVisualStyle(red)}"><div class="palette-slot-content"><span class="palette-slot-name">Red Scene</span></div></div>`;
      document.body.appendChild(host);
      const tile = host.querySelector('.slot');
      const tileStyle = getComputedStyle(tile);
      const overlayStyle = getComputedStyle(tile, '::after');
      const actionColor = tileStyle.getPropertyValue('--slot-action-color').trim();
      return {
        background: tileStyle.backgroundColor,
        actionColor,
        boxShadow: tileStyle.boxShadow,
        overlayOpacity: overlayStyle.opacity,
        overlayBackground: overlayStyle.backgroundColor
      };
    });

    expect(state.background).toBe('rgb(185, 28, 28)');
    expect(state.actionColor).toBe('#01ffe6');
    expect(state.boxShadow).not.toBe('none');
    expect(Number(state.overlayOpacity)).toBeGreaterThan(0);
    expect(state.overlayBackground).toBe('rgba(255, 255, 255, 0.18)');
  });

  test('filled tile highlight darkens light user colors for contrast', async ({ page }) => {
    await openDmxPage(page, '');

    const state = await page.evaluate(() => {
      const host = document.createElement('div');
      const light = { visual: { type: 'visual', color: '#f8fafc', image: '' } };
      host.innerHTML = `<div class="slot filled active" style="${DmxCommon.slotVisualStyle(light)}">${DmxCommon.slotVisualButtonHtml('data-test-visual', '1', 'Edit tile')}<button class="slot-del" title="Delete">×</button><div class="palette-slot-content"><span class="palette-slot-name">Light Scene</span></div></div>`;
      document.body.appendChild(host);
      const tile = host.querySelector('.slot');
      const visualButton = host.querySelector('.slot-visual-btn');
      const deleteButton = host.querySelector('.slot-del');
      const tileStyle = getComputedStyle(tile);
      const visualButtonStyle = getComputedStyle(visualButton);
      const deleteButtonStyle = getComputedStyle(deleteButton);
      const overlayStyle = getComputedStyle(tile, '::after');
      return {
        background: tileStyle.backgroundColor,
        color: tileStyle.color,
        actionColor: tileStyle.getPropertyValue('--slot-action-color').trim(),
        visualButtonColor: visualButtonStyle.color,
        deleteButtonColor: deleteButtonStyle.color,
        boxShadow: tileStyle.boxShadow,
        overlayOpacity: overlayStyle.opacity,
        overlayBackground: overlayStyle.backgroundColor
      };
    });

    expect(state.background).toBe('rgb(248, 250, 252)');
    expect(state.color).toBe('rgb(6, 17, 14)');
    expect(state.actionColor).toBe('#06110e');
    expect(state.visualButtonColor).toBe('rgb(6, 17, 14)');
    expect(state.deleteButtonColor).toBe('rgb(6, 17, 14)');
    expect(state.boxShadow).not.toBe('none');
    expect(Number(state.overlayOpacity)).toBeGreaterThan(0);
    expect(state.overlayBackground).toBe('rgba(0, 0, 0, 0.28)');
  });
});
