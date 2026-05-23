# Manual Data Baseline

This folder contains a deterministic snapshot of the JSON data from the local XAMPP DMX server.

The manual screenshot scripts should use these files as their input data before capturing screenshots. That keeps the user manual reproducible even if the live XAMPP setup changes during testing.

Source at capture time:

`E:\Software\xampp\htdocs\dmx\data`

Included files:

- `fixture_setup.json` - fixture profiles, patched fixtures, and Pico base URL
- `fixture_live_values.json` - controller live values used for capture/recall examples
- `group_setup.json` - saved fixture groups
- `scene_setup.json` - saved scenes and scene toolbox layout
- `palette_setup.json` - saved palettes and palette visuals
- `chaser_setup.json` - saved chases, chaser toolbox layout, and mirrored Pico slot payloads
- `motion_setup.json` - saved Motion FX setup
- `ui_state.json` - shared UI state such as toolbox order, width, and collapse state

When the documentation needs a new stable visual example, update the live XAMPP setup first, then refresh this baseline intentionally.
