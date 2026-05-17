# pico_wifi_dmx

WiFi-controlled DMX512 controller firmware for the Raspberry Pi Pico 2 W (RP2350). Provides real-time DMX output driven either from a browser-based UI or autonomously on the Pico itself, with no dependency on network latency for live playback.

---

## Architecture

| Core | Responsibility |
|------|----------------|
| **Core 0** | DMX engine (continuous 250 kbaud frames), chaser sequencer tick, motion FX oscillator tick — runs at 100 Hz |
| **Core 1** | WiFi (CYW43), lwIP TCP/IP stack, lwIP httpd (HTTP/1.0 API server) |

Cross-core data access is protected by `critical_section_t` hardware spinlocks. DMX buffer writes from the HTTP handler (Core 1) and from the playback engines (Core 0) are coordinated so neither blocks the other.

---

## Playback Modes

### Browser Playback
The browser pages connect directly to the Pico's HTTP API. On every tick the browser computes the next DMX values and sends only the **changed channels** in one batch request (`/dmx/b/`). Two browser tabs can run simultaneously (e.g. chaser on dimmer channels + motion FX on pan/tilt) without interfering because each page tracks its own sent state and never overwrites channels it doesn't own.

### Pico Autonomous Playback
The chaser and motion FX configurations are uploaded to the Pico via HTTP POST. After that the Pico plays back entirely on Core 0 — no further network traffic is needed. This eliminates WiFi latency jitter from the DMX output completely.

Starting browser playback automatically stops any running Pico playback, and vice versa (mutual exclusion).

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

Each chaser slot supports up to **32 steps** in firmware. The Chaser page enforces the same limit so browser playback and Pico playback use the same preset shape.

### Pico motion FX

Up to **32 independent motion FX slots** can be loaded and played simultaneously. Each slot has its own effect type, BPM, fixture list and phase offsets. When multiple slots control the same DMX channel the **bigger-wins** rule applies (highest raw value written).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/motion/load` | POST | Upload motion FX config to slot 0 (backward compat) |
| `/motion/load/<N>` | POST | Upload motion FX config to slot N (0–31) |
| `/motion/start` | GET | Start slot 0 (backward compat) |
| `/motion/start/<N>` | GET | Start slot N |
| `/motion/clear/<N>` | GET | Clear/unload slot N without clearing global DMX output |
| `/motion/stop` | GET | Stop all slots |
| `/motion/stop/<N>` | GET | Stop slot N only |
| `/motion/bpm/<N>/<bpm_x10>` | GET | Set BPM for slot N live (e.g. `/motion/bpm/0/1200` = 120.0 BPM) |
| `/motion/status` | GET | `{"ok":true,"active_mask":N,"loaded_mask":N,"elapsed_s":F}` |
| `/motion/slots` | GET | Array of per-slot info: `{"ok":true,"slots":[{"slot":N,"loaded":bool,"active":bool,"type":N,"bpm":F,"fixture_count":N},…]}` |

`active_mask` and `loaded_mask` are bitmasks — bit *i* set means slot *i* is active/loaded.

Motion FX text protocol (POST body):
```
TYPE <0=circle|1=figure8|2=panSwing|3=tiltSwing>
BPM <float>
PANAMP <0.0–1.0>
TILTAMP <0.0–1.0>
SPREAD <degrees>
FIX <enabled> <pan_ch> <pan_fine_ch> <tilt_ch> <tilt_fine_ch> <is_16bit> <phase_deg>
END
```

The `FIX` line no longer contains fixed center positions. Instead, the oscillation center is read from the **scene base buffer** (`dmx_base_frame`) at tick time — see [Scene Base Buffer](#scene-base-buffer) below.

---

## Web UI

The UI is served from a separate web server (XAMPP in development). All pages talk to the Pico via cross-origin HTTP requests using `new Image().src` for fire-and-forget GET calls.

| Page | File | Description |
|------|------|-------------|
| Fixture Controller | `index.html` | Define fixture profiles, patch fixtures, set individual channels, manage groups, save/recall scenes |
| Chaser | `dmx_chaser.html` | Build and play step sequences with crossfade; save editable presets; upload the current preset to up to 32 independent Pico slots for autonomous playback; slot status strip shows live LIVE/READY/EMPTY state for all 32 slots |
| Motion FX | `dmx_motion.html` | Configure pan/tilt oscillator effects (circle, figure-8, swing); save editable presets; upload the current preset to up to 32 independent Pico slots; slot status strip shows live LIVE/READY/EMPTY state for all 32 slots |
| Fan Out | `dmx_fan.html` | Spread any DMX control (pan, tilt, zoom, dimmer, …) as an offset fan across an ordered fixture list — see below |
| GPIO Control | `dmx_gpio.html` | Prototype editor for mapping physical GPIO button inputs to Pico playback/DMX actions |
| FPS Benchmark | `dmx_benchmark.html` | Measure round-trip request latency for single `/dmx/set` vs batch `/dmx/b/` |

Both playback pages show a **Browser Playback** section and a **Pico Playback** section. Only one can be active at a time — activating one automatically stops the other.

The **Pico base URL** is persisted in `localStorage` under the key `dmxPicoBaseUrl` and is shared across all pages — typing the IP once on any page is enough.

### Chaser / Motion FX — Presets and Pico Slots

The playback pages separate editable presets from the autonomous Pico slot memory:

- **Save Preset / Load Preset** — store and restore the editable page setup on the XAMPP server JSON file.
- **Upload to Slot** — sends the current editable preset to the selected Pico slot and mirrors that slot payload on the XAMPP server. It does not start playback.
- **Play Slot / Start Slot** — starts the already-loaded slot on the Pico.
- **Restore Saved Slots to Pico** — re-sends the saved server-side slot payloads to the Pico after reboot or firmware upload.
- **Delete slot** — loaded slots show a small `×` button in the top-right corner. It deletes the mirrored XAMPP slot payload and calls the Pico clear endpoint for that slot when the Pico base URL is set.

On the Chaser page, each uploaded Pico slot also stores its playback mode (`Single`, `Loop`, `Loop N`), loop count, direction, and speed. `Stop` resets the slot, while `Pause`/`Resume` keeps the current step and fade position.

### Chaser — Participating Controls

The **Participating Controls** panel defines which fixture+control pairs are written by the chaser. It is stored separately from the step list:

- **Save / Load** — persisted to `chaser_setup.json` via `chaser_setup.php?participating`, independently of steps. Changing presets does not overwrite the control selection.
- **Export (↓) / Import (↑)** — download or upload the participating map as a standalone JSON file. Useful for copying a control selection between chaser presets.

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

A floating, draggable, collapsible **Scene Toolbox** overlays the fixture controller page.

- The toolbox shows a configurable grid of slots (rows × columns adjustable with spinners).
- **Save scene** — snapshots every channel value for every patched fixture into a named slot.
- **Recall scene** — sends all stored channel values back to the Pico in one batch request.
- **Delete scene** — each filled slot has a small `×` button (top-right corner); click it to permanently remove that scene after confirmation.
- **Clear all channels** — the red `×` icon next to the scene JSON import/export buttons asks for confirmation, zeros every controller value, updates the live-value snapshot, and calls `/dmx/clear` on the Pico when a Pico base URL is set.
- Slots are stored server-side in `scene_setup.json` via `scene_setup.php`; they survive page reloads and browser changes.
- Toolbox position (drag) and collapsed state are persisted per-page to `ui_state.json` via `ui_state.php`.
- Whenever a control is moved or a scene is recalled, the current live values of all controls are written to `fixture_live_values.json` via `fixture_setup.php?livevalues`. This keeps the Chaser page's "Capture from FC" up to date even if the Chaser page was opened before the FC page.

### Motion FX — Scene Center Toolbox

The Motion FX page has a read-only companion to the Scene Toolbox.

- Loads the same scenes from `scene_setup.php`; renders them as a clickable slot grid.
- Clicking a filled slot reads the pan/tilt channel values stored in that scene, **sends them to the Pico** as a DMX batch (updating `dmx_base_frame`), and stores them as `basePan`/`baseTilt` in the browser's motion fixture state.
- The effect then oscillates **relative to that position** rather than around any fixed stored center. Moving lights to a new position (via a scene) and starting motion will always orbit where they are now.
- The toolbox is draggable, collapsible, and its state is persisted server-side.
- The scene toolbox on the Motion FX page is **read-only** — it does not save or delete scenes. Scene management (save, delete) is only available on the Fixture Controller and Fan Out pages.
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

### Fan Out (`dmx_fan.html`)

Spreads any DMX control as an interpolated offset across an ordered list of fixtures. Useful for creating a pan fan, tilt fan, zoom spread, dimmer gradient, etc.

**Concepts:**

- **Fan Group** — a set of fixtures ordered left-to-right (left = fan start, right = fan end). Each group can have multiple independent **Fan Axes**.
- **Fan Axis** — one control (e.g. Pan, Tilt, Zoom) with its own spread slider. Pan and Tilt axes in the same group share the same fixture order but fan completely independently.
- **Base** — the current DMX value of each fixture's channel, read from the Pico. The fan offset is added on top of the base so the spread always starts from wherever the fixture controller has positioned the lights.
- **Spread** — total offset range. In Symmetric mode the fixtures are spread ±½·spread around their base. In Start→End mode independent From/To offsets interpolate linearly across the fixture list.

**Preview bar** — shows each fixture's actual movement relative to its base. Center = no movement. Fill extends right for positive offsets, left for negative. Orange card + orange text = value was clamped at the DMX limit (reduce spread or snapshot a better base position).

**Base defaults** — when no snapshot has been taken, base defaults to the channel midpoint (`32768` for 16-bit, `128` for 8-bit) so both directions of the fan have equal room without needing a prior snapshot.

**Auto-snapshot** — bases are read from the Pico automatically:
- On page load (if URL is already stored)
- When the URL is entered/changed (800 ms debounce)
- When a control is selected for an axis
- When a fixture is added to a group

**↺ Refresh All Bases** (header button) — re-reads current Pico values for every axis in every group and immediately re-sends all fan values. Use this after changing positions in the Fixture Controller.

**Modes:**

| Mode | Sliders | Behaviour |
|------|---------|-----------|
| Symmetric ± | Spread | Fixture 1 gets `base − spread/2`, last gets `base + spread/2`, others interpolate |
| Start → End | From, To | Fixture 1 gets `base + From`, last gets `base + To`, others interpolate |

Supports 8-bit and 16-bit controls. `panTilt16` controls expose Pan and Tilt as separate selectable axes. Multiple fan groups can run simultaneously (e.g. pan fan on group 1, tilt fan on group 2) — each group sends only its own channels so they never interfere.

The Fan Out page also has a **Scene Toolbox** (same slot grid as the Fixture Controller) for saving and recalling scenes, including the ability to delete individual scenes from their slot with the `×` button.

The red **Clear all DMX channels** icon in the Fan Out scene toolbox calls `/dmx/clear` on the Pico and resets all configured Fan Out lane base values to `0`. This keeps the fan previews and offsets aligned with the cleared hardware state instead of continuing from stale base snapshots.

### GPIO Control Prototype (`dmx_gpio.html`)

The GPIO prototype maps physical Pico GPIO inputs to common playback actions. It is intentionally input-only for the first version.

- The page stores mappings locally in the browser and pushes the active mapping set to the Pico with `POST /gpio/config`.
- **Export JSON / Import JSON** saves or restores the GPIO editor setup, including Pico base URL, enabled state, and all mappings.
- Each GPIO pin can only be used by one mapping. The page highlights duplicate pin use, and the firmware rejects duplicate digital/ADC mappings as a final safety check.
- Digital GPIO mapping pins are selected from a dropdown that excludes the configured hardware-reserved pins (`DMX_TX_PIN=2`, `DMX_TRIGGER_PIN=3`) and disables pins already used by another mapping.
- The Pico polls GPIO inputs on Core 0 with debounce and executes actions without needing the browser to stay open.
- The DMX TX pin and frame-trigger pin are reserved automatically and cannot be mapped.
- Supported pulls: `pullup`, `pulldown`.
- Supported triggers: `falling`, `rising`, `both`.
- Supported digital actions: `dmx_clear`, `dmx_output_clear`, `stop_all`, `chaser_play`, `chaser_stop`, `chaser_toggle`, `chaser_pause`, `chaser_resume`, `chaser_pause_toggle`, `motion_start`, `motion_stop`, `motion_toggle`.
- ADC mappings are separate from digital button mappings and are limited to GPIO26, GPIO27, and GPIO28 on Pico 2 W. The first ADC action is `chaser_speed`, which maps the ADC value to a chaser speed multiplier range.

GPIO config is a line-based text protocol:

```text
ENABLE 1
MAP 14 pullup falling dmx_clear 0 30
MAP 15 pullup falling chaser_toggle 0 30
ADC 26 chaser_speed 0 10 300
```

Format: `MAP <pin> <pull> <trigger> <action> <slot> <debounce_ms>`.
ADC format: `ADC <pin> <action> <slot> <min_x100> <max_x100>`.
The web editor shows ADC ranges as normal speed multipliers, e.g. `0.10` to `6.00`; the generated firmware line stores the same values as `10` to `600`.
ADC readback and multiplier updates use a 10 ms mean filter to reduce ripple from pots and long wires.

Use `dmx_clear` when the button should clear both output and the motion base buffer. Use `dmx_output_clear` when it should black out live output but keep the base buffer intact, so Motion FX can resume around the same stored center.

Firmware endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/gpio/config` | GET | Return current volatile GPIO config as JSON |
| `/gpio/config` | POST | Replace current GPIO config using the line-based protocol |
| `/gpio/status` | GET | Return input states, ADC raw values/mapped speed, event count, and last fired action |

This first prototype does not persist GPIO mappings on the Pico after reboot; save them in the web page or export a JSON backup and push again after flashing/restarting. Pico-side persistence can be added later once the action model is proven.

### Server-side Persistence

All persistent data is stored as JSON files on the PHP web server. No database is required.

| PHP handler | JSON file | Contents |
|-------------|-----------|----------|
| `fixture_setup.php` | `fixture_setup.json` | Fixture profiles, patched fixtures, base URL |
| `fixture_setup.php?livevalues` | `fixture_live_values.json` | Snapshot of every control's current live value; written by the Fixture Controller whenever a control is moved or a scene is recalled; read by the Chaser page to capture FC state into steps |
| `scene_setup.php` | `scene_setup.json` | Named scene snapshots, slot grid dimensions |
| `group_setup.php` | `group_setup.json` | Fixture group definitions |
| `chaser_setup.php` | `chaser_setup.json` | Chaser step sequences and slot config |
| `chaser_setup.php?participating` | `chaser_setup.json` (merged) | Participating controls map — saved/loaded independently of steps so the control selection survives step edits and can be exported/imported as standalone JSON |
| `ui_state.php` | `ui_state.json` | Per-page UI state (section collapse flags, floating toolbox positions) |

All handlers accept `GET` (read) and `POST` (write). `ui_state.php` merges partial state — posting `{page, state}` only touches the keys provided and leaves the rest intact.

### Development sync

HTML files are developed locally and synced to XAMPP with:

```powershell
.\sync_fixture_controller_to_xampp.ps1
```

Target: `E:\Software\xampp\htdocs\dmx\`

---

## Code Layout

| File | Description |
|------|-------------|
| `main.cpp` | Core 0/1 entry points, HTTP endpoint handlers, custom lwIP fs callbacks, DMX UI lock, POST callbacks for chaser/motion upload |
| `dmx_engine.cpp` / `.h` | Continuous DMX512 PIO output engine, channel buffer, thread-safe set/get. Also owns `dmx_base_frame` — the scene base buffer (see below) |
| `dmx_native.pio` | PIO program for 250 kbaud DMX framing |
| `pico_chaser.cpp` / `.h` | Pico-side step sequencer with linear crossfade, 100 Hz tick, hardware spinlock |
| `pico_motion.cpp` / `.h` | Pico-side pan/tilt oscillator — **32 independent slots**, simultaneous playback with bigger-wins channel merge, axes-only writes (pan-swing never touches tilt channels and vice versa), 100 Hz tick, hardware spinlock |
| `gpio_control.cpp` / `.h` | Pico-side GPIO input mapper for debounced physical triggers and playback/DMX actions |
| `lwipopts.h` | lwIP configuration — enables `LWIP_HTTPD_SUPPORT_POST`, custom file serving |
| `fsdata_custom.c` | lwIP custom filesystem stub (all responses are built dynamically) |
| `pico_sdk_import.cmake` | Pico SDK CMake integration |
| `CMakeLists.txt` | Build target, source files, SDK libraries |
| `fixture_setup.php` | REST handler — save/load fixture setup (`fixture_setup.json`); `?livevalues` endpoint snapshots/restores the current live control values (`fixture_live_values.json`) |
| `scene_setup.php` | REST handler — save/load scenes and slot grid config (`scene_setup.json`) |
| `group_setup.php` | REST handler — save/load fixture groups (`group_setup.json`) |
| `chaser_setup.php` | REST handler — save/load chaser step sequences (`chaser_setup.json`); `?participating` endpoint saves/loads participating controls independently of steps |
| `ui_state.php` | REST handler — per-page UI state persistence (`ui_state.json`); merges partial state on POST |
| `sync_fixture_controller_to_xampp.ps1` | PowerShell script — copies all HTML pages and PHP handlers to the local XAMPP htdocs folder |

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
| Free RAM (stable, measured at runtime) | **385 024 bytes** (~376 KB) |
| Total SRAM (RP2350) | 520 KB |

## Notes

- The `/dmx/b/` batch endpoint encodes channel data in the **URL path** rather than a query string. lwIP httpd nulls the `?` in the URI before calling `fs_open_custom`, making query-string-based batch endpoints unreliable.
- `dmx_engine_set_channel()` is called from both cores. Reads/writes to the DMX buffer are 8-bit aligned and the PIO reads the buffer independently, so no additional lock is needed for channel writes. The `dmx_ui_lock` critical section protects the secondary UI mirror array only.
- Both `chaser_lock` and `mfx_lock` are module-local spinlocks. DMX writes are performed **outside** these locks (after releasing them) to avoid nested-lock deadlock.
- The motion FX tick uses a static per-slot **scratch buffer** (`dmx_scratch[513]` + `dmx_touched[513]`). Each active slot computes its values into the scratch with a *bigger-wins* merge (max raw value per channel). The final merged result is written to the DMX engine in one pass after all slots are evaluated — this ensures simultaneous slots never interfere with each other.
- `panSwing` slots only write pan channels; `tiltSwing` slots only write tilt channels. Mixed-mode slots (circle, figure-8) write both. This prevents a pan-only slot from zeroing tilt when no tilt data is present in its scratch.
