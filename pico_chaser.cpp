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

/* ---------- per-slot playback state ------------------------------------ */

typedef struct {
    bool     playing;
    uint16_t current_step;
    uint32_t step_entered_us;
    uint8_t  from_values[513];  /* channel values at last step boundary */
    uint32_t last_elapsed_ms;
} chaser_play_state_t;

static chaser_play_state_t play_state[CHASER_MAX_SLOTS];

/* scratch for bigger-wins merge (written outside lock) */
static uint8_t chaser_scratch[513];
static bool    chaser_touched[513];

static critical_section_t chaser_lock;

/* ---------- init --------------------------------------------------------- */

void chaser_init(void)
{
    critical_section_init(&chaser_lock);
    memset(slot_data,  0, sizeof(slot_data));
    memset(play_state, 0, sizeof(play_state));
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
    /* if this slot was playing, reset it */
    if (play_state[slot].playing)
        play_state[slot].playing = false;
    critical_section_exit(&chaser_lock);

    return true;
}

/* ---------- play / stop / speed ----------------------------------------- */

void chaser_play(uint8_t slot)
{
    if (slot >= CHASER_MAX_SLOTS) return;
    critical_section_enter_blocking(&chaser_lock);
    if (slot_data[slot].loaded && slot_data[slot].step_count > 0) {
        play_state[slot].current_step    = 0;
        play_state[slot].step_entered_us = 0;
        memset(play_state[slot].from_values, 0, sizeof(play_state[slot].from_values));
        play_state[slot].playing         = true;
    }
    critical_section_exit(&chaser_lock);
}

void chaser_stop(void)
{
    critical_section_enter_blocking(&chaser_lock);
    for (uint8_t i = 0; i < CHASER_MAX_SLOTS; i++)
        play_state[i].playing = false;
    critical_section_exit(&chaser_lock);
}

void chaser_stop_slot(uint8_t slot)
{
    if (slot >= CHASER_MAX_SLOTS) return;
    critical_section_enter_blocking(&chaser_lock);
    play_state[slot].playing = false;
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

void chaser_tick(uint32_t now_us)
{
    critical_section_enter_blocking(&chaser_lock);

    /* Build bigger-wins merged output for all active slots */
    memset(chaser_scratch, 0, sizeof(chaser_scratch));
    memset(chaser_touched, 0, sizeof(chaser_touched));

    for (uint8_t sl = 0; sl < CHASER_MAX_SLOTS; sl++) {
        chaser_play_state_t *ps = &play_state[sl];
        if (!ps->playing) continue;

        chaser_slot_data_t *sd = &slot_data[sl];
        if (!sd->loaded || sd->step_count == 0) {
            ps->playing = false;
            continue;
        }

        if (ps->step_entered_us == 0)
            ps->step_entered_us = now_us;

        float speed = slot_speed[sl];
        if (speed < 0.1f) speed = 0.1f;

        chaser_step_t step    = sd->steps[ps->current_step];
        uint32_t      elapsed = now_us - ps->step_entered_us;
        uint32_t      dur_us  = (uint32_t)((float)(step.duration_ms * 1000) / speed);
        uint32_t      fade_us = (uint32_t)((step.fade_percent / 100.0f) * (float)dur_us);

        float t = (fade_us > 0) ? (float)elapsed / (float)fade_us : 1.0f;
        if (t > 1.0f) t = 1.0f;

        for (uint16_t i = 0; i < step.ch_count; i++) {
            chaser_ch_t *e = &sd->channels[step.ch_start + i];
            uint8_t val = lerp8(ps->from_values[e->channel], e->value, t);
            /* bigger-wins: highest value across all active slots wins */
            if (!chaser_touched[e->channel] || val > chaser_scratch[e->channel]) {
                chaser_scratch[e->channel] = val;
                chaser_touched[e->channel] = true;
            }
        }

        if (elapsed >= dur_us) {
            for (uint16_t i = 0; i < step.ch_count; i++)
                ps->from_values[sd->channels[step.ch_start + i].channel] =
                    sd->channels[step.ch_start + i].value;
            uint16_t next = ps->current_step + 1;
            if (next >= sd->step_count) {
                if (sd->loop) {
                    next = 0;
                } else {
                    ps->playing = false;
                    continue;
                }
            }
            ps->current_step    = next;
            ps->step_entered_us = now_us;
        }
        ps->last_elapsed_ms = elapsed / 1000;
    }

    critical_section_exit(&chaser_lock);

    /* Write merged values outside lock */
    for (uint16_t ch = 1; ch <= 512; ch++)
        if (chaser_touched[ch])
            dmx_engine_set_channel(ch, chaser_scratch[ch]);
}

/* ---------- status ------------------------------------------------------- */

void chaser_get_status(chaser_status_t *out)
{
    critical_section_enter_blocking(&chaser_lock);
    memset(out, 0, sizeof(*out));
    for (uint8_t i = 0; i < CHASER_MAX_SLOTS; i++) {
        if (slot_data[i].loaded)
            out->loaded_mask |= (uint8_t)(1u << i);
        if (play_state[i].playing) {
            out->active_mask |= (uint8_t)(1u << i);
            if (out->active_mask == (uint8_t)(1u << i)) { /* first active slot */
                out->step       = play_state[i].current_step;
                out->step_count = slot_data[i].step_count;
                out->elapsed_ms = play_state[i].last_elapsed_ms;
            }
        }
    }
    critical_section_exit(&chaser_lock);
}

void chaser_get_slot_info(uint8_t slot, chaser_slot_info_t *out)
{
    if (slot >= CHASER_MAX_SLOTS) { memset(out, 0, sizeof(*out)); return; }
    critical_section_enter_blocking(&chaser_lock);
    out->loaded     = slot_data[slot].loaded;
    out->active     = play_state[slot].playing;
    out->loop       = slot_data[slot].loop;
    out->step_count = slot_data[slot].step_count;
    out->speed_mult = slot_speed[slot];
    critical_section_exit(&chaser_lock);
}
