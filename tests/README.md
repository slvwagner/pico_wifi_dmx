# Test Structure

This directory contains automated checks for behavior that should not regress while the UI and firmware evolve.

## Directory Layout

```text
tests/
├─ ui/        Browser workflow tests, for example Playwright tests against XAMPP pages
├─ unit/      Pure JavaScript rule tests that do not need a browser
└─ fixtures/  Small deterministic test fixtures used only by tests
```

Use `docs/manual-data/` for the larger manual screenshot baseline. Use `tests/fixtures/` only for compact data that belongs directly to automated tests.

Environment paths are configured in `tests/pathconfig.json`. For machine-specific settings, copy `tests/pathconfig.example.json` to `tests/pathconfig.local.json`; the local file is ignored by Git.

## Implemented Rule Tests

- Controller Group Edit is available when a matching control exists on at least two selected fixtures.
- Mixed fixture selections are allowed; each Group Edit control only edits fixtures that actually have that control.
- Manual fixture selection clears the shared Groups toolbox selection.
- Chaser **All** clears the selected step/edit context but keeps the step list.
- Chaser Group Edit can be available from participating controls without a selected step.
- Chaser **Only** selects one control type without unexpectedly shrinking the fixture scope when no group filter is active.
- Motion FX filters the effect dropdown by the selected target family.
- Motion FX **All** clears group filtering and enables every fixture for the selected target.
- Motion FX **None** disables every visible fixture for the selected target.
- Motion FX group selection filters the fixture matrix.
- Motion FX Group Edit uses the selected effect target and requires two matching participating fixtures.
- GPIO ADC mappings only offer GPIO26, GPIO27, and GPIO28.
- GPIO mapping dropdowns mark reserved or already-used pins unavailable.
- GPIO and Benchmark pages link to the DMX Buffer Monitor.
- Controller wheel/indexed controls reject duplicate DMX option values.
- Controller scene recall clears group selection and filters to involved fixtures.
- Controller palette recall applies only stored values and leaves unrelated values untouched.
- Controller Fan Out symmetric spread calculates around snapshotted base values.
- Chaser **None** clears participating controls, collapses fixtures, and clears groups.
- Chaser **Add step** starts from default/fallback values for selected participating controls.
- Chaser step selection rebuilds the active edit scope from the selected step values.
- Buffer Monitor keeps **Refresh ms** and **Refresh Hz** synchronized.
- Browser Chase Playback sends fade interpolation at the configured update rate.
- Real Pico hardware tests can verify `/dmx/output.json`, `/dmx/base.json`, chaser slot upload/play/stop, and motion slot upload/start/stop when enabled in the path config.

## Running UI Tests

These tests require Node.js and `npm` on PATH. Install the Playwright dependency once:

```powershell
npm install
npx playwright install chromium
```

Run the tests against the XAMPP app:

```powershell
npm run test:ui
```

The default base URL is `http://localhost/dmx/`. Override it when needed:

```powershell
$env:DMX_TEST_BASE_URL = "http://localhost/dmx/"
npm run test:ui
```

## Running Real Pico Tests

Real Pico tests are skipped by default. Enable them only when the Pico is connected and it is safe for the test to write DMX values and overwrite the configured test slots.

```powershell
Copy-Item tests\pathconfig.example.json tests\pathconfig.local.json
```

Edit `tests/pathconfig.local.json`:

```json
{
  "xamppBaseUrl": "http://localhost/dmx/",
  "picoBaseUrl": "http://192.168.0.24/",
  "hardwareTests": {
    "enabled": true,
    "dmxTestChannels": [1, 2],
    "chaserSlot": 31,
    "motionSlot": 63,
    "requestTimeoutMs": 5000
  }
}
```

Then run:

```powershell
npm run test:pico
```

You can also use environment variables for a temporary run:

```powershell
$env:DMX_PICO_BASE_URL = "http://192.168.0.24/"
$env:DMX_RUN_HARDWARE_TESTS = "true"
npm run test:pico
```
