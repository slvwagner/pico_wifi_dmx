const { defineConfig } = require('@playwright/test');
const { loadPathConfig } = require('./tests/ui/helpers/pathconfig');

const pathConfig = loadPathConfig();

module.exports = defineConfig({
  testDir: './tests/ui',
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: pathConfig.xamppBaseUrl,
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1100 },
    actionTimeout: 10000
  }
});
