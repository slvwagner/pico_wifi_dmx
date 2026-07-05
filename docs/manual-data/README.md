# Manual Data Baseline

This folder contains a deterministic snapshot of the JSON data used for manual screenshots.

`scripts/update_user_manual.ps1 -LocalOnly` copies these files into the repo-local `api/data` folder, starts the repo-local PHP dev router, captures screenshots, and rebuilds the manual without using a machine-specific XAMPP URL. Running the script without `-LocalOnly` also syncs the rebuilt manual to the configured XAMPP folder after the local screenshots have been created.

Source at capture time on the development machine:

`E:\Software\xampp\htdocs\dmx\data`

That path is only an example of the machine that created this baseline. The screenshot pipeline reads these committed JSON files directly, so another machine can regenerate the same screenshots without sharing that XAMPP path.

Included files:

- `fixture_setup.json` - fixture profiles, patched fixtures, and Pico base URL
- `fixture_live_values.json` - controller live values used for capture/recall examples
- `group_setup.json` - saved fixture groups
- `scene_setup.json` - saved scenes and scene toolbox layout
- `palette_setup.json` - saved palettes and palette visuals
- `chaser_setup.json` - saved chases, chaser toolbox layout, and mirrored Pico slot payloads
- `motion_setup.json` - saved Motion FX setup
- `ui_state.json` - shared UI state such as toolbox order, width, and collapse state

When the documentation needs a new stable visual example, update a test or local show setup first, then refresh this baseline intentionally.
