import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("firmware/dmx_engine.cpp", "utf8");
const pioSource = readFileSync("firmware/dmx_native.pio", "utf8");

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

test("DMX polling services a late frame-done IRQ without deferring a full period", () => {
  const poll = functionBody("dmx_engine_poll");

  const completionCheck = poll.indexOf("service_frame_completion()");
  const scheduleCheck = poll.indexOf("time_reached(dmx_state.next_frame_time)");

  assert.notEqual(
    completionCheck,
    -1,
    "dmx_engine_poll() must service an active frame on every poll",
  );
  assert.notEqual(scheduleCheck, -1, "dmx_engine_poll() must retain its frame deadline");
  assert.ok(
    completionCheck < scheduleCheck,
    "frame completion must be serviced before the next-frame deadline gate",
  );
  assert.doesNotMatch(
    poll,
    /next_frame_time\s*=\s*make_timeout_time_us/,
    "a busy frame must not move the pending deadline forward by a complete period",
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
