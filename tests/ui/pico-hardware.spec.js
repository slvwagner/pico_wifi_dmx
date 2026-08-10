const { test, expect } = require('@playwright/test');
const { loadPathConfig } = require('./helpers/pathconfig');

const config = loadPathConfig();
const hardware = config.hardwareTests || {};
const describeHardware = hardware.enabled && config.picoBaseUrl ? test.describe : test.describe.skip;

function pico(path) {
  return config.picoBaseUrl.replace(/\/+$/, '') + path;
}

async function getJson(request, path) {
  const response = await request.get(pico(path), { timeout: hardware.requestTimeoutMs });
  expect(response.ok(), path).toBe(true);
  return response.json();
}

async function postText(request, path, body) {
  const response = await request.post(pico(path), {
    timeout: hardware.requestTimeoutMs,
    headers: { 'Content-Type': 'text/plain' },
    data: body
  });
  expect(response.ok(), path).toBe(true);
  return response.json();
}

function gpioConfigText(config) {
  const lines = ['ENABLE ' + (config?.enabled === false ? '0' : '1')];
  for (const mapping of config?.mappings || []) {
    const parts = [
      'MAP',
      mapping.pin,
      mapping.pull || 'pullup',
      mapping.trigger || 'falling',
      mapping.action,
      mapping.slot || 0,
      mapping.debounce_ms || 30
    ];
    if (mapping.action === 'chaser_tap' || mapping.action === 'motion_tap') {
      parts.push(mapping.beat_div || 1);
    }
    lines.push(parts.join(' '));
  }
  for (const mapping of config?.adc_mappings || []) {
    lines.push([
      'ADC',
      mapping.pin,
      mapping.action,
      mapping.slot || 0,
      mapping.min_x100,
      mapping.max_x100
    ].join(' '));
  }
  return lines.join('\n') + '\n';
}

async function waitForSlot(request, kind, slot, predicate) {
  const path = kind === 'chaser' ? '/chaser/slots' : '/motion/slots';
  let last = null;
  for (let i = 0; i < 20; i++) {
    const json = await getJson(request, path);
    last = (json.slots || []).find(s => Number(s.slot) === Number(slot));
    if (last && predicate(last, json)) return last;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(kind + ' slot ' + slot + ' did not reach expected state. Last: ' + JSON.stringify(last));
}

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function readOutputValue(request, channel) {
  const output = await getJson(request, '/dmx/output.json');
  expect(output.ok).toBe(true);
  return output.values[channel - 1];
}

async function readPerfStatus(request) {
  const perf = await getJson(request, '/perf/status.json');
  expect(perf.ok).toBe(true);
  expect(perf.core0?.valid, 'Core0 performance snapshot should be available').toBe(true);
  expect(perf.dmx?.frame_interval_us?.samples, 'DMX frame interval telemetry should be available').toBeGreaterThan(0);
  expect(perf.dmx?.doubled_intervals, 'DMX must not report doubled frame intervals').toBe(0);
  return perf;
}

function heavyChaserDemoBody(channelCount = 128, phase = 0) {
  const lines = [
    'LOOP 1',
    'MODE loop',
    'LOOPS 1',
    'DIR forward',
    'SPEED 1.00',
    'STEP 1000 100'
  ];
  for (let ch = 1; ch <= channelCount; ch++) lines.push(`CH ${ch} ${(ch + phase) % 2 ? 255 : 0}`);
  lines.push('STEP 1000 100');
  for (let ch = 1; ch <= channelCount; ch++) lines.push(`CH ${ch} ${(ch + phase) % 2 ? 0 : 255}`);
  lines.push('END');
  return lines.join('\n');
}

function heavyMotionDemoBody(slot = 0) {
  const lines = [
    'FX 1',
    'TYPE 4',
    'BPM 120',
    'AMP1 1.00',
    'AMP2 0.00',
    'SPREAD 360'
  ];
  for (let i = 0; i < 8; i++) lines.push(`TARGET scalar8 1 ${i + 1} 0 0 0 ${(i * 45 + slot * 7) % 360} 0 0`);
  lines.push('END');
  return lines.join('\n');
}

function finiteMotionDemoBody(channel, mode, loops = 1, bpm = 240) {
  return [
    'FX 1',
    // Circle ends at its positive peak, so this catches a stopped effect
    // leaving its last generated value frozen instead of releasing the channel.
    'TYPE 0',
    `MODE ${mode}`,
    `LOOPS ${loops}`,
    `BPM ${bpm}`,
    'AMP1 0.50',
    'AMP2 0.00',
    'SPREAD 0',
    `TARGET scalar8 1 ${channel} 0 0 0 0 0 0`,
    'END'
  ].join('\n');
}

async function getSlots(request, kind) {
  const json = await getJson(request, kind === 'chaser' ? '/chaser/slots' : '/motion/slots');
  return json.slots || [];
}

function emptySlotIndexes(slots) {
  return slots.filter(s => !s.loaded).map(s => Number(s.slot)).filter(Number.isFinite);
}

async function clearTemporaryStressSlots(request, chaserSlots, motionSlots) {
  for (const slot of chaserSlots || []) await getJson(request, '/chaser/clear/' + slot).catch(() => {});
  for (const slot of motionSlots || []) await getJson(request, '/motion/clear/' + slot).catch(() => {});
}

async function startPlaybackWithTemporaryDemoSlots(request) {
  const chaserSnapshot = await getSlots(request, 'chaser');
  const motionSnapshot = await getSlots(request, 'motion');
  const existingChaserSlots = chaserSnapshot.filter(s => s.loaded).map(s => Number(s.slot)).filter(Number.isFinite);
  const existingMotionSlots = motionSnapshot.filter(s => s.loaded).map(s => Number(s.slot)).filter(Number.isFinite);
  const tempChaserSlots = emptySlotIndexes(chaserSnapshot);
  const tempMotionSlots = emptySlotIndexes(motionSnapshot);

  expect(chaserSnapshot.length, 'Expected firmware to report chaser slots').toBeGreaterThan(0);
  expect(motionSnapshot.length, 'Expected firmware to report effect slots').toBeGreaterThan(0);
  expect(
    existingChaserSlots.length + existingMotionSlots.length + tempChaserSlots.length + tempMotionSlots.length,
    'Expected at least one loaded or empty Pico playback slot'
  ).toBeGreaterThan(0);

  for (const slot of tempChaserSlots) {
    await postText(request, '/chaser/load/' + slot, heavyChaserDemoBody(128, slot));
  }
  for (const slot of tempMotionSlots) {
    await postText(request, '/motion/load/' + slot, heavyMotionDemoBody(slot));
  }
  if (tempChaserSlots.length) {
    await waitForSlot(request, 'chaser', tempChaserSlots[tempChaserSlots.length - 1], s => s.loaded && Number(s.step_count) === 2);
  }
  if (tempMotionSlots.length) {
    await waitForSlot(request, 'motion', tempMotionSlots[tempMotionSlots.length - 1], s => s.loaded && Number(s.target_count || 0) === 8);
  }

  const chaserSlots = [...existingChaserSlots, ...tempChaserSlots];
  const motionSlots = [...existingMotionSlots, ...tempMotionSlots];
  for (const slot of chaserSlots) {
    await getJson(request, '/chaser/play/' + slot);
  }
  for (const slot of motionSlots) {
    await getJson(request, '/motion/start/' + slot);
  }
  if (chaserSlots.length) await waitForSlot(request, 'chaser', chaserSlots[chaserSlots.length - 1], s => s.active);
  if (motionSlots.length) await waitForSlot(request, 'motion', motionSlots[motionSlots.length - 1], s => s.active);
  return { chaserSlots, motionSlots, tempChaserSlots, tempMotionSlots };
}

function paletteRecallBody(seed, channelCount = 512) {
  const pairs = [];
  for (let ch = 1; ch <= channelCount; ch++) {
    const value = (seed * 37 + ch * 11) & 0xff;
    pairs.push(`${ch}:${value}`);
  }
  return pairs.join(',');
}

describeHardware('Real Pico endpoint and slot behavior', () => {
  test('GPIO firmware accepts Effects pause controls and all 64 Effects slots', async ({ request }) => {
    const original = await getJson(request, '/gpio/config');
    expect(original.ok).toBe(true);

    try {
      const configured = await postText(request, '/gpio/config', [
        'ENABLE 0',
        'MAP 16 pullup falling motion_pause 40 30',
        'MAP 17 pullup falling motion_resume 40 30',
        'MAP 18 pullup falling motion_pause_toggle 63 30',
        ''
      ].join('\n'));
      expect(configured.ok).toBe(true);

      const readback = await getJson(request, '/gpio/config');
      expect(readback.enabled).toBe(false);
      expect(readback.mappings).toEqual([
        expect.objectContaining({ pin: 16, action: 'motion_pause', slot: 40 }),
        expect.objectContaining({ pin: 17, action: 'motion_resume', slot: 40 }),
        expect.objectContaining({ pin: 18, action: 'motion_pause_toggle', slot: 63 })
      ]);
    } finally {
      const restored = await postText(request, '/gpio/config', gpioConfigText(original));
      expect(restored.ok).toBe(true);
      const restoredReadback = await getJson(request, '/gpio/config');
      expect(restoredReadback.enabled).toBe(original.enabled);
      expect(restoredReadback.mappings).toEqual(original.mappings);
      expect(restoredReadback.adc_mappings).toEqual(original.adc_mappings);
    }
  });

  test('DMX output endpoint reports live buffer and reflects batch writes', async ({ request }) => {
    const channels = hardware.dmxTestChannels || [1, 2];
    const [a, b] = channels;

    await getJson(request, '/chaser/stop');
    await getJson(request, '/motion/stop');
    await getJson(request, '/dmx/clear');
    let output = await getJson(request, '/dmx/output.json');
    expect(output.ok).toBe(true);
    expect(output.channels).toBeGreaterThanOrEqual(512);
    expect(output.values).toHaveLength(512);

    await postText(request, '/dmx/b', `${a}:17,${b}:29`);
    output = await getJson(request, '/dmx/output.json');
    expect(output.values[a - 1]).toBe(17);
    expect(output.values[b - 1]).toBe(29);

    const base = await getJson(request, '/dmx/base.json');
    expect(Array.isArray(base)).toBe(true);
    expect(base.length).toBeGreaterThanOrEqual(512);
  });

  test('Chaser slot upload, play, and stop works on configured test slot', async ({ request }) => {
    const slot = Number(hardware.chaserSlot);
    const body = [
      'LOOP 1',
      'MODE loop',
      'LOOPS 1',
      'DIR forward',
      'SPEED 1.00',
      'STEP 200 0',
      'CH 1 64',
      'STEP 200 0',
      'CH 1 0',
      'END'
    ].join('\n');

    await getJson(request, '/chaser/stop/' + slot);
    await postText(request, '/chaser/load/' + slot, body);
    await waitForSlot(request, 'chaser', slot, s => s.loaded && Number(s.step_count) === 2);

    await getJson(request, '/chaser/play/' + slot);
    await waitForSlot(request, 'chaser', slot, s => s.active);

    await getJson(request, '/chaser/stop/' + slot);
    await waitForSlot(request, 'chaser', slot, s => !s.active);
  });

  test('Chaser Play Slot outputs the first programmed step immediately', async ({ request }) => {
    const slot = Number(hardware.chaserSlot);
    const channel = (hardware.dmxTestChannels || [1])[0];
    const firstValue = 200;
    const body = [
      'LOOP 0',
      'MODE single',
      'LOOPS 1',
      'DIR forward',
      'SPEED 1.00',
      'STEP 3000 100',
      `CH ${channel} ${firstValue}`,
      'END'
    ].join('\n');

    await getJson(request, '/chaser/stop');
    await getJson(request, '/motion/stop');
    await postText(request, '/dmx/b', `${channel}:73`);
    await postText(request, '/chaser/load/' + slot, body);
    await waitForSlot(request, 'chaser', slot, s => s.loaded && Number(s.step_count) === 1);

    try {
      await getJson(request, '/chaser/play/' + slot);
      await waitForSlot(request, 'chaser', slot, s => s.active);
      await sleep(100);
      const firstOutput = await readOutputValue(request, channel);
      expect(firstOutput).toBe(firstValue);
    } finally {
      await getJson(request, '/chaser/stop/' + slot).catch(() => {});
    }
  });

  test('Chaser Play Slot starts moving toward step two without holding step one', async ({ request }) => {
    const slot = Number(hardware.chaserSlot);
    const channel = (hardware.dmxTestChannels || [1])[0];
    const firstValue = 40;
    const secondValue = 200;
    const body = [
      'LOOP 0',
      'MODE single',
      'LOOPS 1',
      'DIR forward',
      'SPEED 1.00',
      'STEP 3000 0',
      `CH ${channel} ${firstValue}`,
      'STEP 1000 100',
      `CH ${channel} ${secondValue}`,
      'END'
    ].join('\n');

    await getJson(request, '/chaser/stop');
    await getJson(request, '/motion/stop');
    await postText(request, '/dmx/b', `${channel}:0`);
    await postText(request, '/chaser/load/' + slot, body);
    await waitForSlot(request, 'chaser', slot, s => s.loaded && Number(s.step_count) === 2);

    try {
      await getJson(request, '/chaser/play/' + slot);
      await waitForSlot(request, 'chaser', slot, s => s.active);
      await sleep(80);
      const movingOutput = await readOutputValue(request, channel);
      expect(movingOutput).toBeGreaterThan(firstValue);
      expect(movingOutput).toBeLessThan(secondValue);
    } finally {
      await getJson(request, '/chaser/stop/' + slot).catch(() => {});
    }
  });

  test('Chaser pause holds the current fade position and resume continues from it', async ({ request }) => {
    const slot = Number(hardware.chaserSlot);
    const channel = (hardware.dmxTestChannels || [1])[0];
    const body = [
      'LOOP 0',
      'MODE single',
      'LOOPS 1',
      'DIR forward',
      'SPEED 1.00',
      'STEP 200 0',
      `CH ${channel} 20`,
      'STEP 2000 100',
      `CH ${channel} 200`,
      'END'
    ].join('\n');

    await getJson(request, '/chaser/stop');
    await getJson(request, '/motion/stop');
    await getJson(request, '/dmx/clear');
    await postText(request, '/chaser/load/' + slot, body);
    await waitForSlot(request, 'chaser', slot, s => s.loaded && Number(s.step_count) === 2);

    await getJson(request, '/chaser/play/' + slot);
    await sleep(650);
    const pausedAt = await readOutputValue(request, channel);
    await getJson(request, '/chaser/pause/' + slot);
    await waitForSlot(request, 'chaser', slot, s => s.paused);
    await sleep(350);
    const held = await readOutputValue(request, channel);
    expect(Math.abs(held - pausedAt)).toBeLessThanOrEqual(4);

    await getJson(request, '/chaser/resume/' + slot);
    await waitForSlot(request, 'chaser', slot, s => s.active);
    await sleep(350);
    const resumed = await readOutputValue(request, channel);
    expect(resumed).toBeGreaterThan(held + 8);

    await getJson(request, '/chaser/stop/' + slot);
  });

  test('Motion slot upload, start, and stop works on configured test slot', async ({ request }) => {
    const slot = Number(hardware.motionSlot);
    const body = [
      'FX 1',
      'TYPE 4',
      'BPM 60',
      'AMP1 0.25',
      'AMP2 0.00',
      'SPREAD 0',
      'TARGET scalar8 1 1 0 0 0 0',
      'END'
    ].join('\n');

    await getJson(request, '/motion/stop/' + slot);
    await postText(request, '/motion/load/' + slot, body);
    await waitForSlot(request, 'motion', slot, s => s.loaded && Number(s.target_count || 0) >= 1);

    await getJson(request, '/motion/start/' + slot);
    await waitForSlot(request, 'motion', slot, s => s.active);

    await getJson(request, '/motion/stop/' + slot);
    await waitForSlot(request, 'motion', slot, s => !s.active);
  });

  test('Pan and Tilt Pulse drive only the selected axis', async ({ request }) => {
    const slot = Number(hardware.motionSlot);
    const channels = hardware.dmxTestChannels || [];
    test.skip(channels.length < 2, 'Two configured DMX test channels are required for Pan/Tilt Pulse');
    const panChannel = Number(channels[0]);
    const tiltChannel = Number(channels[1]);
    const target = (type, positionOffset, direction) => [
      'FX 1',
      `TYPE ${type}`,
      'BPM 60',
      'AMP1 0.25',
      'AMP2 0.25',
      `PULSE_OFFSET ${positionOffset}`,
      `PULSE_DIRECTION ${direction}`,
      'SPREAD 0',
      `TARGET pantilt8 1 ${panChannel} 0 ${tiltChannel} 0 0 0 0`,
      'END'
    ].join('\n');
    const samplePulse = async (type, positionOffset, direction) => {
      await postText(request, '/motion/load/' + slot, target(type, positionOffset, direction));
      await getJson(request, '/motion/start/' + slot);
      await sleep(150);
      const high = await getJson(request, '/dmx/output.json');
      await sleep(500);
      const low = await getJson(request, '/dmx/output.json');
      await getJson(request, '/motion/stop/' + slot);
      return {
        high: { pan: high.values[panChannel - 1], tilt: high.values[tiltChannel - 1] },
        low: { pan: low.values[panChannel - 1], tilt: low.values[tiltChannel - 1] }
      };
    };

    await getJson(request, '/chaser/stop');
    await getJson(request, '/motion/stop');
    await getJson(request, '/dmx/clear');
    await postText(request, '/dmx/b', `${panChannel}:128,${tiltChannel}:128`);
    try {
      const panPulse = await samplePulse(6, 0, -1);
      expect(Math.abs(panPulse.high.pan - 128)).toBeLessThanOrEqual(1);
      expect(panPulse.low.pan).toBeLessThan(128);
      expect(panPulse.high.tilt).toBe(128);
      expect(panPulse.low.tilt).toBe(128);

      const tiltPulse = await samplePulse(7, .25, 1);
      expect(tiltPulse.high.tilt).toBeGreaterThan(tiltPulse.low.tilt);
      expect(tiltPulse.low.tilt).toBeGreaterThan(128);
      expect(tiltPulse.high.pan).toBe(128);
      expect(tiltPulse.low.pan).toBe(128);
    } finally {
      await getJson(request, '/motion/stop/' + slot).catch(() => {});
      await getJson(request, '/motion/clear/' + slot).catch(() => {});
      await getJson(request, '/dmx/clear').catch(() => {});
    }
  });

  test('Motion pause holds the current phase and resume continues from it', async ({ request }) => {
    const slot = Number(hardware.motionSlot);
    const channel = (hardware.dmxTestChannels || [1])[0];
    const body = [
      'FX 1',
      'TYPE 4',
      'BPM 30',
      'AMP1 1.00',
      'AMP2 0.00',
      'SPREAD 0',
      `TARGET scalar8 1 ${channel} 0 0 0 0 0 0`,
      'END'
    ].join('\n');

    await getJson(request, '/chaser/stop');
    await getJson(request, '/motion/stop');
    await getJson(request, '/dmx/clear');
    await postText(request, '/dmx/b', `${channel}:128`);
    await postText(request, '/motion/load/' + slot, body);
    await waitForSlot(request, 'motion', slot, s => s.loaded && Number(s.target_count || 0) >= 1);

    await getJson(request, '/motion/start/' + slot);
    await sleep(300);
    await getJson(request, '/motion/pause/' + slot);
    await waitForSlot(request, 'motion', slot, s => s.paused);
    const pausedAt = await readOutputValue(request, channel);
    await sleep(350);
    const held = await readOutputValue(request, channel);
    expect(Math.abs(held - pausedAt)).toBeLessThanOrEqual(4);

    await getJson(request, '/motion/resume/' + slot);
    await waitForSlot(request, 'motion', slot, s => s.active);
    await expect.poll(
      async () => Math.abs((await readOutputValue(request, channel)) - held),
      { timeout: 1000, intervals: [100] }
    ).toBeGreaterThan(8);

    await getJson(request, '/motion/stop/' + slot);
  });

  test('Motion Single, Loop, and Loop N modes preserve pause phase and stop at their limits', async ({ request }) => {
    const channel = (hardware.dmxTestChannels || [1])[0];
    const slots = await getSlots(request, 'motion');
    const preferredSlot = Number(hardware.motionSlot);
    const slotInfo = slots.find(s => Number(s.slot) === preferredSlot && !s.loaded)
      || slots.find(s => !s.loaded);
    test.skip(!slotInfo, 'No empty Pico motion slot is available for the playback-mode test');
    const slot = Number(slotInfo.slot);
    const base = await getJson(request, '/dmx/base.json');
    const originalValue = Number(base[channel - 1]) || 0;

    await getJson(request, '/chaser/stop');
    await getJson(request, '/motion/stop');
    await postText(request, '/dmx/b', `${channel}:128`);

    try {
      await postText(request, '/motion/load/' + slot, finiteMotionDemoBody(channel, 'single'));
      let state = await waitForSlot(request, 'motion', slot, s => s.loaded && Number(s.mode) === 0);
      expect(Number(state.loop_count)).toBe(1);
      await getJson(request, '/motion/start/' + slot);
      state = await waitForSlot(request, 'motion', slot, s => !s.active && Number(s.completed_loops) === 1);
      expect(Number(state.elapsed_s)).toBeCloseTo(0.25, 1);

      await postText(request, '/motion/load/' + slot, finiteMotionDemoBody(channel, 'loop', 7));
      state = await waitForSlot(request, 'motion', slot, s => s.loaded && Number(s.mode) === 1);
      expect(Number(state.loop_count)).toBe(7);
      await getJson(request, '/motion/start/' + slot);
      await sleep(650);
      state = await waitForSlot(request, 'motion', slot, s => s.active && Number(s.completed_loops) >= 2);
      expect(state.active).toBe(true);
      await getJson(request, '/motion/stop/' + slot);

      await postText(request, '/motion/load/' + slot, finiteMotionDemoBody(channel, 'loop_n', 3));
      state = await waitForSlot(
        request,
        'motion',
        slot,
        s => s.loaded && Number(s.mode) === 2 && Number(s.loop_count) === 3
      );
      await getJson(request, '/motion/start/' + slot);
      await sleep(350);
      await getJson(request, '/motion/pause/' + slot);
      const paused = await waitForSlot(request, 'motion', slot, s => s.paused);
      await sleep(350);
      const held = await waitForSlot(request, 'motion', slot, s => s.paused);
      expect(Math.abs(Number(held.elapsed_s) - Number(paused.elapsed_s))).toBeLessThanOrEqual(0.02);
      expect(Number(held.completed_loops)).toBe(Number(paused.completed_loops));

      await getJson(request, '/motion/resume/' + slot);
      await waitForSlot(request, 'motion', slot, s => s.active);
      state = await waitForSlot(request, 'motion', slot, s => !s.active && Number(s.completed_loops) === 3);
      expect(Number(state.elapsed_s)).toBeCloseTo(0.75, 1);
      await expect.poll(
        () => readOutputValue(request, channel),
        { timeout: 1000, intervals: [50, 100] }
      ).toBe(128);
    } finally {
      await getJson(request, '/motion/stop/' + slot).catch(() => {});
      await getJson(request, '/motion/clear/' + slot).catch(() => {});
      await postText(request, '/dmx/b', `${channel}:${originalValue}`).catch(() => {});
    }
  });

  test('Blackout lock suppresses running motion output on locked channels', async ({ request }) => {
    const slot = Number(hardware.motionSlot);
    const channel = (hardware.dmxTestChannels || [1])[0];
    const body = [
      'FX 1',
      'TYPE 4',
      'BPM 60',
      'AMP1 1.00',
      'AMP2 0.00',
      'SPREAD 0',
      `TARGET scalar8 1 ${channel} 0 0 0 0 0 0`,
      'END'
    ].join('\n');

    await getJson(request, '/motion/stop/' + slot);
    await getJson(request, '/dmx/blackout/clear');
    await postText(request, '/dmx/b', `${channel}:128`);
    await postText(request, '/motion/load/' + slot, body);

    await postText(request, '/dmx/blackout', `${channel}:0`);
    await getJson(request, '/motion/start/' + slot);
    await new Promise(resolve => setTimeout(resolve, 250));

    let output = await getJson(request, '/dmx/output.json');
    expect(output.values[channel - 1]).toBe(0);

    await getJson(request, '/dmx/blackout/clear');
    let unlockedValue = 0;
    for (let i = 0; i < 12; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      output = await getJson(request, '/dmx/output.json');
      unlockedValue = output.values[channel - 1];
      if (unlockedValue !== 0) break;
    }
    expect(unlockedValue).not.toBe(0);

    await getJson(request, '/motion/stop/' + slot);
    await getJson(request, '/dmx/blackout/clear');
  });

  test('Master scale dims output without suppressing running motion output', async ({ request }) => {
    const slot = Number(hardware.motionSlot);
    const channel = (hardware.dmxTestChannels || [1])[0];
    const body = [
      'FX 1',
      'TYPE 4',
      'BPM 120',
      'AMP1 1.00',
      'AMP2 0.00',
      'SPREAD 0',
      `TARGET scalar8 1 ${channel} 0 0 0 0 0 0`,
      'END'
    ].join('\n');

    await getJson(request, '/motion/stop/' + slot);
    await getJson(request, '/dmx/master/clear');
    await getJson(request, '/dmx/blackout/clear');
    await getJson(request, '/dmx/clear');

    await postText(request, '/dmx/b', `${channel}:200`);
    let output = await getJson(request, '/dmx/output.json');
    expect(output.values[channel - 1]).toBe(200);

    await postText(request, '/dmx/master', `${channel}:128`);
    output = await getJson(request, '/dmx/output.json');
    expect(output.values[channel - 1]).toBeGreaterThanOrEqual(99);
    expect(output.values[channel - 1]).toBeLessThanOrEqual(101);

    await getJson(request, '/dmx/master/clear');
    output = await getJson(request, '/dmx/output.json');
    expect(output.values[channel - 1]).toBe(200);

    await postText(request, '/dmx/b', `${channel}:128`);
    await postText(request, '/motion/load/' + slot, body);
    await postText(request, '/dmx/master', `${channel}:128`);
    await getJson(request, '/motion/start/' + slot);

    const samples = [];
    for (let i = 0; i < 8; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      output = await getJson(request, '/dmx/output.json');
      samples.push(output.values[channel - 1]);
    }

    expect(Math.max(...samples)).toBeGreaterThan(20);
    expect(Math.max(...samples)).toBeLessThanOrEqual(128);
    expect(new Set(samples).size).toBeGreaterThan(2);

    await getJson(request, '/motion/stop/' + slot);
    await getJson(request, '/dmx/master/clear');
    await getJson(request, '/dmx/blackout/clear');
  });

  test('Temporary demo chaser and effect slots report maximum 100 Hz headroom impact', async ({ request }) => {
    await getJson(request, '/chaser/stop');
    await getJson(request, '/motion/stop');
    await getJson(request, '/dmx/master/clear');
    await getJson(request, '/dmx/blackout/clear');
    await getJson(request, '/dmx/clear');

    await sleep(2300);
    const idle = await readPerfStatus(request);
    let chaserSlots = [];
    let motionSlots = [];
    let tempChaserSlots = [];
    let tempMotionSlots = [];

    try {
      ({ chaserSlots, motionSlots, tempChaserSlots, tempMotionSlots } = await startPlaybackWithTemporaryDemoSlots(request));

      await sleep(2300);
      const running = await readPerfStatus(request);

      const idleCore0 = idle.core0;
      const runningCore0 = running.core0;
      const detail = [
        `chaser slots ${chaserSlots.length}`,
        `effect slots ${motionSlots.length}`,
        `temporary chaser slots ${tempChaserSlots.length}`,
        `temporary effect slots ${tempMotionSlots.length}`,
        `idle mean ${idleCore0.work_us.mean}us peak ${idleCore0.work_us.peak}us min slack ${idleCore0.slack_us.min}us`,
        `running mean ${runningCore0.work_us.mean}us peak ${runningCore0.work_us.peak}us min slack ${runningCore0.slack_us.min}us`,
        `free RAM ${running.memory?.free_ram_bytes || 0} bytes`
      ].join(' | ');
      console.log('100 Hz temporary-slot demo load: ' + detail);

      expect(runningCore0.late.count, detail).toBe(0);
      expect(runningCore0.slack_us.min, detail).toBeGreaterThan(1000);
      expect(running.memory?.free_ram_bytes || 0, detail).toBeGreaterThan(16 * 1024);
    } finally {
      await getJson(request, '/chaser/stop').catch(() => {});
      await getJson(request, '/motion/stop').catch(() => {});
      await clearTemporaryStressSlots(request, tempChaserSlots, tempMotionSlots);
    }
  });

  test('Palette-style recalls during temporary playback stress keep Core0 and Core1 headroom', async ({ request }) => {
    await getJson(request, '/chaser/stop');
    await getJson(request, '/motion/stop');
    await getJson(request, '/dmx/master/clear');
    await getJson(request, '/dmx/blackout/clear');
    await getJson(request, '/dmx/clear');

    let chaserSlots = [];
    let motionSlots = [];
    let tempChaserSlots = [];
    let tempMotionSlots = [];
    try {
      ({ chaserSlots, motionSlots, tempChaserSlots, tempMotionSlots } = await startPlaybackWithTemporaryDemoSlots(request));
      await sleep(2300);
      const playbackOnly = await readPerfStatus(request);

      const paletteCount = 80;
      for (let i = 0; i < paletteCount; i++) {
        await postText(request, '/dmx/b', paletteRecallBody(i));
        await sleep(25);
      }
      await sleep(300);
      const stressed = await readPerfStatus(request);

      const playbackCore0 = playbackOnly.core0;
      const stressedCore0 = stressed.core0;
      const detail = [
        `chaser slots ${chaserSlots.length}`,
        `effect slots ${motionSlots.length}`,
        `temporary chaser slots ${tempChaserSlots.length}`,
        `temporary effect slots ${tempMotionSlots.length}`,
        `palette recalls ${paletteCount}`,
        `playback mean ${playbackCore0.work_us.mean}us peak ${playbackCore0.work_us.peak}us min slack ${playbackCore0.slack_us.min}us`,
        `stressed mean ${stressedCore0.work_us.mean}us peak ${stressedCore0.work_us.peak}us min slack ${stressedCore0.slack_us.min}us`,
        `core1 min slack ${stressed.core1?.slack_us?.min ?? 'n/a'}us`,
        `http peak ${stressed.http?.work_us?.peak ?? 'n/a'}us`
      ].join(' | ');
      console.log('100 Hz temporary-slot palette recall load: ' + detail);

      expect(stressedCore0.late.count, detail).toBe(0);
      expect(stressedCore0.slack_us.min, detail).toBeGreaterThan(1000);
      expect(stressed.core1?.late?.count || 0, detail).toBe(0);
      expect(stressed.core1?.slack_us?.min || 0, detail).toBeGreaterThan(100000);
      expect(stressed.memory?.free_ram_bytes || 0, detail).toBeGreaterThan(16 * 1024);
    } finally {
      await getJson(request, '/chaser/stop').catch(() => {});
      await getJson(request, '/motion/stop').catch(() => {});
      await clearTemporaryStressSlots(request, tempChaserSlots, tempMotionSlots);
    }
  });
});
