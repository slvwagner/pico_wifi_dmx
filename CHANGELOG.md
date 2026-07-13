# Changelog

## 0.9.9 - Unreleased

Changed:

- Linked the Launch Control XL MIDI Emulator **Manual** button directly to its MIDI Controller and emulator instructions instead of the top of the Show Run chapter.
- Controller, Show Run, Chaser, Effects, and Room Plane **Group Edit** now use one shared autosave implementation for relative adjustment step sizes. Each page stores its own values, including separate Pan/Tilt coarse and fine steps, in server UI state and restores them whenever the modal or page is reopened.
- Aligned the Show Run **Group Edit** modal with the Fixture Controller visual language: the same compact fixture-control width, divider-based control sections, prominent readouts, rich control layouts, and Default/Blackout/Close footer actions are now used while preserving Show Run's master-aware output path.
- Added a per-tile MIDI playback-action selector for Pico Chaser and Effects slots. A learned button can now toggle start/stop, start, stop, toggle pause/resume, pause, or resume; older mappings retain their start/stop toggle behavior.
- Fixed Show Run **Group Edit** to preserve the fixture profile's control-definition order and keep adjustable wheel range sliders responsive throughout continuous drags, matching the Controller modal.
- Centralized the Controller-style **Group Edit** controls in `dmx-common.js` and reused them in Controller, Chaser, Show Run, Room Plane, and Effects. The pages now share scope details, relative adjustment rows, wheel and scalar layouts, and Default/Blackout/Close actions while retaining their page-specific output behavior.
- Separated the MIDI Emulator surface into distinct Knobs, Faders, Channel Buttons, and Utility Buttons sections. Button columns still match the Launch Control XL hardware positions without implying that a button is functionally tied to the fader above it.
- Started the 0.9.9 development branch.
- Renamed the Show Run **Edit Layout** toggle to **Edit** / **Done** and expanded Edit mode into the common entry point for layout, tile, Live Control, master, and MIDI configuration.
- Added computer USB MIDI support to Show Run through Web MIDI, with input/output selection, explicit connect/disconnect controls, automatic Launch Control XL preference, and the existing Pico UART MIDI diagnostics retained separately.
- Added reusable MIDI Learn/clear editing for Groups, Scenes, Palettes, Pico Chaser Playback, Pico Effects Playback, Grand Master, Group Masters, and Live Controls. Continuous mappings use `0..127` scaling, soft takeover, and update coalescing; button mappings trigger the existing Show actions on their press edge.
- Stored Show Run MIDI mappings in server-side UI state so setup export/import includes them, while keeping browser MIDI permission and port selection local to the XAMPP computer.
- Added browser regression coverage with a simulated Launch Control XL for MIDI Learn, scene recall, Live Control faders, soft takeover, exact server persistence, complete setup export/import recovery, and Edit-only mapping actions.
- Added a separate Launch Control XL-style MIDI Emulator page with 24 knobs, 8 faders, 16 channel buttons, and 8 utility buttons. It connects to Show Run across same-origin browser tabs for MIDI Learn and action testing without controller hardware or a virtual MIDI driver.

## 0.9.8 - 2026-07-13

Changed:

- Started the 0.9.8 development branch.
- Added firmware `/perf/status.json` telemetry for free RAM, Core0 100 Hz playback-loop headroom, Core1 service-loop headroom, HTTP callback timing, and DMX frame counters.
- Enhanced the Pico Performance Test page with Free Memory, 100 Hz Headroom, and Core1 Headroom checks, plus Timing History rows that preserve the full headroom wording.
- Added a Pico Performance Test **Playback + Palette Stress** action that starts already-loaded Pico chaser/effect slots, fills only empty slots with temporary demo data, records those temporary slots in server UI state, sends repeated full 512-channel palette-style recalls, records the resulting telemetry, and clears only the temporary demo slots afterward.
- Added hardware stress coverage for playback plus palette recalls, using `/perf/status.json` to guard Core0/Core1 headroom and free RAM. The stress tests now load demo data only into empty Pico slots and clear those temporary slots afterward.
- Added the Room Plane page for calibrated moving-light room-plane mapping with fixture mount positions, three calibration points, barycentric target weights, and interpolated pan/tilt output.
- Split Room Plane save/recall into a dedicated **Planes** toolbox and added grouped **-- all / + all** collapse controls for Room Plane, Planes, and Fixtures.
- Reworked the Room Plane **Planes** toolbox to use the shared tile workflow: filled tiles recall, empty tiles save the current plane, the pencil edits plane tile visuals, and `x` deletes a saved plane.
- Moved toolbox grouped collapse-all behavior into shared `dmx-common.js` code and adapted Chaser, Effects, and Room Plane to use the common helper.
- Moved saved-plane normalization, barycentric interpolation, and saved-plane tile layout into shared `dmx-common.js` code, then added **Planes** toolboxes to Chaser and Effects.
- Added common **Move** tile controls to Chaser and Effects toolbox matrices, including Groups, Chases, Palettes, Effects, and Planes, with regression coverage for click-to-move and slot swaps.
- Chaser can now recall a saved room plane into the selected chase step, and Effects can recall a saved room plane as the current pan/tilt effect center.
- Updated the shared Groups toolbox so all pages use tile-level pencil and `x` actions for renaming/visual editing and deleting groups, removing the older Rename/Delete action buttons.
- Added **Group Edit** to the Show Run Groups card so the current show target can be edited with a Controller-style modal while still sending live values through Show Run's master-aware output path.
- Unified fixture-control **Group Edit** modals across Controller, Show Run, Chaser, Effects, and Room Plane so shared controls use the same rich editing surface, including XY pan/tilt pads, color pickers, wheel option buttons/ranges, direct wheel DMX values, and relative nudges where supported.
- Changed Room Plane **Groups > Group Edit** to open a Controller-style group edit modal for the selected patched fixtures instead of reusing the single-fixture calibration editor.
- Moved the Room Plane **Planes** tile matrix onto the shared saved-plane toolbox renderer so its layout, Move behavior, active tile state, and tile actions stay aligned with Controller, Chaser, and Effects.
- Added an Edit Layout-only tile `x` action for Show Run Group Masters so group master faders can be removed while the Grand Master remains protected.
- Unified modal shells for tile visual editors, Controller control details, palette merge, guided wheel editing, wheel icon drawing, Show Run utility dialogs, and plane recall dialogs so headers, body scrolling, and action footers use the same shared modal structure.
- Moved shared rich-control color conversion and wheel option icon rendering helpers into `dmx-common.js` and `dmx-ui.css`, keeping Controller, Show Run, Chaser, and Room Plane wheel swatches/icons consistent.

Fixed:

- Enforced one full-range scaling path for continuous MIDI mappings, converting controller values `0..127` across the complete master, 8-bit DMX, or 16-bit DMX target range and using the inverse conversion for soft takeover.
- Anchored the Show Run Pico Chaser and Pico Effects MIDI edit pencils to their individual playback tiles, matching the existing tile-edit visual language while keeping each mapping tied to its own playback slot.
- Isolated Pico HTTP POST bodies and generated responses per connection so overlapping polling, control, and slot-upload requests cannot corrupt one another.
- Made Chaser, Effects, and UI-state JSON read-modify-write saves hold one exclusive transaction lock, preventing simultaneous browser saves from losing updates.
- Fixed the iPad portrait toolbox rail so expanding the last toolbox scrolls it fully into view instead of restoring its collapsed position.
- Removed the duplicate `fixture_count` value from `/motion/slots`; `target_count` is now the single documented target-count field.
- Added regression coverage for firmware HTTP ownership, locked JSON transactions, the Effects slot schema, and toolbox expansion scrolling.
- Fixed **Planes > Edit > Recall A/B/C** not moving a fixture after loading a saved room plane. Saved calibration snapshots now bind by fixture ID to the current Controller profile and patch address before sending live DMX output.
- Fixed the Controller and Show Run **Planes** modal pan-mode buttons so they change to **Stop pan view** with the same active styling as the Room Plane page, then return to **Pan view** when panning is disabled.
- Updated release screenshot automation for the shared modal-card structure so all manual images regenerate successfully.

## 0.9.7 - 2026-07-05

Changed:

- Started the 0.9.7 development branch.
- Added the first Pico-side MIDI hardware milestone: configurable UART MIDI input on GPIO5 by default, MIDI receive/status parsing, `/midi/status.json`, and GPIO reservation for the MIDI RX pin.
- Simplified Show Run layout editing so **Edit Layout** directly enables tile moves, and added Show Run tile edit/delete actions for saved group, scene, and palette tiles.
- Added a Show Run **Hidden Show Items** dialog so saved groups, scenes, palettes, and loaded Pico playback slots outside the visible matrix can be expanded into view or placed into a free visible tile.
- Added a Pico-side blackout lock used by Show Run **Blackout Target** so running chaser/effect playback cannot overwrite fixture blackout channels until the lock is cleared.
- Changed the Show Run page background while **Edit Layout** is active so layout-edit mode is visually obvious.
- Clarified Pico URL versus XAMPP/server URL handling, removed a stale hardcoded Pico value from Show Run, and added a guard test so browser app files keep using relative XAMPP setup URLs.
- Gobo palettes on the Controller page now automatically use matching fixture-library wheel visuals when saved, falling back to the source fixture visual or the normal palette default when needed.
- Added a Show Run **Live Controls** card for operator faders, knobs, and buttons that write directly to selected fixture controls and send the resolved DMX bytes to the Pico.
- Enhanced Show Run **Live Controls** button widgets with Apply, momentary Hold, and fog/haze Timer modes; Hold and Timer restore the previous live value when released, stopped, or removed.
- Added a portable manual screenshot workflow with `scripts/update_user_manual.ps1 -LocalOnly`, using the repo-local PHP dev router and `docs/manual-data/` instead of a machine-specific XAMPP URL.
- Expanded the Show Run manual screenshots with dedicated Live Controls examples for momentary Hold buttons and fog/haze Timer buttons.
- Changed Show Run **Move Cards** to use fixed-position moves: dropping onto an empty matrix spot leaves every other card in place, and dropping onto an occupied spot swaps only those two cards.
- Added a visible Show Run card **Move** handle while Move Cards is active, making interactive cards such as **Live Controls** easy to move without dragging a fader, select, or button.
- Added Pico firmware output master scaling through `/dmx/master` and `/dmx/master/clear`, so Show Run Grand/Group Masters scale transmitted dimmer output while Pico chaser/effect playback continues writing its raw values.

## 0.9.6 - 2026-07-04

Changed:

- Started the 0.9.6 development branch.
- Added a dedicated Show Run page for operating a show from saved groups, scenes, palettes, and Pico chaser/effect slots while keeping setup editing on the existing pages.
- Added Show Run layout controls, including a movable card matrix plus local Cols/Rows and Move mode for arranging operator-page groups, scenes, palettes, and Pico playback tiles.
- Added a sticky **Edit Layout** toggle on Show Run so all card/tile Move and row/column controls stay hidden during normal show operation.
- Added direct Show Run Pico playback controls for chaser slots and effect slots, including chaser play/pause/resume/speed actions and effect start/BPM actions.
- Aligned the Show Run sticky title bar with the shared page-header visual language used by the rest of the app.
- Moved the Show Run Pico base URL and operator action buttons into the sticky title bar so the Pico target and show controls share the same layout and visual language as the other pages.
- Added Pico discovery: firmware broadcasts a UDP beacon on port `64540`, XAMPP serves `pico_discovery.php`, and Pico base URL fields get a shared **Find Pico** button.
- **Find Pico** now saves the discovered Pico URL back to the relevant XAMPP setup file on Controller, Chaser, Effects, and GPIO so the corrected address survives reloads and page changes.
- Added dedicated, cache-busted Manual links for every app page and linked the manual's Main Pages overview to each matching section, including Show Run, GPIO Control, Pico Performance Test, and DMX Buffer Monitor.
- Renamed the user-facing Motion FX page/workflow to **Effects** across navigation, Show Run playback labels, README, and the user manual while keeping existing `dmx_motion.html`, `motion_setup.php`, and `/motion/*` API names for compatibility.
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
- Fixed Show Run Pico Effects Playback to read live Pico `/motion/slots` state and expose live-only loaded effect slots the same way as chaser slots.
- Fixed Show Run Pico playback tile actions so each tile uses one Start/Stop button and updates its state immediately after starting or stopping a slot.
- Fixed Show Run card swaps so clicking a control inside the target card still completes the swap after a source card has been selected, making swaps with **Live Controls** reliable.
- Hardened Show Run **Move Cards** with a dedicated card-move drag layer so interactive cards such as **Live Controls** can reliably be used as drag/drop targets.
- Bound Show Run card drag starts directly to the card move handle/layer in shared move-grid code, improving real mouse drag reliability when **Live Controls** is the source card.
- Added auto-scroll while dragging Show Run cards, so cards lower on the page such as **Live Controls** can be dragged to offscreen card positions above them.
- Made the Show Run workspace use the full browser width instead of staying centered inside a fixed maximum width.
- Hardened the Show Run card matrix model so each card id can appear only once in the indexed `cardOrder` list; duplicate/stale entries are repaired before card moves, preventing **Live Controls** from appearing pinned to a position.
- Simplified Show Run card arranging so **Edit Layout** directly enables card dragging from the card header; the separate **Move Cards** button and small per-card **Move** handle were removed.
- Added Show Run card management in **Edit Layout**: cards can be removed and added back, singleton cards can only be added once, and **Live Controls** cards can be added multiple times for separate fader, button, or mixed control surfaces.
- Hid each **Live Controls** setup toolbar outside **Edit Layout** so the operator page keeps more room for the active faders, knobs, and buttons during show operation.
- Renamed the Show Run card add action contextually, including **Add Live Controls**, and report the exact matrix position after a card is added.
- Reworked Show Run card add/remove controls to follow the established tile visual language: empty card positions now show a `+` add tile and cards use a compact top-right remove icon in **Edit Layout**.
- Moved Show Run card layout, tile placement, matrix sizes, and Live Controls configuration into server-side `ui_state.json` so **Export Setup** / **Import Setup** restores the operator page on another computer.
- Hardened server-side UI state caching so `ui_state.php` is returned with no-store headers and UI state saves bypass browser caches the same way loads already did.
- Fixed Show Run card layout editing so the card matrix renders exactly the configured rows and columns, card remove icons stay visible without hover, and the Add Card modal only lists card types that can currently be added.
- Fixed Show Run **Add Card** so singleton cards hidden outside the visible card matrix can be selected and moved back into a visible empty slot.
- Removed the Show Run singleton-card restriction: every card type can now be added multiple times, and repeated cards render their own active tile grids instead of reusing the first card.
- Fixed repeated Show Run cards so each card instance keeps its own tile layout, including independent Cols/Rows and tile order saved in server-side UI state.
- Fixed Show Run playback tile moves in repeated Pico Chaser and Pico Effects cards by rendering cloned playback grids as active repeat grids and keeping tile move selection tied to the card instance.
- Changed Show Run tile `x` actions to remove only the tile assignment from that card layout instead of deleting the saved group, scene, or palette from the show setup.
- Added Show Run auto-refresh when the page becomes active again, renamed the manual reload action to **Refresh Show Data**, and skipped auto-refresh while **Edit Layout** is active.
- Added a Show Run **Planes** card and recall modal so saved room planes can be opened from the operator page, with live calibrated pan/tilt output using the current group/fixture target.
- Extended complete setup export/import to format v3 so saved room planes and fixture calibration are included in `pico_dmx_setup.json`, and **New Show** resets room-plane setup.
- Updated the user manual, README, and dedicated screenshots for the Room Plane tile workflow and Show Run Planes card/recall modal.
- Preserved rich Open Fixture Library wheel metadata when updating an existing fixture library profile from an edited controller profile, so adjustable ranges such as `WheelShake` and `WheelRotation` are not downgraded to plain wheel values.
- Fixed PicoSpot-style shutter/strobe wheel ranges by adding `ShutterStrobe` metadata handling, so an imported or edited strobe range such as `11..255` renders as a bounded **Strobe speed** control instead of a generic wheel value.

## 0.9.5 - 2026-06-21

Changed:

- Added the converted fixture library workflow so profiles can be loaded from the Open Fixture Library export, imported/exported as a fixture catalog, and updated from edited fixture profiles.
- Simplified fixture profile editing with autosave-first behavior, clearer profile actions, click feedback, and a cleaner visual split between profile actions and saved fixture cards.
- Added complete show import/export with project versioning and a data schema guard so future releases can migrate saved setup data safely.
- Expanded show backup coverage to include scenes, palettes, groups, chases, effects, GPIO mappings, live fader values, fixture library data, tile visuals, and toolbox layout/collapse state.
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
- Extended Pico Effects upload/firmware support so 16-bit Pan/Tilt effect targets keep coarse/fine channels, swapped axes use the correct physical channels, and optional reverse flags invert effects around the current base value.
- Removed redundant absolute Pan/Tilt coarse/fine sliders where the Pan/Tilt plot and relative controls now provide the practical movement workflow.
- Added autosaved relative step-size settings for Group Edit so the user-selected fine movement increments survive reloads.
- Fixed Effects phase spread handling so the preview/output reflects the intended `0..360` degree range.
- Aligned Effects Group Edit with the Controller workflow: visible Source fixture, single-fixture editing, relative nudges, and XY-pad Pan/Tilt editing without duplicate absolute Pan/Tilt sliders.
- Fixed new-show cleanup so saved effects are removed when starting a fresh show.
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
- Fixed browser Effects stop behavior so a running effect restores the stored base position instead of making the last moving output become the next effect center.
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
- Isolated page overview screenshot captures in fresh Chrome profiles so repeated release runs cannot inherit stale browser state and alternate Effects screenshots.
- Reset the manual data baseline again before overview screenshots so controller/chaser docshot state cannot leak into the Effects overview.
- Made the Effects overview screenshot use an explicit docshot mode so async setup loading cannot race between the compact overview and populated Pico slot grid.
- Hardened Chrome startup for deterministic screenshot captures with unique temporary profiles, fresh loopback debug ports on retry, disabled background services, no-sandbox docshot launches, parent-process exit tolerance, profile-scoped cleanup, and bounded readiness checks.

## 0.9.2 - 2026-05-24

Changed:

- Working title: Bugfixing.

Fixed:

- Prevented new scenes, palettes, chases, chaser palettes, and effects from inheriting old default visual icons; defaults now keep only the background color.
- Serialized scene saves so deleting a scene cannot be overwritten by an earlier pending scene save.
- Clarified Effects amplitude controls: scalar targets now show one **Amplitude** slider and force the hidden tilt amplitude to zero for preview and Pico upload.
- Changed Effects startup so hard reload resets **Effect target** to **None**, while normal same-tab navigation restores the current working state from session storage; saved server presets now apply only through **Load**, import, or saved Effect recall.
- Made Effects amplitude controls effect-aware for one-axis effects: **Pan Swing** uses only **Pan amp**, **Tilt Swing** uses only **Tilt amp**, and unused axes are hidden and uploaded as zero.
- Fixed compact collapse layout for Chaser and Motion main cards so the sticky page header keeps a stable height and following cards move up instead of leaving empty space.
- Fixed Effects/iPad sticky header layout so the toolbar buttons no longer shift when the running status text changes digit length.
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

- Fixed Group Edit matching across mixed fixture types on Controller, Chaser, and Effects pages.
- Fixed wheel/indexed Group Edit matching so same-named wheels with different option lists stay separate.
- Fixed Effects Group Edit after hard reload: choosing an Effect Target such as Dimmer now enables compatible cross-fixture editing without enabling playback fixtures.
- Fixed Group Edit modal layout so controls are not clipped and remain vertically scrollable.
- Fixed iPad touch scrolling in Group Edit modals, including drags that start on XY pads.
- Fixed GPIO setup persistence so mappings autosave to the XAMPP server and reload consistently across PC/iPad browsers instead of depending on per-device browser storage.
- Fixed GPIO mapping layout on iPad/mobile widths so all mapping tiles remain reachable without horizontal overflow.
- Added cross-page Group Edit contract tests and iPad toolbox/modal regression tests.

## 0.8.0 - 2026-05-24

- Added the shared Toolboxes sidebar across Controller, Chaser, and Effects pages.
- Added user visuals for scenes, palettes, chases, and effects.
- Added shared modal styling and Group Edit layout rules.
- Added automated Playwright UI rule tests.
- Added deterministic user manual screenshot generation and dark-mode PDF output.
- Added DMX Buffer Monitor page and GPIO/chaser/motion workflow refinements.
