#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define CHASER_MAX_SLOTS      8
#define CHASER_MAX_STEPS      32
#define CHASER_MAX_CH_TOTAL   1024   /* total ch entries per slot */

typedef struct {
    uint16_t channel;   /* 1-512 */
    uint8_t  value;
} chaser_ch_t;

typedef struct {
    uint32_t duration_ms;
    uint8_t  fade_percent;  /* 0-100 */
    uint16_t ch_start;      /* index into flat channel array */
    uint16_t ch_count;
} chaser_step_t;

/* Summary returned by chaser_get_status() */
typedef struct {
    uint8_t  active_mask;   /* bitmask: bit i = slot i is playing  */
    uint8_t  loaded_mask;   /* bitmask: bit i = slot i is loaded   */
    uint16_t step;          /* current_step of the first active slot */
    uint16_t step_count;    /* step_count  of the first active slot */
    uint32_t elapsed_ms;    /* elapsed_ms  of the first active slot */
} chaser_status_t;

/* Per-slot summary returned by chaser_get_slot_info() */
typedef struct {
    bool     loaded;
    bool     active;
    bool     loop;
    uint16_t step_count;
    float    speed_mult;
} chaser_slot_info_t;

void chaser_init(void);
bool chaser_load_slot(uint8_t slot, const char *body, size_t len);
void chaser_play(uint8_t slot);
void chaser_stop(void);
void chaser_stop_slot(uint8_t slot);
void chaser_set_speed(uint8_t slot, float mult);  /* mult: 0.1–10.0, 1.0 = normal */
void chaser_tick(uint32_t now_us, uint8_t *scratch, bool *touched);  /* scratch/touched: [513], indices 1-512 */
void chaser_get_status(chaser_status_t *out);
void chaser_get_slot_info(uint8_t slot, chaser_slot_info_t *out);

#ifdef __cplusplus
}
#endif
