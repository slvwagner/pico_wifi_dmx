# New Features

## 01
- MIDI mapping workflow for Show Run.
  The Pico MIDI input and Show Run MIDI diagnostics are in place. Next, define how decoded MIDI events are mapped to Show Run actions.
  Start with Note On / Control Change mappings for:
  - scene tile trigger
  - palette tile trigger
  - group or fixture tile select/toggle
  - saved room plane recall
  - chaser slot play/pause/stop or toggle
  - effect slot start/stop or toggle
  - Stop All Playback
  - Master card Full/Blackout actions
  Add a MIDI learn mode so the user does not need to type channel/CC/note numbers manually.
  Store mappings in the complete setup export/import so a show backup includes the external controller layout.

## 02
- Pico MIDI action execution.
  Decide whether MIDI actions should be handled only by Show Run in the browser, directly by the Pico firmware, or both.
  Browser/Show Run mapping is easier to configure and can target saved server data.
  Pico-side mapping is better for standalone playback but needs a compact mapping protocol, volatile/persistent config decisions, and endpoints similar to GPIO.
  Likely path: first Show Run mapping, then add optional Pico-side mappings for critical standalone actions such as chaser/effect slot toggle, stop all, tap tempo, and master blackout/full.

## 03
- MIDI value behavior.
  Define mapping modes for hardware controls:
  - trigger on press
  - momentary while held
  - toggle
  - absolute fader/knob value
  - relative encoder/nudge
  - soft takeover / pickup to avoid jumps when a physical fader does not match the current software value
  For 16-bit fixture controls, define how MIDI 7-bit or 14-bit data maps to coarse/fine values.

## 04
- Define a shared "Output enabled" / offline programming model for live-show safety.
  Editing should be possible without changing DMX output, especially for Controller, Chaser, and Effects.
  Uploading chase or effect data to Pico memory slots should still be allowed while offline because it is only data transfer.
  Actual output actions should require output to be enabled: Controller live changes, scene/palette/plane recall, Chaser browser playback, Chaser Prev/Next, Chaser Pico Play/Stop/Pause commands, Effects browser playback, Effects scene-center recalls, Effects Pico Play/Stop commands, Show Run tile playback, Live Controls, MIDI-triggered actions, and GPIO-triggered output actions.
  Pico slots that are already running autonomously are not automatically stopped by disabling browser output; that needs a separate explicit stop command.

Do we want "offline programming" to be a global system mode, or page-specific per tool?

Global is simpler and safer. Page-specific is more flexible, but easier to misunderstand during a show.

## 05
- Documentation and release checklist for MIDI action mapping.
  Once mappings are implemented, update README, user manual, screenshots, changelog, and hardware wiring notes.
  Keep the warning that DIN/TRS MIDI must go through a receiver/opto-isolation circuit before GPIO5.
