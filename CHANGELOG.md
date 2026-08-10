# Changelog

## 1.3.1 - Unreleased

Changed:

- Started the 1.3.1 development branch.

## 1.3.0 - 2026-08-10

Changed:

- Moved Show Run **Edit** into the Show Sidebar header and added the same
  collapse/expand control used by the Controller toolbox rail. The sidebar now
  remains available even when it contains no cards, exits layout editing when
  collapsed, and shares its saved collapsed state with the other toolbox
  pages.
- Pico Chaser and Effects playback manifests now retain the saved tile name,
  color, and icon. Their Pico slot strips and the Show Run playback cards show
  the same identification, while older slots without visual metadata continue
  to use their existing generic labels.
- Added **Single**, **Loop**, and **Loop N** playback modes to browser and
  autonomous Pico Effects. The configurable Loop N count is stored with saved
  Effects and uploaded slot data, and Pico slot tiles report their configured
  mode and completed-loop progress. Show Run reads the same information into
  its Pico Effects controls and playback tiles.
- Added phase-preserving pause and resume to browser Effects playback. Finite
  Single and Loop N playback now stops automatically after the selected number
  of complete BPM-timed effect cycles.
- Updated GPIO Control to give Effects slots the same physical-button controls
  as Chaser slots, including pause, resume, and pause/resume toggle. Effects
  mappings now support all 64 slots and show the slot mode, finite-loop
  progress, BPM, target count, and playback state read back from the Pico.
- Added a configurable Show Run sidebar for operator-critical cards. It uses
  the same fixed, independently scrolling visual rail and shared width as the
  Controller toolboxes, keeps cards in a single column, supports 1–12 visible
  rows, and lets cards move between the sidebar and main matrix in Edit mode.
  Sidebar rows and card order are stored with the existing Show Run UI state.
- Documented autonomous Pico Effects interpolation and DMX output timing,
  including the number of calculated and transmitted positions per BPM-timed
  cycle and practical guidance for smooth 16-bit Pan/Tilt movement.
- Added Pan Pulse and Tilt Pulse effects for Pan/Tilt targets. Existing Pan
  Swing and Tilt Swing effects are now labelled Pan Sine Wave and Tilt Sine
  Wave while retaining their saved-effect and Pico-slot compatibility.
- Added continuous position-offset and direction controls to Pan Pulse and Tilt
  Pulse. Direction ranges from negative-only through the existing symmetric
  pulse to positive-only, while position offset shifts both pulse levels around
  the current Pan/Tilt center. Both values are saved and uploaded to Pico slots.
- Moved the Show Run Fullscreen control from the page navigation into the Show
  Sidebar header directly beside Edit. Both action buttons now use matching
  dimensions and collapse together with the sidebar.

Fixed:

- Fixed the deterministic manual workflow racing the Effects page's saved UI
  state and asynchronous scene/palette loads. Repeated release captures now
  wait for stable documentation data and no longer schedule a delayed panel
  collapse before creating the fully expanded Effects overview.
- Fixed release UI tests racing through shared isolated XAMPP data by running
  that destructive suite serially, and taught the shared-width check to account
  for Show Run's dedicated sidebar rail.
- Fixed release firmware configuration depending on whichever CMake generator
  the current shell or IDE selected. Official builds now use an isolated
  `build-release` directory and the Pico SDK's Ninja executable explicitly.
- Fixed static release-contract tests treating Windows CRLF checkouts as
  different content from LF checkouts.
- Fixed Show Run keeping Pico Effects tiles in the **Stop** state after a
  Single or Loop N effect completed autonomously. While playback is active or
  paused, Show Run now follows the live state of every linked Pico slot and
  returns the tile to **Start** once all participating Picos have stopped.
- Fixed fixture-to-target guide lines in every Recall Plane modal when its
  whiteboard changes size or aspect ratio. Controller, Chaser, Effects, and
  Show Run now use the same pixel-correct line renderer and redraw whenever
  their Plane canvas is resized.
- Fixed VS Code losing the Pico executable target whenever CMake Tools was
  reloaded. The workspace now configures CMake on open without waiting on
  Pico-extension command substitutions, and the malformed Cortex-Debug launch
  configuration has been corrected.
- Fixed autonomous Pico Effects in Single and Loop N modes leaving their last
  generated DMX values frozen after reporting playback complete. Finite
  Effects now stop after the configured cycles and release their channels back
  to the current base values; channels still used by another Effect remain
  under Effects control.

## 1.2.1 - Unreleased

Changed:

- Added an optional **Merge Controls** mode inside the Controller and Show
  Group Edit modals. Exact profile matching remains the default; when enabled,
  matching 8-bit and 16-bit controls such as Dimmer, Focus, Zoom, Iris, Frost,
  and color temperature share one high-resolution editor and are converted to
  each fixture's native DMX resolution. Pan/Tilt resolutions are merged as
  well. RGB, RGBW, RGBWA, CMY, and CMYK controls share a common RGB editor with
  additive/subtractive conversion while fixture-specific white, amber, and key
  channels remain unchanged. Ambiguous duplicate functions within one fixture
  are excluded from merging. Controls that actually combine different native
  definitions are highlighted with the same green background as the active
  **Merge Controls** button.
- Removed the dedicated Room Plane target-nudge section. Operators can still
  position the target by dragging it or entering Target X/Y directly.
- Expanded Room Plane **Reset calibration** into **Reset plane and
  calibration**. It now restores the working A/B/C point geometry, target,
  view, and calibration state while deselecting—but never modifying—saved
  Plane tiles.
- Restructured application-page chapters in the user manual around an
  unnumbered page title, introductory overview, purpose, tools/toolboxes, and
  detailed instructions. Removed artificial page and subsection numbering so
  navigation describes content rather than implying a required step order.
- Reworked the first screenshot for every documented application page as a
  complete overview. Manual capture now expands toolbox rails, individual
  toolboxes, collapsible panels, and details, then measures the page and uses
  the required capture height instead of clipping the overview to 1100 pixels.
  The Controller overview retains every functional area while limiting its
  long repeated fixture list to a representative set.
- Corrected manual toolbox captures so each image contains exactly one
  toolbox at its original rendered pixel scale. The Scenes and Palettes
  chapter now shows separate matching screenshots instead of Scenes followed
  by Groups.
- Documented the Pico firmware diagnostics website in Troubleshooting,
  including how to obtain its address from Controller → **DMX Outputs**, how
  to interpret the rolling firmware log, and how to use the direct DMX channel
  controls without confusing them with the saved show state.
- Added a dedicated **Tools and Toolboxes** manual point to every operational
  page chapter. Each point explains the shared toolbox rail or the cards,
  panels, and controls that replace it, and is available as a third navigation
  level in the HTML manual and generated PDF contents.
- Moved Room Plane into **Create and Program a Show** and separated live
  operation into a new **Run Show** manual group containing Show Run. Page and
  subsection numbering, generated navigation, and application Manual links now
  follow the revised groups.
- Restarted user-manual page numbering within each main navigation group, so
  every submenu begins at page 1 while all in-application Manual links continue
  to open the matching renamed anchor.
- Changed the clean A4 user-manual PDF to a printer-friendly light theme with
  white pages, dark text, restrained table and code backgrounds, and proper
  page margins. The interactive HTML and navigable landscape PDF remain dark.
- Added expandable page submenus to the HTML user manual contents navigation.
  The current group and page are highlighted while scrolling, and a live
  breadcrumb identifies the exact subsection being read.
- Grouped the user manual by operator purpose: getting started; creating,
  programming, and running a show; testing and diagnostics; advanced tools and
  data; and troubleshooting/reference. The workflow overview now identifies
  which pages are used for programming, live operation, diagnostics, or
  advanced setup.
- Reworked the user manual's backup chapter around the Controller's Export
  Show and Import Show workflow, including fixture-resolution choices, Pico
  slot synchronization after restore, and the distinction between show,
  library, and Patch CSV exports. Repository backup commands and concurrent
  persistence details now remain in the engineering README.
- Documented how independent Room Plane fixture calibration compensates for
  different mounting angles and Pan-zero positions, and explained the accuracy
  limits around raw-DMX Pan wrapping, inconsistent rotation paths, and linear
  interpolation over large areas.
- Extended Room Plane calibration from a fixed A/B/C triangle to any number of
  reference points. New points are added at the current target and may be
  taught independently per fixture; fixtures remain usable with any three
  non-collinear calibrated points while additional points provide localized
  piecewise interpolation accuracy. Existing three-point planes remain fully
  compatible across Room Plane, Controller, Show Run, Chaser, and Effects. The
  fixture calibration modal now separates Recall and Store actions with a
  visible divider.
- Removed the legacy Room Plane **Demo values** button so a user cannot
  accidentally replace the working room definition and fixture list with
  demonstration data. The internal first-run fallback remains available when
  no saved Room Plane setup exists.
- Reworked the Room Plane **Add patched fixtures** modal for touch use. Patched
  moving lights are now selected by tapping large Controller-style fixture
  cards with an accent selected state and live selected count instead of
  operating small checkboxes. Added a dedicated deterministic manual screenshot
  and documented the complete fixture-add workflow.
- Replaced the Room Plane prototype **Add fixture** action with **Add patched
  fixtures**. Its multi-select modal lists only Controller fixtures with
  Pan/Tilt controls that are not already in the working plane, and appends the
  selected fixtures without replacing the current list.
- Kept partially calibrated and uncalibrated Room Planes saveable while adding
  an explicit warning that lists every fixture and A/B/C point still missing;
  affected saved tiles continue to show their missing-calibration count.
- Added a fast solid-zlib profile for local Windows installer builds while
  retaining solid LZMA as the official release default. Release timing runs can
  opt into the fast profile with `-WindowsInstallerCompression Fast`.
- Added stage and total runtime reporting to the Windows installer build so dependency
  validation, cleanup, .NET restore/publish, runtime extraction, staging, NSIS
  compilation, and finalization bottlenecks are visible in every installer run.
- Added matching timing to the WSL bridge and native Debian package builder, separating
  Windows/WSL path setup from Linux validation, cache acquisition, Electron extraction,
  firmware/application staging, and final `dpkg-deb` assembly.
- Moved the repo-local PHP development router from the automation-script directory to
  `tools/local-server/router.php`, separating server support from executable build and
  release workflows while preserving the same local application routes.
- Renamed the manual-generation scripts by responsibility and extracted the page
  overview capture from the main builder. Every build, capture, and render script
  reports its total runtime. The builder also reports every orchestration stage, so
  slow scripts and individual screenshots can be identified while retaining the
  shared browser capture session.
- Added per-image timing to manual screenshot generation. Each capture now reports its own PNG capture/write duration and full pipeline interval including preparation waits, followed by a slowest-first summary for the Controller/Effects, Chaser, and page-overview capture stages.
- Started the 1.2.1 development branch.
- Removed the easily stale **Current development version** banner from the README. `VERSION` remains the canonical application and development version, and the version-branch helper no longer edits the source branch solely to maintain that duplicate label.
- Unified autonomous Chaser and Effects playback around fleet-wide logical slot numbers. Logical Chaser slot N now uses physical Chaser slot N on every involved Pico, and Effects follows the same rule across its 64 slots. Slot status distinguishes consistent `EMPTY`/`READY` state from `PARTIAL` occupancy and `UNKNOWN` unreachable outputs; deletion clears N on every configured Pico. Existing linked manifests with differing member slots are not silently restored and can be normalized from either playback page after a timestamped server backup and conflict check. Replaced the incomplete restore action with an explicit fleet synchronization that preflights every configured Pico, re-uploads all saved payloads, and clears stale loaded slots after showing an exact destructive-change summary; opening a playback page no longer writes Pico slot memory automatically.

Fixed:

- Finished every output-changing Performance test on every tested Pico by
  stopping Chaser and Effects, clearing master and blackout overrides, and
  clearing the complete DMX output buffer after the final measurement, with
  explicit reporting if cleanup fails.
- Calculated Room Plane fixture-to-target guide lines in rendered pixels, so
  they terminate on the red target at wide desktop aspect ratios and continue
  to do so while the toolbox rail or browser changes the plane width.
- Preserved optional Room Plane calibration points beyond A/B/C when loading
  saved planes in Controller and Show Run, so five-point planes display and
  calculate with points D/E instead of being reduced to three points.
- Replaced XAMPP-specific storage wording in the Chaser and Effects
  synchronization confirmations with installation-neutral controller wording.
- Kept the wrapped Pico Performance Test guidance inside complete paragraphs
  in the generated HTML and PDF user manuals.
- Captured every Show Run card at its full page position so the sticky header
  no longer covers card titles, descriptions, selectors, or action buttons in
  the user-manual screenshots.
- Kept the Show Run manual overview in its normal operator state instead of
  capturing the automatically opened Hidden Show Items modal, and added a
  separate deterministic modal screenshot beside its layout-recovery guidance.
- Kept wrapped changelog continuation lines inside their list item in the
  generated HTML and PDF manuals, so the current unreleased section uses the
  same formatting as previous releases.
- Preserved the new group-and-page manual structure in both generated PDFs:
  the document table of contents now renders nested page lists, and the
  navigable landscape PDF includes those page links in its sidebar.
- Kept every Patch Fixtures tile and its DMX-output selector inside the Show
  card when the browser or toolbox width changes, including long fixture and
  output names at the narrowest supported Controller layout.
- Preserved every fixture's calibration for additional Room Plane points when
  saving and recalling Plane tiles. Saved planes are now normalized against
  their own point lists instead of the currently active plane's points.
- Kept the Planes toolbox at the same visible position on iPad when recalling
  planes with different numbers of calibration points, even though the Room
  Plane toolbox above it changes height.
- Prevented the iPad fixture-calibration modal from scrolling while the user
  drags the Pan/Tilt position pad. Normal vertical scrolling remains available
  everywhere else in the modal and resumes immediately after the gesture.
- Made the shared Pan/Tilt calibration modal vertically scrollable on iPad-sized
  screens. Recall and Store groups now live inside the scrollable body while
  the modal header and Close action remain accessible, so every added
  calibration point can be stored on touch devices.
- Synchronized and incremented the shared JavaScript and stylesheet cache
  versions across every application page. Browsers now fetch the Room Plane
  interpolation, calibration-modal grouping, and Plane-tile action styles
  together instead of mixing new HTML with stale cached assets.
- Persisted the Room Plane fixture editor's Pan/Tilt coarse and fine relative
  step sizes across fixtures, modal reopen, navigation, and page reload.
- Kept saved Room Plane tiles immutable while the working calibration or target
  is edited, reset, or another plane is recalled. Working state is still
  autosaved separately, but a saved fixture-calibration snapshot now changes
  only when the user explicitly creates a new Plane tile. Reset Calibration
  also deselects the active saved tile so the uncalibrated working state is not
  presented as that saved Plane.
- Allowed the final saved Room Plane tile to be deleted without recreating a
  `Default plane`. An empty Planes library now remains empty after reload while
  retaining the separate working calibration.
- Replaced Room Plane Fixtures **Remove last** with **Remove selected**, allowing
  any checked fixture subset—including the final fixture—to be removed. An
  intentionally empty working fixture list and saved plane fixture list now
  remain empty after recall and reload instead of repopulating demo fixtures.
- Marked newly loaded patched moving lights as missing A/B/C calibration instead
  of assigning demo calibration values as if they had already been taught.
- Made Group Edit **Default** and **Blackout** recalls take manual control on
  the Controller, Chaser, Effects, and Room Plane pages. Both playback engines
  are stopped on every Pico assigned to the selected fixtures before values
  are changed; Show Run retains its live-operation behavior.
- Enforced the `minimumAppVersion` recorded in complete Show exports before
  importing any data. Show Import now compares semantic release and prerelease
  versions, rejects malformed compatibility metadata, and directs users to
  update the application when a show requires a newer version.
- Made ranged split-color wheel slots adjustable with a **Split position**
  slider. They can now retain the correct `WheelSlot` function while exposing
  the full DMX range used to balance both colors; single-color slots remain
  fixed and genuine wheel rotation ranges remain speed controls.
- Added the missing Room Plane API route to the repo-local PHP server. Effects manual
  captures no longer race a successful setup message against a Room Plane `404`, which
  made the collapsed Participating Controls screenshot alternate between valid and
  error states across otherwise identical manual builds.
- Made documentation capture fully hardware-independent by blocking every cross-origin browser request while `docshot` mode is active. Manual generation continues to use its local API server, but saved Pico URLs can no longer cause DMX writes, playback commands, status polling, or network timeout delays.
- Added dedicated manual screenshots for the expanded Effects **Participating Controls** panel and the occupied **Pico Effects Slots** panel, placing each image directly in its corresponding manual section.
- Updated the deterministic Chaser and Effects manual captures to show representative occupied Pico playback slots in live, ready, and paused states. The Effects overview capture now initializes its documentation data without displaying a saved-plane error or an unstarted slot strip.
- Made **Playback + Palette Stress** cleanup use the Pico URL recorded when its temporary slots were created, pace large clear batches, verify that every temporary Chaser and Effects slot is empty, and retry transient failures. The test now remains busy until cleanup completes. Multi-Pico runs no longer silently leave temporary playback data behind; incomplete cleanup retains its recovery record and reports the affected Pico and slots.
- Let linked Effects uploads recover when a secondary Pico has no empty motion slots by asking before overwriting the selected slot number on each full peer, instead of failing while the primary Pico's selected slot appears empty.
- Restored the saved Effects target and participating fixtures when the page is opened or hard-reloaded, preventing Pico slot uploads from incorrectly reporting **No enabled targets for upload** after a valid Effects setup was saved.
- Allowed **Run Full Test** and **Playback + Palette Stress** to use fully occupied Pico playback slots as the existing stress load. When no empty slots are available, the test now loads and clears no temporary data instead of failing, and reports that the saved show playback data was left unchanged.
- Re-clamped a saved wide toolbox rail whenever the browser viewport changes and made the **Show** name row and Fixture Library respond to the actual Controller workspace width. Narrowing the window no longer clips the Show card beneath a large toolbox rail.
- Kept a newly created show completely empty instead of automatically adding the legacy **Generic Moving Head** profile. Reloading that saved empty show now also preserves its empty profile list; the starter profile remains limited to first-run recovery when no setup can be loaded.

## 1.2.0 - 2026-08-06

Changed:

- Started the 1.2.0 development branch.
- Added a guarded GitHub Release publisher that verifies a clean synchronized `main`, manifest and checksum integrity, documentation generation, both platform installers, and explicit acceptance of unsigned Windows builds before creating the annotated tag and latest public release. Interrupted publications can be resumed by reusing the matching tag and uploading only missing assets, while mismatched remote assets are never overwritten.
- Clarified the Windows release output so the WSL stage reports that it assembles the Debian package from the already generated Windows manuals and firmware rather than implying that those artifacts are rebuilt under Linux.
- Added an automatic Windows application startup check that compares every discovered Pico with the bundled firmware version. Incompatible or version-less Picos trigger an update prompt, and accepting it opens the firmware update page with the detailed installed-firmware check already running.
- Replaced the Windows shell's native light message boxes with shared dark dialogs for firmware prompts, flash confirmation and completion, server lifecycle warnings, WebView fallback, and shutdown errors.
- Removed SSID and password compilation from the Pico application. Windows, Ubuntu, and the developer flash workflow now provision credentials through a dedicated persistent RP2350 data partition using a locally generated temporary UF2. Normal application updates preserve it, network changes can replace it, temporary credentials are not logged, and release preparation rejects legacy credential-bearing CMake caches or compiler commands. Legacy `SSID` and `SSID_PW` environment variables are explicitly ignored instead of silently repopulating the updater or firmware build.
- Included **Playback + Palette Stress** in **Run Full Test** for every available Pico, with its result folded into the Full Test's single consolidated timing record per device.

Fixed:

- Made documentation captures report deterministic current-release Pico firmware without contacting configured physical controllers, so release screenshots cannot show stale firmware warnings or depend on which devices happen to be online.
- Prevented the Pico Performance firmware check from showing a false warning when an installer does not expose the standalone `VERSION` file over HTTP. The check now uses the canonical version embedded in the deployed application, matching the startup compatibility check.
- Kept the Core0 DMX frame-start interrupt enabled during heavy chaser and motion playback processing. Playback state remains protected across cores without allowing the **Playback + Palette Stress** workload to delay DMX frame starts while calculating many active slots.
- Ran real Pico release tests as a dedicated serial stage after the isolated parallel UI suite, preventing browser-test concurrency from disturbing physical playback state and timing measurements.
- Made the Show Run hold-button documentation capture clear asynchronous MIDI mapping state and reapply its Button/Hold toolbar after rendering, keeping the complete screenshot and generated manual PDFs reproducible across release runs.

## 1.1.0 - 2026-08-05

Changed:

- Started the 1.1.0 development branch.
- Added full Open Fixture Library regeneration with optional preservation of user-added inline wheel and gobo images from an existing fixture catalog. Preserved images are matched by fixture, mode, control, and DMX option identity, while current OFL names, ranges, metadata, defaults, capabilities, and other generated information remain authoritative.
- Replaced the custom-over-built-in fixture-library layering with one active server catalog. The Controller can now refresh it directly from the bundled OFL catalog after creating a timestamped backup, preserving user wheel images, explicitly user-modified modes, and explicitly user-created fixtures while allowing obsolete unmarked custom entries to disappear.
- Extended OFL color conversion to retain every color in split-color wheel slots, preserve LEE/Rosco filter references alongside their OFL hex previews, and combine RGB fixtures' additional UV, lime, indigo, cyan, magenta, yellow, and warm/cold-white emitters into one advanced color control used consistently by Controller, Chaser, Show Run, and Room Plane.
- Fixed the guided wheel editor showing only the first color of split-color options. It now displays and edits every color, supports adding and removing split colors, updates the gradient preview without discarding the remaining colors, and visually separates every wheel-position row with a divider and additional spacing.
- Fixed **Update from OFL** and large fixture-library imports failing in the Windows customer app by sizing its PHP memory, execution-time, and upload limits for the complete bundled OFL catalog.
- Brought the Ubuntu desktop shell closer to the Windows application with matching dark Application/View menus, a styled three-choice exit dialog, disabled controller context menus, and startup disk-cache clearing; the checksum-verified `.deb` builder now works with either `curl` or `wget` on a clean build host.
- Fixed **Update from OFL** terminating the Ubuntu customer application by giving its isolated PHP service the same 512 MB memory, 120-second execution, and 128 MB request limits as the Windows customer runtime.
- Added the Windows-equivalent guided Pico 2 W firmware updater to the Ubuntu customer application and package, including network version checks, checksum and RP2350 metadata validation, single-device BOOTSEL probing, explicit write confirmation, verified application and separate Wi-Fi partition flashing, recovery guidance, USB user-access rules, and version-matched bundled firmware plus picotool.
- Fixed the Ubuntu application appearing impossible to close because its controller `WebContentsView` covered the custom exit-choice dialog; the controller view is now hidden while the dialog is open and restored when closing is cancelled.
- Fixed the Ubuntu Application/View dropdowns opening underneath the controller `WebContentsView`, which made **Firmware update…** and other menu actions inaccessible; opening a menu now temporarily yields the content area and restores it on selection or dismissal.
- Fixed opening **Firmware update…** crashing Electron under Ubuntu/Wayland by presenting the guarded updater in the existing application window instead of creating a second GTK/Chromium window; closing the updater restores the live controller.
- Fixed `pico-dmx-config --lan`, `--local`, and lifecycle commands reporting `temp_file: unbound variable` after successfully writing configuration by keeping temporary-file cleanup state valid for the script's full lifetime.
- Changed Ubuntu `pico-dmx-config --lan` and LAN-mode `--status` to print the computer's concrete IPv4 controller URL instead of the unusable `this-computer-ip` placeholder, with an explicit message when no LAN address is available.
- Added WSL-based Debian packaging to the Windows release workflow. One release command can now build the native Windows installer and the Debian/Ubuntu package from the same checkout and firmware, record both checksums and architectures in the release manifest, select a WSL distribution, accept an explicit Linux picotool path, and stage Debian metadata on WSL's native filesystem so NTFS mount permissions cannot invalidate the package. The Ubuntu package guide now documents the verified WSL launch and trusted-LAN test workflow, including mirrored networking, narrowly scoped TCP 8090 firewall access, Windows `localhost` access, and the separate LAN URL used by other devices.
- Fixed release preparation deploying regenerated manuals and application source into the protected live XAMPP controller. Documentation generation is now always local-only; the release test application continues to be synchronized exclusively to the isolated `dmx-test` playground.

## 1.0.1 - 2026-07-28

Changed:

- Started the 1.0.1 development branch from the complete 1.0.0 stable release.
- Added responsive user-manual navigation: a sticky desktop contents sidebar, an iPad/mobile contents drawer, active-section highlighting, persistent and per-section contents links, and previous/next section controls that are hidden from printed/PDF output.
- Fixed the desktop manual contents sidebar disappearing while scrolling by preserving its sticky top offset, with a regression test covering long-page scrolling.
- Added two generated and packaged PDF manuals: a clean A4 portrait version and an A4 landscape version with a persistent clickable contents sidebar. Both variants are deployed to XAMPP and included by the Windows, macOS, Ubuntu, and release-package workflows.
- Fixed occasional doubled DMX frame intervals by servicing the PIO frame-done flag on every Core0 poll, preserving an overdue frame deadline until transmission completes, and preventing resynchronization from starting PIO before DMA is primed.
- Fixed the DMX control PIO startup sequence consuming the single frame-start IRQ before reaching its wrapped transmit loop, which caused continuous frame timeouts and resynchronization.
- Added firmware DMX frame-interval telemetry and a Performance Test check that reports expected, last, minimum, and maximum break-to-break timing, late intervals, and doubled-frame gaps.
- Fixed DMX frame starts being delayed by foreground polling and cross-core write contention by moving the deadline to a lock-free hardware-alarm callback, using an interrupt-friendly mutex for pending channel data, and retrying unfinished frames without timer catch-up or a full-period skip.
- Fixed the Performance Test's **Run Full Test** button remaining disabled when its final Pico telemetry refresh stalls by timing out Pico requests and bounding the final refresh wait.
- Fixed multi-Pico **Run Full Test** runs hanging on an unavailable configured output by preflighting every selected Pico, skipping and naming unavailable outputs with their failure reason, bounding write requests, and stopping a write run after three consecutive errors.
- Added exact firmware-version validation to the Pico Performance Test. The firmware build now takes its version directly from `VERSION` and reports it through `/status.json` and `/perf/status.json`; the test compares it with the deployed `VERSION`, records it in Timing History, and clearly fails old or mismatched firmware.
- Added firmware-version validation to the Controller's shared Pico fleet indicator. It now reports online coverage and firmware currency separately and identifies mismatched, missing, and unreachable Pico firmware per output and universe.
- Changed the shared Pico fleet indicator to display the exact expected firmware version instead of the vague `firmware current` label.
- Hardened the version-branch and release scripts around `VERSION` as the canonical firmware version, including validation that CMake still derives both its compile-time and Pico program versions from that file.
- Added **Check installed firmware** to the Windows Pico firmware installer. It reuses the Controller's network discovery service, compares every discovered Pico with the bundled firmware manifest, and identifies current, outdated, and version-less devices before BOOTSEL flashing.
- Applied the shared Windows dark-title-bar treatment to the firmware updater, exit-choice dialog, and server-shutdown progress dialog as well as the main application window.
- Documented the hardware-alarm frame scheduler and the CPU-to-PIO plus control-SM/data-SM IRQ handshake, including retry, timeout, and resynchronization behavior.
- Fixed the Controller header shifting the **DMX Outputs** button while Pico health text changed by anchoring its right edge and truncating the adjacent polled fleet-status label when space is constrained.

## 1.0.0 - 2026-07-28

Changed:

- Promoted the customer-ready application, bundled Windows server, guided Pico firmware installer, and multi-universe show workflow to the first stable `1.0.0` release.
- Added prominent README Getting Started downloads for the latest Windows customer installer and matching PDF user manual, and made updating and verifying both links required GitHub Release steps.
- Restructured the user manual to begin with a linked table of contents and place the complete project changelog at the end.
- Updated the README introduction to explain multi-Pico DMX universes, linked Getting Started to the detailed Windows installation section, and added a linked README table of contents before the overview.
- Replaced hard-coded `C:` Windows installation/data paths in public documentation with the generic `%ProgramFiles%` and `%ProgramData%` environment paths.
- Added automatic, show-safe Pico address remapping for DHCP changes. **Find Picos** compares each Pico's stable unique-board ID with the saved DMX Output identity and automatically replaces a changed URL while preserving output IDs, universes, names, fixture assignments, and show programming.
- Added shared fixture-aware DMX batching and extended Show Run plus Room Plane so live controls, scene/palette/Pixel Matrix recalls, calibrated plane targeting, and Show Run master scaling follow every fixture's configured DMX Output/universe.
- Added linked multi-Pico playback manifests for Chaser and Effects. Uploads are partitioned by fixture output, verify every involved Pico's slot table, reserve an empty peer slot, roll back partial uploads, show the linked universe/slot members, and operate all member slots together from Chaser, Effects, and Show Run.
- Fixed Chaser Pico slot tiles so they show one canonical playback mode—Single, Loop, Loop N, or Ping Pong—instead of displaying separate Loop and Ping Pong on/off lines.
- Added the saved step fade percentage to Chaser Pico slot tiles; slots with mixed fade values show their minimum–maximum range.
- Added a Windows BOOTSEL firmware installer to WiFiPicoDMX. The software installer can open it after setup; it guides the customer through connecting one Pico, validates the bundled application and Wi-Fi UF2 files, requires confirmation before flashing, and reports recovery instructions.
- Fixed bundled Wi-Fi UF2 validation when `picotool` wraps metadata across lines because of the installation path or console width.
- Hardened customer release packaging so firmware is explicitly configured as a Release build, the selected build directory feeds the Windows installer, and Debug UF2 images are rejected.
- Fixed **Exit and stop server** falsely reporting failure when Apache completed shutdown after the original 12-second wait. WiFiPicoDMX now waits up to 45 seconds, performs a final service-state check, and keeps a non-dismissible animated progress window visible throughout shutdown.
- Corrected and completed the user documentation against every current application page, including multi-output routing, linked Pico playback, fixture/profile controls, Fan Out, Pixel Matrices, MIDI, GPIO, performance testing, DMX monitoring, and Room Plane operation; removed the duplicate README screenshot walkthrough in favor of the complete user manual.
- Added the standalone HTML user manual to the public GitHub Release assets and made publishing and verifying both HTML and PDF manuals part of the release checklist.

## 0.9.16 - 2026-07-28

Changed:

- Started the 0.9.16 development branch.
- Added a reproducible three-sheet Fusion/EAGLE Rev. A schematic generated from the maintained project library, with frozen component values, explicit physical pin mappings, readable net labels, an A3 frame on every sheet, matching CSV/Markdown net lists, and regression coverage for connectivity, symbol placement, and Fusion ERC consistency.
- Froze the Rev. A passive BOM around 0402 resistors and high-frequency capacitors, qualified 0603/0805 ISOW1412 supply capacitors, 0402 ferrites, 0603 status LEDs, the 1206 resettable fuse, and exact manufacturer ordering codes plus placement/population rules.
- Corrected the selected Fusion symbols and footprints for the through-hole Pico 2 W development board, four-pad PTS810 reset switch, ISOW1412 DFM-20, HCPL-0700 SOIC-8, SM712 SOT-23, 1N4148WS SOD-323, ACT45B common-mode choke, JST B4B/B5B XH harness headers, and diagnostic pad banks while preserving every valid available 3D-package association.
- Added a generated 95 mm × 100 mm Rev. A carrier-board starting layout with 37 physical components and 55 named nets. GPIO/analog expansion is placed left of the Pico, isolated DMX flows left-to-right across the upper section, and the isolated MIDI input occupies a protected lower board-edge island.
- Added top, bottom, and via-restrict isolation corridors for the ISOW1412 and MIDI optocoupler boundaries, plus separate top/bottom polygon pours for `GND_LOGIC` and `GND_DMX_ISO`. `GND_DMX_CONVERTER` remains locally routed so its FB2 high-frequency filtering boundary is not bypassed.
- Removed the obsolete J6 diagnostic pad bank, Pico carrier cutout, and Pico-specific carrier keepout. The complete Pico development board now mounts through its two 20-pin header rows using the supplied footprint.
- Added `WiFiPicoDMX_RevA_used.lbr`, a reproducibly generated Fusion/EAGLE library containing exactly the 20 device sets, 17 symbols, 19 packages, and eight currently available 3D associations used by Rev. A, including the A3 frame and project-specific pad banks.
- Unified the schematic, board, and standalone used-component library under the `WiFiPicoDMX_RevA_used` identity. The `.sch` and `.brd` retain EAGLE's required embedded component records for portability while matching the separately uploadable `.lbr` for library import and later managed-library swapping.

## 0.9.15 - 2026-07-25

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
- Added an Ubuntu customer installer workflow that builds a versioned, checksummed `.deb` package with a systemd PHP service, self-contained Electron/Chromium application with a dark frame and Windows-shell-equivalent controls, Applications-menu and installer-owned desktop launchers, localhost-only default, explicit trusted-LAN/UFW configuration, pre-upgrade show snapshots, and persistent data preserved on removal.
- Changed the Ubuntu package to application-managed service lifetime by default. Opening the desktop application starts the Pico DMX system service; closing it stops all Electron/Chromium processes and PHP workers. A narrowly scoped Polkit rule permits the active local user to manage only this service, while `pico-dmx-config --always-on` remains available as an explicit LAN-server opt-in.
- Fixed WiFiPicoDMX desktop launches failing when GNOME could not show systemd's fallback authentication dialog. The installer now processes its exact-service Polkit authorization before generic rules and retries GNOME trusted-launcher metadata to avoid a desktop-startup race.
- Added the first customer-oriented Windows installer workflow. It packages only Apache, x64 Thread Safe PHP, the browser application, and the manual; installs Apache as the automatic `PicoDmxController` Windows service; offers explicit Private-network access for iPads/other PCs; creates app-style Start Menu and desktop shortcuts; and excludes MariaDB, phpMyAdmin, and XAMPP development tools.
- Separated installed application files under `Program Files` from mutable show data under `ProgramData`. Every PHP data endpoint now honors the installer-provided `PICO_DMX_DATA_DIR` while retaining the existing `api/data` fallback for XAMPP development. Upgrades preserve a pre-replacement data snapshot, and uninstall deliberately leaves customer show data intact.
- Added reproducible Windows packaging scripts with pinned SHA-256-verified Apache 2.4.68, PHP 8.5.8 Thread Safe x64, and Microsoft Visual C++ runtime inputs; warning-free NSIS compilation; installer checksums; and optional Authenticode signing and timestamp verification for customer releases.
- Protected Windows signing certificates, private keys, local environment/credential files, IDE state, and future customer show backups with repository ignore rules. Signing uses the protected Windows certificate store or CI service and passes only a non-secret certificate thumbprint to the build script.
- Replaced the browser-only Windows shortcut with a self-contained native WebView2 application shell. It waits for the local service, opens the controller in a dedicated resizable window, supports F11 fullscreen and Escape restore, keeps visible **Exit full screen** and **Stop server and close** controls in fullscreen, exposes Open/fullscreen/exit actions through a tray icon, and falls back to the default browser if WebView2 cannot initialize.
- Matched the Windows shell to the controller's dark visual language. Supported Windows versions receive an immersive dark title bar and frame, while the native menu bar, dropdowns, status bar, tray menu, and fullscreen buttons use coordinated dark surfaces, light text, hover states, and a distinct close action.
- Added a customer-selectable HTTP port to the Windows installer. Setup defaults to 8090, validates ports 1024–65535, detects conflicts, remembers the installed port during upgrades, and consistently applies it to Apache, the optional Private-network firewall rule, application shortcuts, and launch-after-install.
- Improved Windows installer port-conflict handling during upgrades. Setup now recognizes its own running `PicoDmxController` service and asks to close the operator window/server so the selected port can be retained; it identifies unrelated desktop owners by process name and PID before asking permission to close them, while refusing to stop unrelated Windows services automatically.
- Changed Windows application exit behavior so closing the window, using the tray/menu exit command, or pressing the fullscreen close button confirms the operator-device disconnection, requests administrator approval to stop only `PicoDmxController`, waits for the service to stop, and exits only after success. Cancelling confirmation or UAC leaves the application and server running.
- Made the Windows application restart a stopped `PicoDmxController` service when its shortcut is opened again. The shell explains the administrator prompt before requesting elevation, waits for the service to run before loading the controller, and skips elevation when the service is already running.
- Renamed the customer-facing Windows application to **WiFiPicoDMX**, including its native process, window, installer, shortcuts, and Apps & Features entry. The internal service/registry identifiers and existing `ProgramData\Pico DMX Controller` show-data location remain stable so upgrades preserve customer installations and data.
- Added an explicit Windows close-choice dialog. **Exit only** closes WiFiPicoDMX while keeping the server available to iPads and other PCs, **Exit and stop server** retains the confirmed UAC-controlled service shutdown, and **Cancel** leaves both running.
- Fixed the native Windows application retaining outdated page-width CSS after an upgrade. The packaged server now requires HTML, CSS, and JavaScript revalidation, and WiFiPicoDMX clears only its WebView2 disk cache before loading the controller so updated layouts appear immediately without removing show data or browser-local settings.
- Extended `scripts/prepare_release.ps1` to build the versioned Windows x64 customer installer automatically on Windows, place it beside the firmware artifacts, and record its size, SHA-256, and Authenticode state in `release-manifest.json`. Windows release runs can supply the protected signing-certificate thumbprint or explicitly skip installer creation for a firmware-only package.
- Added the complete canonical project change log immediately after the user-manual introduction. HTML and PDF generation reads `CHANGELOG.md` directly and nests its version headings below the manual section, so release notes remain searchable offline without maintaining a second copy.
- Aligned the macOS and Ubuntu customer applications with the **WiFiPicoDMX** name and Windows-style exit choices. Both now offer **Exit only**, **Exit and stop server**, and **Cancel**, while retaining their existing LaunchAgent/systemd identifiers and customer-data paths for safe upgrades. Ubuntu waits for the last local app instance before stopping its shared service.
- Added a native macOS customer-package workflow for Apple Silicon and Intel Macs. It builds a dark Cocoa/WKWebView application, bundles a pinned standalone PHP runtime, configures an available port and local/trusted-LAN access at first run or later settings, keeps the server alive through a per-user LaunchAgent, separates Application Support show data from replaceable app code, snapshots data after upgrades, and supports Developer ID signing plus `notarytool` submission and ticket stapling.

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

- Added deterministic Pico firmware Logs and DMX Controls screenshots to the
  Troubleshooting and Reference manual section without requiring Pico hardware.
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
