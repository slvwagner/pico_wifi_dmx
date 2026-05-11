#include <stdio.h>
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include "pico/stdlib.h"
#include "pico/sync.h"
#include "pico/multicore.h"
#include "pico/cyw43_arch.h"
#include "lwip/apps/fs.h"
#include "lwip/apps/httpd.h"
#include "lwip/netif.h"
#include "lwip/ip4_addr.h"
#include "lwip/ip6_addr.h"

#include "dmx_engine.h"

#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif

#ifndef DMX_TX_PIN
#define DMX_TX_PIN 2
#endif

#ifndef DMX_TRIGGER_PIN
#define DMX_TRIGGER_PIN 3
#endif

#ifndef DMX_CHANNELS
#define DMX_CHANNELS 512
#endif

#ifndef DMX_REFRESH_RATE
#define DMX_REFRESH_RATE 44
#endif

static critical_section_t log_lock;
static critical_section_t dmx_ui_lock;
static char log_buffer[4096];
static size_t log_length;
static char http_page[12288];
static char http_logs[6144];
static char http_status_json[1024];
static char http_dmx_json[1024];
static uint8_t dmx_ui_values[513];
static volatile bool application_running = true;

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

static const char *ipv6_state_name(uint8_t state)
{
    if (ip6_addr_ispreferred(state)) {
        return "preferred";
    }
    if (ip6_addr_isvalid(state)) {
        return "valid";
    }
    if (ip6_addr_istentative(state)) {
        return "tentative";
    }
    if (ip6_addr_isduplicated(state)) {
        return "duplicated";
    }
    return "invalid";
}

static void start_ipv6_autoconfig()
{
    if (!netif_default) {
        return;
    }

    cyw43_arch_lwip_begin();
    netif_create_ip6_linklocal_address(netif_default, 1);
    netif_set_ip6_autoconfig_enabled(netif_default, 1);
    cyw43_arch_lwip_end();
}

static void log_ip_addresses()
{
    if (!netif_default) {
        log_printf("No default network interface\n");
        return;
    }

    char ipv4[16];
    char ipv6[LWIP_IPV6_NUM_ADDRESSES][40];
    uint8_t ipv6_state[LWIP_IPV6_NUM_ADDRESSES];
    bool ipv6_is_browser_usable[LWIP_IPV6_NUM_ADDRESSES];

    cyw43_arch_lwip_begin();
    snprintf(ipv4, sizeof(ipv4), "%s", ip4addr_ntoa(netif_ip4_addr(netif_default)));
    for (int i = 0; i < LWIP_IPV6_NUM_ADDRESSES; i++) {
        ip6addr_ntoa_r(netif_ip6_addr(netif_default, i), ipv6[i], sizeof(ipv6[i]));
        ipv6_state[i] = netif_ip6_addr_state(netif_default, i);
        ipv6_is_browser_usable[i] =
            ip6_addr_isglobal(netif_ip6_addr(netif_default, i)) ||
            ip6_addr_isuniquelocal(netif_ip6_addr(netif_default, i));
    }
    cyw43_arch_lwip_end();

    log_printf("Open logs at http://%s/\n", ipv4);
    for (int i = 0; i < LWIP_IPV6_NUM_ADDRESSES; i++) {
        if (ipv6_state[i] != IP6_ADDR_INVALID) {
            log_printf("IPv6[%d]: %s (%s, state=0x%02x)\n",
                       i,
                       ipv6[i],
                       ipv6_state_name(ipv6_state[i]),
                       ipv6_state[i]);
            if (ip6_addr_isvalid(ipv6_state[i]) && ipv6_is_browser_usable[i]) {
                log_printf("Open logs over IPv6 at http://[%s]/\n", ipv6[i]);
            }
        }
    }
}

static void stay_alive_with_message(const char *message)
{
    while (true) {
        log_printf("%s\n", message);
        sleep_ms(1000);
    }
}

static void stay_alive_with_wifi_status(const char *message, int result)
{
    while (true) {
        int wifi_status = cyw43_wifi_link_status(&cyw43_state, CYW43_ITF_STA);
        int tcpip_status = cyw43_tcpip_link_status(&cyw43_state, CYW43_ITF_STA);
        log_printf("%s: result=%d wifi=%d(%s) tcpip=%d(%s)\n",
                   message,
                   result,
                   wifi_status,
                   link_status_name(wifi_status),
                   tcpip_status,
                   link_status_name(tcpip_status));
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
        "<body><main><h1>Pico 2W Logs</h1><p><a href=\"/dmx.html\">DMX controls</a> &nbsp; <a href=\"/logs.txt\">Raw logs</a></p><pre id=\"logs\">Loading...</pre></main></body>"
        "</html>");
}

static void build_dmx_page()
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
        "<title>Pico 2W DMX</title>"
        "<style>"
        ":root{color-scheme:dark;--bg:#0d1115;--panel:#161c22;--line:#31404d;--text:#edf3f7;--muted:#9cafbf;--accent:#37c4a4;--warn:#ffbc6b;}"
        "*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,Segoe UI,sans-serif;}"
        "main{max-width:980px;margin:0 auto;padding:20px;display:grid;gap:16px}header{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}"
        "h1{font-size:22px;margin:0}.nav{display:flex;gap:12px;align-items:center}a{color:#8bd3ff}.status{color:var(--muted);font-size:14px}"
        ".panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px}.control{display:grid;gap:14px}"
        "label{display:grid;gap:6px;color:var(--muted);font-size:13px}.row{display:grid;grid-template-columns:1fr 110px;gap:12px;align-items:end}"
        "input,button{font:inherit}input[type=number]{width:100%;padding:10px;background:#0a0d10;color:var(--text);border:1px solid var(--line);border-radius:6px}"
        "input[type=range]{width:100%;accent-color:var(--accent)}.value{font-size:42px;line-height:1;font-weight:700;color:var(--accent)}"
        ".buttons,.pager{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.pager{justify-content:space-between;margin-bottom:10px}button{border:1px solid var(--line);background:#22303a;color:var(--text);padding:10px 14px;border-radius:6px;cursor:pointer}"
        "button.primary{background:var(--accent);border-color:var(--accent);color:#06110e;font-weight:700}button.warn{background:#3c2b1b;border-color:#765332;color:var(--warn)}"
        "button:disabled{opacity:.45;cursor:not-allowed}.range{color:var(--muted);font-size:14px}"
        ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:8px}.tile{min-height:54px;padding:8px;border-radius:6px;border:1px solid var(--line);background:#10161b;color:var(--text);text-align:left}"
        ".tile.active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}.tile span{display:block;color:var(--muted);font-size:12px}.tile b{font-size:18px}"
        "</style>"
        "</head>"
        "<body><main>"
        "<header><div><h1>Pico 2W DMX</h1><div class=\"status\" id=\"status\">Connecting...</div></div><div class=\"nav\"><a href=\"/\">Logs</a><a href=\"/status.json\">Status JSON</a></div></header>"
        "<section class=\"panel control\">"
        "<div class=\"row\"><label>Channel<input id=\"ch\" type=\"number\" min=\"1\" max=\"512\" value=\"1\"></label><label>Value<input id=\"num\" type=\"number\" min=\"0\" max=\"255\" value=\"0\"></label></div>"
        "<input id=\"slider\" type=\"range\" min=\"0\" max=\"255\" value=\"0\">"
        "<div class=\"value\" id=\"big\">0</div>"
        "<div class=\"buttons\"><button class=\"primary\" id=\"send\">Update channel</button><button id=\"zero\">Set selected to 0</button><button id=\"full\">Set selected to 255</button><button class=\"warn\" id=\"clear\">Clear all</button></div>"
        "</section>"
        "<section class=\"panel\"><div class=\"pager\"><button id=\"prev\">Previous 32</button><div class=\"range\" id=\"range\"></div><button id=\"next\">Next 32</button></div><div class=\"grid\" id=\"grid\"></div></section>"
        "<script>"
        "let maxCh=512;const pageSize=32,known=Array(maxCh+1).fill(0);let active=1,pageStart=1;"
        "const ch=document.getElementById('ch'),num=document.getElementById('num'),slider=document.getElementById('slider'),big=document.getElementById('big'),grid=document.getElementById('grid'),statusEl=document.getElementById('status'),rangeEl=document.getElementById('range'),prev=document.getElementById('prev'),next=document.getElementById('next');"
        "function clamp(v,min,max){v=parseInt(v||0,10);return Math.max(min,Math.min(max,isNaN(v)?min:v));}"
        "function draw(){grid.innerHTML='';const end=Math.min(maxCh,pageStart+pageSize-1);rangeEl.textContent='Channels '+pageStart+'-'+end+' of '+maxCh;prev.disabled=pageStart<=1;next.disabled=end>=maxCh;for(let i=pageStart;i<=end;i++){const b=document.createElement('button');b.className='tile'+(i===active?' active':'');b.innerHTML='<span>CH '+i+'</span><b>'+known[i]+'</b>';b.onclick=()=>select(i);grid.appendChild(b);}}"
        "function showPage(start){pageStart=clamp(start,1,maxCh);pageStart=Math.floor((pageStart-1)/pageSize)*pageSize+1;draw();loadValues();}"
        "function pageFor(c){const start=Math.floor((c-1)/pageSize)*pageSize+1;if(start!==pageStart){showPage(start);}else{draw();}}"
        "function sync(v){v=clamp(v,0,255);num.value=v;slider.value=v;big.textContent=v;known[active]=v;draw();}"
        "function select(c){active=clamp(c,1,maxCh);ch.value=active;pageFor(active);sync(known[active]);}"
        "async function setValue(c,v){c=clamp(c,1,maxCh);v=clamp(v,0,255);const r=await fetch('/dmx/set/'+c+'/'+v,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();known[j.channel]=j.value;active=j.channel;ch.value=active;sync(j.value);statusEl.textContent='Updated channel '+j.channel+' to '+j.value;}"
        "async function loadValues(){try{const r=await fetch('/dmx/values/'+pageStart+'/'+pageSize,{cache:'no-store'});const j=await r.json();j.values.forEach((v,i)=>known[j.first+i]=v);sync(known[active]);}catch(e){draw();}}"
        "async function refresh(){try{const r=await fetch('/status.json',{cache:'no-store'});const j=await r.json();maxCh=clamp(j.dmx.channels,1,512);ch.max=maxCh;statusEl.textContent=(j.dmx.running?'Running':'Stopped')+' - '+j.dmx.channels+' channels - frame '+j.dmx.frame_count;draw();}catch(e){statusEl.textContent='Status refresh failed';}}"
        "ch.onchange=()=>select(ch.value);num.oninput=()=>sync(num.value);slider.oninput=()=>sync(slider.value);"
        "prev.onclick=()=>showPage(pageStart-pageSize);next.onclick=()=>showPage(pageStart+pageSize);"
        "document.getElementById('send').onclick=()=>setValue(active,num.value).catch(e=>statusEl.textContent=e.message);"
        "document.getElementById('zero').onclick=()=>setValue(active,0).catch(e=>statusEl.textContent=e.message);"
        "document.getElementById('full').onclick=()=>setValue(active,255).catch(e=>statusEl.textContent=e.message);"
        "document.getElementById('clear').onclick=async()=>{try{const r=await fetch('/dmx/clear',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);known.fill(0);sync(0);statusEl.textContent='All channels cleared';}catch(e){statusEl.textContent=e.message;}};"
        "draw();loadValues();refresh();setInterval(refresh,1500);"
        "</script>"
        "</main></body>"
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

static void build_status_json()
{
    dmx_engine_status_t dmx;
    dmx_engine_get_status(&dmx);

    snprintf(
        http_status_json,
        sizeof(http_status_json),
        "HTTP/1.0 200 OK\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "{"
        "\"dmx\":{"
        "\"initialized\":%s,"
        "\"running\":%s,"
        "\"tx_pin\":%u,"
        "\"trigger_pin\":%u,"
        "\"channels\":%u,"
        "\"refresh_rate\":%u,"
        "\"pio_block\":%u,"
        "\"ctrl_sm\":%u,"
        "\"data_sm\":%u,"
        "\"frame_count\":%lu,"
        "\"skipped_callbacks\":%lu,"
        "\"prime_timeouts\":%lu,"
        "\"frame_timeouts\":%lu,"
        "\"auto_resyncs\":%lu"
        "}"
        "}\n",
        dmx.initialized ? "true" : "false",
        dmx.running ? "true" : "false",
        dmx.tx_pin,
        dmx.trigger_pin,
        dmx.channels,
        dmx.refresh_rate,
        dmx.pio_block,
        dmx.active_ctrl_sm,
        dmx.active_data_sm,
        (unsigned long)dmx.frame_count,
        (unsigned long)dmx.skipped_callbacks,
        (unsigned long)dmx.prime_timeouts,
        (unsigned long)dmx.frame_timeouts,
        (unsigned long)dmx.auto_resyncs);
}

static bool path_matches(const char *name, const char *path)
{
    size_t path_len = strlen(path);
    return strncmp(name, path, path_len) == 0 &&
           (name[path_len] == '\0' || name[path_len] == '?' || name[path_len] == '/');
}

static bool parse_path_u16_pair(const char *name, const char *prefix, uint16_t *first, uint16_t *second)
{
    size_t prefix_len = strlen(prefix);
    if (strncmp(name, prefix, prefix_len) != 0 || name[prefix_len] != '/') {
        return false;
    }

    char *end = NULL;
    unsigned long parsed_first = strtoul(name + prefix_len + 1, &end, 10);
    if (end == name + prefix_len + 1 || *end != '/' || parsed_first > 65535ul) {
        return false;
    }

    const char *second_start = end + 1;
    unsigned long parsed_second = strtoul(second_start, &end, 10);
    if (end == second_start || (*end != '\0' && *end != '?') || parsed_second > 65535ul) {
        return false;
    }

    *first = (uint16_t)parsed_first;
    *second = (uint16_t)parsed_second;
    return true;
}

static bool get_query_u16(const char *name, const char *key, uint16_t *value)
{
    const char *query = strchr(name, '?');
    if (!query) {
        return false;
    }
    query++;

    size_t key_len = strlen(key);
    while (*query) {
        const char *next = strchr(query, '&');
        size_t item_len = next ? (size_t)(next - query) : strlen(query);
        if (item_len > key_len + 1 &&
            strncmp(query, key, key_len) == 0 &&
            query[key_len] == '=') {
            char *end = NULL;
            unsigned long parsed = strtoul(query + key_len + 1, &end, 10);
            if (end != query + key_len + 1 && parsed <= 65535ul) {
                *value = (uint16_t)parsed;
                return true;
            }
            return false;
        }
        if (!next) {
            break;
        }
        query = next + 1;
    }

    return false;
}

static void build_dmx_json_response(unsigned status_code, const char *status_text, const char *body)
{
    snprintf(
        http_dmx_json,
        sizeof(http_dmx_json),
        "HTTP/1.0 %u %s\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "%s",
        status_code,
        status_text,
        body);
}

static void build_dmx_set_response(const char *name)
{
    uint16_t channel = 0;
    uint16_t value = 0;
    dmx_engine_status_t status;
    dmx_engine_get_status(&status);

    bool got_values = parse_path_u16_pair(name, "/dmx/set", &channel, &value);
    if (!got_values) {
        got_values = get_query_u16(name, "ch", &channel) &&
                     get_query_u16(name, "value", &value);
    }

    if (!got_values ||
        channel < 1 ||
        channel > status.channels ||
        value > 255) {
        build_dmx_json_response(400, "Bad Request", "{\"ok\":false,\"error\":\"Use /dmx/set/1/255 with valid ranges\"}\n");
        return;
    }

    if (!dmx_engine_set_channel(channel, (uint8_t)value)) {
        build_dmx_json_response(500, "Internal Server Error", "{\"ok\":false,\"error\":\"DMX channel update failed\"}\n");
        return;
    }

    critical_section_enter_blocking(&dmx_ui_lock);
    dmx_ui_values[channel] = (uint8_t)value;
    critical_section_exit(&dmx_ui_lock);

    snprintf(
        http_dmx_json,
        sizeof(http_dmx_json),
        "HTTP/1.0 200 OK\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "{\"ok\":true,\"channel\":%u,\"value\":%u}\n",
        channel,
        value);
}

static void build_dmx_clear_response()
{
    dmx_engine_clear();

    critical_section_enter_blocking(&dmx_ui_lock);
    memset(dmx_ui_values, 0, sizeof(dmx_ui_values));
    critical_section_exit(&dmx_ui_lock);

    build_dmx_json_response(200, "OK", "{\"ok\":true,\"cleared\":true}\n");
}

static void build_dmx_values_response(const char *name)
{
    uint16_t first = 1;
    uint16_t count = 32;
    uint16_t parsed = 0;
    dmx_engine_status_t status;
    dmx_engine_get_status(&status);

    if (parse_path_u16_pair(name, "/dmx/values", &first, &count)) {
        parsed = 0;
    } else if (get_query_u16(name, "first", &parsed)) {
        first = parsed;
    }
    if (get_query_u16(name, "count", &parsed)) {
        count = parsed;
    }
    if (first < 1 || first > status.channels || count < 1 || count > 64) {
        build_dmx_json_response(400, "Bad Request", "{\"ok\":false,\"error\":\"Use first within channels and count 1..64\"}\n");
        return;
    }
    if ((uint32_t)first + count - 1u > status.channels) {
        count = (uint16_t)(status.channels - first + 1u);
    }

    size_t used = (size_t)snprintf(
        http_dmx_json,
        sizeof(http_dmx_json),
        "HTTP/1.0 200 OK\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "{\"ok\":true,\"first\":%u,\"count\":%u,\"values\":[",
        first,
        count);

    critical_section_enter_blocking(&dmx_ui_lock);
    for (uint16_t i = 0; i < count && used < sizeof(http_dmx_json); ++i) {
        uint16_t channel = (uint16_t)(first + i);
        int written = snprintf(
            http_dmx_json + used,
            sizeof(http_dmx_json) - used,
            "%s%u",
            i == 0 ? "" : ",",
            dmx_ui_values[channel]);
        if (written < 0) {
            break;
        }
        used += (size_t)written;
    }
    critical_section_exit(&dmx_ui_lock);

    if (used < sizeof(http_dmx_json)) {
        snprintf(http_dmx_json + used, sizeof(http_dmx_json) - used, "]}\n");
    } else {
        http_dmx_json[sizeof(http_dmx_json) - 1] = '\0';
    }
}

extern "C" int fs_open_custom(struct fs_file *file, const char *name)
{
    if (path_matches(name, "/dmx/set")) {
        build_dmx_set_response(name);
        file->data = http_dmx_json;
        file->len = (int)strlen(http_dmx_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/dmx/clear")) {
        build_dmx_clear_response();
        file->data = http_dmx_json;
        file->len = (int)strlen(http_dmx_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/dmx/values.json")) {
        build_dmx_values_response(name);
        file->data = http_dmx_json;
        file->len = (int)strlen(http_dmx_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/dmx/values")) {
        build_dmx_values_response(name);
        file->data = http_dmx_json;
        file->len = (int)strlen(http_dmx_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (strcmp(name, "/status.json") == 0) {
        build_status_json();
        file->data = http_status_json;
        file->len = (int)strlen(http_status_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (strcmp(name, "/logs.txt") == 0) {
        build_logs_text();
        file->data = http_logs;
        file->len = (int)strlen(http_logs);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (strcmp(name, "/dmx.html") == 0 ||
        strcmp(name, "/dmx") == 0) {
        build_dmx_page();
        file->data = http_page;
        file->len = (int)strlen(http_page);
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

static void core1_network_log_server()
{
    log_printf("Core1 network/log server starting\n");

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
    start_ipv6_autoconfig();
    log_ip_addresses();

    httpd_init();
    log_printf("HTTPD log server started on port 80\n");

    uint32_t loop_count = 0;
    while (true) {
        cyw43_arch_gpio_put(CYW43_WL_GPIO_LED_PIN, 1);
        
        if ((loop_count++ % 10) == 0) {
            log_printf("Wi-Fi is connected\n");
            log_printf("Approx free RAM: %u bytes\n", (unsigned)get_free_ram_bytes());
            log_ip_addresses();
        }
        sleep_ms(500);
        cyw43_arch_gpio_put(CYW43_WL_GPIO_LED_PIN, 0);
        sleep_ms(1000);
    }
}

static void core0_application_loop()
{
    dmx_engine_config_t dmx_config;
    dmx_engine_default_config(&dmx_config);
    dmx_config.tx_pin = DMX_TX_PIN;
    dmx_config.trigger_pin = DMX_TRIGGER_PIN;
    dmx_config.channels = DMX_CHANNELS;
    dmx_config.refresh_rate = DMX_REFRESH_RATE;

    log_printf("Core0 initializing DMX: tx_pin=%u trigger_pin=%u channels=%u refresh=%uHz\n",
               dmx_config.tx_pin,
               dmx_config.trigger_pin,
               dmx_config.channels,
               dmx_config.refresh_rate);

    if (!dmx_engine_init(&dmx_config)) {
        log_printf("DMX initialization failed\n");
        stay_alive_with_message("Core0 DMX initialization failed");
    }

    if (!dmx_engine_start()) {
        log_printf("DMX start failed\n");
        stay_alive_with_message("Core0 DMX start failed");
    }

    log_printf("Core0 DMX engine running\n");

    uint32_t loop_count = 0;

    while (application_running) {
        dmx_engine_poll();

        if ((loop_count++ % 5000) == 0) {
            dmx_engine_status_t status;
            dmx_engine_get_status(&status);
            log_printf("Core0 DMX running: frames=%lu skipped=%lu timeouts=%lu resyncs=%lu\n",
                       (unsigned long)status.frame_count,
                       (unsigned long)status.skipped_callbacks,
                       (unsigned long)status.frame_timeouts,
                       (unsigned long)status.auto_resyncs);
        }
        sleep_us(50);
    }
}

int main()
{
    critical_section_init(&log_lock);
    critical_section_init(&dmx_ui_lock);

    log_printf("Hello, from Pico 2W!\n");
    log_printf("Starting network/log server on core1\n");

    multicore_launch_core1(core1_network_log_server);
    core0_application_loop();

    while (true) {
        tight_loop_contents();
    }
}
