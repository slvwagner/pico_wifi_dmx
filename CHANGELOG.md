# Changelog

## 0.9.15 - Unreleased

Changed:

- Started the 0.9.15 development branch.
- Added a dedicated README core-feature description for Pixel Matrices, including fixture mapping, browser image conversion, live DMX recall, Chaser-step sequences, and shared Controller/Chaser/Show Run operation.
- Reorganized the README core-feature overview into setup/data, programming/visualization, live operation, and firmware/diagnostics sections, with multi-Pico DMX Outputs documented explicitly.
- Replaced machine-specific XAMPP URLs and filesystem paths in the public README with generic host/path placeholders and a conventional `C:\xampp` configuration example.
- Documented the checked-in Visual Studio Code/Pico development environment, pinned SDK and tool versions, exact recommended Marketplace extension IDs, and the supplied build, flash, reset, serial, and Cortex-Debug workflows.
- Extended **Pico Performance Test** to load every configured DMX Output, measure one selected Pico or the complete fleet sequentially, and label Timing History plus Write History with the Pico name and universe. Full Test repeats status/telemetry, buffer readback, DMX write, MIDI latency, and final telemetry for every selected output; the individual checks and Playback + Palette Stress can also run across all outputs.
- Extended **GPIO Control** with a DMX Output selector and independent enabled state, digital mappings, and ADC mappings for every configured Pico/universe. Autosave persists the complete per-output map through XAMPP, legacy single-Pico files migrate to the first output, and push, pull, status, and chaser-slot readback target the selected Pico.
- Extended **DMX Buffer Monitor** with a named DMX Output/universe selector. Output/base reads, frame information, change highlighting, auto refresh, and **Clear all** now follow the selected Pico instead of always using the show's first output.
- Fixed complete show import flattening multi-Pico GPIO data to the legacy active mapping. Show export/import regression coverage now verifies that named DMX Outputs, fixture-to-output assignments, the selected GPIO output, and every per-output digital/ADC mapping survive a full round trip. **New Show** also initializes an empty GPIO configuration for every retained output.

## 0.9.14 - 2026-07-24

Changed:

- Started the 0.9.14 development branch.
- Added shared, universe-aware **DMX Outputs** data to the Fixture Controller. A show can now store multiple named Pico base URLs, assign every patched fixture to an output, reuse the same DMX address on different outputs, change an existing fixture's output, and route individual controls plus grouped scene, palette, Fan Out, and room-plane batches to the correct Pico concurrently. Legacy single-URL setups migrate to the first output, Patch CSV includes output and universe columns, and the complete show format advances to version 4 so older software cannot silently collapse a multi-output show onto one Pico.
- Expanded Pico discovery from the original first-device shortcut into an all-device **Find Picos** workflow inside the DMX Outputs modal. Every discovery beacon is listed with device name and IP address, each controller can be added independently with the next free universe, stable device IDs prevent duplicates, and manually entered URLs that match a discovered device are recognized as already assigned.
- Added the reusable **Pixel Matrices** toolbox to the Fixture Controller with a dedicated dark-amber header that distinguishes it from Scenes. Saved matrices now use the same configurable tile grid as the other toolboxes: empty `+` tiles create matrices, normal tile clicks apply them to DMX, pencil and `x` overlays edit or delete them, and Toolboxes Edit reveals persisted Cols/Rows controls plus drag/tap movement. It stores multiple logical matrices up to 64×64, maps pixels manually or row-major to RGB/RGBW/RGBWA/CMY/CMYK fixture controls and individual native `matrixRgb` pixels, converts PNG/JPEG/WebP/GIF images in the browser with contain/cover/stretch fitting and brightness limiting, and sends each mapped color concurrently to the fixture's assigned DMX output. After a manual pixel assignment, the mapping target advances to the next unused compatible fixture so a physical matrix can be entered by clicking its pixel positions in sequence. Matrix definitions, tile positions/layout, and converted pixels are included in fixture autosave and complete show backups; the complete show format advances to version 5.
- Added the saved **Pixel Matrices** toolbox to Chaser. Recalling a picture writes its mapped RGB-type fixture values and native `matrixRgb` pixels into the selected step, or creates a step when none is selected, while immediately previewing the result on DMX. Different pictures can therefore be recalled into successive steps and played by browser Chase Playback or serialized into a Pico chaser slot with every matrix pixel expanded to its DMX channels. Chaser now provides the complete Controller matrix workflow: empty `+` tiles create pictures, filled tiles offer the shared pencil editor and confirmed `x` deletion, Toolboxes Edit reveals persisted Cols/Rows controls, and drag or tap movement rearranges and swaps matrix tiles.
- Reworked the common **Pixel Matrix editor** used by Controller and Chaser. It now opens in color-paint mode: choose a native color and click any matrix cell to recolor it. **Edit Mapping** explicitly switches cell clicks to fixture assignment and reveals Auto Map/Clear Mapping. Pixel, mapping, size, image-conversion, and clear changes preview immediately through the page's DMX path, so the redundant **Apply to DMX** button is removed. Definition deletion is now available only through the matrix tile `x`, removing the duplicate modal Delete action.
- Added a visually separated **Tile appearance** section to the common Pixel Matrix editor. A matrix definition can now store its toolbox background color plus an optional uploaded or hand-drawn icon independently from its pixel image. Controller, Chaser, and every Show Run Pixel Matrices card render the same saved appearance, while older matrices without visual metadata continue using their first pixel color.
- Fixed saved **Pixel Matrix tile recall** through a common stop-reset-apply sequence. Controller now stops autonomous Chaser and Effects playback on every involved DMX output before sending the picture. Chaser also resets its browser-output cache after stopping playback, ensuring a tile click retransmits all intended DMX bytes even when they equal the last browser-sent values.
- Added **Use icon as matrix** to the common Pixel Matrix tile-appearance editor. Uploaded or hand-drawn tile artwork is composited over its saved background, converted to the current matrix Width × Height using the selected Fit and Brightness settings, written into the editable pixel cells, and previewed immediately through the page's DMX path.
- Added a live matrix-grid overlay to the shared Pixel Matrix icon canvas. The preview follows Width, Height, and the selected Contain/Cover/Stretch transform, translates drawing coordinates through that transform, and keeps the guide lines out of the saved icon and converted DMX picture.
- Changed Controller Pixel Matrix recall to clear the previous fixture/group/scene filter state and select exactly the valid fixtures referenced by the recalled matrix mappings before applying its pixels to DMX.
- Extended Controller Pixel Matrix recall to compare that mapped fixture set with every saved Group. Exact order-independent matches are selected and shared with the other pages, while partial and superset Groups remain unselected.
- Moved **Tile appearance** to the top of the shared Pixel Matrix modal so toolbox-tile presentation is edited first, followed by the matrix definition, image conversion, color painting, and fixture mapping controls.
- Added a repeatable **Pixel Matrices** card to Show Run. Operators can add it through Edit Layout, arrange its card and picture tiles, choose independent Cols/Rows for every repeated card, and recall saved pictures to the current Groups/Fixtures target. Recall updates the shared live-value snapshot and sends regular RGB-type mappings plus native `matrixRgb` pixels through the normal Show DMX path without modifying the saved matrix definition.
- Reworked the sticky application header on every page. Navigation now occupies its own compact wrapping row and responds to the workspace left by the resizable Toolboxes rail, so page buttons remain visible even when the rail uses two thirds of a desktop or iPad landscape screen. The obsolete single **Pico base URL** and **Find Pico** header controls are hidden; a shared, refreshable fleet pill instead checks every DMX Output used by the show and reports full, partial, offline, or unconfigured status. Pico discovery and URL editing remain centralized in Controller → **DMX Outputs**, while one-device Pico operations automatically use the first show output for compatibility.
- Fixed Controller **DMX Outputs** so its modal opens from the sticky header even while the main **Show** setup card is collapsed; opening the modal no longer changes the saved Show-card collapse state.
- Fixed later fixture DMX-output/universe reassignment only changing the saved patch. After an overlap-safe move, the Controller now immediately sends every current control value for that fixture to its newly assigned Pico and reports any transport failure.
- Fixed collapsed Controller fixture cards clipping the lower edge of Default, Blackout, Highlight/Restore, and expand controls on iPad. Fixture headers now grow around the shared 44 px coarse-pointer touch targets while retaining their compact desktop minimum height.
- Fixed tall Pixel Matrix definitions becoming inaccessible in the shared editor on iPad. The modal body is now the single touch-friendly vertical and horizontal scroll container, eliminating the nested `55vh` matrix scroller while keeping Save and Close fixed outside the scrolling content.

## 0.9.13 - 2026-07-24

Changed:

- Started the 0.9.13 development branch.
- Expanded the README versioning policy with stable/development versions, SemVer meanings, the release-branch lifecycle, synchronized version sources, cache-revision behavior, and current 0.9.12 firmware paths.
- Added `scripts/start_version_branch.ps1` to validate, preview, create, update, and optionally commit the next version branch without manually editing every synchronized version source.
- Split show and fixture-catalog backups into four explicit actions: **Export Show**, **Import Show**, **Export Library**, and **Import Library**. `pico_dmx_setup.json` embeds the definitions used by the show, while `pico_dmx_fixture_library.json` preserves the complete reusable catalog. Show import compares changed or missing embedded definitions with the current catalog in a mapping table: highlighted rows use the selected library mode, unselected rows keep the show version, and unrelated catalog entries are preserved. Browser regression coverage now imports a library file followed by a differing show file and verifies that the mapping modal appears before any show data is written.
- Added a persistent show name requested by **New Show**, made it directly editable with the normal 800 ms server autosave in the Show card, stored it in show backups, restored it on import, and used it for readable export filenames such as `pico_dmx_summer-gala_show.json`. **Import Show** accepts any `.json` filename, including names with spaces, because validation uses file content, and its confirmation names the embedded show (for example, **Import xyz_show?**). Older unnamed backups load as **Untitled Show**.
- Added `scripts/backup_show.ps1` for timestamped, read-only HTTP backups containing the split importable show and complete fixture-library files, diagnostic endpoint responses, restore instructions, and SHA-256 hashes. The script defaults to `/dmx-test/` and requires an explicit switch before reading `/dmx/`.
- Organized external source material by moving the Open Fixture Library export to `tools/fixture-library/` and the Launch Control XL programmer reference to `docs/references/`; the fixture-library builder now uses the new archive path by default.
- Linked the README and user manual to the original Open Fixture Library project.
- Added normalized OFL fixture information to the Controller library preview, including authors/dates, physical specifications, and safe source/manual/product/video links. A compact metadata sidecar enriches older custom catalogs in browser memory without writing server data, while the converter's metadata-only mode preserves all curated fixtures and controls.
- Added a compact OFL capability sidecar that enriches matching custom catalogs in browser memory without changing their server data. Segmented capabilities become named option controls for shutter/strobe, programs, effects, prisms, and maintenance functions; continuous capabilities retain their range and speed metadata for bounded controls where applicable.
- Changed **Export Library** to download a real compressed `pico_dmx_fixture_library.zip` containing `pico_dmx_fixture_library.json`. **Import Library** accepts the ZIP directly and remains backward compatible with existing uncompressed JSON catalogs.
- Parallelized the Open Fixture Library converter with an automatic worker count of up to 16 logical processors, added `-ThrottleLimit` for explicit control, and added `-SidecarsOnly` so metadata and capability assets can be regenerated without replacing the curated fixture catalog.
- Converted scalar OFL coarse/fine channel pairs such as dimmer, focus, zoom, iris, and color temperature into the Controller's existing 16-bit slider type instead of exposing the fine byte as a separate control.
- Imported explicit OFL default values into wheel, slider, color, and Pan/Tilt controls, including percentage values and correct scaling between OFL source resolution and the Controller's 8-bit or 16-bit control resolution.
- Converted compatible rectangular OFL matrices using per-pixel sequential RGB channel order into native Controller RGB matrix controls while leaving unsupported matrix layouts uncollapsed rather than mapping them incorrectly.
- Imported explicit OFL highlight values and added a state-aware fixture-card **Highlight** / **Restore** button. Highlight stops autonomous Pico playback, applies only declared highlight values without autosaving the temporary look, and restores the exact previous values afterward.
- Added offline OFL gobo/wheel images through a deduplicated `fixture-resources.json` sidecar. Twenty-eight unique embedded resources enrich 140 wheel options in browser memory, including older/custom catalogs, while resource-key exports avoid duplicating large images throughout the library backup.
- Added a curated Claypaky Hy B-Eye K25 fixture from the November 2025 manufacturer DMX chart and current manufacturer data sheet. The library includes Standard, Standard + Frequency, Shape, Shape + Frequency, Pixel Engine RGB, and Pixel Engine RGBW modes; all basic-engine channels use purpose-built controls, each of the 37 pixel-engine LEDs has its own RGB or RGBW control, and the library preview includes dimensions, weight, input power, connectors, light source, beam range, and manufacturer links.
- Changed each Fixture Profile **Update Library** action into a bidirectional comparison: **Use show in library** updates the matching reusable mode, while **Use library in show** refreshes the existing show profile. Stable fixture/mode links replace later name guessing, library-only metadata/capabilities/warnings and unrelated modes are preserved, and show-only IDs plus Pan/Tilt mounting corrections remain in the show.

## 0.9.12 - 2026-07-19

Changed:

- Started the 0.9.12 development branch.
- Added a state-aware **Full Screen / Exit Full Screen** control to the sticky Show Run header for supported PC and iPad browsers, including Safari-prefixed API compatibility.
- Added **DMX Controller** web-app metadata and XAMPP-derived favicon/touch icons so saving the Controller page to an iPad Home Screen uses the correct name and a dedicated app icon.
- Added shared two-finger pinch zoom to the virtual Room Plane on the Room Plane page and in the Controller and Show Run plane modals, without displacing the live target when the gesture begins.

## 0.9.11 - 2026-07-19

Changed:

- Started the 0.9.11 development branch.
- Updated the Raspberry Pi Pico SDK and picotool integration from 2.2.0 to 2.3.0.
- Moved the CYW43 Wi-Fi firmware into its own RP2350 flash partition, cutting normal application UF2 updates roughly in half. Release packages now include regular and try-before-you-buy Wi-Fi firmware UF2s with separate checksums and one-time provisioning instructions.
- Added `scripts/flash_firmware.ps1` to validate and flash the partitioned application and Wi-Fi UF2s in the required order, with an application-only mode for subsequent updates.
- Unified Pico Chaser playback pause/resume controls into one state-aware button on the Chaser and Show Run pages. Each control now changes between **Pause** and **Resume** with the selected slot's live state.
- Simplified tile-based toolboxes by showing touch-friendly **Cols** and **Rows** dropdowns only while Toolboxes **Edit** is active and enabling tile movement automatically in Edit mode, removing the separate Move buttons.
- Kept the Toolboxes **Edit** and sidebar collapse controls visible in a sticky header while scrolling through toolbox tiles.
- Added recall-only **Scenes** and **Palettes** toolboxes to Room Plane. They use the shared tile layouts and send the stored fixture values to DMX so complete looks or partial palettes can be previewed while calibrating the room plane.
- Removed the redundant GPIO **Save local** and misleading **Clear local** buttons. GPIO edits continue to autosave to browser storage and the XAMPP server, while **Push to Pico** and **Read from Pico** remain explicit actions.
- Replaced the old numeric Show Run matrix dimension fields with the same native **Cols** and **Rows** dropdowns used by tile toolboxes, including the overall card matrix and repeated cards.

Fixed:

- Fixed selected tile highlights blending into light custom tile colors by applying the same contrast decision used for tile text to every saved tile's dark or bright highlight ring.
- Fixed iPad palette tiles becoming difficult to recall because the shared coarse-pointer button rule expanded the edit and delete overlays. Touch overlays now scale with the tile while desktop sizing remains unchanged.
- Stabilized the motion pause/resume hardware regression test by sampling after pause confirmation and polling for resumed output movement instead of relying on one timing-sensitive sample.
- Fixed Show Run Pico Chaser Playback tiles not redrawing after pause or resume, which left their button labels stale even though the Pico command succeeded.
- Fixed Chaser previews so recalling a saved chase immediately sends its first selected step to DMX, and manually selecting another step sends that step's programmed values, including Pan/Tilt, without requiring chase playback.
- Fixed Chaser playback ownership rules: recalling another chase while browser playback is active now continues playback with the recalled chase, while recalling a chase stops Pico chaser and motion playback. Manually selecting a step now also stops both Pico playback engines before sending the step's DMX preview; Pico **Play Slot** continues to stop browser chase playback. Added regression coverage for each transition.
- Fixed Pico chaser slot startup so the first programmed step is output immediately instead of fading up from zero/default values, and multi-step slots begin the Step 1-to-Step 2 transition on the next playback tick instead of holding Step 1 for its full duration first.
- Fixed Chaser **Play Slot** responsiveness by releasing browser Chase Playback synchronously, before waiting for the Pico HTTP response, with regression coverage enforcing a sub-20 ms browser-side DMX handoff.
- Fixed Fixture Controller card **Default** and **Blackout** recalls being immediately overwritten by active Pico playback. These manual recalls now stop Pico Chaser and Motion playback before sending the configured fixture values to DMX.
- Fixed shared toolbox-order saving so page-specific toolboxes such as Room Plane, Planes, Fixtures, and Room Plane Scenes/Palettes are retained in server UI state and restored after reload.
- Fixed the Show Run sticky header disappearing near the bottom of long operator layouts by allowing the document body to grow with its content.

## 0.9.10 - 2026-07-19

Changed:

- Added USB and Launch Control XL Emulator MIDI-to-DMX latency measurement to the Pico Performance Test. The primary result measures the MIDI event until the browser starts `/dmx/b`, including Show-style 30 ms continuous-control coalescing or immediate button handling; Pico transport, acknowledgement, output-buffer visibility, and confirmed-frame time remain separate diagnostics. **Run Full Test** now loads the emulator invisibly in the Performance page when no MIDI input is connected, generates all configured samples automatically without opening or focusing another tab, records a dedicated Connection & Core Timing result and Timing History value, and restores the selected DMX test channel afterward. A connected physical USB input remains available for manual hardware measurements.
- Moved Fixture Library, Fixture Profiles, and Patch Fixtures inside the Controller's first **Show** card. Collapsing Show now hides all show-setup tools together, while each nested card keeps its own independent collapse state.
- Added an Auto/1–4 **Cols** selector to the Fixture Controller Control Surface. The preference is saved in server UI state, supports up to four fixture columns on wide desktops, and automatically reduces the effective count when the available width or an iPad layout would make fixture controls too narrow.
- Started the 0.9.10 development branch.

## 0.9.9 - 2026-07-14

Changed:

- Hardened release preparation so Pico hardware tests remain explicitly opt-in even when a developer's local test configuration enables them, and removed a full-suite Chaser test visibility race.
- Added a shared **Edit / Done** mode to the Toolboxes header on Controller, Chaser, Effects, and Room Plane. Toolbox headers reorder only while Edit is active; the default locked state restores vertical touch scrolling on toolbox headers and prevents accidental iPad rearrangement.
- Added the missing **Scenes** toolbox to Chaser with the Controller tile visual language, shared Cols/Rows/Move controls, tile editing and deletion, and server-backed scene layout. A filled Scene replaces the selected chase step with that complete saved look and clears an unrelated group filter; an empty slot saves the selected step as a shared Scene.
- Fixed saved Plane recall across Controller, Show Run, Chaser, and Effects so opening a tile both shows the target-adjustment modal and immediately applies the plane's current calibrated Pan/Tilt output. All operational Plane toolboxes now provide the same live drag, nudge, zoom, and pan-view workflow. Controller Plane recall now restores all patched fixtures saved in the Plane as the visible active selection, replacing any unrelated prior group selection before sending DMX.
- Moved toolbox **Cols**, **Rows**, and **Move** controls into a shared `dmx-common.js` renderer and applied the same compact horizontal visual language across Controller, Chaser, Effects (including Scenes), and Room Plane toolboxes.
- Standardized modals across Controller, Show Run, Chaser, Effects, and Room Plane so clicking the dark backdrop never closes an editor or dialog; users must choose an explicit Close, Cancel, save, or other modal action.
- Fixed saved Effect tile recall so changing from another target family cannot overwrite the saved preview amplitudes. If the browser preview is already active and its button reads **Stop**, recalling another tile now restarts that effect immediately with its saved timing and update rate; an idle preview remains stopped.
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
