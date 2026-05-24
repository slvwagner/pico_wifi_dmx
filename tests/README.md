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
