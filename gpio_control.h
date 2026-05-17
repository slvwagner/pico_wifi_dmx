#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define GPIO_CONTROL_MAX_MAPPINGS 12
#define GPIO_CONTROL_MAX_ADC_MAPPINGS 4

typedef enum {
    GPIO_ACTION_NONE = 0,
    GPIO_ACTION_DMX_CLEAR,
    GPIO_ACTION_DMX_OUTPUT_CLEAR,
    GPIO_ACTION_STOP_ALL,
    GPIO_ACTION_CHASER_PLAY,
    GPIO_ACTION_CHASER_STOP,
    GPIO_ACTION_CHASER_TOGGLE,
    GPIO_ACTION_CHASER_PAUSE,
    GPIO_ACTION_CHASER_RESUME,
    GPIO_ACTION_CHASER_PAUSE_TOGGLE,
    GPIO_ACTION_MOTION_START,
    GPIO_ACTION_MOTION_STOP,
    GPIO_ACTION_MOTION_TOGGLE,
} gpio_action_t;

typedef enum {
    GPIO_PULL_UP = 0,
    GPIO_PULL_DOWN,
} gpio_pull_t;

typedef enum {
    GPIO_TRIGGER_FALLING = 0,
    GPIO_TRIGGER_RISING,
    GPIO_TRIGGER_BOTH,
} gpio_trigger_t;

typedef enum {
    GPIO_ADC_ACTION_NONE = 0,
    GPIO_ADC_ACTION_CHASER_SPEED,
} gpio_adc_action_t;

typedef struct {
    bool           enabled;
    uint8_t        pin;
    gpio_pull_t    pull;
    gpio_trigger_t trigger;
    gpio_action_t  action;
    uint8_t        slot;
    uint16_t       debounce_ms;
} gpio_mapping_t;

typedef struct {
    bool              enabled;
    uint8_t           pin;
    gpio_adc_action_t action;
    uint8_t           slot;
    uint16_t          min_x100;
    uint16_t          max_x100;
} gpio_adc_mapping_t;

typedef void (*gpio_control_dmx_clear_hook_t)(void);

void gpio_control_init(uint32_t reserved_pin_mask);
void gpio_control_set_dmx_clear_hook(gpio_control_dmx_clear_hook_t hook);
void gpio_control_set_dmx_output_clear_hook(gpio_control_dmx_clear_hook_t hook);
bool gpio_control_configure_text(const char *body, size_t len, char *err, size_t err_len);
void gpio_control_poll(uint32_t now_ms);
void gpio_control_write_config_json(char *out, size_t out_len);
void gpio_control_write_status_json(char *out, size_t out_len);

#ifdef __cplusplus
}
#endif
