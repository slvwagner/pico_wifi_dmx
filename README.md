# Micropython Custom C Extensions

Firmware project for a Raspberry Pi Pico 2 W. The current program connects to Wi-Fi, starts a small HTTP log page, and keeps that network/log work on core1 so core0 is free for the main application logic.

## Current Behavior

- Core0 starts the program, initializes USB serial/logging, launches core1, then runs `core0_application_loop()`.
- Core1 runs `core1_network_log_server()`, which initializes the Wi-Fi chip, connects to Wi-Fi, starts IPv6 autoconfig, logs IP addresses, and starts the lwIP HTTP server.
- The HTTP log page is available at `http://<pico-ip>/`.
- Raw logs are available at `http://<pico-ip>/logs.txt`.
- USB serial output is enabled. UART output is disabled.

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

Optional USB serial wait time:

```powershell
cmake -S . -B build -G Ninja -DUSB_SERIAL_WAIT_MS=5000
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

After Wi-Fi connects, the firmware logs the IPv4 address over USB serial and into the HTTP log buffer:

```text
Open logs at http://<pico-ip>/
```

Open that address in a browser on the same network.

## Code Layout

- `Micropython_Custom_C_extentions.cpp` contains the application, logging buffer, custom lwIP file callbacks, Wi-Fi setup, and core0/core1 entry points.
- `lwipopts.h` configures lwIP and enables custom HTTP file serving.
- `fsdata_custom.c` enables lwIP custom file support.
- `CMakeLists.txt` configures the Pico SDK target and links `pico_multicore`, `pico_cyw43_arch_lwip_threadsafe_background`, and `pico_lwip_http`.

## Notes

- Keep lwIP and CYW43 calls protected with the existing Pico SDK thread-safe background APIs where needed.
- `log_printf()` is safe to call from both cores because the shared log buffer is protected by a critical section.
- Add your main application code inside or below `core0_application_loop()`.
