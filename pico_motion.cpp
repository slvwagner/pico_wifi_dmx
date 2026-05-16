#include "pico_motion.h"
#include "dmx_engine.h"
#include "pico/sync.h"
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>

#ifndef MFX_PI
#define MFX_PI 3.14159265358979f
#endif

/* ---------- slot storage ------------------------------------------------ */

typedef struct {
    bool           loaded;
    mfx_type_t     type;
    float          bpm;
    float          pan_amp;     /* 0.0-1.0 */
    float          tilt_amp;    /* 0.0-1.0 */
    float          spread_deg;  /* 0.0-360.0 */
    uint16_t       fixture_count;
    mfx_fixture_t  fixtures[MFX_MAX_FIXTURES];
} mfx_slot_data_t;

static mfx_slot_data_t slot_data[MFX_MAX_SLOTS];

/* ---------- playback state (one active slot at a time) ------------------ */

static struct {
    bool     active;
    int8_t   slot;          /* -1 = none */
    uint32_t start_us;      /* 0 = set on first tick */
    float    last_elapsed_s;
} play;

static critical_section_t mfx_lock;

/* ---------- init --------------------------------------------------------- */

void mfx_init(void)
{
    critical_section_init(&mfx_lock);
    memset(slot_data, 0, sizeof(slot_data));
    memset(&play,     0, sizeof(play));
    play.slot = -1;
    /* sensible defaults for slot 0 */
    slot_data[0].bpm      = 30.0f;
    slot_data[0].pan_amp  = 0.2f;
    slot_data[0].tilt_amp = 0.15f;
}

/* ---------- load --------------------------------------------------------- */

bool mfx_load_slot(uint8_t slot, const char *body, size_t len)
{
    if (slot >= MFX_MAX_SLOTS) return false;

    mfx_slot_data_t tmp;
    memset(&tmp, 0, sizeof(tmp));
    tmp.bpm      = 30.0f;
    tmp.pan_amp  = 0.2f;
    tmp.tilt_amp = 0.15f;

    const char *p   = body;
    const char *end = body + len;

    while (p < end) {
        while (p < end && (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')) p++;
        if (p >= end) break;

        const char *ls = p;
        while (p < end && *p != '\n' && *p != '\r') p++;

        size_t ll = (size_t)(p - ls);
        char   line[128];
        if (ll >= sizeof(line)) ll = sizeof(line) - 1;
        memcpy(line, ls, ll);
        line[ll] = '\0';

        if (strncmp(line, "TYPE ", 5) == 0) {
            tmp.type = (mfx_type_t)atoi(line + 5);
        } else if (strncmp(line, "BPM ", 4) == 0) {
            tmp.bpm = strtof(line + 4, NULL);
        } else if (strncmp(line, "PANAMP ", 7) == 0) {
            tmp.pan_amp = strtof(line + 7, NULL);
        } else if (strncmp(line, "TILTAMP ", 8) == 0) {
            tmp.tilt_amp = strtof(line + 8, NULL);
        } else if (strncmp(line, "SPREAD ", 7) == 0) {
            tmp.spread_deg = strtof(line + 7, NULL);
        } else if (strncmp(line, "FIX ", 4) == 0 && tmp.fixture_count < MFX_MAX_FIXTURES) {
            mfx_fixture_t *f = &tmp.fixtures[tmp.fixture_count];
            int  enabled = 0, is_16bit = 0;
            unsigned pan_ch = 0, pan_fine = 0, tilt_ch = 0, tilt_fine = 0;
            float pan_c = 0.0f, tilt_c = 0.0f, phase = 0.0f;
            int got = sscanf(line + 4, "%d %u %u %u %u %d %f %f %f",
                             &enabled, &pan_ch, &pan_fine,
                             &tilt_ch, &tilt_fine, &is_16bit,
                             &pan_c, &tilt_c, &phase);
            if (got == 9) {
                f->enabled          = (enabled  != 0);
                f->is_16bit         = (is_16bit != 0);
                f->pan_ch           = (uint16_t)pan_ch;
                f->pan_fine_ch      = (uint16_t)pan_fine;
                f->tilt_ch          = (uint16_t)tilt_ch;
                f->tilt_fine_ch     = (uint16_t)tilt_fine;
                f->pan_center       = pan_c;
                f->tilt_center      = tilt_c;
                f->phase_offset_deg = phase;
                f->max_val          = is_16bit ? 65535.0f : 255.0f;
                tmp.fixture_count++;
            }
        } else if (strncmp(line, "END", 3) == 0) {
            break;
        }
    }

    if (tmp.fixture_count == 0) return false;
    tmp.loaded = true;

    critical_section_enter_blocking(&mfx_lock);
    memcpy(&slot_data[slot], &tmp, sizeof(mfx_slot_data_t));
    if (play.slot == (int8_t)slot)
        play.active = false;
    critical_section_exit(&mfx_lock);

    return true;
}

/* ---------- start / stop / bpm ------------------------------------------ */

void mfx_start(uint8_t slot)
{
    if (slot >= MFX_MAX_SLOTS) return;
    critical_section_enter_blocking(&mfx_lock);
    if (slot_data[slot].loaded) {
        play.slot     = (int8_t)slot;
        play.start_us = 0; /* set on first tick */
        play.active   = true;
    }
    critical_section_exit(&mfx_lock);
}

void mfx_stop(void)
{
    critical_section_enter_blocking(&mfx_lock);
    play.active = false;
    critical_section_exit(&mfx_lock);
}

void mfx_set_bpm(uint8_t slot, float bpm)
{
    if (slot >= MFX_MAX_SLOTS) return;
    if (bpm < 0.1f)  bpm = 0.1f;
    if (bpm > 600.0f) bpm = 600.0f;
    critical_section_enter_blocking(&mfx_lock);
    slot_data[slot].bpm = bpm;
    critical_section_exit(&mfx_lock);
}

/* ---------- tick (called from core0 at ~100 Hz) ------------------------- */

static void effect_offset(float t, mfx_type_t type, float *pan_off, float *tilt_off)
{
    switch (type) {
        case MFX_CIRCLE:     *pan_off = cosf(t); *tilt_off = sinf(t);      break;
        case MFX_FIGURE8:    *pan_off = sinf(t); *tilt_off = sinf(2.0f*t); break;
        case MFX_PAN_SWING:  *pan_off = sinf(t); *tilt_off = 0.0f;         break;
        case MFX_TILT_SWING: *pan_off = 0.0f;    *tilt_off = sinf(t);      break;
        default:             *pan_off = 0.0f;    *tilt_off = 0.0f;         break;
    }
}

void mfx_tick(uint32_t now_us)
{
    critical_section_enter_blocking(&mfx_lock);

    if (!play.active || play.slot < 0) {
        critical_section_exit(&mfx_lock);
        return;
    }

    mfx_slot_data_t *sd = &slot_data[(uint8_t)play.slot];
    if (!sd->loaded || sd->fixture_count == 0) {
        play.active = false;
        critical_section_exit(&mfx_lock);
        return;
    }

    if (play.start_us == 0) play.start_us = now_us;

    float elapsed_s  = (float)((uint32_t)(now_us - play.start_us)) / 1e6f;
    float angle      = elapsed_s * (sd->bpm / 60.0f) * (2.0f * MFX_PI);
    float spread_rad = sd->spread_deg * MFX_PI / 180.0f;

    int enabled_count = 0;
    for (int i = 0; i < sd->fixture_count; i++)
        if (sd->fixtures[i].enabled) enabled_count++;

    /* snapshot config */
    mfx_fixture_t snap[MFX_MAX_FIXTURES];
    uint16_t      fcount = sd->fixture_count;
    mfx_type_t    type   = sd->type;
    float         pamp   = sd->pan_amp;
    float         tamp   = sd->tilt_amp;
    memcpy(snap, sd->fixtures, fcount * sizeof(mfx_fixture_t));
    play.last_elapsed_s = elapsed_s;

    critical_section_exit(&mfx_lock);

    /* compute + write outside the lock */
    int fi = 0;
    for (int i = 0; i < (int)fcount; i++) {
        mfx_fixture_t *f = &snap[i];
        if (!f->enabled) continue;

        float auto_phase = (enabled_count > 1)
                           ? spread_rad * fi / (float)enabled_count
                           : 0.0f;
        float phase = f->phase_offset_deg * MFX_PI / 180.0f + auto_phase;
        float pan_off, tilt_off;
        effect_offset(angle + phase, type, &pan_off, &tilt_off);

        float half     = f->max_val / 2.0f;
        float new_pan  = f->pan_center  + pan_off  * pamp * half;
        float new_tilt = f->tilt_center + tilt_off * tamp * half;
        if (new_pan  < 0.0f)       new_pan  = 0.0f;
        if (new_pan  > f->max_val) new_pan  = f->max_val;
        if (new_tilt < 0.0f)       new_tilt = 0.0f;
        if (new_tilt > f->max_val) new_tilt = f->max_val;

        if (f->is_16bit) {
            uint16_t p16 = (uint16_t)new_pan;
            uint16_t t16 = (uint16_t)new_tilt;
            dmx_engine_set_channel(f->pan_ch,       (p16 >> 8) & 0xFF);
            dmx_engine_set_channel(f->pan_fine_ch,   p16 & 0xFF);
            dmx_engine_set_channel(f->tilt_ch,      (t16 >> 8) & 0xFF);
            dmx_engine_set_channel(f->tilt_fine_ch,  t16 & 0xFF);
        } else {
            dmx_engine_set_channel(f->pan_ch,  (uint8_t)new_pan);
            dmx_engine_set_channel(f->tilt_ch, (uint8_t)new_tilt);
        }
        fi++;
    }
}

/* ---------- status ------------------------------------------------------- */

void mfx_get_status(mfx_status_t *out)
{
    critical_section_enter_blocking(&mfx_lock);
    uint8_t s = (play.slot >= 0) ? (uint8_t)play.slot : 0;
    out->active      = play.active;
    out->active_slot = s;
    out->loaded      = slot_data[s].loaded;
    out->type        = (int)slot_data[s].type;
    out->bpm         = slot_data[s].bpm;
    out->elapsed_s   = play.last_elapsed_s;
    critical_section_exit(&mfx_lock);
}

void mfx_get_slot_info(uint8_t slot, mfx_slot_info_t *out)
{
    if (slot >= MFX_MAX_SLOTS) { memset(out, 0, sizeof(*out)); return; }
    critical_section_enter_blocking(&mfx_lock);
    out->loaded        = slot_data[slot].loaded;
    out->type          = (int)slot_data[slot].type;
    out->bpm           = slot_data[slot].bpm;
    out->fixture_count = slot_data[slot].fixture_count;
    critical_section_exit(&mfx_lock);
}
