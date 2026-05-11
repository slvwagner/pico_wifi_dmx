# Micropython Custom C Extensions

Firmware project for a Raspberry Pi Pico 2 W. The current program connects to Wi-Fi, starts a small HTTP log page, and keeps that network/log work on core1 so core0 is free for the main application logic.

## Current Behavior

- Core0 starts the program, initializes the HTTP log buffer, launches core1, then runs `core0_application_loop()`.
- Core1 runs `core1_network_log_server()`, which initializes the Wi-Fi chip, connects to Wi-Fi, starts IPv6 autoconfig, logs IP addresses, and starts the lwIP HTTP server.
- The HTTP log page is available at `http://<pico-ip>/`.
- Raw logs are available at `http://<pico-ip>/logs.txt`.
- The DMX control page is available at `http://<pico-ip>/dmx.html`.
- DMX channel values are held until changed through the HTTP UI or control endpoint.
- USB serial and UART stdio output are disabled. Logs are exposed through the HTTP page.

## Requirements

- Raspberry Pi Pico SDK 2.2.0 or compatible
- CMake and Ninja
- ARM embedded GCC toolchain
- Raspberry Pi Pico 2 W board

This project was generated for `PICO_BOARD=pico2_w`.

## Configure

Wi-Fi credentials can be supplied with CMake definitions:

```powershell
cmake -S . -B build -G Ninja -DWIFI_SSID="your_ssid" -DWIFI_PASSWORD="your_password"
```

You can also set environment variables before configuring:

```powershell
$env:SSID="your_ssid"
$env:SSID_PW="your_password"
cmake -S . -B build -G Ninja
```

DMX defaults to GPIO 2 for output and GPIO 3 for the optional frame trigger/debug signal, leaving GPIO 0/1 free for a Pico Debug Probe UART connection. Override them at configure time if your wiring needs different pins:

```powershell
cmake -S . -B build -G Ninja -DDMX_TX_PIN=2 -DDMX_TRIGGER_PIN=3
```

## Build

If CMake is on your `PATH`:

```powershell
cmake --build build
```

With the Pico SDK extension layout used on this machine:

```powershell
& 'C:\Users\slvwa\.pico-sdk\cmake\v3.31.5\bin\cmake.exe' --build build
```

The UF2 firmware is generated at:

```text
build/Micropython_Custom_C_extentions.uf2
```

## Flash

1. Hold the BOOTSEL button on the Pico 2 W.
2. Plug it into USB.
3. Copy `build/Micropython_Custom_C_extentions.uf2` to the mounted `RPI-RP2` drive.
4. The board reboots and starts the firmware.

## Finding The Log Page

After Wi-Fi connects, the firmware writes the IPv4 address into the HTTP log buffer:

```text
Open logs at http://<pico-ip>/
```

Open that address in a browser on the same network.

## DMX HTTP Controls

Open the DMX control page at:

```text
http://<pico-ip>/dmx.html
```

The page can update individual DMX channels and clear all channels. The same controls are also available as simple HTTP endpoints:

```text
http://<pico-ip>/dmx/set/1/255
http://<pico-ip>/dmx/clear
http://<pico-ip>/dmx/values/1/32
```

Channel numbers are 1-based. The firmware endpoint requires values in the valid DMX range of `0` through `255`.

## Code Layout

- `Micropython_Custom_C_extentions.cpp` contains the application, logging buffer, DMX HTTP UI, custom lwIP file callbacks, Wi-Fi setup, and core0/core1 entry points.
- `lwipopts.h` configures lwIP and enables custom HTTP file serving.
- `fsdata_custom.c` enables lwIP custom file support.
- `CMakeLists.txt` configures the Pico SDK target and links `pico_multicore`, `pico_cyw43_arch_lwip_threadsafe_background`, and `pico_lwip_http`.

## Notes

- Keep lwIP and CYW43 calls protected with the existing Pico SDK thread-safe background APIs where needed.
- `log_printf()` is safe to call from both cores because the shared log buffer is protected by a critical section.
- Add your main application code inside or below `core0_application_loop()`.
