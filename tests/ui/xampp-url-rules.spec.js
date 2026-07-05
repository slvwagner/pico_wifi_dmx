const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const appFiles = [
  'web/dmx_fixture_controller.html',
  'web/dmx_show.html',
  'web/dmx_chaser.html',
  'web/dmx_motion.html',
  'web/dmx_gpio.html',
  'web/dmx_monitor.html',
  'web/dmx_benchmark.html',
  'web/assets/dmx-common.js'
];

test('browser app files do not hardcode the XAMPP host URL', () => {
  const violations = [];
  for (const rel of appFiles) {
    const text = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    for (const match of text.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.[0-9.]+)[^'"`\s<)]*/g)) {
      const url = match[0];
      if (/\/dmx(?:-test)?\//.test(url)) {
        violations.push(`${rel}: ${url}`);
      }
    }
  }

  expect(violations).toEqual([]);
});
