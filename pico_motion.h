#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

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
    float    pan_center;        /* 0–65535 */
    float    tilt_center;       /* 0–65535 */
    float    phase_offset_deg;  /* –180 … +180 */
    float    max_val;           /* 255.0 or 65535.0 */
} mfx_fixture_t;

typedef struct {
    bool            active;
    bool            loaded;
    int             type;    /* mfx_type_t cast to int for C compat */
    float           bpm;
    float           elapsed_s;
} mfx_status_t;

void mfx_init(void);
bool mfx_load(const char *body, size_t len);
void mfx_start(void);
void mfx_stop(void);
void mfx_tick(uint32_t now_us);
void mfx_get_status(mfx_status_t *out);

#ifdef __cplusplus
}
#endif
