#include "pico_chaser.h"
#include "dmx_engine.h"
#include "pico/sync.h"
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

/* ---------- state -------------------------------------------------------- */

static critical_section_t chaser_lock;

static struct {
    bool     loaded;
    bool     playing;
    bool     loop;
    uint16_t step_count;
    uint16_t ch_total;
    chaser_step_t steps[CHASER_MAX_STEPS];
    chaser_ch_t   channels[CHASER_MAX_CH_TOTAL];
    /* playback */
    uint16_t current_step;
    uint32_t step_entered_us;   /* 0 = not yet started */
    uint8_t  from_values[513];  /* channel values at last step boundary */
    uint32_t last_elapsed_ms;
} cs;

/* ---------- init --------------------------------------------------------- */

void chaser_init(void)
{
    critical_section_init(&chaser_lock);
    memset(&cs, 0, sizeof(cs));
}

/* ---------- load (called from core1 / lwIP context) --------------------- */

bool chaser_load(const char *body, size_t len)
{
    /* Parse into a temporary struct first — no lock needed here */
    struct {
        bool          loop;
        uint16_t      step_count;
        uint16_t      ch_total;
        chaser_step_t steps[CHASER_MAX_STEPS];
        chaser_ch_t   channels[CHASER_MAX_CH_TOTAL];
    } tmp;
    memset(&tmp, 0, sizeof(tmp));

    const char *p   = body;
    const char *end = body + len;
    int         step_idx = -1;

    while (p < end) {
        /* skip blank / whitespace */
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

    /* Atomic swap into live state */
    critical_section_enter_blocking(&chaser_lock);
    cs.loaded      = true;
    cs.playing     = false;
    cs.loop        = tmp.loop;
    cs.step_count  = tmp.step_count;
    cs.ch_total    = tmp.ch_total;
    memcpy(cs.steps,    tmp.steps,    tmp.step_count * sizeof(chaser_step_t));
    memcpy(cs.channels, tmp.channels, tmp.ch_total   * sizeof(chaser_ch_t));
    cs.current_step    = 0;
    cs.step_entered_us = 0;
    memset(cs.from_values, 0, sizeof(cs.from_values));
    critical_section_exit(&chaser_lock);

    return true;
}

/* ---------- play / stop (called from core1 / lwIP context) -------------- */

void chaser_play(void)
{
    critical_section_enter_blocking(&chaser_lock);
    if (cs.loaded && cs.step_count > 0) {
        cs.current_step    = 0;
        cs.step_entered_us = 0;
        memset(cs.from_values, 0, sizeof(cs.from_values));
        cs.playing = true;
    }
    critical_section_exit(&chaser_lock);
}

void chaser_stop(void)
{
    critical_section_enter_blocking(&chaser_lock);
    cs.playing = false;
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

/* Reusable tick-local buffers — static to keep off the stack */
static uint16_t tick_ch[CHASER_MAX_CH_TOTAL];
static uint8_t  tick_from[CHASER_MAX_CH_TOTAL];
static uint8_t  tick_to[CHASER_MAX_CH_TOTAL];

void chaser_tick(uint32_t now_us)
{
    /* ---- read state under lock ----------------------------------------- */
    critical_section_enter_blocking(&chaser_lock);

    if (!cs.playing || cs.step_count == 0) {
        critical_section_exit(&chaser_lock);
        return;
    }

    if (cs.step_entered_us == 0)
        cs.step_entered_us = now_us;

    chaser_step_t step      = cs.steps[cs.current_step]; /* copy */
    uint32_t      elapsed   = now_us - cs.step_entered_us;
    uint32_t      dur_us    = step.duration_ms * 1000;
    uint32_t      fade_us   = (uint32_t)((step.fade_percent / 100.0f) * (float)dur_us);

    float t = (fade_us > 0) ? (float)elapsed / (float)fade_us : 1.0f;
    if (t > 1.0f) t = 1.0f;

    /* snapshot channel data */
    uint16_t count = step.ch_count;
    for (uint16_t i = 0; i < count; i++) {
        chaser_ch_t *e = &cs.channels[step.ch_start + i];
        tick_ch[i]   = e->channel;
        tick_to[i]   = e->value;
        tick_from[i] = cs.from_values[e->channel];
    }

    /* advance step if duration elapsed */
    if (elapsed >= dur_us) {
        for (uint16_t i = 0; i < count; i++)
            cs.from_values[tick_ch[i]] = tick_to[i];

        uint16_t next = cs.current_step + 1;
        if (next >= cs.step_count) {
            if (cs.loop) {
                next = 0;
            } else {
                cs.playing = false;
                critical_section_exit(&chaser_lock);
                return;
            }
        }
        cs.current_step    = next;
        cs.step_entered_us = now_us;
    }
    cs.last_elapsed_ms = elapsed / 1000;

    critical_section_exit(&chaser_lock);

    /* ---- write to DMX outside the lock --------------------------------- */
    for (uint16_t i = 0; i < count; i++)
        dmx_engine_set_channel(tick_ch[i], lerp8(tick_from[i], tick_to[i], t));
}

/* ---------- status ------------------------------------------------------- */

void chaser_get_status(chaser_status_t *out)
{
    critical_section_enter_blocking(&chaser_lock);
    out->playing      = cs.playing;
    out->loaded       = cs.loaded;
    out->loop         = cs.loop;
    out->current_step = cs.current_step;
    out->step_count   = cs.step_count;
    out->elapsed_ms   = cs.last_elapsed_ms;
    critical_section_exit(&chaser_lock);
}
