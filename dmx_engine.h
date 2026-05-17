#pragma once

#include <stdbool.h>
#include <stdint.h>

typedef struct dmx_engine_config_t {
    uint8_t tx_pin;
    uint8_t trigger_pin;
    uint16_t channels;
    uint16_t refresh_rate;
    uint8_t start_code;
    uint8_t sm_ctrl_id;
    uint8_t sm_data_id;
    bool invert_data_bits;
} dmx_engine_config_t;

typedef struct dmx_engine_status_t {
    bool initialized;
    bool running;
    uint8_t tx_pin;
    uint8_t trigger_pin;
    uint16_t channels;
    uint16_t refresh_rate;
    uint8_t active_ctrl_sm;
    uint8_t active_data_sm;
    uint8_t pio_block;
    uint32_t frame_count;
    uint32_t skipped_callbacks;
    uint32_t prime_timeouts;
    uint32_t frame_timeouts;
    uint32_t auto_resyncs;
} dmx_engine_status_t;

void dmx_engine_default_config(dmx_engine_config_t *config);
bool dmx_engine_init(const dmx_engine_config_t *config);
bool dmx_engine_start(void);
void dmx_engine_poll(void);
void dmx_engine_stop(void);
bool dmx_engine_set_channel(uint16_t channel, uint8_t value);
uint16_t dmx_engine_set_channels(const uint8_t *values, uint16_t count);
void dmx_engine_clear(void);
void dmx_engine_get_status(dmx_engine_status_t *status);

/* Scene base buffer — position layer written by scenes/chaser/direct writes.
 * Motion FX reads from this buffer instead of a stored fixed center so that
 * effects are always relative to the current live position. */
bool    dmx_engine_set_base_channel(uint16_t channel, uint8_t value);
uint8_t dmx_engine_get_base_channel(uint16_t channel);
