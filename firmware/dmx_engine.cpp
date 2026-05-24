#include "dmx_engine.h"

#include <string.h>

#include "hardware/clocks.h"
#include "hardware/dma.h"
#include "hardware/pio.h"
#include "pico/sync.h"
#include "pico/stdlib.h"
#include "pico/time.h"

#include "dmx_native.pio.h"

#define DMX_ENGINE_MAX_CHANNELS 512u
#define DMX_ENGINE_FRAME_SLOTS (DMX_ENGINE_MAX_CHANNELS + 1u)
#define DMX_BREAK_US 92u
#define DMX_MAB_US 12u
#define DMX_SLOT_US 44u
#define SM_CTRL_CLOCK_HZ 6000000u
#define SM_DATA_CLOCK_HZ 3000000u
#define IRQ_FRAME_DONE 2u
#define IRQ_FRAME_START 0u
#define DMA_PRIME_TIMEOUT_US 500u

typedef struct sm_pair_t {
    uint8_t ctrl;
    uint8_t data;
} sm_pair_t;

static const sm_pair_t fallback_sm_pairs[] = {
    {8, 9},
    {0, 1},
    {4, 5},
};

typedef struct dmx_engine_state_t {
    bool initialized;
    bool running;
    bool resources_allocated;
    bool timer_active;
    bool frame_in_progress;
    bool invert_data_bits;
    uint8_t tx_pin;
    uint8_t trigger_pin;
    uint8_t start_code;
    uint8_t requested_ctrl_sm;
    uint8_t requested_data_sm;
    uint8_t active_ctrl_sm;
    uint8_t active_data_sm;
    uint16_t channels;
    uint16_t refresh_rate;
    PIO pio;
    uint pio_index;
    uint ctrl_sm_local;
    uint data_sm_local;
    int ctrl_offset;
    int data_offset;
    int dma_channel;
    dma_channel_config dma_cfg;
    repeating_timer_t timer;
    critical_section_t lock;
    uint32_t frame_time_us;
    uint32_t frame_period_us;
    int64_t timer_period_us;
    absolute_time_t next_frame_time;
    absolute_time_t frame_deadline;
    uint32_t frame_count;
    uint32_t skipped_callbacks;
    uint32_t prime_timeouts;
    uint32_t frame_timeouts;
    uint32_t auto_resyncs;
    uint32_t data_version;
    uint32_t last_sent_version;
    uint8_t frame[DMX_ENGINE_FRAME_SLOTS];
    uint8_t tx_frame[DMX_ENGINE_FRAME_SLOTS];
    uint8_t dirty_mask[DMX_ENGINE_FRAME_SLOTS];
    uint16_t dirty_first;
    int16_t dirty_last;
} dmx_engine_state_t;

static dmx_engine_state_t dmx_state = {
    .initialized = false,
    .running = false,
    .resources_allocated = false,
    .timer_active = false,
    .frame_in_progress = false,
    .invert_data_bits = true,
    .tx_pin = 2,
    .trigger_pin = 3,
    .start_code = 0,
    .requested_ctrl_sm = 8,
    .requested_data_sm = 9,
    .active_ctrl_sm = 8,
    .active_data_sm = 9,
    .channels = DMX_ENGINE_MAX_CHANNELS,
    .refresh_rate = 43,
    .pio = NULL,
    .pio_index = 0,
    .ctrl_sm_local = 0,
    .data_sm_local = 1,
    .ctrl_offset = -1,
    .data_offset = -1,
    .dma_channel = -1,
    .frame_time_us = DMX_BREAK_US + DMX_MAB_US + (DMX_ENGINE_FRAME_SLOTS * DMX_SLOT_US),
    .frame_period_us = 22676,
    .timer_period_us = -22676,
    .frame_count = 0,
    .skipped_callbacks = 0,
    .prime_timeouts = 0,
    .frame_timeouts = 0,
    .auto_resyncs = 0,
    .data_version = 0,
    .last_sent_version = 0,
    .dirty_first = DMX_ENGINE_FRAME_SLOTS,
    .dirty_last = -1,
};

/* Scene base buffer — written by scenes/chaser/direct browser writes.
 * Motion FX reads from this instead of a fixed stored center so effects
 * are always relative to the current live position.  Indices 1-512. */
static uint8_t dmx_base_frame[DMX_ENGINE_FRAME_SLOTS];

static inline uint8_t encode_value(uint8_t value)
{
    return dmx_state.invert_data_bits ? (uint8_t)(value ^ 0xffu) : value;
}

static void mark_dirty(uint16_t idx)
{
    dmx_state.dirty_mask[idx] = 1;
    if (idx < dmx_state.dirty_first) {
        dmx_state.dirty_first = idx;
    }
    if ((int16_t)idx > dmx_state.dirty_last) {
        dmx_state.dirty_last = (int16_t)idx;
    }
}

static void apply_dirty_locked(void)
{
    if (dmx_state.dirty_last < (int16_t)dmx_state.dirty_first) {
        return;
    }

    for (uint16_t idx = dmx_state.dirty_first; idx <= (uint16_t)dmx_state.dirty_last; ++idx) {
        if (dmx_state.dirty_mask[idx]) {
            dmx_state.tx_frame[idx] = dmx_state.frame[idx];
            dmx_state.dirty_mask[idx] = 0;
        }
    }
    dmx_state.dirty_first = DMX_ENGINE_FRAME_SLOTS;
    dmx_state.dirty_last = -1;
}

static bool resolve_pair(uint8_t ctrl_sm, uint8_t data_sm, PIO *pio_out, uint *ctrl_local_out, uint *data_local_out, uint *pio_index_out)
{
    if ((ctrl_sm / 4u) != (data_sm / 4u)) {
        return false;
    }

    uint block = ctrl_sm / 4u;
    if (block >= NUM_PIOS) {
        return false;
    }

    static PIO pio_instances[] = {
        pio0,
        pio1,
#if NUM_PIOS > 2
        pio2,
#endif
    };

    *pio_out = pio_instances[block];
    *ctrl_local_out = ctrl_sm & 0x3u;
    *data_local_out = data_sm & 0x3u;
    *pio_index_out = block;
    return true;
}

static void force_frame_start_irq(void)
{
    dmx_state.pio->irq_force = 1u << IRQ_FRAME_START;
}

static void clear_pio_irqs(void)
{
    for (uint i = 0; i < 8; ++i) {
        pio_interrupt_clear(dmx_state.pio, i);
    }
}

static bool wait_dma_fifo_prime(uint32_t timeout_us)
{
    absolute_time_t deadline = make_timeout_time_us(timeout_us);
    while (!time_reached(deadline)) {
        if (pio_sm_get_tx_fifo_level(dmx_state.pio, dmx_state.data_sm_local) > 0) {
            return true;
        }
        tight_loop_contents();
    }
    return false;
}

static void stop_hw(void)
{
    if (dmx_state.timer_active) {
        cancel_repeating_timer(&dmx_state.timer);
        dmx_state.timer_active = false;
    }
    if (dmx_state.dma_channel >= 0) {
        dma_channel_abort((uint)dmx_state.dma_channel);
    }
    if (dmx_state.resources_allocated) {
        pio_sm_set_enabled(dmx_state.pio, dmx_state.ctrl_sm_local, false);
        pio_sm_set_enabled(dmx_state.pio, dmx_state.data_sm_local, false);
        clear_pio_irqs();
    }
    gpio_init(dmx_state.tx_pin);
    gpio_set_dir(dmx_state.tx_pin, GPIO_OUT);
    gpio_put(dmx_state.tx_pin, 1);
    dmx_state.frame_in_progress = false;
}

static void release_resources(void)
{
    stop_hw();
    if (dmx_state.resources_allocated) {
        if (dmx_state.data_offset >= 0) {
            pio_remove_program(dmx_state.pio, &sm_dmx_data_program, (uint)dmx_state.data_offset);
        }
        if (dmx_state.ctrl_offset >= 0) {
            pio_remove_program(dmx_state.pio, &sm_dmx_control_program, (uint)dmx_state.ctrl_offset);
        }
        pio_sm_unclaim(dmx_state.pio, dmx_state.ctrl_sm_local);
        pio_sm_unclaim(dmx_state.pio, dmx_state.data_sm_local);
    }
    if (dmx_state.dma_channel >= 0) {
        dma_channel_unclaim((uint)dmx_state.dma_channel);
    }
    dmx_state.resources_allocated = false;
    dmx_state.ctrl_offset = -1;
    dmx_state.data_offset = -1;
    dmx_state.dma_channel = -1;
    dmx_state.pio = NULL;
}

static bool try_allocate_pair(uint8_t ctrl_sm, uint8_t data_sm)
{
    PIO pio = NULL;
    uint ctrl_local = 0;
    uint data_local = 0;
    uint pio_index = 0;

    if (!resolve_pair(ctrl_sm, data_sm, &pio, &ctrl_local, &data_local, &pio_index)) {
        return false;
    }
    if (pio_sm_is_claimed(pio, ctrl_local) || pio_sm_is_claimed(pio, data_local)) {
        return false;
    }
    if (!pio_can_add_program(pio, &sm_dmx_control_program)) {
        return false;
    }

    int ctrl_offset = pio_add_program(pio, &sm_dmx_control_program);
    if (!pio_can_add_program(pio, &sm_dmx_data_program)) {
        pio_remove_program(pio, &sm_dmx_control_program, (uint)ctrl_offset);
        return false;
    }

    int data_offset = pio_add_program(pio, &sm_dmx_data_program);
    pio_claim_sm_mask(pio, (1u << ctrl_local) | (1u << data_local));

    dmx_state.pio = pio;
    dmx_state.pio_index = pio_index;
    dmx_state.ctrl_sm_local = ctrl_local;
    dmx_state.data_sm_local = data_local;
    dmx_state.ctrl_offset = ctrl_offset;
    dmx_state.data_offset = data_offset;
    dmx_state.active_ctrl_sm = ctrl_sm;
    dmx_state.active_data_sm = data_sm;
    dmx_state.dma_channel = dma_claim_unused_channel(false);
    if (dmx_state.dma_channel < 0) {
        pio_remove_program(pio, &sm_dmx_data_program, (uint)data_offset);
        pio_remove_program(pio, &sm_dmx_control_program, (uint)ctrl_offset);
        pio_sm_unclaim(pio, ctrl_local);
        pio_sm_unclaim(pio, data_local);
        return false;
    }

    dmx_state.resources_allocated = true;
    dmx_state.dma_cfg = dma_channel_get_default_config((uint)dmx_state.dma_channel);
    channel_config_set_transfer_data_size(&dmx_state.dma_cfg, DMA_SIZE_8);
    channel_config_set_read_increment(&dmx_state.dma_cfg, true);
    channel_config_set_write_increment(&dmx_state.dma_cfg, false);
    channel_config_set_dreq(&dmx_state.dma_cfg, pio_get_dreq(dmx_state.pio, dmx_state.data_sm_local, true));
    return true;
}

static bool allocate_resources(void)
{
    release_resources();

    sm_pair_t ordered[1 + (sizeof(fallback_sm_pairs) / sizeof(fallback_sm_pairs[0]))];
    size_t ordered_count = 0;
    ordered[ordered_count++] = {dmx_state.requested_ctrl_sm, dmx_state.requested_data_sm};

    for (size_t i = 0; i < sizeof(fallback_sm_pairs) / sizeof(fallback_sm_pairs[0]); ++i) {
        if (fallback_sm_pairs[i].ctrl == ordered[0].ctrl && fallback_sm_pairs[i].data == ordered[0].data) {
            continue;
        }
        ordered[ordered_count++] = fallback_sm_pairs[i];
    }

    for (size_t i = 0; i < ordered_count; ++i) {
        if (try_allocate_pair(ordered[i].ctrl, ordered[i].data)) {
            return true;
        }
    }
    return false;
}

static void configure_sms(void)
{
    gpio_init(dmx_state.tx_pin);
    gpio_set_dir(dmx_state.tx_pin, GPIO_OUT);
    gpio_put(dmx_state.tx_pin, 1);
    gpio_init(dmx_state.trigger_pin);
    gpio_set_dir(dmx_state.trigger_pin, GPIO_OUT);
    gpio_put(dmx_state.trigger_pin, 0);

    pio_gpio_init(dmx_state.pio, dmx_state.tx_pin);
    pio_gpio_init(dmx_state.pio, dmx_state.trigger_pin);
    pio_sm_set_consecutive_pindirs(dmx_state.pio, dmx_state.ctrl_sm_local, dmx_state.tx_pin, 1, true);
    pio_sm_set_consecutive_pindirs(dmx_state.pio, dmx_state.ctrl_sm_local, dmx_state.trigger_pin, 1, true);
    pio_sm_set_consecutive_pindirs(dmx_state.pio, dmx_state.data_sm_local, dmx_state.tx_pin, 1, true);

    pio_sm_config ctrl_cfg = sm_dmx_control_program_get_default_config((uint)dmx_state.ctrl_offset);
    sm_config_set_clkdiv(&ctrl_cfg, (float)clock_get_hz(clk_sys) / (float)SM_CTRL_CLOCK_HZ);
    sm_config_set_set_pins(&ctrl_cfg, dmx_state.tx_pin, 1);
    sm_config_set_sideset_pins(&ctrl_cfg, dmx_state.trigger_pin);

    pio_sm_config data_cfg = sm_dmx_data_program_get_default_config((uint)dmx_state.data_offset);
    sm_config_set_clkdiv(&data_cfg, (float)clock_get_hz(clk_sys) / (float)SM_DATA_CLOCK_HZ);
    sm_config_set_set_pins(&data_cfg, dmx_state.tx_pin, 1);
    sm_config_set_out_pins(&data_cfg, dmx_state.tx_pin, 1);
    sm_config_set_sideset_pins(&data_cfg, dmx_state.tx_pin);
    sm_config_set_out_shift(&data_cfg, true, true, 8);
    sm_config_set_fifo_join(&data_cfg, PIO_FIFO_JOIN_TX);

    pio_sm_init(dmx_state.pio, dmx_state.ctrl_sm_local, (uint)dmx_state.ctrl_offset, &ctrl_cfg);
    pio_sm_init(dmx_state.pio, dmx_state.data_sm_local, (uint)dmx_state.data_offset, &data_cfg);
    pio_sm_clear_fifos(dmx_state.pio, dmx_state.ctrl_sm_local);
    pio_sm_clear_fifos(dmx_state.pio, dmx_state.data_sm_local);
    clear_pio_irqs();
}

static void resync(void)
{
    dmx_state.auto_resyncs += 1;
    dma_channel_abort((uint)dmx_state.dma_channel);
    configure_sms();
    pio_sm_set_enabled(dmx_state.pio, dmx_state.data_sm_local, true);
    pio_sm_set_enabled(dmx_state.pio, dmx_state.ctrl_sm_local, true);
    sleep_us(200);
    pio_sm_put_blocking(dmx_state.pio, dmx_state.ctrl_sm_local, dmx_state.channels);
    force_frame_start_irq();
    dmx_state.frame_in_progress = false;
}

static bool update_frame(void)
{
    if (dmx_state.frame_in_progress) {
        if (pio_interrupt_get(dmx_state.pio, IRQ_FRAME_DONE)) {
            pio_interrupt_clear(dmx_state.pio, IRQ_FRAME_DONE);
            dmx_state.frame_in_progress = false;
            dmx_state.last_sent_version = dmx_state.data_version;
        } else if (time_reached(dmx_state.frame_deadline)) {
            dmx_state.frame_timeouts += 1;
            dmx_state.frame_in_progress = false;
            resync();
        } else {
            dmx_state.skipped_callbacks += 1;
            return true;
        }
    }

    critical_section_enter_blocking(&dmx_state.lock);
    apply_dirty_locked();
    critical_section_exit(&dmx_state.lock);

    dma_channel_abort((uint)dmx_state.dma_channel);
    dma_channel_configure(
        (uint)dmx_state.dma_channel,
        &dmx_state.dma_cfg,
        &dmx_state.pio->txf[dmx_state.data_sm_local],
        dmx_state.tx_frame,
        dmx_state.channels + 1,
        true);

    if (!wait_dma_fifo_prime(DMA_PRIME_TIMEOUT_US)) {
        dmx_state.prime_timeouts += 1;
        dma_channel_abort((uint)dmx_state.dma_channel);
        resync();
        return true;
    }

    pio_interrupt_clear(dmx_state.pio, IRQ_FRAME_DONE);
    force_frame_start_irq();
    dmx_state.frame_in_progress = true;
    dmx_state.frame_deadline = make_timeout_time_us(dmx_state.frame_time_us + 3000u);
    dmx_state.frame_count += 1;
    return true;
}

void dmx_engine_default_config(dmx_engine_config_t *config)
{
    config->tx_pin = 2;
    config->trigger_pin = 3;
    config->channels = DMX_ENGINE_MAX_CHANNELS;
    config->refresh_rate = 40;
    config->start_code = 0;
    config->sm_ctrl_id = 8;
    config->sm_data_id = 9;
    config->invert_data_bits = true;
}

bool dmx_engine_init(const dmx_engine_config_t *config)
{
    if (!config || config->channels < 1 || config->channels > DMX_ENGINE_MAX_CHANNELS || config->refresh_rate < 1) {
        return false;
    }

    if (!dmx_state.initialized) {
        critical_section_init(&dmx_state.lock);
    }

    release_resources();

    dmx_state.tx_pin = config->tx_pin;
    dmx_state.trigger_pin = config->trigger_pin;
    dmx_state.channels = config->channels;
    dmx_state.refresh_rate = config->refresh_rate;
    dmx_state.start_code = config->start_code;
    dmx_state.requested_ctrl_sm = config->sm_ctrl_id;
    dmx_state.requested_data_sm = config->sm_data_id;
    dmx_state.invert_data_bits = config->invert_data_bits;
    dmx_state.frame_time_us = DMX_BREAK_US + DMX_MAB_US + ((uint32_t)(dmx_state.channels + 1u) * DMX_SLOT_US);

    int64_t requested_period_us = 1000000ll / (int64_t)dmx_state.refresh_rate;
    int64_t min_period_us = (int64_t)dmx_state.frame_time_us;
    dmx_state.frame_period_us = (uint32_t)(requested_period_us > min_period_us ? requested_period_us : min_period_us);
    dmx_state.timer_period_us = -(int64_t)dmx_state.frame_period_us;

    memset(dmx_state.frame, 0, sizeof(dmx_state.frame));
    memset(dmx_state.tx_frame, 0, sizeof(dmx_state.tx_frame));
    memset(dmx_state.dirty_mask, 0, sizeof(dmx_state.dirty_mask));
    dmx_state.frame[0] = dmx_state.start_code;
    dmx_state.tx_frame[0] = dmx_state.start_code;
    for (uint16_t i = 1; i <= dmx_state.channels; ++i) {
        dmx_state.frame[i] = encode_value(0);
        dmx_state.tx_frame[i] = encode_value(0);
    }

    dmx_state.dirty_first = DMX_ENGINE_FRAME_SLOTS;
    dmx_state.dirty_last = -1;
    dmx_state.initialized = true;
    dmx_state.running = false;
    dmx_state.frame_in_progress = false;
    dmx_state.frame_count = 0;
    dmx_state.skipped_callbacks = 0;
    dmx_state.prime_timeouts = 0;
    dmx_state.frame_timeouts = 0;
    dmx_state.auto_resyncs = 0;
    dmx_state.data_version = 0;
    dmx_state.last_sent_version = 0;
    dmx_state.next_frame_time = nil_time;

    if (!allocate_resources()) {
        dmx_state.initialized = false;
        return false;
    }

    configure_sms();
    return true;
}

bool dmx_engine_start(void)
{
    if (!dmx_state.initialized) {
        return false;
    }
    if (!dmx_state.resources_allocated && !allocate_resources()) {
        return false;
    }

    configure_sms();
    if (dmx_state.running) {
        return true;
    }

    dmx_state.frame_in_progress = false;
    clear_pio_irqs();
    pio_sm_set_enabled(dmx_state.pio, dmx_state.data_sm_local, true);
    pio_sm_set_enabled(dmx_state.pio, dmx_state.ctrl_sm_local, true);
    sleep_ms(1);
    pio_sm_put_blocking(dmx_state.pio, dmx_state.ctrl_sm_local, dmx_state.channels);

    dmx_state.running = true;
    if (!update_frame()) {
        dmx_state.running = false;
        return false;
    }
    dmx_state.next_frame_time = make_timeout_time_us(dmx_state.frame_period_us);
    return true;
}

void dmx_engine_poll(void)
{
    if (!dmx_state.running || !time_reached(dmx_state.next_frame_time)) {
        return;
    }

    update_frame();
    dmx_state.next_frame_time = make_timeout_time_us(dmx_state.frame_period_us);
}

void dmx_engine_stop(void)
{
    dmx_state.running = false;
    stop_hw();
}

bool dmx_engine_set_channel(uint16_t channel, uint8_t value)
{
    if (!dmx_state.initialized || channel < 1 || channel > dmx_state.channels) {
        return false;
    }

    uint8_t encoded = encode_value(value);
    critical_section_enter_blocking(&dmx_state.lock);
    if (dmx_state.frame[channel] != encoded) {
        dmx_state.frame[channel] = encoded;
        mark_dirty(channel);
        dmx_state.data_version += 1;
    }
    critical_section_exit(&dmx_state.lock);
    return true;
}

uint16_t dmx_engine_set_channels(const uint8_t *values, uint16_t count)
{
    if (!dmx_state.initialized || !values) {
        return 0;
    }
    if (count > dmx_state.channels) {
        count = dmx_state.channels;
    }

    bool changed = false;
    critical_section_enter_blocking(&dmx_state.lock);
    for (uint16_t i = 0; i < count; ++i) {
        uint16_t idx = (uint16_t)(i + 1u);
        uint8_t encoded = encode_value(values[i]);
        if (dmx_state.frame[idx] != encoded) {
            dmx_state.frame[idx] = encoded;
            mark_dirty(idx);
            changed = true;
        }
    }
    if (changed) {
        dmx_state.data_version += 1;
    }
    critical_section_exit(&dmx_state.lock);
    return count;
}

uint8_t dmx_engine_get_output_channel(uint16_t channel)
{
    if (!dmx_state.initialized || channel < 1 || channel > dmx_state.channels) {
        return 0;
    }

    critical_section_enter_blocking(&dmx_state.lock);
    uint8_t value = encode_value(dmx_state.frame[channel]);
    critical_section_exit(&dmx_state.lock);
    return value;
}

bool dmx_engine_set_base_channel(uint16_t channel, uint8_t value)
{
    if (channel < 1 || channel > DMX_ENGINE_MAX_CHANNELS) return false;
    dmx_base_frame[channel] = value;
    return true;
}

uint8_t dmx_engine_get_base_channel(uint16_t channel)
{
    if (channel < 1 || channel > DMX_ENGINE_MAX_CHANNELS) return 0;
    return dmx_base_frame[channel];
}

void dmx_engine_clear_output(void)
{
    if (!dmx_state.initialized) {
        return;
    }

    critical_section_enter_blocking(&dmx_state.lock);
    memset(dmx_state.frame, encode_value(0), sizeof(dmx_state.frame));
    dmx_state.frame[0] = dmx_state.start_code;
    memset(dmx_state.dirty_mask, 1, dmx_state.channels + 1u);
    dmx_state.dirty_first = 0;
    dmx_state.dirty_last = dmx_state.channels;
    dmx_state.data_version += 1;
    critical_section_exit(&dmx_state.lock);
}

void dmx_engine_clear(void)
{
    dmx_engine_clear_output();
    /* Also clear the scene base buffer. */
    memset(dmx_base_frame, 0, sizeof(dmx_base_frame));
}

void dmx_engine_get_status(dmx_engine_status_t *status)
{
    if (!status) {
        return;
    }

    uint32_t irq_state = save_and_disable_interrupts();
    status->initialized = dmx_state.initialized;
    status->running = dmx_state.running;
    status->tx_pin = dmx_state.tx_pin;
    status->trigger_pin = dmx_state.trigger_pin;
    status->channels = dmx_state.channels;
    status->refresh_rate = dmx_state.refresh_rate;
    status->active_ctrl_sm = dmx_state.active_ctrl_sm;
    status->active_data_sm = dmx_state.active_data_sm;
    status->pio_block = (uint8_t)dmx_state.pio_index;
    status->frame_count = dmx_state.frame_count;
    status->skipped_callbacks = dmx_state.skipped_callbacks;
    status->prime_timeouts = dmx_state.prime_timeouts;
    status->frame_timeouts = dmx_state.frame_timeouts;
    status->auto_resyncs = dmx_state.auto_resyncs;
    restore_interrupts(irq_state);
}
