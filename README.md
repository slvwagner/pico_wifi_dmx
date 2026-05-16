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
| `/dmx/clear` | GET | Zero all channels |
| `/dmx/values/<start>/<count>` | GET | Read up to 64 channel values as JSON array |
| `/dmx/values.json` | GET | Read all channel values |

### Pico chaser

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chaser/load` | POST | Upload chaser config (text protocol, see below) |
| `/chaser/play` | GET | Start/resume Pico-side chaser |
| `/chaser/stop` | GET | Stop Pico-side chaser |
| `/chaser/status` | GET | `{"playing":bool,"step":N,"step_count":N,"elapsed_ms":N}` |

Chaser text protocol (POST body):
```
LOOP 1
STEP <duration_ms> <fade_percent>
CH <channel> <value>
CH <channel> <value>
END
STEP …
END
```

### Pico motion FX

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/motion/load` | POST | Upload motion FX config (text protocol, see below) |
| `/motion/start` | GET | Start Pico-side motion FX |
| `/motion/stop` | GET | Stop Pico-side motion FX |
| `/motion/status` | GET | `{"playing":bool,"type":N,"bpm":F}` |

Motion FX text protocol (POST body):
```
TYPE <0=circle|1=figure8|2=panSwing|3=tiltSwing>
BPM <float>
PANAMP <0.0–1.0>
TILTAMP <0.0–1.0>
SPREAD <degrees>
FIX <enabled> <pan_ch> <pan_fine_ch> <tilt_ch> <tilt_fine_ch> <is_16bit> <pan_center> <tilt_center> <phase_deg>
END
```

---

## Web UI

The UI is served from a separate web server (XAMPP in development). All pages talk to the Pico via cross-origin HTTP requests using `new Image().src` for fire-and-forget GET calls.

| Page | File | Description |
|------|------|-------------|
| Fixture Controller | `index.html` | Define fixture profiles, patch fixtures, set individual channels |
| Chaser | `dmx_chaser.html` | Build and play step sequences with crossfade; upload to Pico for autonomous playback |
| Motion FX | `dmx_motion.html` | Configure pan/tilt oscillator effects (circle, figure-8, swing); upload to Pico |
| FPS Benchmark | `dmx_benchmark.html` | Measure round-trip request latency for single `/dmx/set` vs batch `/dmx/b/` |

Both playback pages show a **Browser Playback** section and a **Pico Playback** section. Only one can be active at a time — activating one automatically stops the other.

### Development sync

HTML files are developed locally and synced to XAMPP with:

```powershell
.\sync_fixture_controller_to_xampp.ps1
```

Target: `E:\Software\xampp\htdocs\dmx-fixtures\`

---

## Code Layout

| File | Description |
|------|-------------|
| `main.cpp` | Core 0/1 entry points, HTTP endpoint handlers, custom lwIP fs callbacks, DMX UI lock, POST callbacks for chaser/motion upload |
| `dmx_engine.cpp` / `.h` | Continuous DMX512 PIO output engine, channel buffer, thread-safe set/get |
| `dmx_native.pio` | PIO program for 250 kbaud DMX framing |
| `pico_chaser.cpp` / `.h` | Pico-side step sequencer with linear crossfade, 100 Hz tick, hardware spinlock |
| `pico_motion.cpp` / `.h` | Pico-side pan/tilt oscillator (sinf/cosf), 8-bit and 16-bit modes, 100 Hz tick |
| `lwipopts.h` | lwIP configuration — enables `LWIP_HTTPD_SUPPORT_POST`, custom file serving |
| `fsdata_custom.c` | lwIP custom filesystem stub (all responses are built dynamically) |
| `pico_sdk_import.cmake` | Pico SDK CMake integration |
| `CMakeLists.txt` | Build target, source files, SDK libraries |

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

## Notes

- The `/dmx/b/` batch endpoint encodes channel data in the **URL path** rather than a query string. lwIP httpd nulls the `?` in the URI before calling `fs_open_custom`, making query-string-based batch endpoints unreliable.
- `dmx_engine_set_channel()` is called from both cores. Reads/writes to the DMX buffer are 8-bit aligned and the PIO reads the buffer independently, so no additional lock is needed for channel writes. The `dmx_ui_lock` critical section protects the secondary UI mirror array only.
- Both `chaser_lock` and `mfx_lock` are module-local spinlocks. DMX writes are performed **outside** these locks (after releasing them) to avoid nested-lock deadlock.
