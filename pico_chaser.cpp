#include "pico_chaser.h"
#include "pico/sync.h"
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

/* ---------- slot storage ------------------------------------------------ */

typedef struct {
    bool           loaded;
    bool           loop;
    chaser_mode_t  mode;
    chaser_direction_t direction;
    uint16_t       loop_count;
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
    bool     paused;
    uint16_t current_step;
    uint32_t step_entered_us;
    uint32_t paused_elapsed_us;
    uint16_t completed_loops;
    uint8_t  from_values[513];  /* channel values at last step boundary */
    uint32_t last_elapsed_ms;
} chaser_play_state_t;

static chaser_play_state_t play_state[CHASER_MAX_SLOTS];

static critical_section_t chaser_lock;

static uint16_t start_step_for_slot(const chaser_slot_data_t *sd)
{
    if (sd->direction == CHASER_DIR_REVERSE && sd->step_count > 0)
        return (uint16_t)(sd->step_count - 1);
    return 0;
}

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
    tmp.loop = true;
    tmp.mode = CHASER_MODE_LOOP;
    tmp.direction = CHASER_DIR_FORWARD;
    tmp.loop_count = 1;
    float tmp_speed = slot_speed[slot];
    if (tmp_speed < 0.1f) tmp_speed = 1.0f;

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
            tmp.mode = tmp.loop ? CHASER_MODE_LOOP : CHASER_MODE_SINGLE;
        } else if (strncmp(line, "MODE ", 5) == 0) {
            const char *mode = line + 5;
            if (strcmp(mode, "single") == 0 || strcmp(mode, "once") == 0) {
                tmp.mode = CHASER_MODE_SINGLE;
                tmp.loop = false;
            } else if (strcmp(mode, "loop_n") == 0 || strcmp(mode, "loopn") == 0) {
                tmp.mode = CHASER_MODE_LOOP_N;
                tmp.loop = true;
            } else {
                tmp.mode = CHASER_MODE_LOOP;
                tmp.loop = true;
            }
        } else if (strncmp(line, "LOOPS ", 6) == 0) {
            int loops = atoi(line + 6);
            tmp.loop_count = (uint16_t)(loops < 1 ? 1 : (loops > 999 ? 999 : loops));
        } else if (strncmp(line, "DIR ", 4) == 0) {
            const char *dir = line + 4;
            tmp.direction = (strcmp(dir, "reverse") == 0 || strcmp(dir, "rev") == 0) ? CHASER_DIR_REVERSE : CHASER_DIR_FORWARD;
        } else if (strncmp(line, "SPEED ", 6) == 0) {
            float speed = (float)atof(line + 6);
            if (speed < 0.1f) speed = 0.1f;
            if (speed > 10.0f) speed = 10.0f;
            tmp_speed = speed;
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
    slot_speed[slot] = tmp_speed;
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
        play_state[slot].current_step    = start_step_for_slot(&slot_data[slot]);
        play_state[slot].step_entered_us = 0;
        play_state[slot].paused_elapsed_us = 0;
        play_state[slot].completed_loops = 0;
        memset(play_state[slot].from_values, 0, sizeof(play_state[slot].from_values));
        play_state[slot].paused          = false;
        play_state[slot].playing         = true;
    }
    critical_section_exit(&chaser_lock);
}

void chaser_pause(uint8_t slot)
{
    if (slot >= CHASER_MAX_SLOTS) return;
    critical_section_enter_blocking(&chaser_lock);
    if (play_state[slot].playing) {
        play_state[slot].paused_elapsed_us = play_state[slot].last_elapsed_ms * 1000u;
        play_state[slot].playing = false;
        play_state[slot].paused = true;
    }
    critical_section_exit(&chaser_lock);
}

void chaser_resume(uint8_t slot)
{
    if (slot >= CHASER_MAX_SLOTS) return;
    critical_section_enter_blocking(&chaser_lock);
    if (slot_data[slot].loaded && play_state[slot].paused) {
        play_state[slot].step_entered_us = 0;
        play_state[slot].playing = true;
        play_state[slot].paused = false;
    }
    critical_section_exit(&chaser_lock);
}

void chaser_pause_toggle(uint8_t slot)
{
    if (slot >= CHASER_MAX_SLOTS) return;
    critical_section_enter_blocking(&chaser_lock);
    bool playing = play_state[slot].playing;
    bool paused = play_state[slot].paused;
    critical_section_exit(&chaser_lock);
    if (playing) chaser_pause(slot);
    else if (paused) chaser_resume(slot);
    else chaser_play(slot);
}

void chaser_stop(void)
{
    critical_section_enter_blocking(&chaser_lock);
    for (uint8_t i = 0; i < CHASER_MAX_SLOTS; i++) {
        play_state[i].playing = false;
        play_state[i].paused = false;
        play_state[i].current_step = start_step_for_slot(&slot_data[i]);
        play_state[i].step_entered_us = 0;
        play_state[i].paused_elapsed_us = 0;
        play_state[i].completed_loops = 0;
    }
    critical_section_exit(&chaser_lock);
}

void chaser_stop_slot(uint8_t slot)
{
    if (slot >= CHASER_MAX_SLOTS) return;
    critical_section_enter_blocking(&chaser_lock);
    play_state[slot].playing = false;
    play_state[slot].paused = false;
    play_state[slot].current_step = start_step_for_slot(&slot_data[slot]);
    play_state[slot].step_entered_us = 0;
    play_state[slot].paused_elapsed_us = 0;
    play_state[slot].completed_loops = 0;
    critical_section_exit(&chaser_lock);
}

void chaser_clear_slot(uint8_t slot)
{
    if (slot >= CHASER_MAX_SLOTS) return;
    critical_section_enter_blocking(&chaser_lock);
    memset(&slot_data[slot], 0, sizeof(slot_data[slot]));
    memset(&play_state[slot], 0, sizeof(play_state[slot]));
    slot_speed[slot] = 1.0f;
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

void chaser_set_tap_interval(uint8_t slot, uint32_t interval_ms, uint8_t beat_div)
{
    if (slot >= CHASER_MAX_SLOTS || interval_ms == 0) return;
    if (beat_div < 1) beat_div = 1;
    if (beat_div > 16) beat_div = 16;
    critical_section_enter_blocking(&chaser_lock);
    if (slot_data[slot].loaded && slot_data[slot].step_count > 0) {
        uint16_t step_idx = play_state[slot].playing ? play_state[slot].current_step : start_step_for_slot(&slot_data[slot]);
        if (step_idx >= slot_data[slot].step_count) step_idx = 0;
        uint32_t step_ms = slot_data[slot].steps[step_idx].duration_ms;
        if (step_ms > 0) {
            float target_ms = (float)interval_ms / (float)beat_div;
            float mult = target_ms > 1.0f ? (float)step_ms / target_ms : 10.0f;
            if (mult < 0.1f) mult = 0.1f;
            if (mult > 10.0f) mult = 10.0f;
            slot_speed[slot] = mult;
        }
    }
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

void chaser_tick(uint32_t now_us, uint8_t *scratch, bool *touched)
{
    critical_section_enter_blocking(&chaser_lock);

    /* Build bigger-wins merged output for all active slots */
    /* NOTE: caller owns scratch/touched; do NOT clear them here — other
     * modules may have already accumulated values this tick. */

    for (uint8_t sl = 0; sl < CHASER_MAX_SLOTS; sl++) {
        chaser_play_state_t *ps = &play_state[sl];
        if (!ps->playing) continue;

        chaser_slot_data_t *sd = &slot_data[sl];
        if (!sd->loaded || sd->step_count == 0) {
            ps->playing = false;
            continue;
        }

        if (ps->step_entered_us == 0) {
            ps->step_entered_us = now_us - ps->paused_elapsed_us;
            ps->paused_elapsed_us = 0;
        }

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
            if (!touched[e->channel] || val > scratch[e->channel]) {
                scratch[e->channel] = val;
                touched[e->channel] = true;
            }
        }

        if (elapsed >= dur_us) {
            for (uint16_t i = 0; i < step.ch_count; i++)
                ps->from_values[sd->channels[step.ch_start + i].channel] =
                    sd->channels[step.ch_start + i].value;
            int next = (int)ps->current_step + (sd->direction == CHASER_DIR_REVERSE ? -1 : 1);
            bool cycle_done = next < 0 || next >= (int)sd->step_count;
            if (cycle_done) {
                ps->completed_loops++;
                if (sd->mode == CHASER_MODE_LOOP ||
                    (sd->mode == CHASER_MODE_LOOP_N && ps->completed_loops < sd->loop_count)) {
                    next = (int)start_step_for_slot(sd);
                } else {
                    ps->playing = false;
                    ps->paused = false;
                    continue;
                }
            }
            ps->current_step    = (uint16_t)next;
            ps->step_entered_us = now_us;
        }
        ps->last_elapsed_ms = elapsed / 1000;
    }

    critical_section_exit(&chaser_lock);
    /* DMX writes are done by the caller after all ticks accumulate. */
}

/* ---------- status ------------------------------------------------------- */

void chaser_get_status(chaser_status_t *out)
{
    critical_section_enter_blocking(&chaser_lock);
    memset(out, 0, sizeof(*out));
    for (uint8_t i = 0; i < CHASER_MAX_SLOTS; i++) {
        if (slot_data[i].loaded)
            out->loaded_mask |= (uint32_t)(1u << i);
        if (play_state[i].playing) {
            out->active_mask |= (uint32_t)(1u << i);
            if (out->active_mask == (uint32_t)(1u << i)) { /* first active slot */
                out->step       = play_state[i].current_step;
                out->step_count = slot_data[i].step_count;
                out->elapsed_ms = play_state[i].last_elapsed_ms;
            }
        }
        if (play_state[i].paused)
            out->paused_mask |= (uint32_t)(1u << i);
    }
    critical_section_exit(&chaser_lock);
}

void chaser_get_slot_info(uint8_t slot, chaser_slot_info_t *out)
{
    if (slot >= CHASER_MAX_SLOTS) { memset(out, 0, sizeof(*out)); return; }
    critical_section_enter_blocking(&chaser_lock);
    out->loaded     = slot_data[slot].loaded;
    out->active     = play_state[slot].playing;
    out->paused     = play_state[slot].paused;
    out->loop       = slot_data[slot].loop;
    out->mode       = slot_data[slot].mode;
    out->direction  = slot_data[slot].direction;
    out->loop_count = slot_data[slot].loop_count;
    out->completed_loops = play_state[slot].completed_loops;
    out->current_step = play_state[slot].current_step;
    out->step_count = slot_data[slot].step_count;
    out->speed_mult = slot_speed[slot];
    critical_section_exit(&chaser_lock);
}
