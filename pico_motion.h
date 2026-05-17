#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define MFX_MAX_SLOTS    16
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
    float    phase_offset_deg;  /* -180 ... +180 */
    float    max_val;           /* 255.0 or 65535.0 */
} mfx_fixture_t;

/* Summary returned by mfx_get_status() */
typedef struct {
    uint32_t active_mask;   /* bitmask: bit i = slot i is playing  */
    uint32_t loaded_mask;   /* bitmask: bit i = slot i is loaded   */
    float    elapsed_s;     /* elapsed of the lowest active slot   */
} mfx_status_t;

/* Per-slot summary returned by mfx_get_slot_info() */
typedef struct {
    bool     loaded;
    bool     active;
    int      type;
    float    bpm;
    uint16_t fixture_count;
} mfx_slot_info_t;

void mfx_init(void);
bool mfx_load_slot(uint8_t slot, const char *body, size_t len);
void mfx_start(uint8_t slot);     /* start one slot; others keep running */
void mfx_stop(void);              /* stop ALL slots */
void mfx_stop_slot(uint8_t slot); /* stop one slot only */
void mfx_set_bpm(uint8_t slot, float bpm);  /* live BPM override */
void mfx_tick(uint32_t now_us, uint8_t *scratch, bool *touched);     /* scratch/touched: [513], indices 1-512 */
void mfx_get_status(mfx_status_t *out);
void mfx_get_slot_info(uint8_t slot, mfx_slot_info_t *out);

#ifdef __cplusplus
}
#endif
