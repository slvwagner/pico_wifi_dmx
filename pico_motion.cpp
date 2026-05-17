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

/* ---------- slot storage (each slot owns its own playback state) -------- */

typedef struct {
    bool           loaded;
    bool           active;        /* playing right now */
    mfx_type_t     type;
    float          bpm;
    float          pan_amp;       /* 0.0–1.0 */
    float          tilt_amp;      /* 0.0–1.0 */
    float          spread_deg;    /* 0.0–360.0 */
    uint32_t       start_us;      /* 0 = set on first tick */
    float          last_elapsed_s;
    uint16_t       fixture_count;
    mfx_fixture_t  fixtures[MFX_MAX_FIXTURES];
} mfx_slot_data_t;

static mfx_slot_data_t  slot_data[MFX_MAX_SLOTS];
static critical_section_t mfx_lock;

/* Scratch buffers for multi-slot bigger-wins accumulation (static = off stack) */
typedef struct {
    mfx_type_t    type;
    float         bpm, pan_amp, tilt_amp, spread_deg, elapsed_s;
    int           enabled_count;
    uint16_t      fixture_count;
    mfx_fixture_t fixtures[MFX_MAX_FIXTURES];
} mfx_snap_t;

static mfx_snap_t snaps[MFX_MAX_SLOTS]; /* snapshots taken under lock   */

/* ---------- init --------------------------------------------------------- */

void mfx_init(void)
{
    critical_section_init(&mfx_lock);
    memset(slot_data, 0, sizeof(slot_data));
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
            float phase = 0.0f;
            int got = sscanf(line + 4, "%d %u %u %u %u %d %f",
                             &enabled, &pan_ch, &pan_fine,
                             &tilt_ch, &tilt_fine, &is_16bit,
                             &phase);
            if (got == 7) {
                f->enabled          = (enabled  != 0);
                f->is_16bit         = (is_16bit != 0);
                f->pan_ch           = (uint16_t)pan_ch;
                f->pan_fine_ch      = (uint16_t)pan_fine;
                f->tilt_ch          = (uint16_t)tilt_ch;
                f->tilt_fine_ch     = (uint16_t)tilt_fine;
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
    tmp.active   = false;   /* re-upload stops the slot */
    tmp.start_us = 0;
    memcpy(&slot_data[slot], &tmp, sizeof(mfx_slot_data_t));
    critical_section_exit(&mfx_lock);

    return true;
}

/* ---------- start / stop / bpm ------------------------------------------ */

void mfx_start(uint8_t slot)
{
    if (slot >= MFX_MAX_SLOTS) return;
    critical_section_enter_blocking(&mfx_lock);
    if (slot_data[slot].loaded) {
        slot_data[slot].start_us = 0; /* reset phase on each start */
        slot_data[slot].active   = true;
    }
    critical_section_exit(&mfx_lock);
}

void mfx_stop(void)
{
    critical_section_enter_blocking(&mfx_lock);
    for (int i = 0; i < MFX_MAX_SLOTS; i++)
        slot_data[i].active = false;
    critical_section_exit(&mfx_lock);
}

void mfx_stop_slot(uint8_t slot)
{
    if (slot >= MFX_MAX_SLOTS) return;
    critical_section_enter_blocking(&mfx_lock);
    slot_data[slot].active = false;
    critical_section_exit(&mfx_lock);
}

void mfx_clear_slot(uint8_t slot)
{
    if (slot >= MFX_MAX_SLOTS) return;
    critical_section_enter_blocking(&mfx_lock);
    memset(&slot_data[slot], 0, sizeof(slot_data[slot]));
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

/* Write 8-bit value to scratch with bigger-wins. */
static inline void scratch8(uint16_t ch, uint8_t v, uint8_t *scratch, bool *touched)
{
    if (ch < 1 || ch > 512) return;
    if (!touched[ch] || v > scratch[ch]) scratch[ch] = v;
    touched[ch] = true;
}

/*
 * Write a 16-bit value (coarse+fine channel pair) to scratch with bigger-wins.
 * Comparison is done on the full 16-bit value to avoid byte-split carry artifacts.
 * e.g. slot A=49920 (c=194,f=255) vs slot B=50001 (c=195,f=65):
 *   byte-by-byte max would give 50175 (wrong); 16-bit max gives 50001 (correct).
 */
static inline void scratch16(uint16_t coarse_ch, uint16_t fine_ch, uint16_t v16,
                             uint8_t *scratch, bool *touched)
{
    if (coarse_ch < 1 || coarse_ch > 512) return;
    uint16_t cur = touched[coarse_ch]
        ? (((uint16_t)scratch[coarse_ch] << 8) |
           (fine_ch >= 1 && fine_ch <= 512 ? scratch[fine_ch] : 0u))
        : 0u;
    if (!touched[coarse_ch] || v16 > cur) {
        scratch[coarse_ch] = (v16 >> 8) & 0xFF;
        touched[coarse_ch] = true;
        if (fine_ch >= 1 && fine_ch <= 512) {
            scratch[fine_ch] = v16 & 0xFF;
            touched[fine_ch] = true;
        }
    }
}

void mfx_tick(uint32_t now_us, uint8_t *scratch, bool *touched)
{
    /* ---- snapshot all active slots under lock ------------------------- */
    critical_section_enter_blocking(&mfx_lock);
    int active_count = 0;
    for (int i = 0; i < MFX_MAX_SLOTS; i++) {
        mfx_slot_data_t *sd = &slot_data[i];
        if (!sd->active || !sd->loaded || sd->fixture_count == 0) continue;
        if (sd->start_us == 0) sd->start_us = now_us;
        float elapsed_s    = (float)((uint32_t)(now_us - sd->start_us)) / 1e6f;
        sd->last_elapsed_s = elapsed_s;

        mfx_snap_t *sn = &snaps[active_count];
        sn->type          = sd->type;
        sn->bpm           = sd->bpm;
        sn->pan_amp       = sd->pan_amp;
        sn->tilt_amp      = sd->tilt_amp;
        sn->spread_deg    = sd->spread_deg;
        sn->elapsed_s     = elapsed_s;
        sn->fixture_count = sd->fixture_count;
        memcpy(sn->fixtures, sd->fixtures, sd->fixture_count * sizeof(mfx_fixture_t));
        int ec = 0;
        for (int j = 0; j < (int)sd->fixture_count; j++)
            if (sd->fixtures[j].enabled) ec++;
        sn->enabled_count = ec;
        active_count++;
    }
    critical_section_exit(&mfx_lock);

    if (active_count == 0) return;

    /* ---- compute every active slot, accumulate with bigger-wins ------- */
    /* NOTE: caller owns scratch/touched and clears them before the first
     * tick call this cycle — do NOT clear here. */

    for (int si = 0; si < active_count; si++) {
        mfx_snap_t *sn   = &snaps[si];
        float angle      = sn->elapsed_s * (sn->bpm / 60.0f) * (2.0f * MFX_PI);
        float spread_rad = sn->spread_deg * MFX_PI / 180.0f;

        int fi = 0;
        for (int i = 0; i < (int)sn->fixture_count; i++) {
            mfx_fixture_t *f = &sn->fixtures[i];
            if (!f->enabled) continue;

            float auto_phase = (sn->enabled_count > 1)
                               ? spread_rad * fi / (float)sn->enabled_count
                               : 0.0f;
            float phase = f->phase_offset_deg * MFX_PI / 180.0f + auto_phase;
            float pan_off, tilt_off;
            effect_offset(angle + phase, sn->type, &pan_off, &tilt_off);

            /* Only write axes that this effect type actually animates.
             * Writing a static center value for an idle axis would corrupt
             * bigger-wins accumulation when another slot animates that axis. */
            bool moves_pan  = (sn->type != MFX_TILT_SWING);
            bool moves_tilt = (sn->type != MFX_PAN_SWING);

            float half = f->max_val / 2.0f;

            if (moves_pan) {
                /* Read center from scene base buffer — relative to live position. */
                float base_pan;
                if (f->is_16bit) {
                    base_pan = (float)(((uint16_t)dmx_engine_get_base_channel(f->pan_ch) << 8) |
                                       dmx_engine_get_base_channel(f->pan_fine_ch));
                } else {
                    base_pan = (float)dmx_engine_get_base_channel(f->pan_ch);
                }
                float new_pan = base_pan + pan_off * sn->pan_amp * half;
                if (new_pan < 0.0f)       new_pan = 0.0f;
                if (new_pan > f->max_val) new_pan = f->max_val;
                if (f->is_16bit) scratch16(f->pan_ch,  f->pan_fine_ch,  (uint16_t)new_pan,  scratch, touched);
                else              scratch8 (f->pan_ch,                   (uint8_t) new_pan,  scratch, touched);
            }
            if (moves_tilt) {
                float base_tilt;
                if (f->is_16bit) {
                    base_tilt = (float)(((uint16_t)dmx_engine_get_base_channel(f->tilt_ch) << 8) |
                                        dmx_engine_get_base_channel(f->tilt_fine_ch));
                } else {
                    base_tilt = (float)dmx_engine_get_base_channel(f->tilt_ch);
                }
                float new_tilt = base_tilt + tilt_off * sn->tilt_amp * half;
                if (new_tilt < 0.0f)       new_tilt = 0.0f;
                if (new_tilt > f->max_val) new_tilt = f->max_val;
                if (f->is_16bit) scratch16(f->tilt_ch, f->tilt_fine_ch, (uint16_t)new_tilt, scratch, touched);
                else              scratch8 (f->tilt_ch,                  (uint8_t) new_tilt, scratch, touched);
            }
            fi++;
        }
    }
    /* DMX writes are done by the caller after all ticks accumulate. */
}

/* ---------- status ------------------------------------------------------- */

void mfx_get_status(mfx_status_t *out)
{
    critical_section_enter_blocking(&mfx_lock);
    uint32_t amask = 0, lmask = 0;
    float   elapsed = 0.0f;
    for (int i = 0; i < MFX_MAX_SLOTS; i++) {
        if (slot_data[i].active) amask |= (uint32_t)(1u << i);
        if (slot_data[i].loaded) lmask |= (uint32_t)(1u << i);
    }
    for (int i = 0; i < MFX_MAX_SLOTS; i++) { /* elapsed of lowest active slot */
        if (slot_data[i].active) { elapsed = slot_data[i].last_elapsed_s; break; }
    }
    out->active_mask = amask;
    out->loaded_mask = lmask;
    out->elapsed_s   = elapsed;
    critical_section_exit(&mfx_lock);
}

void mfx_get_slot_info(uint8_t slot, mfx_slot_info_t *out)
{
    if (slot >= MFX_MAX_SLOTS) { memset(out, 0, sizeof(*out)); return; }
    critical_section_enter_blocking(&mfx_lock);
    out->loaded        = slot_data[slot].loaded;
    out->active        = slot_data[slot].active;
    out->type          = (int)slot_data[slot].type;
    out->bpm           = slot_data[slot].bpm;
    out->fixture_count = slot_data[slot].fixture_count;
    critical_section_exit(&mfx_lock);
}
