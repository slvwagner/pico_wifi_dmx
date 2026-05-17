#include "gpio_control.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "hardware/gpio.h"
#include "pico/sync.h"

#include "dmx_engine.h"
#include "pico_chaser.h"
#include "pico_motion.h"

typedef struct {
    gpio_mapping_t cfg;
    bool           raw_state;
    bool           stable_state;
    uint32_t       changed_ms;
    uint32_t       last_fire_ms;
} gpio_runtime_t;

static critical_section_t gpio_lock;
static bool gpio_lock_ready = false;
static bool gpio_enabled = true;
static uint32_t gpio_reserved_mask = 0;
static gpio_runtime_t gpio_maps[GPIO_CONTROL_MAX_MAPPINGS];
static uint8_t gpio_map_count = 0;
static uint32_t gpio_event_count = 0;
static uint32_t gpio_last_event_ms = 0;
static int gpio_last_pin = -1;
static gpio_action_t gpio_last_action = GPIO_ACTION_NONE;
static gpio_control_dmx_clear_hook_t gpio_dmx_clear_hook = NULL;
static gpio_control_dmx_clear_hook_t gpio_dmx_output_clear_hook = NULL;

static const char *action_name(gpio_action_t action)
{
    switch (action) {
    case GPIO_ACTION_DMX_CLEAR:     return "dmx_clear";
    case GPIO_ACTION_DMX_OUTPUT_CLEAR: return "dmx_output_clear";
    case GPIO_ACTION_STOP_ALL:      return "stop_all";
    case GPIO_ACTION_CHASER_PLAY:   return "chaser_play";
    case GPIO_ACTION_CHASER_STOP:   return "chaser_stop";
    case GPIO_ACTION_CHASER_TOGGLE: return "chaser_toggle";
    case GPIO_ACTION_MOTION_START:  return "motion_start";
    case GPIO_ACTION_MOTION_STOP:   return "motion_stop";
    case GPIO_ACTION_MOTION_TOGGLE: return "motion_toggle";
    default:                        return "none";
    }
}

static const char *pull_name(gpio_pull_t pull)
{
    return pull == GPIO_PULL_DOWN ? "pulldown" : "pullup";
}

static const char *trigger_name(gpio_trigger_t trigger)
{
    if (trigger == GPIO_TRIGGER_RISING) return "rising";
    if (trigger == GPIO_TRIGGER_BOTH) return "both";
    return "falling";
}

static bool parse_pull(const char *s, gpio_pull_t *out)
{
    if (strcmp(s, "pullup") == 0 || strcmp(s, "up") == 0) {
        *out = GPIO_PULL_UP;
        return true;
    }
    if (strcmp(s, "pulldown") == 0 || strcmp(s, "down") == 0) {
        *out = GPIO_PULL_DOWN;
        return true;
    }
    return false;
}

static bool parse_trigger(const char *s, gpio_trigger_t *out)
{
    if (strcmp(s, "falling") == 0 || strcmp(s, "press") == 0) {
        *out = GPIO_TRIGGER_FALLING;
        return true;
    }
    if (strcmp(s, "rising") == 0 || strcmp(s, "release") == 0) {
        *out = GPIO_TRIGGER_RISING;
        return true;
    }
    if (strcmp(s, "both") == 0) {
        *out = GPIO_TRIGGER_BOTH;
        return true;
    }
    return false;
}

static bool parse_action(const char *s, gpio_action_t *out)
{
    if (strcmp(s, "dmx_clear") == 0 || strcmp(s, "clear") == 0 || strcmp(s, "blackout") == 0) {
        *out = GPIO_ACTION_DMX_CLEAR;
        return true;
    }
    if (strcmp(s, "dmx_output_clear") == 0 || strcmp(s, "output_clear") == 0 || strcmp(s, "clear_output") == 0) {
        *out = GPIO_ACTION_DMX_OUTPUT_CLEAR;
        return true;
    }
    if (strcmp(s, "stop_all") == 0) {
        *out = GPIO_ACTION_STOP_ALL;
        return true;
    }
    if (strcmp(s, "chaser_play") == 0) {
        *out = GPIO_ACTION_CHASER_PLAY;
        return true;
    }
    if (strcmp(s, "chaser_stop") == 0) {
        *out = GPIO_ACTION_CHASER_STOP;
        return true;
    }
    if (strcmp(s, "chaser_toggle") == 0) {
        *out = GPIO_ACTION_CHASER_TOGGLE;
        return true;
    }
    if (strcmp(s, "motion_start") == 0) {
        *out = GPIO_ACTION_MOTION_START;
        return true;
    }
    if (strcmp(s, "motion_stop") == 0) {
        *out = GPIO_ACTION_MOTION_STOP;
        return true;
    }
    if (strcmp(s, "motion_toggle") == 0) {
        *out = GPIO_ACTION_MOTION_TOGGLE;
        return true;
    }
    return false;
}

static bool pin_allowed(uint8_t pin)
{
    if (pin > 28) return false;
    return (gpio_reserved_mask & (1u << pin)) == 0;
}

static void configure_pin(const gpio_mapping_t *m)
{
    gpio_init(m->pin);
    gpio_set_dir(m->pin, GPIO_IN);
    if (m->pull == GPIO_PULL_DOWN) gpio_pull_down(m->pin);
    else gpio_pull_up(m->pin);
}

static bool slot_active_chaser(uint8_t slot)
{
    chaser_status_t st;
    chaser_get_status(&st);
    return (st.active_mask & (1u << slot)) != 0;
}

static bool slot_active_motion(uint8_t slot)
{
    mfx_status_t st;
    mfx_get_status(&st);
    return (st.active_mask & (1u << slot)) != 0;
}

static void run_action(gpio_action_t action, uint8_t slot)
{
    switch (action) {
    case GPIO_ACTION_DMX_CLEAR:
        if (gpio_dmx_clear_hook) gpio_dmx_clear_hook();
        else dmx_engine_clear();
        break;
    case GPIO_ACTION_DMX_OUTPUT_CLEAR:
        if (gpio_dmx_output_clear_hook) gpio_dmx_output_clear_hook();
        else dmx_engine_clear_output();
        break;
    case GPIO_ACTION_STOP_ALL:
        chaser_stop();
        mfx_stop();
        break;
    case GPIO_ACTION_CHASER_PLAY:
        if (slot < CHASER_MAX_SLOTS) chaser_play(slot);
        break;
    case GPIO_ACTION_CHASER_STOP:
        if (slot < CHASER_MAX_SLOTS) chaser_stop_slot(slot);
        break;
    case GPIO_ACTION_CHASER_TOGGLE:
        if (slot < CHASER_MAX_SLOTS) {
            if (slot_active_chaser(slot)) chaser_stop_slot(slot);
            else chaser_play(slot);
        }
        break;
    case GPIO_ACTION_MOTION_START:
        if (slot < MFX_MAX_SLOTS) mfx_start(slot);
        break;
    case GPIO_ACTION_MOTION_STOP:
        if (slot < MFX_MAX_SLOTS) mfx_stop_slot(slot);
        break;
    case GPIO_ACTION_MOTION_TOGGLE:
        if (slot < MFX_MAX_SLOTS) {
            if (slot_active_motion(slot)) mfx_stop_slot(slot);
            else mfx_start(slot);
        }
        break;
    default:
        break;
    }
}

void gpio_control_init(uint32_t reserved_pin_mask)
{
    if (!gpio_lock_ready) {
        critical_section_init(&gpio_lock);
        gpio_lock_ready = true;
    }
    gpio_reserved_mask = reserved_pin_mask;
    gpio_enabled = true;
    gpio_map_count = 0;
    memset(gpio_maps, 0, sizeof(gpio_maps));
}

void gpio_control_set_dmx_clear_hook(gpio_control_dmx_clear_hook_t hook)
{
    gpio_dmx_clear_hook = hook;
}

void gpio_control_set_dmx_output_clear_hook(gpio_control_dmx_clear_hook_t hook)
{
    gpio_dmx_output_clear_hook = hook;
}

bool gpio_control_configure_text(const char *body, size_t len, char *err, size_t err_len)
{
    gpio_runtime_t next[GPIO_CONTROL_MAX_MAPPINGS];
    uint8_t next_count = 0;
    bool next_enabled = true;
    memset(next, 0, sizeof(next));

    char line[160];
    size_t pos = 0;
    while (pos < len) {
        size_t n = 0;
        while (pos < len && body[pos] != '\n' && n + 1 < sizeof(line)) {
            if (body[pos] != '\r') line[n++] = body[pos];
            pos++;
        }
        while (pos < len && body[pos] != '\n') pos++;
        if (pos < len && body[pos] == '\n') pos++;
        line[n] = '\0';

        char *p = line;
        while (*p == ' ' || *p == '\t') p++;
        if (*p == '\0' || *p == '#') continue;

        int enabled_int = 0;
        if (sscanf(p, "ENABLE %d", &enabled_int) == 1) {
            next_enabled = enabled_int != 0;
            continue;
        }

        int pin = -1, slot = 0, debounce = 30;
        char pull_s[16] = {0}, trigger_s[16] = {0}, action_s[24] = {0};
        int got = sscanf(p, "MAP %d %15s %15s %23s %d %d", &pin, pull_s, trigger_s, action_s, &slot, &debounce);
        if (got < 5) {
            snprintf(err, err_len, "Invalid line: %s", p);
            return false;
        }
        if (next_count >= GPIO_CONTROL_MAX_MAPPINGS) {
            snprintf(err, err_len, "Too many mappings, max %u", GPIO_CONTROL_MAX_MAPPINGS);
            return false;
        }
        if (pin < 0 || pin > 28 || !pin_allowed((uint8_t)pin)) {
            snprintf(err, err_len, "GPIO %d is not allowed", pin);
            return false;
        }
        gpio_mapping_t m = {};
        m.enabled = true;
        m.pin = (uint8_t)pin;
        m.slot = slot < 0 ? 0 : (uint8_t)slot;
        m.debounce_ms = debounce < 5 ? 5 : (uint16_t)debounce;
        if (!parse_pull(pull_s, &m.pull) ||
            !parse_trigger(trigger_s, &m.trigger) ||
            !parse_action(action_s, &m.action)) {
            snprintf(err, err_len, "Invalid mapping tokens on GPIO %d", pin);
            return false;
        }
        if ((m.action == GPIO_ACTION_CHASER_PLAY || m.action == GPIO_ACTION_CHASER_STOP || m.action == GPIO_ACTION_CHASER_TOGGLE) &&
            m.slot >= CHASER_MAX_SLOTS) {
            snprintf(err, err_len, "Chaser slot %u out of range", m.slot);
            return false;
        }
        if ((m.action == GPIO_ACTION_MOTION_START || m.action == GPIO_ACTION_MOTION_STOP || m.action == GPIO_ACTION_MOTION_TOGGLE) &&
            m.slot >= MFX_MAX_SLOTS) {
            snprintf(err, err_len, "Motion slot %u out of range", m.slot);
            return false;
        }
        configure_pin(&m);
        bool raw = gpio_get(m.pin);
        next[next_count].cfg = m;
        next[next_count].raw_state = raw;
        next[next_count].stable_state = raw;
        next[next_count].changed_ms = 0;
        next_count++;
    }

    critical_section_enter_blocking(&gpio_lock);
    memcpy(gpio_maps, next, sizeof(gpio_maps));
    gpio_map_count = next_count;
    gpio_enabled = next_enabled;
    critical_section_exit(&gpio_lock);
    return true;
}

void gpio_control_poll(uint32_t now_ms)
{
    gpio_runtime_t snapshot[GPIO_CONTROL_MAX_MAPPINGS];
    uint8_t count = 0;
    bool enabled = false;

    critical_section_enter_blocking(&gpio_lock);
    enabled = gpio_enabled;
    count = gpio_map_count;
    memcpy(snapshot, gpio_maps, sizeof(snapshot));
    critical_section_exit(&gpio_lock);

    if (!enabled) return;

    for (uint8_t i = 0; i < count; i++) {
        gpio_runtime_t *m = &snapshot[i];
        if (!m->cfg.enabled) continue;
        bool raw = gpio_get(m->cfg.pin);
        if (raw != m->raw_state) {
            m->raw_state = raw;
            m->changed_ms = now_ms;
        }
        if (raw != m->stable_state && now_ms - m->changed_ms >= m->cfg.debounce_ms) {
            bool old_state = m->stable_state;
            m->stable_state = raw;
            bool falling = old_state && !raw;
            bool rising = !old_state && raw;
            bool fire = m->cfg.trigger == GPIO_TRIGGER_BOTH ||
                        (m->cfg.trigger == GPIO_TRIGGER_FALLING && falling) ||
                        (m->cfg.trigger == GPIO_TRIGGER_RISING && rising);
            if (fire && now_ms - m->last_fire_ms >= m->cfg.debounce_ms) {
                run_action(m->cfg.action, m->cfg.slot);
                m->last_fire_ms = now_ms;
                critical_section_enter_blocking(&gpio_lock);
                gpio_event_count++;
                gpio_last_event_ms = now_ms;
                gpio_last_pin = m->cfg.pin;
                gpio_last_action = m->cfg.action;
                critical_section_exit(&gpio_lock);
            }
        }
    }

    critical_section_enter_blocking(&gpio_lock);
    for (uint8_t i = 0; i < count && i < gpio_map_count; i++) {
        gpio_maps[i].raw_state = snapshot[i].raw_state;
        gpio_maps[i].stable_state = snapshot[i].stable_state;
        gpio_maps[i].changed_ms = snapshot[i].changed_ms;
        gpio_maps[i].last_fire_ms = snapshot[i].last_fire_ms;
    }
    critical_section_exit(&gpio_lock);
}

void gpio_control_write_config_json(char *out, size_t out_len)
{
    gpio_runtime_t snapshot[GPIO_CONTROL_MAX_MAPPINGS];
    uint8_t count;
    bool enabled;
    critical_section_enter_blocking(&gpio_lock);
    count = gpio_map_count;
    enabled = gpio_enabled;
    memcpy(snapshot, gpio_maps, sizeof(snapshot));
    critical_section_exit(&gpio_lock);

    size_t used = (size_t)snprintf(out, out_len, "{\"ok\":true,\"enabled\":%s,\"max_mappings\":%u,\"mappings\":[",
                                   enabled ? "true" : "false",
                                   GPIO_CONTROL_MAX_MAPPINGS);
    for (uint8_t i = 0; i < count && used + 160 < out_len; i++) {
        gpio_mapping_t *m = &snapshot[i].cfg;
        int n = snprintf(out + used, out_len - used,
                         "%s{\"pin\":%u,\"pull\":\"%s\",\"trigger\":\"%s\",\"action\":\"%s\",\"slot\":%u,\"debounce_ms\":%u}",
                         i ? "," : "",
                         m->pin,
                         pull_name(m->pull),
                         trigger_name(m->trigger),
                         action_name(m->action),
                         m->slot,
                         m->debounce_ms);
        if (n < 0) break;
        used += (size_t)n;
    }
    snprintf(out + used, out_len - used, "]}\n");
}

void gpio_control_write_status_json(char *out, size_t out_len)
{
    gpio_runtime_t snapshot[GPIO_CONTROL_MAX_MAPPINGS];
    uint8_t count;
    bool enabled;
    uint32_t event_count, last_ms;
    int last_pin;
    gpio_action_t last_action;
    critical_section_enter_blocking(&gpio_lock);
    count = gpio_map_count;
    enabled = gpio_enabled;
    event_count = gpio_event_count;
    last_ms = gpio_last_event_ms;
    last_pin = gpio_last_pin;
    last_action = gpio_last_action;
    memcpy(snapshot, gpio_maps, sizeof(snapshot));
    critical_section_exit(&gpio_lock);

    size_t used = (size_t)snprintf(out, out_len,
        "{\"ok\":true,\"enabled\":%s,\"mapping_count\":%u,\"event_count\":%lu,"
        "\"last_event_ms\":%lu,\"last_pin\":%d,\"last_action\":\"%s\",\"inputs\":[",
        enabled ? "true" : "false",
        count,
        (unsigned long)event_count,
        (unsigned long)last_ms,
        last_pin,
        action_name(last_action));
    for (uint8_t i = 0; i < count && used + 96 < out_len; i++) {
        int n = snprintf(out + used, out_len - used,
                         "%s{\"pin\":%u,\"value\":%s,\"stable\":%s}",
                         i ? "," : "",
                         snapshot[i].cfg.pin,
                         snapshot[i].raw_state ? "true" : "false",
                         snapshot[i].stable_state ? "true" : "false");
        if (n < 0) break;
        used += (size_t)n;
    }
    snprintf(out + used, out_len - used, "]}\n");
}
