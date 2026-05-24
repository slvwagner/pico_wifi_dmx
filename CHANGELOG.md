# Changelog

## 0.9.1 - Unreleased

Changed:

- Started the 0.9.1 development branch.
- Working title: Pico performance.

Added:

- Planned firmware performance logging for Core0/Core1 cycle headroom.
- Added Core1 HTTP callback timing to the performance log.
- Reworked the former Frame Rate Test into the Pico Performance Test with Pico status checks, firmware log parsing, DMX/base buffer readback, the existing write benchmark, and automated UI coverage.
- Hardened the Pico Performance Test so old firmware readback/log issues show as warnings, and added `/dmx/base.json` as a firmware alias for `/dmx/base`.

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
