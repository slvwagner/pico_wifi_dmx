#include <stdio.h>
#include <stdarg.h>
#include <string.h>
#include <unistd.h>
#include "pico/stdlib.h"
#include "pico/stdio_usb.h"
#include "pico/sync.h"
#include "pico/cyw43_arch.h"
#include "lwip/apps/fs.h"
#include "lwip/apps/httpd.h"
#include "lwip/netif.h"
#include "lwip/ip4_addr.h"

#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif

#ifndef USB_SERIAL_WAIT_MS
#define USB_SERIAL_WAIT_MS 0
#endif

static critical_section_t log_lock;
static char log_buffer[4096];
static size_t log_length;
static char http_page[8192];
static char http_logs[6144];

extern char __StackLimit;

static void append_log_line(const char *line)
{
    critical_section_enter_blocking(&log_lock);

    size_t line_length = strlen(line);
    if (line_length >= sizeof(log_buffer)) {
        line += line_length - sizeof(log_buffer) + 1;
        line_length = strlen(line);
    }

    if (log_length + line_length >= sizeof(log_buffer)) {
        size_t remove_count = log_length + line_length - sizeof(log_buffer) + 1;
        if (remove_count > log_length) {
            remove_count = log_length;
        }
        memmove(log_buffer, log_buffer + remove_count, log_length - remove_count);
        log_length -= remove_count;
    }

    memcpy(log_buffer + log_length, line, line_length);
    log_length += line_length;
    log_buffer[log_length] = '\0';

    critical_section_exit(&log_lock);
}

static void log_printf(const char *format, ...)
{
    char line[256];
    va_list args;
    va_start(args, format);
    vsnprintf(line, sizeof(line), format, args);
    va_end(args);

    if (stdio_usb_connected()) {
        printf("%s", line);
    }
    append_log_line(line);
}

static size_t get_free_ram_bytes()
{
    char *heap_end = (char *)sbrk(0);
    return (size_t)(&__StackLimit - heap_end);
}

static const char *link_status_name(int status)
{
    switch (status) {
        case CYW43_LINK_DOWN:
            return "DOWN";
        case CYW43_LINK_JOIN:
            return "JOIN";
        case CYW43_LINK_NOIP:
            return "NOIP";
        case CYW43_LINK_UP:
            return "UP";
        case CYW43_LINK_FAIL:
            return "FAIL";
        case CYW43_LINK_NONET:
            return "NONET";
        case CYW43_LINK_BADAUTH:
            return "BADAUTH";
        default:
            return "UNKNOWN";
    }
}

static void wait_for_usb_serial()
{
    if (USB_SERIAL_WAIT_MS <= 0) {
        return;
    }

    const absolute_time_t timeout = make_timeout_time_ms(USB_SERIAL_WAIT_MS);

    while (!stdio_usb_connected() && !time_reached(timeout)) {
        sleep_ms(100);
    }
}

static void stay_alive_with_message(const char *message)
{
    while (true) {
        if (stdio_usb_connected()) {
            log_printf("%s\n", message);
        }
        sleep_ms(1000);
    }
}

static void stay_alive_with_wifi_status(const char *message, int result)
{
    while (true) {
        if (stdio_usb_connected()) {
            int wifi_status = cyw43_wifi_link_status(&cyw43_state, CYW43_ITF_STA);
            int tcpip_status = cyw43_tcpip_link_status(&cyw43_state, CYW43_ITF_STA);
            log_printf("%s: result=%d wifi=%d(%s) tcpip=%d(%s)\n",
                       message,
                       result,
                       wifi_status,
                       link_status_name(wifi_status),
                       tcpip_status,
                       link_status_name(tcpip_status));
        }
        sleep_ms(1000);
    }
}

static void html_escape_logs(char *output, size_t output_size)
{
    size_t output_length = 0;

    critical_section_enter_blocking(&log_lock);
    for (size_t i = 0; i < log_length && output_length + 6 < output_size; i++) {
        char c = log_buffer[i];
        const char *replacement = NULL;

        if (c == '&') {
            replacement = "&amp;";
        } else if (c == '<') {
            replacement = "&lt;";
        } else if (c == '>') {
            replacement = "&gt;";
        }

        if (replacement) {
            size_t replacement_length = strlen(replacement);
            if (output_length + replacement_length >= output_size) {
                break;
            }
            memcpy(output + output_length, replacement, replacement_length);
            output_length += replacement_length;
        } else {
            output[output_length++] = c;
        }
    }
    critical_section_exit(&log_lock);

    output[output_length] = '\0';
}

static void build_http_page()
{
    snprintf(
        http_page,
        sizeof(http_page),
        "HTTP/1.0 200 OK\r\n"
        "Content-Type: text/html; charset=utf-8\r\n"
        "Connection: close\r\n"
        "\r\n"
        "<!doctype html>"
        "<html>"
        "<head>"
        "<meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        "<title>Pico 2W Logs</title>"
        "<style>"
        "body{margin:0;background:#101417;color:#e8edf2;font-family:system-ui,Segoe UI,sans-serif;}"
        "main{max-width:960px;margin:0 auto;padding:24px;}"
        "h1{font-size:22px;margin:0 0 16px;}"
        "a{color:#8bd3ff;}"
        "pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#050607;border:1px solid #2f3a42;padding:16px;line-height:1.45;}"
        "</style>"
        "<script>"
        "async function loadLogs(){"
        "try{"
        "const r=await fetch('/logs.txt',{cache:'no-store'});"
        "document.getElementById('logs').textContent=await r.text();"
        "}catch(e){document.getElementById('logs').textContent='Log refresh failed';}"
        "}"
        "setInterval(loadLogs,1000);"
        "addEventListener('load',loadLogs);"
        "</script>"
        "</head>"
        "<body><main><h1>Pico 2W Logs</h1><p><a href=\"/logs.txt\">Raw logs</a></p><pre id=\"logs\">Loading...</pre></main></body>"
        "</html>");
}

static void build_logs_text()
{
    critical_section_enter_blocking(&log_lock);
    size_t copy_length = log_length;
    if (copy_length >= sizeof(http_logs)) {
        copy_length = sizeof(http_logs) - 1;
    }
    memcpy(http_logs, log_buffer + log_length - copy_length, copy_length);
    http_logs[copy_length] = '\0';
    critical_section_exit(&log_lock);
}

extern "C" int fs_open_custom(struct fs_file *file, const char *name)
{
    if (strcmp(name, "/logs.txt") == 0) {
        build_logs_text();
        file->data = http_logs;
        file->len = (int)strlen(http_logs);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (strcmp(name, "/") == 0 ||
        strcmp(name, "/index.html") == 0 ||
        strcmp(name, "/index.shtml") == 0) {
        build_http_page();
        file->data = http_page;
        file->len = (int)strlen(http_page);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    return 0;
}

extern "C" void fs_close_custom(struct fs_file *file)
{
    (void)file;
}

int main()
{
    critical_section_init(&log_lock);
    stdio_init_all();
    wait_for_usb_serial();

    log_printf("Hello, from Pico 2W!\n");

    if (WIFI_SSID[0] == '\0') {
        stay_alive_with_message("WIFI_SSID is not set. Reconfigure CMake with -DWIFI_SSID=your_ssid -DWIFI_PASSWORD=your_password");
    }

    if (cyw43_arch_init_with_country(CYW43_COUNTRY_SWITZERLAND)) {
        stay_alive_with_message("Failed to initialize Wi-Fi chip");
    }

    cyw43_arch_enable_sta_mode();

    log_printf("Connecting to Wi-Fi SSID '%s'...\n", WIFI_SSID);
    int result = cyw43_arch_wifi_connect_timeout_ms(
        WIFI_SSID,
        WIFI_PASSWORD,
        CYW43_AUTH_WPA2_MIXED_PSK,
        30000
    );

    if (result) {
        stay_alive_with_wifi_status("Wi-Fi connection failed", result);
    }

    log_printf("Connected to Wi-Fi\n");
    log_printf("Approx free RAM: %u bytes\n", (unsigned)get_free_ram_bytes());
    if (netif_default) {
        log_printf("Open logs at http://%s/\n", ip4addr_ntoa(netif_ip4_addr(netif_default)));
    }

    httpd_init();
    log_printf("HTTPD log server started on port 80\n");

    uint32_t loop_count = 0;
    while (true) {
        cyw43_arch_gpio_put(CYW43_WL_GPIO_LED_PIN, 1);
        log_printf("Wi-Fi is connected\n");
        if ((loop_count++ % 10) == 0) {
            log_printf("Approx free RAM: %u bytes\n", (unsigned)get_free_ram_bytes());
        }
        sleep_ms(500);
        cyw43_arch_gpio_put(CYW43_WL_GPIO_LED_PIN, 0);
        sleep_ms(1000);
    }
}
