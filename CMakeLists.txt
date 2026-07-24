# Generated Cmake Pico project file

cmake_minimum_required(VERSION 3.13)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Initialise pico_sdk from installed location
# (note this can come from environment, CMake cache etc)

# == DO NOT EDIT THE FOLLOWING LINES for the Raspberry Pi Pico VS Code Extension to work ==
if(WIN32)
    set(USERHOME $ENV{USERPROFILE})
else()
    set(USERHOME $ENV{HOME})
endif()
set(sdkVersion 2.3.0)
set(toolchainVersion 14_2_Rel1)
set(picotoolVersion 2.3.0)
set(picoVscode ${USERHOME}/.pico-sdk/cmake/pico-vscode.cmake)
if (EXISTS ${picoVscode})
    include(${picoVscode})
endif()
# ====================================================================================
set(PICO_BOARD pico2_w CACHE STRING "Board type")
if(DEFINED ENV{SSID} AND NOT DEFINED WIFI_SSID)
    set(WIFI_SSID "$ENV{SSID}" CACHE STRING "Wi-Fi SSID")
else()
    set(WIFI_SSID "" CACHE STRING "Wi-Fi SSID")
endif()

if(DEFINED ENV{SSID_PW} AND NOT DEFINED WIFI_PASSWORD)
    set(WIFI_PASSWORD "$ENV{SSID_PW}" CACHE STRING "Wi-Fi password")
else()
    set(WIFI_PASSWORD "" CACHE STRING "Wi-Fi password")
endif()

set(DMX_TX_PIN "2" CACHE STRING "DMX output GPIO")
set(DMX_TRIGGER_PIN "3" CACHE STRING "Optional DMX frame trigger/debug GPIO")
set(DMX_CHANNELS "512" CACHE STRING "Number of DMX channels to transmit")
set(DMX_REFRESH_RATE "43" CACHE STRING "DMX refresh rate in Hz")
set(MIDI_ENABLED "1" CACHE STRING "Enable DIN/TRS MIDI UART input")
set(MIDI_RX_PIN "5" CACHE STRING "MIDI UART RX GPIO")
set(MIDI_UART_ID "1" CACHE STRING "MIDI UART block, 0 or 1")
set(MIDI_BAUD "31250" CACHE STRING "MIDI serial baud rate")

if(DEFINED ENV{SSID})
    set(WIFI_SSID "$ENV{SSID}" CACHE STRING "Wi-Fi SSID" FORCE)
endif()

if(DEFINED ENV{SSID_PW})
    set(WIFI_PASSWORD "$ENV{SSID_PW}" CACHE STRING "Wi-Fi password" FORCE)
endif()

# Pull in Raspberry Pi Pico SDK (must be before project)
include(pico_sdk_import.cmake)

project(pico_wifi_dmx C CXX ASM)

# Initialise the Raspberry Pi Pico SDK
pico_sdk_init()

# Add executable. Default name is the project name, version 0.1

add_executable(pico_wifi_dmx
        firmware/main.cpp
        firmware/dmx_engine.cpp
        firmware/pico_chaser.cpp
        firmware/pico_motion.cpp
        firmware/gpio_control.cpp
        firmware/midi_input.cpp
)

pico_generate_pio_header(pico_wifi_dmx ${CMAKE_CURRENT_LIST_DIR}/firmware/dmx_native.pio)

target_compile_definitions(pico_wifi_dmx PRIVATE
        WIFI_SSID="${WIFI_SSID}"
        WIFI_PASSWORD="${WIFI_PASSWORD}"
        DMX_TX_PIN=${DMX_TX_PIN}
        DMX_TRIGGER_PIN=${DMX_TRIGGER_PIN}
        DMX_CHANNELS=${DMX_CHANNELS}
        DMX_REFRESH_RATE=${DMX_REFRESH_RATE}
        MIDI_ENABLED=${MIDI_ENABLED}
        MIDI_RX_PIN=${MIDI_RX_PIN}
        MIDI_UART_ID=${MIDI_UART_ID}
        MIDI_BAUD=${MIDI_BAUD}
        PICO_DMX_VERSION="0.9.14"
)

pico_set_program_name(pico_wifi_dmx "pico-wifi-dmx")
pico_set_program_version(pico_wifi_dmx "0.9.14")

# Modify the below lines to enable/disable output over UART/USB
pico_enable_stdio_uart(pico_wifi_dmx 0)
pico_enable_stdio_usb(pico_wifi_dmx 0)

# Add the standard library to the build
target_link_libraries(pico_wifi_dmx
        pico_stdlib
        pico_multicore
        pico_cyw43_arch_lwip_threadsafe_background
        pico_lwip_http
        hardware_adc
        hardware_dma
        hardware_pio
        hardware_uart)

# Add the standard include files to the build
target_include_directories(pico_wifi_dmx PRIVATE
        ${CMAKE_CURRENT_LIST_DIR}/firmware
)

# Add any user requested libraries
target_link_libraries(pico_wifi_dmx 
        
        )

# Keep the CYW43 firmware in its own RP2350 flash partition. New devices must
# receive the generated Wi-Fi firmware UF2 once; normal application updates can
# then use the smaller pico_wifi_dmx UF2 without rewriting the Wi-Fi blob.
pico_use_wifi_firmware_partition(pico_wifi_dmx)

pico_add_extra_outputs(pico_wifi_dmx)

