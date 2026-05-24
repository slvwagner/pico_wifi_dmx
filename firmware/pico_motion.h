#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define MFX_MAX_SLOTS    64
#define MFX_MAX_TARGETS  8

typedef enum {
    MFX_CIRCLE     = 0,
    MFX_FIGURE8    = 1,
    MFX_PAN_SWING  = 2,
    MFX_TILT_SWING = 3,
    MFX_SINE       = 4,
    MFX_PULSE      = 5,
} mfx_type_t;

typedef enum {
    MFX_TARGET_SCALAR8   = 0,
    MFX_TARGET_SCALAR16  = 1,
    MFX_TARGET_PANTILT8  = 2,
    MFX_TARGET_PANTILT16 = 3,
} mfx_target_kind_t;

typedef struct {
    bool     enabled;
    mfx_target_kind_t kind;
    uint16_t ch1;
    uint16_t fine1;
    uint16_t ch2;
    uint16_t fine2;
    float    phase_offset_deg;  /* -180 ... +180 */
    float    max_val;           /* 255.0 or 65535.0 */
} mfx_target_t;

/* Summary returned by mfx_get_status() */
typedef struct {
    uint64_t active_mask;   /* bitmask: bit i = slot i is playing  */
    uint64_t loaded_mask;   /* bitmask: bit i = slot i is loaded   */
    float    elapsed_s;     /* elapsed of the lowest active slot   */
} mfx_status_t;

/* Per-slot summary returned by mfx_get_slot_info() */
typedef struct {
    bool     loaded;
    bool     active;
    int      type;
    float    bpm;
    uint16_t target_count;
} mfx_slot_info_t;

void mfx_init(void);
bool mfx_load_slot(uint8_t slot, const char *body, size_t len);
void mfx_start(uint8_t slot);     /* start one slot; others keep running */
void mfx_stop(void);              /* stop ALL slots */
void mfx_stop_slot(uint8_t slot); /* stop one slot only */
void mfx_clear_slot(uint8_t slot);
void mfx_set_bpm(uint8_t slot, float bpm);  /* live BPM override */
void mfx_tick(uint32_t now_us, uint8_t *scratch, bool *touched);     /* scratch/touched: [513], indices 1-512 */
void mfx_get_status(mfx_status_t *out);
void mfx_get_slot_info(uint8_t slot, mfx_slot_info_t *out);

#ifdef __cplusplus
}
#endif
