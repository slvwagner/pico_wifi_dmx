const fs = require('fs');
const path = require('path');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return {};
  }
}

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  return raw ? raw.replace(/\/+$/, '/') : '';
}

function loadPathConfig() {
  const root = path.resolve(__dirname, '..', '..');
  const defaults = readJson(path.join(root, 'pathconfig.json'));
  const local = readJson(path.join(root, 'pathconfig.local.json'));
  const merged = {
    ...defaults,
    ...local,
    hardwareTests: {
      ...(defaults.hardwareTests || {}),
      ...(local.hardwareTests || {})
    }
  };

  if (process.env.DMX_TEST_BASE_URL) merged.xamppBaseUrl = process.env.DMX_TEST_BASE_URL;
  if (process.env.DMX_PICO_BASE_URL) merged.picoBaseUrl = process.env.DMX_PICO_BASE_URL;
  if (process.env.DMX_RUN_HARDWARE_TESTS) {
    merged.hardwareTests = merged.hardwareTests || {};
    merged.hardwareTests.enabled = /^(1|true|yes)$/i.test(process.env.DMX_RUN_HARDWARE_TESTS);
  }

  merged.xamppBaseUrl = normalizeBaseUrl(merged.xamppBaseUrl || 'http://localhost/dmx/');
  merged.picoBaseUrl = normalizeBaseUrl(merged.picoBaseUrl || '');
  merged.hardwareTests = {
    enabled: false,
    dmxTestChannels: [1, 2],
    chaserSlot: 31,
    motionSlot: 63,
    requestTimeoutMs: 5000,
    ...(merged.hardwareTests || {})
  };
  return merged;
}

module.exports = { loadPathConfig };

