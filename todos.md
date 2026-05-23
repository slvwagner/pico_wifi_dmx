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
In the toolbox Groups button group edit it uses the sorce values form the fixture but it does not apply it to all the controlls editable automatically. I think that is so fare ok but I would need a button per controll to apply the source values to the controlls for all the fixtures. I think it is best to do seperatly for each controll. And may add another button all on the very left side of the modall to do it for all controlls.

## 03
In the chaser page tool boxes chase chase steps I want you to stop the play back as sone as a step gets selected or if any control button will be used in the edit step card. Would that be feasible without breaking otherthings?

# Debug



## 02
So you are always using the manual-data to create screen shots automated?


# Error fixing


