# Changelog

## 0.9.2 - Unreleased

Changed:

- Working title: Bugfixing.

Fixed:

- Prevented new scenes, palettes, chases, chaser palettes, and motion effects from inheriting old default visual icons; defaults now keep only the background color.
- Serialized scene saves so deleting a scene cannot be overwritten by an earlier pending scene save.
- Clarified Motion FX amplitude controls: scalar targets now show one **Amplitude** slider and force the hidden tilt amplitude to zero for preview and Pico upload.
- Changed Motion FX startup so hard reload resets **Effect target** to **None**, while normal same-tab navigation restores the current working state from session storage; saved server presets now apply only through **Load**, import, or saved Effect recall.

## 0.9.1 - 2026-05-24

Changed:

- Focused this release on Pico performance visibility and release-readiness.

Added:

- Added firmware performance logging for Core0 DMX/playback cycle headroom, Core1 service-loop slack, DMX frame counters, network state, free RAM, and HTTP callback timing.
- Reworked the former Frame Rate Test into the Pico Performance Test with Pico status checks, firmware log parsing, DMX/base buffer readback, the existing write benchmark, and automated UI coverage.
- Added Timing History to the Pico Performance Test so repeated Pico status/timing checks can be compared separately from DMX write history.
- Added release preparation tooling that builds firmware, runs UI tests, copies the UF2 into `release/v<version>/`, and writes a manifest plus SHA256 checksum.
- Added a `-RunHardwareTests` release-script option that initializes the local Pico test config when missing and includes real hardware tests in the release run.
- Added configurable local path setup for XAMPP/script paths.

Fixed:

- Hardened the Pico Performance Test so old firmware readback/log issues show as warnings instead of hiding successful write-test results.
- Added `/dmx/base.json` as a firmware alias for `/dmx/base` and CORS headers for Pico log/base readback endpoints.

## 0.9.0 - Unreleased

Fixed:

- Fixed Group Edit matching across mixed fixture types on Controller, Chaser, and Motion FX pages.
- Fixed wheel/indexed Group Edit matching so same-named wheels with different option lists stay separate.
- Fixed Motion FX Group Edit after hard reload: choosing an Effect Target such as Dimmer now enables compatible cross-fixture editing without enabling playback fixtures.
- Fixed Group Edit modal layout so controls are not clipped and remain vertically scrollable.
- Fixed iPad touch scrolling in Group Edit modals, including drags that start on XY pads.
- Fixed GPIO setup persistence so mappings autosave to the XAMPP server and reload consistently across PC/iPad browsers instead of depending on per-device browser storage.
- Fixed GPIO mapping layout on iPad/mobile widths so all mapping tiles remain reachable without horizontal overflow.
- Added cross-page Group Edit contract tests and iPad toolbox/modal regression tests.

## 0.8.0 - 2026-05-24

- Added the shared Toolboxes sidebar across Controller, Chaser, and Motion FX pages.
- Added user visuals for scenes, palettes, chases, and motion effects.
- Added shared modal styling and Group Edit layout rules.
- Added automated Playwright UI rule tests.
- Added deterministic user manual screenshot generation and dark-mode PDF output.
- Added DMX Buffer Monitor page and GPIO/chaser/motion workflow refinements.
