const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/ui',
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: process.env.DMX_TEST_BASE_URL || 'http://localhost/dmx/',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1100 },
    actionTimeout: 10000
  }
});

