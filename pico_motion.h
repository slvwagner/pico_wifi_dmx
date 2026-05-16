#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define MFX_MAX_SLOTS    8
#define MFX_MAX_FIXTURES 8

typedef enum {
    MFX_CIRCLE     = 0,
    MFX_FIGURE8    = 1,
    MFX_PAN_SWING  = 2,
    MFX_TILT_SWING = 3,
} mfx_type_t;

typedef struct {
    bool     enabled;
    bool     is_16bit;
    uint16_t pan_ch;
    uint16_t pan_fine_ch;
    uint16_t tilt_ch;
    uint16_t tilt_fine_ch;
    float    pan_center;        /* 0-65535 */
    float    tilt_center;       /* 0-65535 */
    float    phase_offset_deg;  /* -180 ... +180 */
    float    max_val;           /* 255.0 or 65535.0 */
} mfx_fixture_t;

/* Summary returned by mfx_get_status() */
typedef struct {
    bool     active;
    bool     loaded;        /* active slot is loaded */
    uint8_t  active_slot;
    int      type;          /* mfx_type_t cast to int for C compat */
    float    bpm;
    float    elapsed_s;
} mfx_status_t;

/* Per-slot summary returned by mfx_get_slot_info() */
typedef struct {
    bool     loaded;
    int      type;
    float    bpm;
    uint16_t fixture_count;
} mfx_slot_info_t;

void mfx_init(void);
bool mfx_load_slot(uint8_t slot, const char *body, size_t len);
void mfx_start(uint8_t slot);
void mfx_stop(void);
void mfx_set_bpm(uint8_t slot, float bpm);  /* live BPM override */
void mfx_tick(uint32_t now_us);
void mfx_get_status(mfx_status_t *out);
void mfx_get_slot_info(uint8_t slot, mfx_slot_info_t *out);

#ifdef __cplusplus
}
#endif
