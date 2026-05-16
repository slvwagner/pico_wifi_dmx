#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define CHASER_MAX_STEPS      32
#define CHASER_MAX_CH_TOTAL   1024   /* total ch entries across all steps */

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

typedef struct {
    bool     playing;
    bool     loaded;
    bool     loop;
    uint16_t current_step;
    uint16_t step_count;
    uint32_t elapsed_ms;
} chaser_status_t;

void chaser_init(void);
bool chaser_load(const char *body, size_t len);
void chaser_play(void);
void chaser_stop(void);
void chaser_tick(uint32_t now_us);
void chaser_get_status(chaser_status_t *out);

#ifdef __cplusplus
}
#endif
