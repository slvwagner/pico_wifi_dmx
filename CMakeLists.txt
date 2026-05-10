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
set(sdkVersion 2.2.0)
set(toolchainVersion 14_2_Rel1)
set(picotoolVersion 2.2.0-a4)
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

set(USB_SERIAL_WAIT_MS "0" CACHE STRING "Time to wait for USB serial at startup")

if(DEFINED ENV{SSID})
    set(WIFI_SSID "$ENV{SSID}" CACHE STRING "Wi-Fi SSID" FORCE)
endif()

if(DEFINED ENV{SSID_PW})
    set(WIFI_PASSWORD "$ENV{SSID_PW}" CACHE STRING "Wi-Fi password" FORCE)
endif()

# Pull in Raspberry Pi Pico SDK (must be before project)
include(pico_sdk_import.cmake)

project(Micropython_Custom_C_extentions C CXX ASM)

# Initialise the Raspberry Pi Pico SDK
pico_sdk_init()

# Add executable. Default name is the project name, version 0.1

add_executable(Micropython_Custom_C_extentions Micropython_Custom_C_extentions.cpp )

target_compile_definitions(Micropython_Custom_C_extentions PRIVATE
        WIFI_SSID="${WIFI_SSID}"
        WIFI_PASSWORD="${WIFI_PASSWORD}"
        USB_SERIAL_WAIT_MS=${USB_SERIAL_WAIT_MS}
)

pico_set_program_name(Micropython_Custom_C_extentions "Micropython_Custom_C_extentions")
pico_set_program_version(Micropython_Custom_C_extentions "0.1")

# Modify the below lines to enable/disable output over UART/USB
pico_enable_stdio_uart(Micropython_Custom_C_extentions 0)
pico_enable_stdio_usb(Micropython_Custom_C_extentions 1)

# Add the standard library to the build
target_link_libraries(Micropython_Custom_C_extentions
        pico_stdlib
        pico_cyw43_arch_lwip_threadsafe_background
        pico_lwip_http)

# Add the standard include files to the build
target_include_directories(Micropython_Custom_C_extentions PRIVATE
        ${CMAKE_CURRENT_LIST_DIR}
)

# Add any user requested libraries
target_link_libraries(Micropython_Custom_C_extentions 
        
        )

pico_add_extra_outputs(Micropython_Custom_C_extentions)

