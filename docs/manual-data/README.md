# Manual Data Baseline

This folder contains a deterministic snapshot of the JSON data used for manual screenshots.

`scripts/build_user_manual.ps1 -LocalOnly` copies these files into the repo-local `api/data` folder, starts the repo-local PHP dev router, captures screenshots, and rebuilds the manual without using a machine-specific XAMPP URL. Running the script without `-LocalOnly` also syncs the rebuilt manual to the configured XAMPP folder after the local screenshots have been created.

The baseline was captured from a development show and then committed here. The screenshot pipeline reads these JSON files directly, so another machine can regenerate the same screenshots without knowing or sharing the original XAMPP path.

Included files:

- `fixture_setup.json` - show name, DMX Outputs, fixture profiles, patched fixtures, and Pixel Matrices
- `fixture_live_values.json` - controller live values used for capture/recall examples
- `group_setup.json` - saved fixture groups
- `scene_setup.json` - saved scenes and scene toolbox layout
- `palette_setup.json` - saved palettes and palette visuals
- `chaser_setup.json` - saved chases, chaser toolbox layout, and mirrored Pico slot payloads
- `motion_setup.json` - saved Motion FX setup
- `room_plane_setup.json` - saved room planes, calibrated fixtures, targets, and view state
- `ui_state.json` - shared UI state such as toolbox order, width, and collapse state

When the documentation needs a new stable visual example, update a test or local show setup first, then refresh this baseline intentionally.
