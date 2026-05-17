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
#include "lwip/pbuf.h"

#include "dmx_engine.h"
#include "pico_chaser.h"
#include "pico_motion.h"
#include "gpio_control.h"

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

#define DMX_STRINGIFY_VALUE(value) #value
#define DMX_STRINGIFY(value) DMX_STRINGIFY_VALUE(value)
#define DMX_CHANNELS_TEXT DMX_STRINGIFY(DMX_CHANNELS)

#ifndef DMX_REFRESH_RATE
#define DMX_REFRESH_RATE 40
#endif

static critical_section_t log_lock;
static critical_section_t dmx_ui_lock;
static char log_buffer[4096];
static size_t log_length;
static char http_page[12288];
static char http_logs[6144];
static char http_status_json[1024];
static char http_dmx_json[1024];
static char http_dmx_base_json[2560];  /* 512 ch × 4 bytes + headers */
static char http_playback_json[12288];
static char http_gpio_json[4096];
static char http_gpio_body[3072];
static uint8_t dmx_ui_values[513];
static volatile bool application_running = true;

/* POST receive buffer */
#define POST_BUFFER_MAX (12 * 1024)
static char    post_buffer[POST_BUFFER_MAX];
static size_t  post_length = 0;
static enum { POST_NONE = 0, POST_CHASER, POST_MOTION, POST_DMX_BATCH, POST_GPIO_CONFIG } post_type = POST_NONE;
static uint8_t post_slot = 0;

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
        "button:disabled{opacity:.45;cursor:not-allowed}.range,.selection{color:var(--muted);font-size:14px}"
        ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:8px}.tile{min-height:54px;padding:8px;border-radius:6px;border:1px solid var(--line);background:#10161b;color:var(--text);text-align:left}"
        ".tile.active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}.tile.selected{background:#17362f;border-color:#37c4a4}.tile span{display:block;color:var(--muted);font-size:12px}.tile b{font-size:18px}"
        "</style>"
        "</head>"
        "<body><main>"
        "<header><div><h1>Pico 2W DMX</h1><div class=\"status\" id=\"status\">Connecting...</div></div><div class=\"nav\"><a href=\"/\">Logs</a><a href=\"/status.json\">Status JSON</a></div></header>"
        "<section class=\"panel control\">"
        "<div class=\"row\"><label>Channel<input id=\"ch\" type=\"number\" min=\"1\" max=\"" DMX_CHANNELS_TEXT "\" value=\"1\"></label><label>Value<input id=\"num\" type=\"number\" min=\"0\" max=\"255\" value=\"0\"></label></div>"
        "<input id=\"slider\" type=\"range\" min=\"0\" max=\"255\" value=\"0\">"
        "<div class=\"value\" id=\"big\">0</div>"
        "<div class=\"selection\" id=\"selection\">No channels selected</div>"
        "<div class=\"buttons\"><button id=\"multi\">Multiselect off</button><button class=\"primary\" id=\"send\">Apply slider value</button><button id=\"zero\">Set to 0</button><button id=\"full\">Set to 255</button><button id=\"clearSel\">Clear selection</button><button class=\"warn\" id=\"clear\">Clear all</button></div>"
        "</section>"
        "<section class=\"panel\"><div class=\"pager\"><button id=\"prev\">Previous 32</button><div class=\"range\" id=\"range\"></div><button id=\"next\">Next 32</button></div><div class=\"grid\" id=\"grid\"></div></section>"
        "<script>"
        "const configuredMax=parseInt(document.getElementById('ch').max,10)||512;let maxCh=configuredMax;const pageSize=32,known=Array(configuredMax+1).fill(0),selected=Array(configuredMax+1).fill(false);let active=1,pageStart=1,selectedCount=0,multi=false;"
        "const ch=document.getElementById('ch'),num=document.getElementById('num'),slider=document.getElementById('slider'),big=document.getElementById('big'),grid=document.getElementById('grid'),statusEl=document.getElementById('status'),rangeEl=document.getElementById('range'),selectionEl=document.getElementById('selection'),prev=document.getElementById('prev'),next=document.getElementById('next');"
        "function clamp(v,min,max){v=parseInt(v||0,10);return Math.max(min,Math.min(max,isNaN(v)?min:v));}"
        "function draw(){grid.innerHTML='';const end=Math.min(maxCh,pageStart+pageSize-1);rangeEl.textContent='Channels '+pageStart+'-'+end+' of '+maxCh;selectionEl.textContent=selectedCount?selectedCount+' channel'+(selectedCount===1?'':'s')+' selected':'No channels selected';prev.disabled=pageStart<=1;next.disabled=end>=maxCh;document.getElementById('multi').textContent=multi?'Multiselect on':'Multiselect off';for(let i=pageStart;i<=end;i++){const b=document.createElement('button');b.className='tile'+(i===active?' active':'')+(selected[i]?' selected':'');b.innerHTML='<span>CH '+i+'</span><b>'+known[i]+'</b>';b.onclick=()=>pickTile(i);grid.appendChild(b);}}"
        "function showPage(start){pageStart=clamp(start,1,maxCh);pageStart=Math.floor((pageStart-1)/pageSize)*pageSize+1;draw();loadValues();}"
        "function pageFor(c){const start=Math.floor((c-1)/pageSize)*pageSize+1;if(start!==pageStart){showPage(start);}else{draw();}}"
        "function showValue(v){v=clamp(v,0,255);num.value=v;slider.value=v;big.textContent=v;draw();}"
        "function sync(v){v=clamp(v,0,255);known[active]=v;showValue(v);}"
        "function setSelected(c,on){c=clamp(c,1,maxCh);if(selected[c]!==on){selected[c]=on;selectedCount+=on?1:-1;}}"
        "function toggleSelect(c){active=clamp(c,1,maxCh);ch.value=active;setSelected(active,!selected[active]);pageFor(active);showValue(known[active]);}"
        "function pickTile(c){if(multi){toggleSelect(c);}else{select(c);}}"
        "function clearSelection(){selected.fill(false);selectedCount=0;}"
        "function selectedTargets(){if(!multi)return [active];const out=[];for(let i=1;i<=maxCh;i++){if(selected[i])out.push(i);}return out.length?out:[active];}"
        "function select(c){active=clamp(c,1,maxCh);ch.value=active;if(!multi)clearSelection();pageFor(active);sync(known[active]);}"
        "async function setOne(c,v){c=clamp(c,1,maxCh);v=clamp(v,0,255);const r=await fetch('/dmx/set/'+c+'/'+v,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();known[j.channel]=j.value;return j;}"
        "async function setValue(c,v){const j=await setOne(c,v);active=j.channel;ch.value=active;sync(j.value);statusEl.textContent='Updated channel '+j.channel+' to '+j.value;}"
        "async function setSelectedValues(v){v=clamp(v,0,255);const targets=selectedTargets();for(const c of targets){await setOne(c,v);}showValue(v);statusEl.textContent='Updated '+targets.length+' channel'+(targets.length===1?'':'s')+' to '+v;}"
        "async function loadValues(){try{const r=await fetch('/dmx/values/'+pageStart+'/'+pageSize,{cache:'no-store'});const j=await r.json();j.values.forEach((v,i)=>known[j.first+i]=v);showValue(known[active]);}catch(e){draw();}}"
        "async function refresh(){try{const r=await fetch('/status.json',{cache:'no-store'});const j=await r.json();maxCh=clamp(j.dmx.channels,1,configuredMax);ch.max=maxCh;active=clamp(active,1,maxCh);ch.value=active;pageStart=Math.floor((clamp(pageStart,1,maxCh)-1)/pageSize)*pageSize+1;statusEl.textContent=(j.dmx.running?'Running':'Stopped')+' - '+j.dmx.channels+' channels - frame '+j.dmx.frame_count;draw();}catch(e){statusEl.textContent='Status refresh failed';}}"
        "ch.onchange=()=>select(ch.value);num.oninput=()=>sync(num.value);slider.oninput=()=>sync(slider.value);"
        "prev.onclick=()=>showPage(pageStart-pageSize);next.onclick=()=>showPage(pageStart+pageSize);"
        "document.getElementById('send').onclick=()=>setSelectedValues(num.value).catch(e=>statusEl.textContent=e.message);"
        "document.getElementById('zero').onclick=()=>setSelectedValues(0).catch(e=>statusEl.textContent=e.message);"
        "document.getElementById('full').onclick=()=>setSelectedValues(255).catch(e=>statusEl.textContent=e.message);"
        "document.getElementById('multi').onclick=()=>{multi=!multi;if(!multi)clearSelection();draw();};"
        "document.getElementById('clearSel').onclick=()=>{clearSelection();draw();};"
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
        "Access-Control-Allow-Origin: *\r\n"
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
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "%s",
        status_code,
        status_text,
        body);
}

static void build_gpio_json_response(unsigned status_code, const char *status_text, const char *body)
{
    snprintf(
        http_gpio_json,
        sizeof(http_gpio_json),
        "HTTP/1.0 %u %s\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "%s",
        status_code,
        status_text,
        body);
}

// /dmx/b/<ch>:<val>,<ch>:<val>,…  — batch set, data encoded in path (no query string)
// lwIP httpd strips query strings before fs_open, so we must use the path.
static void build_dmx_b_response(const char *name)
{
    // name = "/dmx/b/1:255,2:128,..."  — skip the 7-char prefix "/dmx/b/"
    const char *data = name + 7;
    if (!*data) {
        build_dmx_json_response(400, "Bad Request", "{\"ok\":false,\"error\":\"Use /dmx/b/ch:val,ch:val\"}\n");
        return;
    }

    dmx_engine_status_t status;
    dmx_engine_get_status(&status);

    uint16_t updated = 0;
    const char *p = data;
    while (*p) {
        char *end_ch = NULL;
        unsigned long ch = strtoul(p, &end_ch, 10);
        if (end_ch != p && *end_ch == ':' && ch >= 1 && ch <= status.channels) {
            char *end_val = NULL;
            unsigned long val = strtoul(end_ch + 1, &end_val, 10);
            if (end_val != end_ch + 1 && val <= 255) {
                dmx_engine_set_channel((uint16_t)ch, (uint8_t)val);
                dmx_engine_set_base_channel((uint16_t)ch, (uint8_t)val);
                critical_section_enter_blocking(&dmx_ui_lock);
                dmx_ui_values[ch] = (uint8_t)val;
                critical_section_exit(&dmx_ui_lock);
                updated++;
            }
            p = end_val;
        } else {
            const char *next = strchr(p, ',');
            if (!next) break;
            p = next;
        }
        if (*p == ',') p++;
        else break;
    }

    snprintf(
        http_dmx_json,
        sizeof(http_dmx_json),
        "HTTP/1.0 200 OK\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "{\"ok\":true,\"updated\":%u}\n",
        updated);
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
    dmx_engine_set_base_channel(channel, (uint8_t)value);

    critical_section_enter_blocking(&dmx_ui_lock);
    dmx_ui_values[channel] = (uint8_t)value;
    critical_section_exit(&dmx_ui_lock);

    snprintf(
        http_dmx_json,
        sizeof(http_dmx_json),
        "HTTP/1.0 200 OK\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
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

static void gpio_clear_dmx_and_ui()
{
    dmx_engine_clear();
    critical_section_enter_blocking(&dmx_ui_lock);
    memset(dmx_ui_values, 0, sizeof(dmx_ui_values));
    critical_section_exit(&dmx_ui_lock);
}

static void gpio_clear_dmx_output_and_ui()
{
    dmx_engine_clear_output();
    critical_section_enter_blocking(&dmx_ui_lock);
    memset(dmx_ui_values, 0, sizeof(dmx_ui_values));
    critical_section_exit(&dmx_ui_lock);
}

static void build_dmx_output_clear_response()
{
    gpio_clear_dmx_output_and_ui();
    build_dmx_json_response(200, "OK", "{\"ok\":true,\"cleared\":true,\"base_preserved\":true}\n");
}

static void build_dmx_base_response(void)
{
    dmx_engine_status_t status;
    dmx_engine_get_status(&status);

    size_t used = (size_t)snprintf(
        http_dmx_base_json,
        sizeof(http_dmx_base_json),
        "HTTP/1.0 200 OK\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "[");

    for (uint16_t ch = 1; ch <= status.channels; ch++) {
        int written = snprintf(
            http_dmx_base_json + used,
            sizeof(http_dmx_base_json) - used,
            "%s%u",
            ch == 1 ? "" : ",",
            dmx_engine_get_base_channel(ch));
        if (written < 0) break;
        used += (size_t)written;
    }

    if (used + 2 < sizeof(http_dmx_base_json)) {
        snprintf(http_dmx_base_json + used, sizeof(http_dmx_base_json) - used, "]\n");
    } else {
        http_dmx_base_json[sizeof(http_dmx_base_json) - 1] = '\0';
    }
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

static void build_chaser_status_response()
{
    chaser_status_t s;
    chaser_get_status(&s);
    snprintf(http_playback_json, sizeof(http_playback_json),
        "HTTP/1.0 200 OK\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "{\"ok\":true,\"active_mask\":%lu,\"loaded_mask\":%lu,"
        "\"paused_mask\":%lu,\"step\":%u,\"step_count\":%u,\"elapsed_ms\":%lu}\n",
        (unsigned long)s.active_mask,
        (unsigned long)s.loaded_mask,
        (unsigned long)s.paused_mask,
        s.step,
        s.step_count,
        (unsigned long)s.elapsed_ms);
}

static void build_chaser_slots_response()
{
    int used = snprintf(http_playback_json, sizeof(http_playback_json),
        "HTTP/1.0 200 OK\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "{\"ok\":true,\"slots\":[");
    for (uint8_t i = 0; i < CHASER_MAX_SLOTS && used < (int)sizeof(http_playback_json) - 256; i++) {
        chaser_slot_info_t info;
        chaser_get_slot_info(i, &info);
        used += snprintf(http_playback_json + used, sizeof(http_playback_json) - used,
            "%s{\"slot\":%u,\"loaded\":%s,\"active\":%s,\"paused\":%s,\"loop\":%s,\"mode\":%u,\"direction\":%u,\"loop_count\":%u,\"completed_loops\":%u,\"current_step\":%u,\"step_count\":%u,\"speed_mult\":%.2f}",
            i == 0 ? "" : ",",
            (unsigned)i,
            info.loaded     ? "true" : "false",
            info.active     ? "true" : "false",
            info.paused     ? "true" : "false",
            info.loop       ? "true" : "false",
            (unsigned)info.mode,
            (unsigned)info.direction,
            info.loop_count,
            info.completed_loops,
            info.current_step,
            info.step_count,
            (double)info.speed_mult);
    }
    snprintf(http_playback_json + used, sizeof(http_playback_json) - used, "]}\n");
}

static void build_motion_status_response()
{
    mfx_status_t s;
    mfx_get_status(&s);
    snprintf(http_playback_json, sizeof(http_playback_json),
        "HTTP/1.0 200 OK\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "{\"ok\":true,\"active_mask\":%lu,\"loaded_mask\":%lu,\"elapsed_s\":%.2f}\n",
        (unsigned long)s.active_mask,
        (unsigned long)s.loaded_mask,
        (double)s.elapsed_s);
}

static void build_motion_slots_response()
{
    int used = snprintf(http_playback_json, sizeof(http_playback_json),
        "HTTP/1.0 200 OK\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "{\"ok\":true,\"slots\":[");
    for (uint8_t i = 0; i < MFX_MAX_SLOTS && used < (int)sizeof(http_playback_json) - 160; i++) {
        mfx_slot_info_t info;
        mfx_get_slot_info(i, &info);
        used += snprintf(http_playback_json + used, sizeof(http_playback_json) - used,
            "%s{\"slot\":%u,\"loaded\":%s,\"active\":%s,\"type\":%d,\"bpm\":%.2f,\"fixture_count\":%u}",
            i == 0 ? "" : ",",
            (unsigned)i,
            info.loaded ? "true" : "false",
            info.active ? "true" : "false",
            info.type,
            (double)info.bpm,
            info.fixture_count);
    }
    snprintf(http_playback_json + used, sizeof(http_playback_json) - used, "]}\n");
}

static void build_playback_ok_response(const char *msg)
{
    snprintf(http_playback_json, sizeof(http_playback_json),
        "HTTP/1.0 200 OK\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "{\"ok\":true,\"msg\":\"%s\"}\n", msg);
}

static void build_playback_err_response(const char *msg)
{
    snprintf(http_playback_json, sizeof(http_playback_json),
        "HTTP/1.0 400 Bad Request\r\n"
        "Content-Type: application/json; charset=utf-8\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n"
        "\r\n"
        "{\"ok\":false,\"error\":\"%s\"}\n", msg);
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

    if (path_matches(name, "/dmx/b")) {
        build_dmx_b_response(name);
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

    if (path_matches(name, "/dmx/output_clear") || path_matches(name, "/dmx/clear_output")) {
        build_dmx_output_clear_response();
        file->data = http_dmx_json;
        file->len = (int)strlen(http_dmx_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/dmx/base")) {
        build_dmx_base_response();
        file->data = http_dmx_base_json;
        file->len = (int)strlen(http_dmx_base_json);
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

    /* ----- GPIO control endpoints ------------------------------------- */
    if (path_matches(name, "/gpio/config")) {
        gpio_control_write_config_json(http_gpio_body, sizeof(http_gpio_body));
        build_gpio_json_response(200, "OK", http_gpio_body);
        file->data = http_gpio_json;
        file->len = (int)strlen(http_gpio_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/gpio/status")) {
        gpio_control_write_status_json(http_gpio_body, sizeof(http_gpio_body));
        build_gpio_json_response(200, "OK", http_gpio_body);
        file->data = http_gpio_json;
        file->len = (int)strlen(http_gpio_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/gpio/config_ok")) {
        file->data = http_gpio_json;
        file->len = (int)strlen(http_gpio_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    /* ----- Chaser endpoints ------------------------------------------- */
    /* /chaser/play        — play slot 0 (backward compat)
       /chaser/play/<N>    — play slot N */
    if (path_matches(name, "/chaser/play")) {
        uint8_t slot = 0;
        if (name[12] == '/') {
            unsigned long s = strtoul(name + 13, NULL, 10);
            if (s < CHASER_MAX_SLOTS) slot = (uint8_t)s;
        }
        chaser_play(slot);
        build_playback_ok_response("chaser playing");
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/chaser/stop")) {
        if (name[12] == '/') {
            /* /chaser/stop/<slot> — stop one slot only */
            unsigned long s = strtoul(name + 13, NULL, 10);
            if (s < CHASER_MAX_SLOTS) chaser_stop_slot((uint8_t)s);
            build_playback_ok_response("chaser slot stopped");
        } else {
            /* /chaser/stop — stop all slots */
            chaser_stop();
            build_playback_ok_response("chaser stopped");
        }
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/chaser/pause")) {
        uint8_t slot = 0;
        if (name[13] == '/') {
            unsigned long s = strtoul(name + 14, NULL, 10);
            if (s < CHASER_MAX_SLOTS) slot = (uint8_t)s;
        }
        chaser_pause(slot);
        build_playback_ok_response("chaser paused");
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/chaser/resume")) {
        uint8_t slot = 0;
        if (name[14] == '/') {
            unsigned long s = strtoul(name + 15, NULL, 10);
            if (s < CHASER_MAX_SLOTS) slot = (uint8_t)s;
        }
        chaser_resume(slot);
        build_playback_ok_response("chaser resumed");
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/chaser/pause_toggle")) {
        uint8_t slot = 0;
        if (name[20] == '/') {
            unsigned long s = strtoul(name + 21, NULL, 10);
            if (s < CHASER_MAX_SLOTS) slot = (uint8_t)s;
        }
        chaser_pause_toggle(slot);
        build_playback_ok_response("chaser pause toggled");
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/chaser/status")) {
        build_chaser_status_response();
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/chaser/slots")) {
        build_chaser_slots_response();
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    /* /chaser/speed/<slot>/<rate_x100>  e.g. /chaser/speed/0/200 = slot 0 at 2.0x */
    if (path_matches(name, "/chaser/speed")) {
        uint16_t slot_u = 0, rate_x100 = 100;
        if (parse_path_u16_pair(name, "/chaser/speed", &slot_u, &rate_x100) &&
            slot_u < CHASER_MAX_SLOTS && rate_x100 >= 10 && rate_x100 <= 1000) {
            chaser_set_speed((uint8_t)slot_u, rate_x100 / 100.0f);
            build_playback_ok_response("speed set");
        } else {
            build_playback_err_response("Use /chaser/speed/slot/rate_x100 (10..1000)");
        }
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    /* POST /chaser/load response — pre-built in httpd_post_finished */
    if (path_matches(name, "/chaser/load_ok")) {
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    /* ----- Motion endpoints ------------------------------------------- */
    /* /motion/start        — start slot 0 (backward compat)
       /motion/start/<N>    — start slot N */
    if (path_matches(name, "/motion/start")) {
        uint8_t slot = 0;
        if (name[13] == '/') {
            unsigned long s = strtoul(name + 14, NULL, 10);
            if (s < MFX_MAX_SLOTS) slot = (uint8_t)s;
        }
        mfx_start(slot);
        build_playback_ok_response("motion started");
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/motion/stop")) {
        if (name[12] == '/') {
            /* /motion/stop/<slot> — stop one slot only */
            unsigned long s = strtoul(name + 13, NULL, 10);
            if (s < MFX_MAX_SLOTS) mfx_stop_slot((uint8_t)s);
            build_playback_ok_response("motion slot stopped");
        } else {
            /* /motion/stop — stop all slots */
            mfx_stop();
            build_playback_ok_response("motion stopped");
        }
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/motion/status")) {
        build_motion_status_response();
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    if (path_matches(name, "/motion/slots")) {
        build_motion_slots_response();
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    /* /motion/bpm/<slot>/<bpm_x10>  e.g. /motion/bpm/0/1200 = slot 0 at 120.0 BPM */
    if (path_matches(name, "/motion/bpm")) {
        uint16_t slot_u = 0, bpm_x10 = 300;
        if (parse_path_u16_pair(name, "/motion/bpm", &slot_u, &bpm_x10) &&
            slot_u < MFX_MAX_SLOTS && bpm_x10 >= 1 && bpm_x10 <= 6000) {
            mfx_set_bpm((uint8_t)slot_u, bpm_x10 / 10.0f);
            build_playback_ok_response("bpm set");
        } else {
            build_playback_err_response("Use /motion/bpm/slot/bpm_x10 (1..6000)");
        }
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    /* POST /dmx/b response — pre-built in httpd_post_finished */
    if (path_matches(name, "/dmx/b_post_ok")) {
        file->data = http_dmx_json;
        file->len = (int)strlen(http_dmx_json);
        file->index = file->len;
        file->flags = FS_FILE_FLAGS_HEADER_INCLUDED | FS_FILE_FLAGS_HEADER_PERSISTENT;
        return 1;
    }

    /* POST /motion/load response — pre-built in httpd_post_finished */
    if (path_matches(name, "/motion/load_ok")) {
        file->data = http_playback_json;
        file->len = (int)strlen(http_playback_json);
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

/* ========================================================================
 * lwIP HTTPD POST callbacks
 * ====================================================================== */

extern "C" err_t httpd_post_begin(void *connection,
                                   const char *uri,
                                   const char *http_request,
                                   u16_t http_request_len,
                                   int content_len,
                                   char *response_uri,
                                   u16_t response_uri_len,
                                   u8_t *post_auto_wnd)
{
    (void)connection; (void)http_request; (void)http_request_len;
    (void)response_uri; (void)response_uri_len;

    post_length = 0;
    *post_auto_wnd = 1;

    if (content_len > (int)(POST_BUFFER_MAX - 1))
        return ERR_VAL; /* body too large */

    if (strcmp(uri, "/gpio/config") == 0) {
        post_type = POST_GPIO_CONFIG;
        return ERR_OK;
    }

    /* /chaser/load or /chaser/load/<slot> */
    if (strncmp(uri, "/chaser/load", 12) == 0 &&
        (uri[12] == '\0' || uri[12] == '/')) {
        post_type = POST_CHASER;
        post_slot = 0;
        if (uri[12] == '/') {
            unsigned long s = strtoul(uri + 13, NULL, 10);
            if (s < CHASER_MAX_SLOTS) post_slot = (uint8_t)s;
        }
        return ERR_OK;
    }
    /* /motion/load or /motion/load/<slot> */
    if (strncmp(uri, "/motion/load", 12) == 0 &&
        (uri[12] == '\0' || uri[12] == '/')) {
        post_type = POST_MOTION;
        post_slot = 0;
        if (uri[12] == '/') {
            unsigned long s = strtoul(uri + 13, NULL, 10);
            if (s < MFX_MAX_SLOTS) post_slot = (uint8_t)s;
        }
        return ERR_OK;
    }

    /* POST /dmx/b  — batch DMX set with ch:val pairs in body */
    if (strncmp(uri, "/dmx/b", 6) == 0 &&
        (uri[6] == '\0' || uri[6] == '/' || uri[6] == '?')) {
        post_type = POST_DMX_BATCH;
        return ERR_OK;
    }

    post_type = POST_NONE;
    return ERR_VAL;
}

extern "C" err_t httpd_post_receive_data(void *connection, struct pbuf *p)
{
    (void)connection;
    struct pbuf *q = p;
    while (q != NULL) {
        uint16_t copy = q->len;
        if (post_length + copy > POST_BUFFER_MAX - 1)
            copy = (uint16_t)(POST_BUFFER_MAX - 1 - post_length);
        if (copy > 0) {
            memcpy(post_buffer + post_length, q->payload, copy);
            post_length += copy;
        }
        q = q->next;
    }
    pbuf_free(p);
    return ERR_OK;
}

extern "C" void httpd_post_finished(void *connection,
                                     char *response_uri,
                                     u16_t response_uri_len)
{
    (void)connection;
    post_buffer[post_length] = '\0';

    if (post_type == POST_CHASER) {
        bool ok = chaser_load_slot(post_slot, post_buffer, post_length);
        if (ok) build_playback_ok_response("chaser loaded");
        else    build_playback_err_response("parse error");
        snprintf(response_uri, response_uri_len, "/chaser/load_ok");
    } else if (post_type == POST_MOTION) {
        bool ok = mfx_load_slot(post_slot, post_buffer, post_length);
        if (ok) build_playback_ok_response("motion loaded");
        else    build_playback_err_response("parse error");
        snprintf(response_uri, response_uri_len, "/motion/load_ok");
    } else if (post_type == POST_GPIO_CONFIG) {
        char err[160] = {0};
        bool ok = gpio_control_configure_text(post_buffer, post_length, err, sizeof(err));
        if (ok) {
            build_gpio_json_response(200, "OK", "{\"ok\":true,\"message\":\"gpio config loaded\"}\n");
        } else {
            snprintf(http_gpio_body, sizeof(http_gpio_body), "{\"ok\":false,\"error\":\"%s\"}\n", err[0] ? err : "parse error");
            build_gpio_json_response(400, "Bad Request", http_gpio_body);
        }
        snprintf(response_uri, response_uri_len, "/gpio/config_ok");
    } else if (post_type == POST_DMX_BATCH) {
        dmx_engine_status_t status;
        dmx_engine_get_status(&status);
        uint16_t updated = 0;
        const char *p = post_buffer;
        while (*p) {
            char *end_ch = NULL;
            unsigned long ch = strtoul(p, &end_ch, 10);
            if (end_ch != p && *end_ch == ':' && ch >= 1 && ch <= status.channels) {
                char *end_val = NULL;
                unsigned long val = strtoul(end_ch + 1, &end_val, 10);
                if (end_val != end_ch + 1 && val <= 255) {
                    dmx_engine_set_channel((uint16_t)ch, (uint8_t)val);
                    dmx_engine_set_base_channel((uint16_t)ch, (uint8_t)val);
                    critical_section_enter_blocking(&dmx_ui_lock);
                    dmx_ui_values[ch] = (uint8_t)val;
                    critical_section_exit(&dmx_ui_lock);
                    updated++;
                }
                p = end_val;
            } else {
                const char *next = strchr(p, ',');
                if (!next) break;
                p = next;
            }
            if (*p == ',') p++;
            else break;
        }
        snprintf(http_dmx_json, sizeof(http_dmx_json),
            "HTTP/1.0 200 OK\r\n"
            "Content-Type: application/json; charset=utf-8\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Connection: close\r\n"
            "Cache-Control: no-store\r\n"
            "\r\n"
            "{\"ok\":true,\"updated\":%u}\n",
            updated);
        snprintf(response_uri, response_uri_len, "/dmx/b_post_ok");
    } else {
        build_playback_err_response("unknown endpoint");
        snprintf(response_uri, response_uri_len, "/chaser/load_ok");
    }

    post_type   = POST_NONE;
    post_length = 0;
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
    chaser_init();
    mfx_init();
    gpio_control_init((1u << DMX_TX_PIN) | (1u << DMX_TRIGGER_PIN));
    gpio_control_set_dmx_clear_hook(gpio_clear_dmx_and_ui);
    gpio_control_set_dmx_output_clear_hook(gpio_clear_dmx_output_and_ui);

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
    uint32_t last_playback_tick = 0;
    uint32_t last_gpio_poll_ms = 0;

    while (application_running) {
        dmx_engine_poll();

        uint32_t now_us = time_us_32();
        if (now_us - last_playback_tick >= 10000) {  /* 100 Hz */
            /* Phase 1: chaser — results update the scene base buffer AND the output. */
            static uint8_t chaser_scratch[513];
            static bool    chaser_touched[513];
            memset(chaser_scratch, 0, sizeof(chaser_scratch));
            memset(chaser_touched, 0, sizeof(chaser_touched));
            chaser_tick(now_us, chaser_scratch, chaser_touched);
            for (uint16_t ch = 1; ch <= 512; ch++) {
                if (chaser_touched[ch]) {
                    dmx_engine_set_base_channel(ch, chaser_scratch[ch]);
                    dmx_engine_set_channel(ch, chaser_scratch[ch]);
                }
            }

            /* Phase 2: motion FX — reads base buffer internally, writes output only. */
            static uint8_t mfx_scratch[513];
            static bool    mfx_touched[513];
            memset(mfx_scratch, 0, sizeof(mfx_scratch));
            memset(mfx_touched, 0, sizeof(mfx_touched));
            mfx_tick(now_us, mfx_scratch, mfx_touched);
            for (uint16_t ch = 1; ch <= 512; ch++)
                if (mfx_touched[ch])
                    dmx_engine_set_channel(ch, mfx_scratch[ch]);

            last_playback_tick = now_us;
        }

        uint32_t now_ms = to_ms_since_boot(get_absolute_time());
        if (now_ms != last_gpio_poll_ms) {
            gpio_control_poll(now_ms);
            last_gpio_poll_ms = now_ms;
        }

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
