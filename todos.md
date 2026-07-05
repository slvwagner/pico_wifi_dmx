# New Features

## 01
- Show Run page: make this the next active work area for real show operation.
  Add an operator-focused MIDI/control layer to Show Run first, before spreading MIDI concepts to setup pages.
  The page should be able to show connected/available control inputs, show last received hardware event, and provide clear feedback when an external controller triggers a tile or playback command.
  Keep Show Run read-mostly: it may trigger scenes, palettes, groups, chaser slots, effect slots, blackout, stop-all, and target selection, but it should not edit fixture profiles, saved scenes, palettes, chases, or effects.
  Add tests before changing tile/playback behavior so Show Run remains safe for live use.

## 02
- MIDI mapping workflow for Show Run.
  After the Pico MIDI input wiring is verified through `/midi/status.json`, define how MIDI events are mapped to Show Run actions.
  Start with Note On / Control Change mappings for:
  - scene tile trigger
  - palette tile trigger
  - group/target tile select or toggle
  - chaser slot play/pause/stop or toggle
  - effect slot start/stop or toggle
  - Stop All Playback
  - Blackout Target
  - Show All Fixtures
  Add a MIDI learn mode so the user does not need to type channel/CC/note numbers manually.
  Store mappings in the complete setup export/import so a show backup includes the external controller layout.

## 03
- Pico MIDI action execution.
  Decide whether MIDI actions should be handled only by Show Run in the browser, directly by the Pico firmware, or both.
  Browser/Show Run mapping is easier to configure and can target saved server data.
  Pico-side mapping is better for standalone playback but needs a compact mapping protocol, volatile/persistent config decisions, and endpoints similar to GPIO.
  Likely path: first Show Run mapping, then add optional Pico-side mappings for critical standalone actions such as chaser/effect slot toggle, stop all, tap tempo, and blackout.

## 04
- MIDI value behavior.
  Define mapping modes for hardware controls:
  - trigger on press
  - momentary while held
  - toggle
  - absolute fader/knob value
  - relative encoder/nudge
  - soft takeover / pickup to avoid jumps when a physical fader does not match the current software value
  For 16-bit fixture controls, define how MIDI 7-bit or 14-bit data maps to coarse/fine values.

## 05
- Define a shared "Output enabled" / offline programming model for live-show safety.
  Editing should be possible without changing DMX output, especially for Controller, Chaser, and Motion FX.
  Uploading chase or motion data to Pico memory slots should still be allowed while offline because it is only data transfer.
  Actual output actions should require output to be enabled: Controller live changes, scene/palette recall, Chaser browser playback, Chaser Prev/Next, Chaser Pico Play/Stop/Pause commands, Motion browser playback, Motion scene-center recalls, Motion Pico Play/Stop commands, and GPIO-triggered output actions.
  Pico slots that are already running autonomously are not automatically stopped by disabling browser output; that needs a separate explicit stop command.

Do we want “offline programming” to be a global system mode, or page-specific per tool?

Global is simpler and safer. Page-specific is more flexible, but easier to misunderstand during a show.

## 06
- MIDI diagnostics UI.
  Add a small page or Show Run/Performance panel that reads `/midi/status.json` from the Pico and shows:
  enabled/initialized state, UART/pin/baud, byte/message counters, parse errors, and the last decoded message.
  This should help verify wiring before any action mapping is enabled.

## 07
- Documentation and release checklist for MIDI.
  Once mappings are implemented, update README, user manual, screenshots, changelog, and hardware wiring notes.
  Keep the warning that DIN/TRS MIDI must go through a receiver/opto-isolation circuit before GPIO5.

# Bugs

## 01




