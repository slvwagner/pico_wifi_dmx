const { test, expect } = require('@playwright/test');
const { openDmxPage } = require('./helpers/dmx-page');

test.describe('Toolbox visual tile rules', () => {
  test('shared visual default normalization strips icons but keeps colors', async ({ page }) => {
    await openDmxPage(page, '');

    const visual = await page.evaluate(() => DmxCommon.normalizeSlotVisualDefault({
      type: 'visual',
      color: '#abcdef',
      image: 'data:image/png;base64,SHOULD_NOT_COPY'
    }, '#225a50'));

    expect(visual).toEqual({ type: 'visual', color: '#abcdef', image: '' });
  });

  test('new scenes inherit default color but not default icon image', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sceneVisualDefault', JSON.stringify({
        type: 'visual',
        color: '#123456',
        image: 'data:image/png;base64,SHOULD_NOT_COPY'
      }));
    });
    await page.goto('index.html?test=' + Date.now());
    const state = await page.evaluate(() => {
      return {
        visual: currentSceneVisualForSave(),
        stored: JSON.parse(localStorage.getItem('sceneVisualDefault'))
      };
    });
    expect(state.visual).toEqual({ type: 'visual', color: '#123456', image: '' });
    expect(state.stored).toEqual({ type: 'visual', color: '#123456', image: '' });
  });

  test('new controller palettes inherit default color but not default icon image', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('paletteVisualDefaults', JSON.stringify({
        color: {
          type: 'visual',
          color: '#234567',
          image: 'data:image/png;base64,SHOULD_NOT_COPY'
        }
      }));
    });
    await openDmxPage(page, '');

    const state = await page.evaluate(() => {
      document.getElementById('paletteScope').value = 'color';
      return {
        visual: currentPaletteVisualForSave(),
        stored: JSON.parse(localStorage.getItem('paletteVisualDefaults')).color
      };
    });

    expect(state.visual).toEqual({ type: 'visual', color: '#234567', image: '' });
    expect(state.stored).toEqual({ type: 'visual', color: '#234567', image: '' });
  });

  test('new chases and chaser palettes inherit default color but not default icon image', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('chaseVisualDefault', JSON.stringify({
        type: 'visual',
        color: '#345678',
        image: 'data:image/png;base64,SHOULD_NOT_COPY'
      }));
      localStorage.setItem('chaserPaletteVisualDefault', JSON.stringify({
        type: 'visual',
        color: '#456789',
        image: 'data:image/png;base64,SHOULD_NOT_COPY'
      }));
    });
    await openDmxPage(page, 'dmx_chaser.html');

    const state = await page.evaluate(() => ({
      chaseVisual: currentChaseVisualForSave(),
      paletteVisual: currentChaserPaletteVisualForSave(),
      storedChase: JSON.parse(localStorage.getItem('chaseVisualDefault')),
      storedPalette: JSON.parse(localStorage.getItem('chaserPaletteVisualDefault'))
    }));

    expect(state.chaseVisual).toEqual({ type: 'visual', color: '#345678', image: '' });
    expect(state.paletteVisual).toEqual({ type: 'visual', color: '#456789', image: '' });
    expect(state.storedChase).toEqual({ type: 'visual', color: '#345678', image: '' });
    expect(state.storedPalette).toEqual({ type: 'visual', color: '#456789', image: '' });
  });

  test('new motion effects inherit default color but not default icon image', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('motionEffectVisualDefault', JSON.stringify({
        type: 'visual',
        color: '#56789a',
        image: 'data:image/png;base64,SHOULD_NOT_COPY'
      }));
    });
    await openDmxPage(page, 'dmx_motion.html');

    const state = await page.evaluate(() => ({
      visual: currentMotionEffectVisualForSave(),
      stored: JSON.parse(localStorage.getItem('motionEffectVisualDefault'))
    }));

    expect(state.visual).toEqual({ type: 'visual', color: '#56789a', image: '' });
    expect(state.stored).toEqual({ type: 'visual', color: '#56789a', image: '' });
  });

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
        labelBackground: labelStyle.backgroundColor,
        labelZIndex: labelStyle.zIndex
      };
    });

    expect(state.visualPosition).toBe('absolute');
    expect(state.visualInset).toEqual(['0px', '0px', '0px', '0px']);
    expect(state.visualBorder).toBe('0px');
    expect(state.visualBackgroundSize).toBe('contain');
    expect(state.visualBackgroundPosition).toBe('50% 0%');
    expect(state.visualPointerEvents).toBe('none');
    expect(state.labelPosition).toBe('relative');
    expect(state.labelAlignSelf).toBe('end');
    expect(state.labelBackground).toBe('rgb(50, 90, 54)');
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
