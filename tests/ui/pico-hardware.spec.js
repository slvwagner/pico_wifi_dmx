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

describeHardware('Real Pico endpoint and slot behavior', () => {
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

  test('Chaser pause holds the current fade position and resume continues from it', async ({ request }) => {
    const slot = Number(hardware.chaserSlot);
    const channel = (hardware.dmxTestChannels || [1])[0];
    const body = [
      'LOOP 0',
      'MODE single',
      'LOOPS 1',
      'DIR forward',
      'SPEED 1.00',
      'STEP 2000 100',
      `CH ${channel} 200`,
      'END'
    ].join('\n');

    await getJson(request, '/chaser/stop');
    await getJson(request, '/motion/stop');
    await getJson(request, '/dmx/clear');
    await postText(request, '/chaser/load/' + slot, body);
    await waitForSlot(request, 'chaser', slot, s => s.loaded && Number(s.step_count) === 1);

    await getJson(request, '/chaser/play/' + slot);
    await sleep(450);
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
    const pausedAt = await readOutputValue(request, channel);
    await getJson(request, '/motion/pause/' + slot);
    await waitForSlot(request, 'motion', slot, s => s.paused);
    await sleep(350);
    const held = await readOutputValue(request, channel);
    expect(Math.abs(held - pausedAt)).toBeLessThanOrEqual(4);

    await getJson(request, '/motion/resume/' + slot);
    await waitForSlot(request, 'motion', slot, s => s.active);
    await sleep(300);
    const resumed = await readOutputValue(request, channel);
    expect(Math.abs(resumed - held)).toBeGreaterThan(8);

    await getJson(request, '/motion/stop/' + slot);
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
});
