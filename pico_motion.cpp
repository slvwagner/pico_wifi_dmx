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

/* ---------- state -------------------------------------------------------- */

static critical_section_t mfx_lock;

static struct {
    bool           loaded;
    bool           active;
    mfx_type_t     type;
    float          bpm;
    float          pan_amp;     /* 0.0–1.0 */
    float          tilt_amp;    /* 0.0–1.0 */
    float          spread_deg;  /* 0.0–360.0 */
    uint32_t       start_us;    /* 0 = set on first tick */
    uint16_t       fixture_count;
    mfx_fixture_t  fixtures[MFX_MAX_FIXTURES];
    float          last_elapsed_s;
} ms;

/* ---------- init --------------------------------------------------------- */

void mfx_init(void)
{
    critical_section_init(&mfx_lock);
    memset(&ms, 0, sizeof(ms));
    ms.bpm      = 30.0f;
    ms.pan_amp  = 0.2f;
    ms.tilt_amp = 0.15f;
}

/* ---------- load (called from core1 / lwIP context) --------------------- */
/*
 * Text protocol:
 *   TYPE 0          (0=circle 1=figure8 2=panSwing 3=tiltSwing)
 *   BPM 30.000
 *   PANAMP 0.200
 *   TILTAMP 0.150
 *   SPREAD 90.000
 *   FIX enabled pan_ch pan_fine_ch tilt_ch tilt_fine_ch is_16bit pan_center tilt_center phase_deg
 *   END
 */
bool mfx_load(const char *body, size_t len)
{
    struct {
        bool          loaded;
        mfx_type_t    type;
        float         bpm, pan_amp, tilt_amp, spread_deg;
        uint16_t      fixture_count;
        mfx_fixture_t fixtures[MFX_MAX_FIXTURES];
    } tmp;
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
                f->enabled         = (enabled  != 0);
                f->is_16bit        = (is_16bit != 0);
                f->pan_ch          = (uint16_t)pan_ch;
                f->pan_fine_ch     = (uint16_t)pan_fine;
                f->tilt_ch         = (uint16_t)tilt_ch;
                f->tilt_fine_ch    = (uint16_t)tilt_fine;
                f->pan_center      = pan_c;
                f->tilt_center     = tilt_c;
                f->phase_offset_deg= phase;
                f->max_val         = is_16bit ? 65535.0f : 255.0f;
                tmp.fixture_count++;
            }

        } else if (strncmp(line, "END", 3) == 0) {
            break;
        }
    }

    if (tmp.fixture_count == 0) return false;

    critical_section_enter_blocking(&mfx_lock);
    ms.loaded        = true;
    ms.active        = false;
    ms.type          = tmp.type;
    ms.bpm           = tmp.bpm;
    ms.pan_amp       = tmp.pan_amp;
    ms.tilt_amp      = tmp.tilt_amp;
    ms.spread_deg    = tmp.spread_deg;
    ms.fixture_count = tmp.fixture_count;
    ms.start_us      = 0;
    memcpy(ms.fixtures, tmp.fixtures, tmp.fixture_count * sizeof(mfx_fixture_t));
    critical_section_exit(&mfx_lock);

    return true;
}

/* ---------- start / stop ------------------------------------------------- */

void mfx_start(void)
{
    critical_section_enter_blocking(&mfx_lock);
    if (ms.loaded) {
        ms.start_us = 0; /* set on first tick */
        ms.active   = true;
    }
    critical_section_exit(&mfx_lock);
}

void mfx_stop(void)
{
    critical_section_enter_blocking(&mfx_lock);
    ms.active = false;
    critical_section_exit(&mfx_lock);
}

/* ---------- tick (called from core0 at ~100 Hz) ------------------------- */

static void effect_offset(float t, mfx_type_t type, float *pan_off, float *tilt_off)
{
    switch (type) {
        case MFX_CIRCLE:     *pan_off = cosf(t); *tilt_off = sinf(t);     break;
        case MFX_FIGURE8:    *pan_off = sinf(t); *tilt_off = sinf(2.0f*t);break;
        case MFX_PAN_SWING:  *pan_off = sinf(t); *tilt_off = 0.0f;        break;
        case MFX_TILT_SWING: *pan_off = 0.0f;    *tilt_off = sinf(t);     break;
        default:             *pan_off = 0.0f;    *tilt_off = 0.0f;        break;
    }
}

void mfx_tick(uint32_t now_us)
{
    critical_section_enter_blocking(&mfx_lock);

    if (!ms.active || ms.fixture_count == 0) {
        critical_section_exit(&mfx_lock);
        return;
    }

    if (ms.start_us == 0) ms.start_us = now_us;

    float elapsed_s = (float)((uint32_t)(now_us - ms.start_us)) / 1e6f;
    float angle     = elapsed_s * (ms.bpm / 60.0f) * (2.0f * MFX_PI);
    float spread_rad= ms.spread_deg * MFX_PI / 180.0f;

    /* count enabled fixtures for phase-spread calculation */
    int enabled_count = 0;
    for (int i = 0; i < ms.fixture_count; i++)
        if (ms.fixtures[i].enabled) enabled_count++;

    /* snapshot config */
    mfx_fixture_t  snap[MFX_MAX_FIXTURES];
    uint16_t       fcount = ms.fixture_count;
    mfx_type_t     type   = ms.type;
    float          pamp   = ms.pan_amp;
    float          tamp   = ms.tilt_amp;
    memcpy(snap, ms.fixtures, fcount * sizeof(mfx_fixture_t));

    ms.last_elapsed_s = elapsed_s;
    critical_section_exit(&mfx_lock);

    /* ---- compute + write outside the lock ------------------------------ */
    int fi = 0;
    for (int i = 0; i < (int)fcount; i++) {
        mfx_fixture_t *f = &snap[i];
        if (!f->enabled) continue;

        float auto_phase = (enabled_count > 1)
                           ? spread_rad * fi / (float)enabled_count
                           : 0.0f;
        float phase      = f->phase_offset_deg * MFX_PI / 180.0f + auto_phase;
        float pan_off, tilt_off;
        effect_offset(angle + phase, type, &pan_off, &tilt_off);

        float half     = f->max_val / 2.0f;
        float new_pan  = f->pan_center  + pan_off  * pamp * half;
        float new_tilt = f->tilt_center + tilt_off * tamp * half;
        if (new_pan  < 0.0f)         new_pan  = 0.0f;
        if (new_pan  > f->max_val)   new_pan  = f->max_val;
        if (new_tilt < 0.0f)         new_tilt = 0.0f;
        if (new_tilt > f->max_val)   new_tilt = f->max_val;

        if (f->is_16bit) {
            uint16_t p16 = (uint16_t)new_pan;
            uint16_t t16 = (uint16_t)new_tilt;
            dmx_engine_set_channel(f->pan_ch,      (p16 >> 8) & 0xFF);
            dmx_engine_set_channel(f->pan_fine_ch,  p16 & 0xFF);
            dmx_engine_set_channel(f->tilt_ch,     (t16 >> 8) & 0xFF);
            dmx_engine_set_channel(f->tilt_fine_ch, t16 & 0xFF);
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
    out->active    = ms.active;
    out->loaded    = ms.loaded;
    out->type      = (int)ms.type;
    out->bpm       = ms.bpm;
    out->elapsed_s = ms.last_elapsed_s;
    critical_section_exit(&mfx_lock);
}
