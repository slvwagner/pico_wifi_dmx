#include "midi_input.h"

#include <stdio.h>
#include <string.h>

#include "hardware/gpio.h"
#include "hardware/uart.h"
#include "pico/sync.h"

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
    uint8_t  pending_status;
    uint8_t  pending_data[2];
    uint8_t  pending_count;
    uint8_t  expected_count;
    uint8_t  last_status;
    uint8_t  last_type;
    uint8_t  last_channel;
    uint8_t  last_data1;
    uint8_t  last_data2;
    bool     in_sysex;
} midi_input_state_t;

static critical_section_t midi_lock;
static bool midi_lock_ready = false;
static midi_input_state_t midi_state;

static uart_inst_t *uart_for_id(uint8_t uart_id)
{
    return uart_id == 0 ? uart0 : uart1;
}

static uint8_t data_count_for_status(uint8_t status)
{
    uint8_t type = status & 0xF0u;
    if (type == 0xC0u || type == 0xD0u) return 1;
    if (type >= 0x80u && type <= 0xE0u) return 2;
    return 0;
}

static void midi_record_message(uint8_t status, const uint8_t *data, uint8_t count, uint32_t now_ms)
{
    critical_section_enter_blocking(&midi_lock);
    midi_state.message_count++;
    midi_state.last_event_ms = now_ms;
    midi_state.last_status = status;
    midi_state.last_type = status & 0xF0u;
    midi_state.last_channel = (status & 0x0Fu) + 1u;
    midi_state.last_data1 = count > 0 ? data[0] : 0;
    midi_state.last_data2 = count > 1 ? data[1] : 0;
    critical_section_exit(&midi_lock);
}

static void midi_record_parse_error(void)
{
    critical_section_enter_blocking(&midi_lock);
    midi_state.parse_error_count++;
    critical_section_exit(&midi_lock);
}

static void midi_process_byte(uint8_t byte, uint32_t now_ms)
{
    critical_section_enter_blocking(&midi_lock);
    midi_state.byte_count++;
    critical_section_exit(&midi_lock);

    if (byte >= 0xF8u) {
        critical_section_enter_blocking(&midi_lock);
        midi_state.realtime_count++;
        midi_state.last_event_ms = now_ms;
        midi_state.last_status = byte;
        midi_state.last_type = byte;
        midi_state.last_channel = 0;
        midi_state.last_data1 = 0;
        midi_state.last_data2 = 0;
        critical_section_exit(&midi_lock);
        return;
    }

    if (byte == 0xF0u) {
        critical_section_enter_blocking(&midi_lock);
        midi_state.in_sysex = true;
        midi_state.pending_count = 0;
        midi_state.expected_count = 0;
        midi_state.pending_status = 0;
        critical_section_exit(&midi_lock);
        return;
    }

    if (byte == 0xF7u) {
        critical_section_enter_blocking(&midi_lock);
        midi_state.in_sysex = false;
        critical_section_exit(&midi_lock);
        return;
    }

    critical_section_enter_blocking(&midi_lock);
    bool in_sysex = midi_state.in_sysex;
    critical_section_exit(&midi_lock);
    if (in_sysex) return;

    if (byte & 0x80u) {
        uint8_t expected = data_count_for_status(byte);
        critical_section_enter_blocking(&midi_lock);
        midi_state.pending_status = byte;
        midi_state.pending_count = 0;
        midi_state.expected_count = expected;
        if (expected > 0) {
            midi_state.running_status = byte;
        }
        critical_section_exit(&midi_lock);
        if (expected == 0) {
            midi_record_parse_error();
        }
        return;
    }

    uint8_t status = 0;
    uint8_t pending_count = 0;
    uint8_t expected_count = 0;
    uint8_t data[2] = {0, 0};

    critical_section_enter_blocking(&midi_lock);
    status = midi_state.pending_status ? midi_state.pending_status : midi_state.running_status;
    expected_count = midi_state.pending_status ? midi_state.expected_count : data_count_for_status(midi_state.running_status);
    pending_count = midi_state.pending_count;
    if (status && expected_count > 0 && pending_count < sizeof(midi_state.pending_data)) {
        midi_state.pending_data[pending_count++] = byte;
        midi_state.pending_count = pending_count;
        data[0] = midi_state.pending_data[0];
        data[1] = midi_state.pending_data[1];
    }
    critical_section_exit(&midi_lock);

    if (!status || expected_count == 0 || pending_count > expected_count) {
        midi_record_parse_error();
        return;
    }

    if (pending_count >= expected_count) {
        midi_record_message(status, data, expected_count, now_ms);
        critical_section_enter_blocking(&midi_lock);
        midi_state.pending_count = 0;
        midi_state.pending_status = midi_state.running_status;
        midi_state.expected_count = data_count_for_status(midi_state.running_status);
        critical_section_exit(&midi_lock);
    }
}

void midi_input_init(bool enabled, uint8_t rx_pin, uint8_t uart_id, uint32_t baud)
{
    if (!midi_lock_ready) {
        critical_section_init(&midi_lock);
        midi_lock_ready = true;
    }

    memset(&midi_state, 0, sizeof(midi_state));
    midi_state.enabled = enabled;
    midi_state.rx_pin = rx_pin;
    midi_state.uart_id = uart_id > 1 ? 1 : uart_id;
    midi_state.baud = baud ? baud : 31250u;

    if (!enabled) return;

    uart_inst_t *uart = uart_for_id(midi_state.uart_id);
    uart_init(uart, midi_state.baud);
    gpio_set_function(rx_pin, GPIO_FUNC_UART);
    gpio_pull_up(rx_pin);
    uart_set_format(uart, 8, 1, UART_PARITY_NONE);
    uart_set_hw_flow(uart, false, false);
    uart_set_fifo_enabled(uart, true);
    midi_state.initialized = true;
}

void midi_input_poll(uint32_t now_ms)
{
    if (!midi_state.enabled || !midi_state.initialized) return;

    uart_inst_t *uart = uart_for_id(midi_state.uart_id);
    for (uint8_t i = 0; i < 32 && uart_is_readable(uart); i++) {
        midi_process_byte((uint8_t)uart_getc(uart), now_ms);
    }
}

void midi_input_get_status(midi_input_status_t *out)
{
    if (!out) return;
    if (!midi_lock_ready) {
        memset(out, 0, sizeof(*out));
        return;
    }
    critical_section_enter_blocking(&midi_lock);
    out->enabled = midi_state.enabled;
    out->initialized = midi_state.initialized;
    out->rx_pin = midi_state.rx_pin;
    out->uart_id = midi_state.uart_id;
    out->baud = midi_state.baud;
    out->byte_count = midi_state.byte_count;
    out->message_count = midi_state.message_count;
    out->realtime_count = midi_state.realtime_count;
    out->parse_error_count = midi_state.parse_error_count;
    out->last_event_ms = midi_state.last_event_ms;
    out->running_status = midi_state.running_status;
    out->last_status = midi_state.last_status;
    out->last_type = midi_state.last_type;
    out->last_channel = midi_state.last_channel;
    out->last_data1 = midi_state.last_data1;
    out->last_data2 = midi_state.last_data2;
    critical_section_exit(&midi_lock);
}

void midi_input_write_status_json(char *out, size_t out_len)
{
    midi_input_status_t st;
    midi_input_get_status(&st);
    snprintf(out, out_len,
        "{\"ok\":true,\"enabled\":%s,\"initialized\":%s,\"rx_pin\":%u,"
        "\"uart_id\":%u,\"baud\":%lu,\"byte_count\":%lu,\"message_count\":%lu,"
        "\"realtime_count\":%lu,\"parse_error_count\":%lu,\"last_event_ms\":%lu,"
        "\"running_status\":%u,\"last_status\":%u,\"last_type\":%u,"
        "\"last_channel\":%u,\"last_data1\":%u,\"last_data2\":%u}\n",
        st.enabled ? "true" : "false",
        st.initialized ? "true" : "false",
        st.rx_pin,
        st.uart_id,
        (unsigned long)st.baud,
        (unsigned long)st.byte_count,
        (unsigned long)st.message_count,
        (unsigned long)st.realtime_count,
        (unsigned long)st.parse_error_count,
        (unsigned long)st.last_event_ms,
        st.running_status,
        st.last_status,
        st.last_type,
        st.last_channel,
        st.last_data1,
        st.last_data2);
}
