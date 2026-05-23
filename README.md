# pico_wifi_dmx

WiFi-controlled DMX512 controller firmware for the Raspberry Pi Pico 2 W (RP2350). Can contoll a full DMX universe per unit. Provides real-time DMX output driven either from a browser-based UI or autonomously on the Pico itself, with no dependency on network latency for live playback.

Browser-based user interface with the following features:

- Fixture definition
- Fixture patching, including multi-fixture patch runs with automatic numbering and optional Saved Group creation
- Fixture groups with saved group selection, multi-select filtering, rename, delete, and compact group matrix layout
- Scene editing and saving to palettes
- Palette toolbox for reusable partial looks that recall as overlays
- Fan Out toolbox on the Fixture Controller to shape selected groups directly into scene values with affected controls highlighted
- Effect creation, such as swing, circle, and figure-8
- Effects are relative to the scene position
- 32 effects can be saved on the Pico and run simultaneously
- Chaser tool to create chases, add, edit, duplicate steps, and capture channel values to create steps
- Participating fixture controls can be defined for chases, which helps edit only the intended controls and channels
- 32 chasers with 32 steps each can be saved to the Pico
- Preview for all tools
- Real-time running of all chaser and effect slots on the Pico hardware
- Real-time GPIO control to run, stop, set speed, and pause chases and effects
- Simple user interface to define each GPIO pin by choosing a pin and assigning an action
- All data is stored server-side and can be exported or imported as JSON files
- Fixture profile controls support add and edit workflows in one editor. Editing a control automatically opens the Add / Edit Control card.

License: copying, modification, and sharing are allowed for non-commercial use only. Commercial use requires separate written permission. See [LICENSE](LICENSE).

User-facing operating instructions are in [docs/user-manual.md](docs/user-manual.md). A dark-mode PDF version is available at [docs/user-manual.pdf](docs/user-manual.pdf).

---

## Architecture

| Core | Responsibility |
|------|----------------|
| **Core 0** | DMX engine (continuous 250 kbaud frames), chaser sequencer tick, motion FX oscillator tick — runs at 100 Hz |
| **Core 1** | WiFi (CYW43), lwIP TCP/IP stack, lwIP httpd (HTTP/1.0 API server) |

Cross-core data access is protected by `critical_section_t` hardware spinlocks. DMX buffer writes from the HTTP handler (Core 1) and from the playback engines (Core 0) are coordinated so neither blocks the other.

---

## Playback Modes

### Chase Playback
The browser pages connect directly to the Pico's HTTP API. On every tick the browser computes the next DMX values and sends only the **changed channels** in one batch request (`/dmx/b/`). Two browser tabs can run simultaneously (e.g. chaser on dimmer channels + motion FX on pan/tilt) without interfering because each page tracks its own sent state and never overwrites channels it doesn't own.

### Pico Autonomous Playback
The chaser and motion FX configurations are uploaded to the Pico via HTTP POST. After that the Pico plays back entirely on Core 0 — no further network traffic is needed. This eliminates WiFi latency jitter from the DMX output completely.

Starting Chase Playback automatically stops any running Pico playback, and vice versa (mutual exclusion).

---

## HTTP API

All endpoints return JSON with `Access-Control-Allow-Origin: *`.

### DMX channel control

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dmx/set/<ch>/<val>` | GET | Set a single channel (ch 1-based, val 0–255) |
| `/dmx/b/<ch>:<val>,<ch>:<val>,…` | GET | Batch set — channel:value pairs in the URL path. Data is path-encoded (not query-string) because lwIP httpd strips query strings before calling `fs_open`. |
| `/dmx/clear` | GET | Zero all channels and clear the scene base buffer |
| `/dmx/output_clear` | GET | Zero live DMX output channels only; preserve the scene base buffer |
| `/dmx/values/<start>/<count>` | GET | Read up to 64 channel values as JSON array |
| `/dmx/values.json` | GET | Read all channel values |

### Pico chaser

Up to **32 independent chaser slots** can be loaded and played simultaneously. Each slot has its own step list, loop flag, and speed multiplier. When multiple slots control the same DMX channel the **bigger-wins** rule applies (highest raw value written).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chaser/load/<N>` | POST | Upload chaser config to slot N (0–31) |
| `/chaser/play/<N>` | GET | Start slot N from the beginning |
| `/chaser/pause/<N>` | GET | Pause slot N at the current step/fade position |
| `/chaser/resume/<N>` | GET | Resume paused slot N |
| `/chaser/pause_toggle/<N>` | GET | Pause if running, resume if paused, otherwise start slot N |
| `/chaser/clear/<N>` | GET | Clear/unload slot N without clearing global DMX output |
| `/chaser/stop` | GET | Stop all slots |
| `/chaser/stop/<N>` | GET | Stop slot N only |
| `/chaser/speed/<N>/<mult_x100>` | GET | Set speed multiplier for slot N (100 = 1.0×) |
| `/chaser/status` | GET | `{"ok":true,"active_mask":N,"loaded_mask":N,"step":N,"step_count":N,"elapsed_ms":N}` |
| `/chaser/slots` | GET | `{"ok":true,"slots":[{"slot":N,"loaded":bool,"active":bool,"loop":bool,"step_count":N,"speed_mult":F},…]}` |

`active_mask` and `loaded_mask` are bitmasks — bit *i* set means slot *i* is active/loaded.

Chaser text protocol (POST body):
```
LOOP 1
MODE loop
LOOPS 1
DIR forward
SPEED 1.00
STEP <duration_ms> <fade_percent>
CH <channel> <value>
CH <channel> <value>
END
STEP …
END
```

`MODE` supports `single`, `loop`, and `loop_n`. `LOOPS` is used by `loop_n`. `DIR` supports `forward` and `reverse`. `SPEED` is the slot speed multiplier and can still be changed live with `/chaser/speed/<N>/<mult_x100>`.

Each chaser slot supports up to **32 steps** in firmware. The Chaser page enforces the same limit so Chase Playback and Pico playback use the same chase shape.

### Pico motion FX

Up to **64 independent motion FX slots** can be loaded and played simultaneously. Each slot has its own effect type, BPM, target list and phase offsets. Targets can be pan/tilt pairs or scalar controls such as dimmer, zoom, iris, prism, or gobo. When multiple slots control the same DMX channel the **bigger-wins** rule applies (highest raw value written).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/motion/load` | POST | Upload motion FX config to slot 0 |
| `/motion/load/<N>` | POST | Upload motion FX config to slot N (0–63) |
| `/motion/start` | GET | Start slot 0 |
| `/motion/start/<N>` | GET | Start slot N |
| `/motion/clear/<N>` | GET | Clear/unload slot N without clearing global DMX output |
| `/motion/stop` | GET | Stop all slots |
| `/motion/stop/<N>` | GET | Stop slot N only |
| `/motion/bpm/<N>/<bpm_x10>` | GET | Set BPM for slot N live (e.g. `/motion/bpm/0/1200` = 120.0 BPM) |
| `/motion/status` | GET | `{"ok":true,"active_mask":N,"loaded_mask":N,"elapsed_s":F}` |
| `/motion/slots` | GET | Array of per-slot info: `{"ok":true,"slots":[{"slot":N,"loaded":bool,"active":bool,"type":N,"bpm":F,"target_count":N},…]}` |

`active_mask` and `loaded_mask` are bitmasks — bit *i* set means slot *i* is active/loaded.

Motion FX text protocol (POST body):
```
FX 1
TYPE <0=circle|1=figure8|2=panSwing|3=tiltSwing|4=sine|5=pulse>
BPM <float>
AMP1 <0.0–1.0>
AMP2 <0.0–1.0>
SPREAD <degrees>
TARGET <scalar8|scalar16|pantilt8|pantilt16> <enabled> <ch1> <fine1> <ch2> <fine2> <phase_deg>
END
```

The `TARGET` line contains DMX channel positions only. It does not store fixed center values. Instead, the effect center is read from the **scene base buffer** (`dmx_base_frame`) at tick time — see [Scene Base Buffer](#scene-base-buffer) below. Pan/tilt targets use both axes; scalar targets use `ch1`/`fine1` and ignore `ch2`/`fine2`.

---

## Web UI

The UI is served from a separate web server (XAMPP in development). All pages talk to the Pico via cross-origin HTTP requests using `new Image().src` for fire-and-forget GET calls.

| Page | File | Description |
|------|------|-------------|
| Fixture Controller | `web/dmx_fixture_controller.html` (served as `index.html`) | Define fixture profiles, patch fixtures, set individual channels, manage groups, save/recall scenes |
| Chaser | `web/dmx_chaser.html` | Build and play step sequences with crossfade; save reusable chases in the Chases toolbox; upload the current chase to up to 32 independent Pico slots for autonomous playback; slot status strip shows live LIVE/READY/EMPTY state for all 32 slots |
| Motion FX | `web/dmx_motion.html` | Configure generic oscillator effects for pan/tilt pairs or scalar controls; upload the current effect to up to 64 independent Pico slots; slot status strip shows live LIVE/READY/EMPTY state for all 64 slots |
| GPIO Control | `web/dmx_gpio.html` | Prototype editor for mapping physical GPIO button inputs to Pico playback/DMX actions |
| FPS Benchmark | `web/dmx_benchmark.html` | Measure Pico HTTP latency for single-channel, scene-sized batch, stress, and soak-test DMX update patterns with percentile stats |

### Screenshots

The screenshots below show the main pages as served from XAMPP during development and explain how the software is used in practice.

Run `scripts/update_user_manual.ps1` after UI or documentation changes. It syncs the current web app to XAMPP, captures deterministic screenshots, rebuilds the dark-mode HTML/PDF manual, syncs the result back to XAMPP, and verifies the deployed manual.

The controller screenshots are generated with deterministic per-shot setup states: each screenshot explicitly opens or collapses the relevant sections, collapses the shared toolbox sidebar for page-local topics, sets toolbox visibility for toolbox-specific topics, clears or selects group filters, and expands fixture cards as needed. This avoids stale browser collapse state leaking into the documentation images.

**Fixture Controller**

![Fixture Controller page](docs/screenshots/fixture-controller.png)

The Fixture Controller is the main setup and live-control page. It defines fixture profiles, patches real fixtures to DMX start addresses, and renders the controls for each fixture card. Fixture profiles describe the channel layout, for example dimmer, pan/tilt, RGB, RGBW, RGBWA, wheels, sliders, and 16-bit channels.

From this page you can move individual controls live, save and recall scenes, organize fixtures into groups, and recall default or blackout values per fixture or per group. Scene recall writes channel values back to the Pico and also updates the live-value snapshot used by the Chaser page.

Patch Fixtures supports one fixture at a time or a numbered run. Set a base name such as `RGB Spot`, choose a profile, enter the first DMX start address, and set Count. The controller creates `RGB Spot 1`, `RGB Spot 2`, and so on, spacing each fixture by the selected profile's channel count. After a multi-fixture patch it offers to create a Saved Group using the same base name. The patched fixture matrix is split into rows by consecutive profile runs so separate fixture groups remain visually clear.

The Controller also includes a Fan Out toolbox in the shared Toolboxes sidebar. Select one or more groups, choose a compatible control such as Dimmer, Pan, or Tilt, snapshot the current values as the base, and adjust a spread. The controller surface updates continuously, affected controls are highlighted directly, and the resulting look can be saved with the Scene Toolbox. Fan Out presets can also be saved and recalled as UI tool settings.

The Palettes toolbox stores reusable partial looks such as positions, colors, gobos, dimmer levels, or Fan Out overlays. Palette visuals are independent from scope: any palette can carry a background color plus an optional drawn/uploaded visual so slots stay readable at a glance. The visual editor can reset to the default background or clear the icon entirely. Palette visuals are saved inside `data/palette_setup.json` together with the palette values.

![Fixture profile and control editor](docs/screenshots/fixture-controller-profile-controls.png)

The profile editor is where a fixture personality is described. The left side lists saved fixture profiles and their controls. The Add / Edit Control card edits the selected control type, channel mapping, label, and default/blackout values. For pan/tilt controls the editor shows XY pads; for color controls it exposes the color picker and extra white/amber channels where needed. Clicking Edit on an existing control opens this editor automatically. Collapsing Fixture Profiles also hides the Add / Edit Control card.

![Fixture live control cards](docs/screenshots/fixture-controller-live-controls.png)

The live control surface shows patched fixtures as cards. Each card contains the controls created in the profile, such as dimmer sliders, pan/tilt XY pads, color controls, wheels, and 16-bit coarse/fine sliders. The Default and Blackout buttons recall the stored values for one fixture, while Select adds the fixture to group editing.

![Saved Groups matrix](docs/screenshots/fixture-controller-saved-groups.png)

Saved Groups are shown in a compact matrix. Each group has Select and Deselect on the top row, with smaller Rename and Delete buttons below. Selecting a saved group filters the control surface to that group's fixtures. Multiple groups can be selected at the same time; the surface shows the union of all selected group fixtures, and Show all clears the filter.

![Fixture group edit modal](docs/screenshots/fixture-controller-group-modal.png)

The Group Edit modal appears when multiple compatible fixtures are selected or when a saved group is loaded. It shows only controls that exist on all selected fixtures, so one slider or XY pad can update every fixture in the group at once. The modal can also recall Default all or Blackout all; normal edits follow the page's live-send behavior.

![Fixture Controller scene toolbox](docs/screenshots/fixture-controller-scene-box.png)

The Scene Toolbox sits in the shared Toolboxes sidebar for saving, recalling, deleting, exporting, and importing looks. The row and column controls change the visible slot grid, filled slots recall scenes, empty slots save new scenes, and the red clear button clears all controller values and the Pico DMX output when a base URL is set. Scenes can also carry a background color plus an optional drawn/uploaded visual as a label in the slot grid, with controls to reset the background or remove the icon.

**Chaser**

![Chaser page](docs/screenshots/chaser.png)

The Chaser page builds step-based sequences. A chase is made from multiple steps; each step stores DMX channel values plus timing and fade settings. The participating-controls panel decides which fixture controls are part of the chase, so editing a chase does not accidentally touch unrelated channels.

Chaser steps can be created manually, duplicated, edited, or captured from the current Fixture Controller live values. A chase can run in the browser for editing, or it can be uploaded into one of the Pico's 32 chaser slots for autonomous playback. Pico playback supports single run, loop, loop N times, direction, pause/resume, and live speed changes.

The repeated page tools now live in a shared right-side Toolboxes sidebar on desktop screens. Drag the sidebar's left resize line to change the width, double-click it to reset, use the header arrow to collapse or reopen the sidebar, and drag toolbox headers to reorder them. Sidebar width, collapse state, and toolbox order are shared across Controller, Chaser, and Motion FX. Chases use the same Visual editor as scenes and palettes so chase slots can have a background color plus optional drawn/uploaded visual, with controls to reset the background or remove the icon. The Chaser also has a Palettes toolbox: empty palette slots save the selected step's fixture/control values, and filled palette slots recall compatible values into the selected step.

**Motion FX**

![Motion FX page](docs/screenshots/motion-fx.png)

The Motion FX page creates continuous effects for one selected target type at a time. Pan/tilt targets can run circle, figure-8, pan swing, or tilt swing; scalar controls such as dimmer, zoom, iris, prism, or gobo can run sine or pulse effects. All effects are calculated relative to the current scene/base-buffer value instead of using a fixed stored center point.

This means the normal workflow is: recall or set the base value first, then start the effect. The firmware reads the center from the scene base buffer and the motion oscillator moves around that value. Motion FX can also be uploaded into one of 64 Pico slots so multiple effects can run directly on the Pico without browser timing jitter. The Motion page can recall compatible shared palettes as effect centers, so position, dimmer, beam, or other scalar palettes can seed the current target before upload. The Effects toolbox stores reusable effect recipes (target, participants, effect type, BPM, amplitudes, spread, and phase offsets) without storing center/base values.

**GPIO Control**

![GPIO Control page](docs/screenshots/gpio-control.png)

The GPIO Control page maps physical Pico inputs to lighting actions. Digital GPIO pins can trigger actions such as DMX clear, output-only clear, chaser play/stop/toggle, pause/resume, motion start/stop/toggle, and tap tempo. ADC pins can be mapped to continuous values such as chaser speed multiplier or Motion FX BPM.

The page protects reserved hardware pins and already-used pins, then sends the mapping to the Pico with `POST /gpio/config`. Once uploaded, the Pico polls the inputs on Core 0 and runs the actions directly, so the browser does not need to stay open during operation.

**Benchmark**

![Benchmark page](docs/screenshots/benchmark.png)

The Benchmark page measures how fast the Pico HTTP API can accept DMX updates. It can test single-channel updates, scene-sized batch updates, stress tests, and longer soak tests. The result panel shows throughput, effective DMX channel updates per second, average latency, median, p95/p99 latency, jitter, min/max latency, completed attempts, and errors.

This page is mainly for checking whether a change in firmware, WiFi, API format, or browser behavior affects real-time control performance. The CSV export makes it possible to compare test runs later.

Both playback pages show a **Chase Playback** section and a **Pico Playback** section. Only one can be active at a time — activating one automatically stops the other.

The **Pico base URL** is persisted in `localStorage` under the key `dmxPicoBaseUrl` and is shared across all pages — typing the IP once on any page is enough.

### Chaser / Motion FX — Saved Chases, Presets and Pico Slots

The playback pages separate browser editing from the autonomous Pico slot memory:

- **Chaser Chases toolbox** — stores reusable editable chases on the XAMPP server. Recalling a chase loads its steps, selects Step 1, rebuilds Participating Controls and Edit Step, and a newly opened Chaser page starts with no working steps until a chase is recalled or created.
- **Motion Save Preset / Load Preset** — stores and restores the editable Motion FX page setup on the XAMPP server JSON file.
- **Pico slot click upload** — click an empty Pico slot to send the current editable chase or Motion FX preset to that slot and mirror the payload on the XAMPP server. Click a loaded slot once to select it for playback controls; click the selected loaded slot again to replace it after confirmation.
- **Play Slot / Start Slot** — starts the already-loaded slot on the Pico.
- **Restore Saved Slots to Pico** — re-sends the saved server-side slot payloads to the Pico after reboot or firmware upload.
- **Delete slot** — loaded slots show a small `×` button in the top-right corner. It deletes the mirrored XAMPP slot payload and calls the Pico clear endpoint for that slot when the Pico base URL is set.

On the Chaser page, each uploaded Pico slot also stores its playback mode (`Single`, `Loop`, `Loop N`), loop count, direction, and speed. `Stop` resets the slot, while `Pause`/`Resume` keeps the current step and fade position.

### Chaser — Participating Controls

The **Participating Controls** panel defines which fixture+control pairs are written by the chaser. It is stored separately from the step list:

- **Save / Load** — persisted to `chaser_setup.json` via `chaser_setup.php?participating`, independently of steps. Recalling a saved chase rebuilds the active selection from the recalled step.
- **Export (↓) / Import (↑)** — download or upload the participating map as a standalone JSON file. Useful for copying a control selection between chase-building sessions.

### Chaser — Capture from Fixture Controller

**Capture + Add** and **Capture from FC** read the current live values from the Fixture Controller:

1. Tries `fixture_setup.php?livevalues` (server-side snapshot written by the FC page whenever any control is moved or a scene is recalled).
2. Falls back to `localStorage` key `dmxFCLiveValues` if the server is unavailable.

This means capture works correctly even when the Chaser and FC pages are open in different browser windows or tabs.

### Fixture Controller — Groups

Fixtures can be organised into named **Saved Groups** (stored server-side via `group_setup.php`).

- Create a group and assign any subset of patched fixtures to it.
- A collapsible **Group Bar** appears above the fixture list; clicking a group instantly selects all its fixtures and scrolls to the first one.
- The **Group Edit** modal can recall **Default all** or **Blackout all** for every selected fixture at once, using each fixture profile's own stored default/blackout values.
- Groups can be edited (rename, change member list) or deleted from the Saved Groups panel.
- Export / import the whole group store as JSON using the toolbar icon buttons.

### Fixture Controller — Default and Blackout Values

Each control in a fixture profile can store optional **Default** and **Blackout** values. These are configured in the **Default & Blackout** card while adding or editing a control.

- **None** — disables the stored value for that control. Disabled values are skipped during recall.
- **Pan/Tilt** — stores pan and tilt together; 16-bit controls use `0–65535`, 8-bit controls use `0–255`.
- **Slider / wheel controls** — store one numeric DMX value. 16-bit sliders use `0–65535`; 8-bit sliders and wheels use `0–255`.
- **RGB / RGBW / RGBWA** — use a color picker for RGB. RGBW also stores a manual `W` channel; RGBWA stores manual `W` and `Amber` channels.
- **CMY / CMYK** — use the color picker converted to CMY/CMYK. CMYK also stores a manual `K` channel.

On each patched fixture card, **Default** and **Blackout** buttons are shown when at least one control in that fixture's profile has the corresponding value enabled. Clicking one recalls all enabled values for that fixture, updates the on-screen controls, writes the live-value snapshot used by Chaser capture, and sends the resulting DMX values to the Pico when live send is enabled.

### Fixture Controller — Scene Toolbox

The **Scene Toolbox** sits in the shared right-side Toolboxes sidebar.

- The toolbox shows a configurable grid of slots (rows × columns adjustable with spinners).
- **Save scene** — snapshots every channel value for every patched fixture into a named slot.
- **Recall scene** — clears the active group/fixture selection, restores all stored controller values, updates the Chaser live-value snapshot, and sends the values to the Pico in one batch request when Live send is enabled.
- **Delete scene** — each filled slot has a small `×` button (top-right corner); click it to permanently remove that scene after confirmation.
- **Clear all channels** — the red `×` icon next to the scene JSON import/export buttons asks for confirmation, zeros every controller value, updates the live-value snapshot, and calls `/dmx/clear` on the Pico when a Pico base URL is set.
- Slots are stored server-side in `data/scene_setup.json` via `scene_setup.php`; they survive page reloads and browser changes.
- Sidebar width and toolbox order are shared across toolbox pages via `data/ui_state.json`; collapsed state is also persisted.
- Whenever a control is moved or a scene is recalled, the current live values of all controls are written to `data/fixture_live_values.json` via `fixture_setup.php?livevalues`. This keeps the Chaser page's "Capture from FC" up to date even if the Chaser page was opened before the FC page.

### Motion FX — Scene Center Toolbox

The Motion FX page has a read-only companion to the Scene Toolbox.

- Loads the same scenes from `scene_setup.php`; renders them as a clickable slot grid.
- Clicking a filled slot reads the pan/tilt channel values stored in that scene, **sends them to the Pico** as a DMX batch (updating `dmx_base_frame`), and stores them as `basePan`/`baseTilt` in the browser's motion fixture state.
- The effect then oscillates **relative to that position** rather than around any fixed stored center. Moving lights to a new position (via a scene) and starting motion will always orbit where they are now.
- The toolbox lives in the shared sidebar. Drag its colored header to reorder it, and use the sidebar resize line to adjust the shared toolbox width.
- The scene toolbox on the Motion FX page is **read-only** — it does not save or delete scenes. Scene management (save, delete) is only available on the Fixture Controller.
- The **↺ Reload from Fixture Controller** button re-fetches `fixture_setup.php` (fixture definitions, not live values) to refresh the fixture list in case fixtures were added or changed.

### Motion FX — Fixture Card Grid

Fixture cards in the Motion FX page are displayed in a responsive CSS auto-fill grid (minimum card width 220 px) rather than a single vertical list. The fixture panel is capped at 70 vh with internal scrolling — the panel heading and action buttons remain visible outside the scroll area.

---

### Scene Base Buffer

The firmware maintains a dedicated `dmx_base_frame[513]` buffer (indices 1–512 map to DMX channels) that tracks the *position layer* — the last non-FX DMX value for every channel. Motion FX effects read their center from this buffer at tick time rather than from a fixed number stored in the slot config.

**What writes to `dmx_base_frame`:**

| Source | Updates base buffer? |
|--------|----------------------|
| `/dmx/set/<ch>/<val>` GET | ✅ yes |
| `/dmx/b/<ch>:<val>,…` GET or POST batch | ✅ yes |
| Chaser tick output (Core 0) | ✅ yes |
| Motion FX tick output (Core 0) | ❌ no — intentional; prevents drift |

Because motion FX never writes back to the base buffer, the oscillation center stays fixed at whatever position was set last. There is no accumulation error even after hours of continuous playback.

**Practical workflow:**
1. Position the fixture using the Fixture Controller, or recall a scene.
2. On the Motion FX page, click that same scene in the Scene Toolbox — this sends the stored values to the Pico and updates `dmx_base_frame`.
3. Start motion (browser `▶ Start` or Pico `/motion/start`) — the effect orbits the position set in step 1/2.

When browser motion starts, the page fetches `/dmx/values.json` from the Pico and seeds the browser-side base from the live channel values, so the browser and firmware bases are always in sync.

### GPIO Control Prototype (`web/dmx_gpio.html`)

The GPIO prototype maps physical Pico GPIO inputs to common playback actions. It is intentionally input-only for the first version.

- The page stores mappings locally in the browser and pushes the active mapping set to the Pico with `POST /gpio/config`.
- **Export JSON / Import JSON** saves or restores the GPIO editor setup, including Pico base URL, enabled state, and all mappings.
- Each GPIO pin can only be used by one mapping. The page highlights duplicate pin use, and the firmware rejects duplicate digital/ADC mappings as a final safety check.
- Digital GPIO mapping pins are selected from a dropdown that excludes the configured hardware-reserved pins (`DMX_TX_PIN=2`, `DMX_TRIGGER_PIN=3`) and disables pins already used by another mapping.
- The Pico polls GPIO inputs on Core 0 with debounce and executes actions without needing the browser to stay open.
- The DMX TX pin and frame-trigger pin are reserved automatically and cannot be mapped.
- Supported pulls: `pullup`, `pulldown`.
- Supported triggers: `falling`, `rising`, `both`.
- Supported digital actions: `dmx_clear`, `dmx_output_clear`, `stop_all`, `chaser_play`, `chaser_stop`, `chaser_toggle`, `chaser_pause`, `chaser_resume`, `chaser_pause_toggle`, `chaser_tap`, `motion_start`, `motion_stop`, `motion_toggle`, `motion_tap`.
- ADC mappings are separate from digital button mappings and are limited to GPIO26, GPIO27, and GPIO28 on Pico 2 W. ADC actions include `chaser_speed`, which maps the ADC value to a chaser speed multiplier range, and `motion_bpm`, which maps the ADC value to a Motion FX BPM range.

GPIO config is a line-based text protocol:

```text
ENABLE 1
MAP 14 pullup falling dmx_clear 0 30
MAP 15 pullup falling chaser_toggle 0 30
MAP 16 pullup falling motion_tap 0 30 1
MAP 17 pullup falling chaser_tap 0 30 2
ADC 26 chaser_speed 0 10 300
ADC 27 motion_bpm 0 1000 12000
```

Format: `MAP <pin> <pull> <trigger> <action> <slot> <debounce_ms> [beat_div]`.
ADC format: `ADC <pin> <action> <slot> <min_x100> <max_x100>`.
The web editor shows `chaser_speed` ranges as normal speed multipliers, e.g. `0.10` to `6.00`, and `motion_bpm` ranges as BPM, e.g. `10.0` to `120.0`. The generated firmware line stores both as value ×100.
ADC readback and speed/BPM updates use a 10 ms mean filter to reduce ripple from pots and long wires.

Tap actions use the interval between two valid button presses. `motion_tap` writes Motion FX BPM directly. `chaser_tap` converts the tapped interval into a chaser speed multiplier using the selected slot's current step duration. Optional `beat_div` supports `1`, `2`, `4`, `8`, and `16`, where `2` means a half-beat target, `4` a quarter-beat target, and so on.

Use `dmx_clear` when the button should clear both output and the motion base buffer. Use `dmx_output_clear` when it should black out live output but keep the base buffer intact, so Motion FX can resume around the same stored center.

Firmware endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/gpio/config` | GET | Return current volatile GPIO config as JSON |
| `/gpio/config` | POST | Replace current GPIO config using the line-based protocol |
| `/gpio/status` | GET | Return input states, ADC raw values/mapped speed, event count, and last fired action |

This first prototype does not persist GPIO mappings on the Pico after reboot; save them in the web page or export a JSON backup and push again after flashing/restarting. Pico-side persistence can be added later once the action model is proven.

### Server-side Persistence

All persistent data is stored as JSON files in the PHP web server's `data/` folder. No database is required. The sync script migrates existing root-level JSON files into `data/` and writes a `.htaccess` file that denies direct browser access to the folder.

| PHP handler | JSON file | Contents |
|-------------|-----------|----------|
| `fixture_setup.php` | `data/fixture_setup.json` | Fixture profiles, patched fixtures, base URL |
| `fixture_setup.php?livevalues` | `data/fixture_live_values.json` | Snapshot of every control's current live value; written by the Fixture Controller whenever a control is moved or a scene is recalled; read by the Chaser page to capture FC state into steps |
| `scene_setup.php` | `data/scene_setup.json` | Named scene snapshots, slot grid dimensions |
| `palette_setup.php` | `data/palette_setup.json` | Reusable palette overlays and slot grid dimensions |
| `group_setup.php` | `data/group_setup.json` | Fixture group definitions |
| `chaser_setup.php` | `data/chaser_setup.json` | Saved chases, Chaser toolbox grid config, mirrored Pico slot payloads |
| `chaser_setup.php?participating` | `data/chaser_setup.json` (merged) | Participating controls map — saved/loaded independently of steps so the control selection survives step edits and can be exported/imported as standalone JSON |
| `motion_setup.php` | `data/motion_setup.json` | Motion FX browser setup, saved effect recipes, and saved Pico slot payloads |
| `ui_state.php` | `data/ui_state.json` | UI state such as section collapse flags, toolbox order, shared sidebar width, and toolbox collapse state |

All handlers accept `GET` (read) and `POST` (write). `ui_state.php` merges partial state — posting `{page, state}` only touches the keys provided and leaves the rest intact.

### Development sync

HTML files are developed locally and synced to XAMPP with:

```powershell
.\scripts\sync_fixture_controller_to_xampp.ps1
```

Target: `E:\Software\xampp\htdocs\dmx\`

---

## Code Layout

The repository is split by responsibility:

| Folder | Contents |
|--------|----------|
| `firmware/` | Pico C/C++ firmware, DMX engine, playback engines, GPIO mapper, PIO program, lwIP config |
| `web/` | Browser UI pages copied to XAMPP |
| `api/` | PHP persistence endpoints copied to XAMPP |
| `scripts/` | Local helper/deployment scripts |
| `build/` | Generated CMake/Ninja output, ignored by git |

The root `CMakeLists.txt` remains the Pico build entry point and references sources under `firmware/`.

| File | Description |
|------|-------------|
| `firmware/main.cpp` | Core 0/1 entry points, HTTP endpoint handlers, custom lwIP fs callbacks, DMX UI lock, POST callbacks for chaser/motion upload |
| `firmware/dmx_engine.cpp` / `.h` | Continuous DMX512 PIO output engine, channel buffer, thread-safe set/get. Also owns `dmx_base_frame` — the scene base buffer (see below) |
| `firmware/dmx_native.pio` | PIO program for 250 kbaud DMX framing |
| `firmware/pico_chaser.cpp` / `.h` | Pico-side step sequencer with linear crossfade, 100 Hz tick, hardware spinlock |
| `firmware/pico_motion.cpp` / `.h` | Pico-side generic FX oscillator — **64 independent slots**, pan/tilt and scalar targets, simultaneous playback with bigger-wins channel merge, target-aware axis writes, 100 Hz tick, hardware spinlock |
| `firmware/gpio_control.cpp` / `.h` | Pico-side GPIO input mapper for debounced physical triggers and playback/DMX actions |
| `firmware/lwipopts.h` | lwIP configuration — enables `LWIP_HTTPD_SUPPORT_POST`, custom file serving |
| `firmware/fsdata_custom.c` | lwIP custom filesystem stub (all responses are built dynamically) |
| `pico_sdk_import.cmake` | Pico SDK CMake integration |
| `CMakeLists.txt` | Build target, source files, SDK libraries |
| `api/fixture_setup.php` | REST handler — save/load fixture setup (`data/fixture_setup.json`); `?livevalues` endpoint snapshots/restores the current live control values (`data/fixture_live_values.json`) |
| `api/scene_setup.php` | REST handler — save/load scenes and slot grid config (`data/scene_setup.json`) |
| `api/palette_setup.php` | REST handler — save/load reusable palette overlays (`data/palette_setup.json`) |
| `api/group_setup.php` | REST handler — save/load fixture groups (`data/group_setup.json`) |
| `api/chaser_setup.php` | REST handler — save/load saved Chases toolbox entries and mirrored Pico slot payloads (`data/chaser_setup.json`); `?participating` endpoint saves/loads participating controls independently of steps |
| `api/motion_setup.php` | REST handler — save/load Motion FX setup, saved effect recipes, and mirrored Pico slot payloads (`data/motion_setup.json`) |
| `api/ui_state.php` | REST handler — per-page UI state persistence (`data/ui_state.json`); merges partial state on POST |
| `scripts/sync_fixture_controller_to_xampp.ps1` | PowerShell script — copies all HTML pages and PHP handlers to the local XAMPP htdocs folder |

---

## Requirements

- Raspberry Pi Pico 2 W (`PICO_BOARD=pico2_w`, RP2350)
- Pico SDK 2.2.0
- CMake 3.13+, Ninja, ARM embedded GCC toolchain

---

## Configure

```powershell
cmake -S . -B build -G Ninja `
  -DWIFI_SSID="your_ssid" `
  -DWIFI_PASSWORD="your_password"
```

Optional overrides:

```powershell
# DMX output pin (default 2) and frame-trigger debug pin (default 3)
-DDMX_TX_PIN=2 -DDMX_TRIGGER_PIN=3

# Universe size — limits channels in firmware and UI (default 512)
-DDMX_CHANNELS=46
```

---

## Build

```powershell
& "$env:USERPROFILE/.pico-sdk/ninja/v1.12.1/ninja.exe" -C build
```

Output: `build/pico_wifi_dmx.uf2`

---

## Flash

Using picotool (Pico connected via USB in normal run mode):

```powershell
& "$env:USERPROFILE/.pico-sdk/picotool/2.2.0-a4/picotool/picotool.exe" load build/pico_wifi_dmx.elf -fx
```

Using OpenOCD + Picoprobe/CMSIS-DAP:

```powershell
& "$env:USERPROFILE/.pico-sdk/openocd/0.12.0+dev/openocd.exe" `
  -s "$env:USERPROFILE/.pico-sdk/openocd/0.12.0+dev/scripts" `
  -f interface/cmsis-dap.cfg -f target/rp2350.cfg `
  -c "adapter speed 5000; program build/pico_wifi_dmx.elf verify reset exit"
```

---

## Resource Usage

| Resource | Value |
|----------|-------|
| Free RAM (stable, measured at runtime) | **385 024 bytes** (~195 KB) |
| Total SRAM (RP2350) | 520 KB |

## Notes

- The `/dmx/b/` batch endpoint encodes channel data in the **URL path** rather than a query string. lwIP httpd nulls the `?` in the URI before calling `fs_open_custom`, making query-string-based batch endpoints unreliable.
- `dmx_engine_set_channel()` is called from both cores. Reads/writes to the DMX buffer are 8-bit aligned and the PIO reads the buffer independently, so no additional lock is needed for channel writes. The `dmx_ui_lock` critical section protects the secondary UI mirror array only.
- Both `chaser_lock` and `mfx_lock` are module-local spinlocks. DMX writes are performed **outside** these locks (after releasing them) to avoid nested-lock deadlock.
- The motion FX tick uses static scratch buffers for 8-bit and 16-bit values. Each active slot computes its values into the scratch with a *bigger-wins* merge (max raw value per channel). The final merged result is written to the DMX engine in one pass after all slots are evaluated — this ensures simultaneous slots never interfere with each other.
- `panSwing` slots only write pan channels; `tiltSwing` slots only write tilt channels. Mixed-mode pan/tilt slots (circle, figure-8) write both. Scalar slots write only their selected scalar control. This prevents one effect from zeroing unrelated channels.
