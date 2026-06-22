# Changelog

## 0.9.6 - Unreleased

Changed:

- Started the 0.9.6 development branch.
- Added a dedicated Show Run page for operating a show from saved groups, scenes, palettes, and Pico chaser/motion slots while keeping setup editing on the existing pages.
- Added Show Run layout controls, including a movable card matrix plus local Cols/Rows and Move mode for arranging operator-page groups, scenes, palettes, and Pico playback tiles.
- Added a sticky **Edit Layout** toggle on Show Run so all card/tile Move and row/column controls stay hidden during normal show operation.
- Added direct Show Run Pico playback controls for chaser slots and motion slots, including chaser play/pause/resume/speed actions and motion start/BPM actions.
- Added a fixture-library sync script to validate and refresh the bundled catalog from the current XAMPP fixture library.
- The fixture-library sync script now reviews fixture-level differences before updating the bundled catalog, with interactive prompts plus accept-all, keep-existing, and dry-run modes.
- Added direct numeric DMX value inputs for wheel controls on the Controller surface and in Controller Group Edit.
- Extended the manual wheel-option editor syntax so ranges can include OFL-style metadata such as `WheelSlot`, `WheelShake`, `WheelRotation`, slot numbers, and speed labels.
- Added a guided wheel-option editor modal for editing indexed wheel ranges and OFL-style metadata without writing the raw syntax by hand.
- Reworked Fixture Profiles into a single card with compact control type/channel fields and a dedicated Control Details modal for default/blackout, pan/tilt mapping, color, and guided wheel settings.
- Removed the older inline wheel quick-add controls so wheel colors, uploads, drawings, and metadata are handled in the Guided wheel editor table.
- Expanded Controller palette scopes using fixture-library control names, including stronger color matching plus Shutter/Strobe, Gobo, Prism, Optics, and Programs/Effects scopes.
- Fixed Controller UI tests so they no longer write saved groups, scenes, or palettes to the live XAMPP show data, and added a saved-groups backup before empty overwrites.
- Moved the default Playwright UI test target to an isolated XAMPP app folder at `/dmx-test/` so tests do not run against the user's live `/dmx/` show data.
- Added `ShutterStrobe` wheel metadata support so shutter/strobe ranges can show a bounded strobe-speed control.
- Replaced the Controller palette merge slot prompt with a visual palette matrix picker.
- Made shared toolbox tile text backgrounds transparent so tile icons remain visible behind labels.
- Streamlined Guided Wheel Editor visuals with row-level color pickers, icon upload/clear actions, and combined color-plus-icon rendering for wheel option buttons.
- Cleaned up Guided Wheel Editor visual actions so clearing an icon is visually separate from removing the whole option row.
- Added direct icon drawing for Guided Wheel Editor rows, so wheel option icons can be drawn, uploaded, or cleared in the same workflow.

Fixed:

- Fixed Show Run tile Move mode so filled tile buttons can be dragged to another tile position while nested tile action buttons remain protected from accidental drag starts.
- Fixed Show Run Pico Chaser Playback so it also reads live Pico `/chaser/slots` state; loaded Pico slots now appear even when the XAMPP mirrored slot payload file is empty.
- Fixed Show Run Pico Motion Playback to read live Pico `/motion/slots` state and expose live-only loaded motion slots the same way as chaser slots.
- Preserved rich Open Fixture Library wheel metadata when updating an existing fixture library profile from an edited controller profile, so adjustable ranges such as `WheelShake` and `WheelRotation` are not downgraded to plain wheel values.
- Fixed PicoSpot-style shutter/strobe wheel ranges by adding `ShutterStrobe` metadata handling, so an imported or edited strobe range such as `11..255` renders as a bounded **Strobe speed** control instead of a generic wheel value.

## 0.9.5 - 2026-06-21

Changed:

- Added the converted fixture library workflow so profiles can be loaded from the Open Fixture Library export, imported/exported as a fixture catalog, and updated from edited fixture profiles.
- Simplified fixture profile editing with autosave-first behavior, clearer profile actions, click feedback, and a cleaner visual split between profile actions and saved fixture cards.
- Added complete show import/export with project versioning and a data schema guard so future releases can migrate saved setup data safely.
- Expanded show backup coverage to include scenes, palettes, groups, chases, motion effects, GPIO mappings, live fader values, fixture library data, tile visuals, and toolbox layout/collapse state.
- Renamed setup actions to user-facing show/setup language and added a fresh-show action for starting over from a clean project.
- Made scene, palette, and group tiles share the same visual language, including edit/delete icons, solid tile borders, tile styling, and consistent hover/selection feedback.
- Added tile Move mode for scenes, palettes, and groups so tiles can be rearranged by drag and drop using the same interaction style as toolbox reordering.
- Added shared collapse/expand behavior and visual controls for fixture/profile/toolbox cards, including collapse-all support for Control Surface fixtures.
- Reworked group editing so a selected fixture acts as the source/template for group edits, with source indication and clearer documentation of when source values are applied.
- Made Group Edit available for single-fixture selections too, so the same workflow can be used for one fixture or many.
- Improved fixture multi-selection and deselection so group filters stay stable while editing selected fixtures.
- Enhanced Fan Out with shared common-code layout, autosaved working state, spread step-size controls, +/- fine adjustment buttons, and a signed Spread slider centered at `0` so negative Spread replaces the old Invert button.
- Unified Fan Out behavior between Controller and Chaser pages so both use the same source/order model and full-width Spread layout.
- Added relative value editing for live controls, with dedicated fine adjustment for 16-bit channels and correct fine-channel underflow/overflow carry into the coarse channel.
- Added Pan/Tilt fixture profile mapping options for reversing Pan DMX, reversing Tilt DMX, and swapping Pan/Tilt physical axes while keeping the UI values logical. Saving an edited Pan/Tilt control now immediately reapplies the current live value to patched fixtures when a Pico base URL is set, so mounting-correction changes take effect right away.
- Extended Pico Motion upload/firmware support so 16-bit Pan/Tilt motion targets keep coarse/fine channels, swapped axes use the correct physical channels, and optional reverse flags invert motion around the current base value.
- Removed redundant absolute Pan/Tilt coarse/fine sliders where the Pan/Tilt plot and relative controls now provide the practical movement workflow.
- Added autosaved relative step-size settings for Group Edit so the user-selected fine movement increments survive reloads.
- Fixed Motion FX phase spread handling so the preview/output reflects the intended `0..360` degree range.
- Aligned Motion FX Group Edit with the Controller workflow: visible Source fixture, single-fixture editing, relative nudges, and XY-pad Pan/Tilt editing without duplicate absolute Pan/Tilt sliders.
- Fixed new-show cleanup so saved motion effects are removed when starting a fresh show.
- Improved Chaser editing with an Update Chase action for recalled chases and visible user feedback after updates.
- Added direct numeric editing for Chaser step values in addition to sliders.
- Updated DMX output documentation with GPIO wiring, signal generation, start-channel behavior, and timing notes.
- Updated the README and user manual for fixture library use, full show import/export, Fan Out, relative controls, tile movement, source-based Group Edit, and the latest screenshots.

Fixed:

- Fixed group tile persistence so saved group tile information is included in setup export/import.
- Fixed group tile drag/drop by giving groups the same numbered slot model used by scenes and palettes.
- Fixed page navigation losing saved groups by keeping toolbox group state persisted server-side.
- Fixed fixture profile cards so title/description layout and profile selection hover behavior match Control Surface fixture cards.
- Fixed fixture library updates so show-specific Pan/Tilt reverse/swap mounting corrections are cleared from the reusable library copy.
- Fixed toolbox scrollbar usability by widening scrollbars, allowing the toolbox width up to two thirds of the screen, and highlighting the scroll thumb on hover.
- Fixed sticky controller/toolbox behavior across iPad portrait/landscape layouts.
- Fixed Fan Out spread reset and source/order inconsistencies across Controller and Chaser workflows.
- Fixed browser Motion FX stop behavior so a running effect restores the stored base position instead of making the last moving output become the next effect center.
- Fixed group edit modal close behavior so it only closes through explicit close controls.

## 0.9.4 - 2026-06-16

Changed:

- Added a shared Pico base URL connection indicator across the browser UI.
- The Pico base URL field now checks `/status.json`, turns dark green when connected, dark red when unreachable, and keeps polling so it can recover after flashing or rebooting the Pico.
- Updated the user manual and generated manual assets for the Pico URL connection indicator.

## 0.9.3 - 2026-05-24

Changed:

- Working title: Playmodes.
- Added Chaser play direction and Ping Pong playback for browser Chase Playback and Pico chaser slots.
- Made Pico playback slot tiles describe loop state, direction, and Ping Pong state explicitly on separate lines.
- Replaced the old chaser Loop/Ping Pong checkbox combination with one explicit Chase Playback mode selector: Single, Loop, Loop N, and Ping Pong. Pico uploads now derive playmode, loop count, and direction from those browser playback controls.
- Updated GPIO Control so chaser mappings and chaser speed ADC mappings show the selected Pico slot's playmode, direction, loop state, step count, and live/ready state.
- Hid chaser loop-count controls unless the selected playmode is Loop N, in both Chase Playback and Pico Playback.
- Made the release script regenerate the user manual, PDF, and deterministic screenshots before packaging, with `-SkipManual` available for quick local packages.
- Normalized generated user-manual PDF metadata so repeated manual/release runs no longer dirty the tree only because of PDF timestamps.
- Added a screenshot manifest check so README/manual image filenames are owned by one capture path and duplicate screenshot outputs fail early.
- Stabilized generated PNG writes by keeping existing screenshots when the newly captured pixels are identical, preventing release runs from stopping on byte-only PNG differences.
- Made the release manifest preserve its existing commit/time metadata when the packaged firmware, docs, screenshots, and test mode are unchanged, so repeat release runs do not dirty the tree just because the package was committed.
- Made the manual screenshot and release scripts work on Ubuntu PowerShell too by using cross-platform temporary paths, Linux-safe process launching, and release-time XAMPP/Chrome path overrides.
- Added a local XAMPP update wrapper that syncs the web app and verifies the deployed Ubuntu/Windows pages respond.
- Kept unchanged release manifests from being rewritten on repeat release runs, preserving ISO timestamps and preventing ordering-only JSON churn.
- Isolated page overview screenshot captures in fresh Chrome profiles so repeated release runs cannot inherit stale browser state and alternate Motion FX screenshots.
- Reset the manual data baseline again before overview screenshots so controller/chaser docshot state cannot leak into the Motion FX overview.
- Made the Motion FX overview screenshot use an explicit docshot mode so async setup loading cannot race between the compact overview and populated Pico slot grid.
- Hardened Chrome startup for deterministic screenshot captures with unique temporary profiles, fresh loopback debug ports on retry, disabled background services, no-sandbox docshot launches, parent-process exit tolerance, profile-scoped cleanup, and bounded readiness checks.

## 0.9.2 - 2026-05-24

Changed:

- Working title: Bugfixing.

Fixed:

- Prevented new scenes, palettes, chases, chaser palettes, and motion effects from inheriting old default visual icons; defaults now keep only the background color.
- Serialized scene saves so deleting a scene cannot be overwritten by an earlier pending scene save.
- Clarified Motion FX amplitude controls: scalar targets now show one **Amplitude** slider and force the hidden tilt amplitude to zero for preview and Pico upload.
- Changed Motion FX startup so hard reload resets **Effect target** to **None**, while normal same-tab navigation restores the current working state from session storage; saved server presets now apply only through **Load**, import, or saved Effect recall.
- Made Motion FX amplitude controls effect-aware for one-axis effects: **Pan Swing** uses only **Pan amp**, **Tilt Swing** uses only **Tilt amp**, and unused axes are hidden and uploaded as zero.
- Fixed compact collapse layout for Chaser and Motion main cards so the sticky page header keeps a stable height and following cards move up instead of leaving empty space.
- Fixed Motion FX/iPad sticky header layout so the toolbar buttons no longer shift when the running status text changes digit length.
- Fixed the toolbox sidebar width divider so it stays visible and draggable while the toolbox area is scrolled.
- Fixed Controller iPad toolbox resizing so restored wide sidebar states cannot squeeze fixture cards, Pan/Tilt XY pads, or byte sliders into a broken horizontal-overflow layout.
- Fixed the Chaser iPad Pan/Tilt step editor so the **Center** button stays anchored while Pan/Tilt readout digit lengths change.
- Fixed iPad touch scrolling so page content and toolbox rails keep real bottom scroll space on Controller, Chaser, and Motion; the last toolbox can be reached and expanded without snapping out of reach after release.
- Tightened the iPad touch bottom scroll spacer again: page content keeps the smaller spacer and toolbox rails now use less end space while still keeping the last toolbox reachable.
- Fixed iPad toolbox reordering so it uses pointer dragging on the colored header instead of native browser drag/drop, preventing Safari from opening/searching dragged toolbox content.

Added:

- Added a **Clear all** action to the DMX Buffer Monitor to immediately clear both the Pico DMX output buffer and base buffer, then refresh the displayed values.

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
- Documented the Ubuntu release workflow expectation that generated manual assets may need one committed refresh before the final clean release run.

Fixed:

- Hardened the Pico Performance Test so old firmware readback/log issues show as warnings instead of hiding successful write-test results.
- Added `/dmx/base.json` as a firmware alias for `/dmx/base` and CORS headers for Pico log/base readback endpoints.
- Avoided unnecessary PNG rewrites on Linux when exact screenshot bytes already match, even if the optional pixel comparison backend is unavailable.

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
