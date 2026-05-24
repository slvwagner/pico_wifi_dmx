#include "pico_motion.h"
#include "dmx_engine.h"
#include "pico/sync.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef MFX_PI
#define MFX_PI 3.14159265358979f
#endif

typedef struct {
    bool          loaded;
    bool          active;
    mfx_type_t    type;
    float         bpm;
    float         amp1;
    float         amp2;
    float         spread_deg;
    uint32_t      start_us;
    float         last_elapsed_s;
    uint16_t      target_count;
    mfx_target_t  targets[MFX_MAX_TARGETS];
} mfx_slot_data_t;

typedef struct {
    mfx_type_t    type;
    float         bpm, amp1, amp2, spread_deg, elapsed_s;
    int           enabled_count;
    uint16_t      target_count;
    mfx_target_t  targets[MFX_MAX_TARGETS];
} mfx_snap_t;

static mfx_slot_data_t slot_data[MFX_MAX_SLOTS];
static mfx_snap_t snaps[MFX_MAX_SLOTS];
static critical_section_t mfx_lock;

void mfx_init(void)
{
    critical_section_init(&mfx_lock);
    memset(slot_data, 0, sizeof(slot_data));
    slot_data[0].bpm  = 30.0f;
    slot_data[0].amp1 = 0.2f;
    slot_data[0].amp2 = 0.15f;
}

static bool parse_kind(const char *s, mfx_target_kind_t *out)
{
    if (strcmp(s, "scalar8") == 0)   { *out = MFX_TARGET_SCALAR8; return true; }
    if (strcmp(s, "scalar16") == 0)  { *out = MFX_TARGET_SCALAR16; return true; }
    if (strcmp(s, "pantilt8") == 0)  { *out = MFX_TARGET_PANTILT8; return true; }
    if (strcmp(s, "pantilt16") == 0) { *out = MFX_TARGET_PANTILT16; return true; }
    return false;
}

static bool target_is_16bit(const mfx_target_t *t)
{
    return t->kind == MFX_TARGET_SCALAR16 || t->kind == MFX_TARGET_PANTILT16;
}

static bool target_is_pantilt(const mfx_target_t *t)
{
    return t->kind == MFX_TARGET_PANTILT8 || t->kind == MFX_TARGET_PANTILT16;
}

bool mfx_load_slot(uint8_t slot, const char *body, size_t len)
{
    if (slot >= MFX_MAX_SLOTS) return false;

    mfx_slot_data_t tmp;
    memset(&tmp, 0, sizeof(tmp));
    tmp.bpm  = 30.0f;
    tmp.amp1 = 0.2f;
    tmp.amp2 = 0.15f;

    const char *p = body;
    const char *end = body + len;

    while (p < end) {
        while (p < end && (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')) p++;
        if (p >= end) break;

        const char *ls = p;
        while (p < end && *p != '\n' && *p != '\r') p++;

        size_t ll = (size_t)(p - ls);
        char line[128];
        if (ll >= sizeof(line)) ll = sizeof(line) - 1;
        memcpy(line, ls, ll);
        line[ll] = '\0';

        if (strncmp(line, "TYPE ", 5) == 0) {
            tmp.type = (mfx_type_t)atoi(line + 5);
        } else if (strncmp(line, "BPM ", 4) == 0) {
            tmp.bpm = strtof(line + 4, NULL);
        } else if (strncmp(line, "AMP1 ", 5) == 0) {
            tmp.amp1 = strtof(line + 5, NULL);
        } else if (strncmp(line, "AMP2 ", 5) == 0) {
            tmp.amp2 = strtof(line + 5, NULL);
        } else if (strncmp(line, "SPREAD ", 7) == 0) {
            tmp.spread_deg = strtof(line + 7, NULL);
        } else if (strncmp(line, "TARGET ", 7) == 0 && tmp.target_count < MFX_MAX_TARGETS) {
            char kind_s[16] = {0};
            int enabled = 0;
            unsigned ch1 = 0, fine1 = 0, ch2 = 0, fine2 = 0;
            float phase = 0.0f;
            int got = sscanf(line + 7, "%15s %d %u %u %u %u %f",
                             kind_s, &enabled, &ch1, &fine1, &ch2, &fine2, &phase);
            mfx_target_kind_t kind;
            if (got == 7 && parse_kind(kind_s, &kind)) {
                mfx_target_t *t = &tmp.targets[tmp.target_count++];
                t->enabled = enabled != 0;
                t->kind = kind;
                t->ch1 = (uint16_t)ch1;
                t->fine1 = (uint16_t)fine1;
                t->ch2 = (uint16_t)ch2;
                t->fine2 = (uint16_t)fine2;
                t->phase_offset_deg = phase;
                t->max_val = (kind == MFX_TARGET_SCALAR16 || kind == MFX_TARGET_PANTILT16) ? 65535.0f : 255.0f;
            }
        } else if (strncmp(line, "END", 3) == 0) {
            break;
        }
    }

    if (tmp.target_count == 0) return false;
    tmp.loaded = true;

    critical_section_enter_blocking(&mfx_lock);
    tmp.active = false;
    tmp.start_us = 0;
    memcpy(&slot_data[slot], &tmp, sizeof(mfx_slot_data_t));
    critical_section_exit(&mfx_lock);
    return true;
}

void mfx_start(uint8_t slot)
{
    if (slot >= MFX_MAX_SLOTS) return;
    critical_section_enter_blocking(&mfx_lock);
    if (slot_data[slot].loaded) {
        slot_data[slot].start_us = 0;
        slot_data[slot].active = true;
    }
    critical_section_exit(&mfx_lock);
}

void mfx_stop(void)
{
    critical_section_enter_blocking(&mfx_lock);
    for (int i = 0; i < MFX_MAX_SLOTS; i++) slot_data[i].active = false;
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
    if (bpm < 0.1f) bpm = 0.1f;
    if (bpm > 600.0f) bpm = 600.0f;
    critical_section_enter_blocking(&mfx_lock);
    slot_data[slot].bpm = bpm;
    critical_section_exit(&mfx_lock);
}

static void effect_offset(float t, mfx_type_t type, float *a, float *b)
{
    switch (type) {
        case MFX_CIRCLE:     *a = cosf(t); *b = sinf(t); break;
        case MFX_FIGURE8:    *a = sinf(t); *b = sinf(2.0f * t); break;
        case MFX_PAN_SWING:  *a = sinf(t); *b = 0.0f; break;
        case MFX_TILT_SWING: *a = 0.0f; *b = sinf(t); break;
        case MFX_SINE:       *a = sinf(t); *b = 0.0f; break;
        case MFX_PULSE:      *a = sinf(t) >= 0.0f ? 1.0f : -1.0f; *b = 0.0f; break;
        default:             *a = 0.0f; *b = 0.0f; break;
    }
}

static inline void scratch8(uint16_t ch, uint8_t v, uint8_t *scratch, bool *touched)
{
    if (ch < 1 || ch > 512) return;
    if (!touched[ch] || v > scratch[ch]) scratch[ch] = v;
    touched[ch] = true;
}

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

static uint16_t read_base16(uint16_t coarse_ch, uint16_t fine_ch)
{
    return (uint16_t)(((uint16_t)dmx_engine_get_base_channel(coarse_ch) << 8) |
                      dmx_engine_get_base_channel(fine_ch));
}

static void write_target_value(const mfx_target_t *t, uint16_t ch, uint16_t fine_ch,
                               float value, uint8_t *scratch, bool *touched)
{
    if (value < 0.0f) value = 0.0f;
    if (value > t->max_val) value = t->max_val;
    if (target_is_16bit(t)) scratch16(ch, fine_ch, (uint16_t)value, scratch, touched);
    else scratch8(ch, (uint8_t)value, scratch, touched);
}

void mfx_tick(uint32_t now_us, uint8_t *scratch, bool *touched)
{
    critical_section_enter_blocking(&mfx_lock);
    int active_count = 0;
    for (int i = 0; i < MFX_MAX_SLOTS; i++) {
        mfx_slot_data_t *sd = &slot_data[i];
        if (!sd->active || !sd->loaded || sd->target_count == 0) continue;
        if (sd->start_us == 0) sd->start_us = now_us;
        float elapsed_s = (float)((uint32_t)(now_us - sd->start_us)) / 1e6f;
        sd->last_elapsed_s = elapsed_s;

        mfx_snap_t *sn = &snaps[active_count++];
        sn->type = sd->type;
        sn->bpm = sd->bpm;
        sn->amp1 = sd->amp1;
        sn->amp2 = sd->amp2;
        sn->spread_deg = sd->spread_deg;
        sn->elapsed_s = elapsed_s;
        sn->target_count = sd->target_count;
        memcpy(sn->targets, sd->targets, sd->target_count * sizeof(mfx_target_t));
        int ec = 0;
        for (int j = 0; j < (int)sd->target_count; j++) if (sd->targets[j].enabled) ec++;
        sn->enabled_count = ec;
    }
    critical_section_exit(&mfx_lock);

    if (active_count == 0) return;

    for (int si = 0; si < active_count; si++) {
        mfx_snap_t *sn = &snaps[si];
        float angle = sn->elapsed_s * (sn->bpm / 60.0f) * (2.0f * MFX_PI);
        float spread_rad = sn->spread_deg * MFX_PI / 180.0f;

        int ti = 0;
        for (int i = 0; i < (int)sn->target_count; i++) {
            mfx_target_t *t = &sn->targets[i];
            if (!t->enabled) continue;

            float auto_phase = (sn->enabled_count > 1) ? spread_rad * ti / (float)sn->enabled_count : 0.0f;
            float phase = t->phase_offset_deg * MFX_PI / 180.0f + auto_phase;
            float off1, off2;
            effect_offset(angle + phase, sn->type, &off1, &off2);
            float half = t->max_val / 2.0f;

            if (target_is_pantilt(t)) {
                bool moves_1 = (sn->type != MFX_TILT_SWING);
                bool moves_2 = (sn->type != MFX_PAN_SWING);
                if (moves_1) {
                    float base = target_is_16bit(t) ? (float)read_base16(t->ch1, t->fine1)
                                                    : (float)dmx_engine_get_base_channel(t->ch1);
                    write_target_value(t, t->ch1, t->fine1, base + off1 * sn->amp1 * half, scratch, touched);
                }
                if (moves_2) {
                    float base = target_is_16bit(t) ? (float)read_base16(t->ch2, t->fine2)
                                                    : (float)dmx_engine_get_base_channel(t->ch2);
                    write_target_value(t, t->ch2, t->fine2, base + off2 * sn->amp2 * half, scratch, touched);
                }
            } else {
                float base = target_is_16bit(t) ? (float)read_base16(t->ch1, t->fine1)
                                                : (float)dmx_engine_get_base_channel(t->ch1);
                write_target_value(t, t->ch1, t->fine1, base + off1 * sn->amp1 * half, scratch, touched);
            }
            ti++;
        }
    }
}

void mfx_get_status(mfx_status_t *out)
{
    critical_section_enter_blocking(&mfx_lock);
    uint64_t amask = 0, lmask = 0;
    float elapsed = 0.0f;
    for (int i = 0; i < MFX_MAX_SLOTS; i++) {
        if (slot_data[i].active) amask |= (uint64_t)1u << i;
        if (slot_data[i].loaded) lmask |= (uint64_t)1u << i;
    }
    for (int i = 0; i < MFX_MAX_SLOTS; i++) {
        if (slot_data[i].active) { elapsed = slot_data[i].last_elapsed_s; break; }
    }
    out->active_mask = amask;
    out->loaded_mask = lmask;
    out->elapsed_s = elapsed;
    critical_section_exit(&mfx_lock);
}

void mfx_get_slot_info(uint8_t slot, mfx_slot_info_t *out)
{
    if (slot >= MFX_MAX_SLOTS) { memset(out, 0, sizeof(*out)); return; }
    critical_section_enter_blocking(&mfx_lock);
    out->loaded = slot_data[slot].loaded;
    out->active = slot_data[slot].active;
    out->type = (int)slot_data[slot].type;
    out->bpm = slot_data[slot].bpm;
    out->target_count = slot_data[slot].target_count;
    critical_section_exit(&mfx_lock);
}
