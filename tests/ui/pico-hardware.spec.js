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

describeHardware('Real Pico endpoint and slot behavior', () => {
  test('DMX output endpoint reports live buffer and reflects batch writes', async ({ request }) => {
    const channels = hardware.dmxTestChannels || [1, 2];
    const [a, b] = channels;

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
      'END',
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
});

