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
Getting started needs to be written for a user 
1.  installing all dependencies to runn the software
2.  how to download an install the firmware

Getting starded for a developper 
1.  installing dependencis to build firmware / vs code and the needed extentions, testing envirnoment needed and how to install e.g  on windows 

I think there should be more but can you shortly check 



# Debug



## 01



# Error fixing


