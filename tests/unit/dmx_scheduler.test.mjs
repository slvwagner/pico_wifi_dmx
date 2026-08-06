import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("firmware/dmx_engine.cpp", "utf8");
const pioSource = readFileSync("firmware/dmx_native.pio", "utf8");
const chaserSource = readFileSync("firmware/pico_chaser.cpp", "utf8");
const motionSource = readFileSync("firmware/pico_motion.cpp", "utf8");

function functionBody(name) {
  const signature = source.indexOf(`${name}(`);
  assert.notEqual(signature, -1, `missing ${name}()`);

  const openingBrace = source.indexOf("{", signature);
  assert.notEqual(openingBrace, -1, `missing body for ${name}()`);

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openingBrace + 1, index);
    }
  }

  assert.fail(`unterminated body for ${name}()`);
}

test("DMX polling services frame completion without owning the next deadline", () => {
  const poll = functionBody("dmx_engine_poll");

  const completionCheck = poll.indexOf("service_frame_completion()");

  assert.notEqual(
    completionCheck,
    -1,
    "dmx_engine_poll() must service an active frame on every poll",
  );
  assert.doesNotMatch(
    poll,
    /time_reached\s*\(\s*dmx_state\.next_frame_time|start_frame\s*\(/,
    "foreground work must not control the next frame-start deadline",
  );
});

test("DMX recovery primes DMA before raising the frame-start IRQ", () => {
  const resync = functionBody("resync");
  const startFrame = functionBody("start_frame");

  assert.doesNotMatch(
    resync,
    /force_frame_start_irq\s*\(/,
    "resync must leave the control state machine waiting until DMA is ready",
  );

  const dmaPrime = startFrame.indexOf("wait_dma_fifo_prime");
  const frameStart = startFrame.indexOf("force_frame_start_irq()");
  assert.notEqual(dmaPrime, -1, "start_frame() must wait for DMA data");
  assert.notEqual(frameStart, -1, "start_frame() must trigger the control state machine");
  assert.ok(dmaPrime < frameStart, "DMA must be primed before the PIO frame starts");
});

test("DMX control startup consumes exactly one frame-start IRQ", () => {
  const controlProgram = pioSource.slice(
    pioSource.indexOf(".program sm_dmx_control"),
    pioSource.indexOf(".program sm_dmx_data"),
  );
  const preamble = controlProgram.slice(0, controlProgram.indexOf(".wrap_target"));

  assert.doesNotMatch(
    preamble,
    /wait\s+1\s+irq\s+0/,
    "the blocking channel-count pull is sufficient; an earlier wait consumes the only start IRQ",
  );
  assert.match(preamble, /pull\s+block\s*\r?\n\s*mov\s+y,\s*osr/);
  assert.match(
    controlProgram,
    /\.wrap_target\s*\r?\n\s*wait\s+1\s+irq\s+0/,
    "each transmitted frame must consume one start IRQ at the wrap target",
  );
});

test("DMX frame deadlines are serviced by a lock-free timer callback", () => {
  const start = functionBody("dmx_engine_start");
  const poll = functionBody("dmx_engine_poll");
  const timer = functionBody("dmx_frame_timer_callback");

  assert.match(
    start,
    /add_repeating_timer_us\s*\(/,
    "frame timing must run from a hardware alarm instead of depending on foreground polling",
  );
  assert.match(
    timer,
    /start_frame\s*\(\s*false\s*\)/,
    "the timer callback must be able to start the prepared frame without taking the data lock",
  );
  assert.doesNotMatch(
    timer,
    /critical_section_enter|apply_dirty_locked/,
    "the timer callback must not deadlock by acquiring a lock held by interrupted foreground code",
  );
  assert.doesNotMatch(
    poll,
    /start_frame\s*\(/,
    "foreground polling must not own the frame-start deadline",
  );
  assert.match(
    source,
    /mutex_t\s+lock\s*;/,
    "cross-core DMX data contention must leave Core0 timer interrupts enabled",
  );
  assert.doesNotMatch(
    source,
    /critical_section_t\s+lock\s*;/,
    "the DMX data lock must not disable Core0 interrupts while waiting on Core1",
  );
});

test("a late timer callback cannot compress or discard the following frame", () => {
  const timer = functionBody("dmx_frame_timer_callback");

  assert.match(
    timer,
    /timer->delay_us\s*=\s*DMX_FRAME_RETRY_US/,
    "an unfinished PIO frame must receive a short retry instead of losing a complete period",
  );
  assert.match(
    timer,
    /timer->delay_us\s*=\s*dmx_state\.timer_period_us/,
    "a successful start must restore the normal frame delay",
  );
  assert.doesNotMatch(
    source,
    /timer_period_us\s*=\s*-\s*\(int64_t\)dmx_state\.frame_period_us/,
    "the next deadline must be relative to the completed callback, not an absolute catch-up phase",
  );
});

test("playback processing leaves the Core0 DMX timer interrupt enabled", () => {
  for (const [label, playbackSource] of [
    ["chaser", chaserSource],
    ["motion", motionSource],
  ]) {
    assert.match(
      playbackSource,
      /mutex_t\s+\w+_lock\s*;/,
      `${label} state must use a cross-core mutex`,
    );
    assert.doesNotMatch(
      playbackSource,
      /critical_section_(?:init|enter_blocking|exit)\s*\(/,
      `${label} work must not mask the Core0 DMX frame-start interrupt`,
    );
  }
});
