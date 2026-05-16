#include "pico_chaser.h"
#include "dmx_engine.h"
#include "pico/sync.h"
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

/* ---------- slot storage ------------------------------------------------ */

typedef struct {
    bool           loaded;
    bool           loop;
    uint16_t       step_count;
    uint16_t       ch_total;
    chaser_step_t  steps[CHASER_MAX_STEPS];
    chaser_ch_t    channels[CHASER_MAX_CH_TOTAL];
} chaser_slot_data_t;

static chaser_slot_data_t slot_data[CHASER_MAX_SLOTS];
static float              slot_speed[CHASER_MAX_SLOTS]; /* 1.0 = normal */

/* ---------- playback state (one active slot at a time) ------------------ */

static struct {
    bool     playing;
    int8_t   slot;              /* -1 = none */
    uint16_t current_step;
    uint32_t step_entered_us;   /* 0 = not yet started */
    uint8_t  from_values[513];  /* channel values at last step boundary */
    uint32_t last_elapsed_ms;
} play;

static critical_section_t chaser_lock;

/* ---------- init --------------------------------------------------------- */

void chaser_init(void)
{
    critical_section_init(&chaser_lock);
    memset(slot_data,  0, sizeof(slot_data));
    memset(&play,      0, sizeof(play));
    play.slot = -1;
    for (int i = 0; i < CHASER_MAX_SLOTS; i++)
        slot_speed[i] = 1.0f;
}

/* ---------- load --------------------------------------------------------- */

bool chaser_load_slot(uint8_t slot, const char *body, size_t len)
{
    if (slot >= CHASER_MAX_SLOTS) return false;

    /* Parse into a temporary struct — no lock needed */
    chaser_slot_data_t tmp;
    memset(&tmp, 0, sizeof(tmp));

    const char *p   = body;
    const char *end = body + len;
    int         step_idx = -1;

    while (p < end) {
        while (p < end && (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')) p++;
        if (p >= end) break;

        const char *ls = p;
        while (p < end && *p != '\n' && *p != '\r') p++;

        size_t ll = (size_t)(p - ls);
        char   line[80];
        if (ll >= sizeof(line)) ll = sizeof(line) - 1;
        memcpy(line, ls, ll);
        line[ll] = '\0';

        if (strncmp(line, "LOOP ", 5) == 0) {
            tmp.loop = (atoi(line + 5) != 0);
        } else if (strncmp(line, "STEP ", 5) == 0) {
            if (tmp.step_count >= CHASER_MAX_STEPS) continue;
            step_idx = tmp.step_count++;
            chaser_step_t *s = &tmp.steps[step_idx];
            s->ch_start  = tmp.ch_total;
            s->ch_count  = 0;
            unsigned long dur = 0, fade = 0;
            sscanf(line + 5, "%lu %lu", &dur, &fade);
            s->duration_ms  = (uint32_t)dur;
            s->fade_percent = (uint8_t)(fade > 100 ? 100 : fade);
        } else if (strncmp(line, "CH ", 3) == 0 && step_idx >= 0) {
            if (tmp.ch_total >= CHASER_MAX_CH_TOTAL) continue;
            unsigned long ch = 0, val = 0;
            sscanf(line + 3, "%lu %lu", &ch, &val);
            if (ch >= 1 && ch <= 512 && val <= 255) {
                tmp.channels[tmp.ch_total].channel = (uint16_t)ch;
                tmp.channels[tmp.ch_total].value   = (uint8_t)val;
                tmp.ch_total++;
                tmp.steps[step_idx].ch_count++;
            }
        } else if (strncmp(line, "END", 3) == 0) {
            break;
        }
    }

    if (tmp.step_count == 0) return false;
    tmp.loaded = true;

    critical_section_enter_blocking(&chaser_lock);
    memcpy(&slot_data[slot], &tmp, sizeof(chaser_slot_data_t));
    /* if this slot was playing, reset playback */
    if (play.slot == (int8_t)slot)
        play.playing = false;
    critical_section_exit(&chaser_lock);

    return true;
}

/* ---------- play / stop / speed ----------------------------------------- */

void chaser_play(uint8_t slot)
{
    if (slot >= CHASER_MAX_SLOTS) return;
    critical_section_enter_blocking(&chaser_lock);
    if (slot_data[slot].loaded && slot_data[slot].step_count > 0) {
        play.slot           = (int8_t)slot;
        play.current_step   = 0;
        play.step_entered_us = 0;
        memset(play.from_values, 0, sizeof(play.from_values));
        play.playing        = true;
    }
    critical_section_exit(&chaser_lock);
}

void chaser_stop(void)
{
    critical_section_enter_blocking(&chaser_lock);
    play.playing = false;
    critical_section_exit(&chaser_lock);
}

void chaser_set_speed(uint8_t slot, float mult)
{
    if (slot >= CHASER_MAX_SLOTS) return;
    if (mult < 0.1f) mult = 0.1f;
    if (mult > 10.0f) mult = 10.0f;
    critical_section_enter_blocking(&chaser_lock);
    slot_speed[slot] = mult;
    critical_section_exit(&chaser_lock);
}

/* ---------- tick (called from core0 at ~100 Hz) ------------------------- */

static inline uint8_t lerp8(uint8_t a, uint8_t b, float t)
{
    float v = (float)a + ((float)b - (float)a) * t;
    if (v < 0.0f)   v = 0.0f;
    if (v > 255.0f) v = 255.0f;
    return (uint8_t)v;
}

static uint16_t tick_ch[CHASER_MAX_CH_TOTAL];
static uint8_t  tick_from[CHASER_MAX_CH_TOTAL];
static uint8_t  tick_to[CHASER_MAX_CH_TOTAL];

void chaser_tick(uint32_t now_us)
{
    critical_section_enter_blocking(&chaser_lock);

    if (!play.playing || play.slot < 0) {
        critical_section_exit(&chaser_lock);
        return;
    }

    chaser_slot_data_t *sd = &slot_data[(uint8_t)play.slot];
    if (!sd->loaded || sd->step_count == 0) {
        play.playing = false;
        critical_section_exit(&chaser_lock);
        return;
    }

    if (play.step_entered_us == 0)
        play.step_entered_us = now_us;

    float speed = slot_speed[(uint8_t)play.slot];
    if (speed < 0.1f) speed = 0.1f;

    chaser_step_t step    = sd->steps[play.current_step];
    uint32_t      elapsed = now_us - play.step_entered_us;
    /* apply speed multiplier: higher mult = shorter effective duration */
    uint32_t dur_us  = (uint32_t)((float)(step.duration_ms * 1000) / speed);
    uint32_t fade_us = (uint32_t)((step.fade_percent / 100.0f) * (float)dur_us);

    float t = (fade_us > 0) ? (float)elapsed / (float)fade_us : 1.0f;
    if (t > 1.0f) t = 1.0f;

    uint16_t count = step.ch_count;
    for (uint16_t i = 0; i < count; i++) {
        chaser_ch_t *e = &sd->channels[step.ch_start + i];
        tick_ch[i]   = e->channel;
        tick_to[i]   = e->value;
        tick_from[i] = play.from_values[e->channel];
    }

    if (elapsed >= dur_us) {
        for (uint16_t i = 0; i < count; i++)
            play.from_values[tick_ch[i]] = tick_to[i];
        uint16_t next = play.current_step + 1;
        if (next >= sd->step_count) {
            if (sd->loop) {
                next = 0;
            } else {
                play.playing = false;
                critical_section_exit(&chaser_lock);
                return;
            }
        }
        play.current_step    = next;
        play.step_entered_us = now_us;
    }
    play.last_elapsed_ms = elapsed / 1000;

    critical_section_exit(&chaser_lock);

    for (uint16_t i = 0; i < count; i++)
        dmx_engine_set_channel(tick_ch[i], lerp8(tick_from[i], tick_to[i], t));
}

/* ---------- status ------------------------------------------------------- */

void chaser_get_status(chaser_status_t *out)
{
    critical_section_enter_blocking(&chaser_lock);
    uint8_t s = (play.slot >= 0) ? (uint8_t)play.slot : 0;
    out->playing      = play.playing;
    out->active_slot  = s;
    out->loaded       = slot_data[s].loaded;
    out->loop         = slot_data[s].loop;
    out->current_step = play.current_step;
    out->step_count   = slot_data[s].step_count;
    out->elapsed_ms   = play.last_elapsed_ms;
    out->speed_mult   = slot_speed[s];
    critical_section_exit(&chaser_lock);
}

void chaser_get_slot_info(uint8_t slot, chaser_slot_info_t *out)
{
    if (slot >= CHASER_MAX_SLOTS) { memset(out, 0, sizeof(*out)); return; }
    critical_section_enter_blocking(&chaser_lock);
    out->loaded     = slot_data[slot].loaded;
    out->loop       = slot_data[slot].loop;
    out->step_count = slot_data[slot].step_count;
    out->speed_mult = slot_speed[slot];
    critical_section_exit(&chaser_lock);
}
