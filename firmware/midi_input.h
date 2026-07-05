#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    bool     enabled;
    bool     initialized;
    uint8_t  rx_pin;
    uint8_t  uart_id;
    uint32_t baud;
    uint32_t byte_count;
    uint32_t message_count;
    uint32_t realtime_count;
    uint32_t parse_error_count;
    uint32_t last_event_ms;
    uint8_t  running_status;
    uint8_t  last_status;
    uint8_t  last_type;
    uint8_t  last_channel;
    uint8_t  last_data1;
    uint8_t  last_data2;
} midi_input_status_t;

void midi_input_init(bool enabled, uint8_t rx_pin, uint8_t uart_id, uint32_t baud);
void midi_input_poll(uint32_t now_ms);
void midi_input_get_status(midi_input_status_t *out);
void midi_input_write_status_json(char *out, size_t out_len);

#ifdef __cplusplus
}
#endif
