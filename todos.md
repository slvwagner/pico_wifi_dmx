# New Features

## 01
- Define a shared "Output enabled" / offline programming model for live-show safety.
  Editing should be possible without changing DMX output, especially for Controller, Chaser, and Motion FX.
  Uploading chase or motion data to Pico memory slots should still be allowed while offline because it is only data transfer.
  Actual output actions should require output to be enabled: Controller live changes, scene/palette recall, Chaser browser playback, Chaser Prev/Next, Chaser Pico Play/Stop/Pause commands, Motion browser playback, Motion scene-center recalls, Motion Pico Play/Stop commands, and GPIO-triggered output actions.
  Pico slots that are already running autonomously are not automatically stopped by disabling browser output; that needs a separate explicit stop command.


Do we want “offline programming” to be a global system mode, or page-specific per tool?

Global is simpler and safer. Page-specific is more flexible, but easier to misunderstand during a show.

## 02
could I move the page scroll bar to the left side of the tool box separation line?

# Debug

## 01
No document cleary every toolbox in every page with a decicated toolbox screen shot for the the one going together you could take a single shot but you must not. Whatever is more simple to maintain. Update the manuall but in a way that it can be automated cleanly. 

But before doing any manuall update 

## 02
So you are always using the manual-data to create screen shots automated?


# Error fixing


