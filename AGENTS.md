# Agent Safety Rules

These instructions are mandatory for every automated or AI agent working in this repository.

## Environment ownership

- `http://localhost/dmx/` and `E:\Software\xampp\htdocs\dmx` are the user's working environment and contain user-owned show data.
- `http://localhost/dmx-test/` and `E:\Software\xampp\htdocs\dmx-test` are the automation playground.
- Never infer safety from the hostname. `localhost/dmx/` is the same protected environment as `localhost/dmx/` when served by this XAMPP installation.

## Prohibited actions

- Never run Playwright, browser automation, `npm`/`npx` tests, screenshot capture, manual generation, or test diagnostics against `/dmx/`.
- Never set `DMX_TEST_BASE_URL`, Playwright `baseURL`, or test path configuration to `/dmx/`.
- Never directly copy, edit, delete, or replace files under `E:\Software\xampp\htdocs\dmx`.
- Never write or restore live `data/*.json` without explicit user authorization for the exact files involved.

Browser tests are destructive by design: they can save mock groups, palettes, chases, tile layouts, and UI state through real PHP endpoints. A narrowly filtered test is not safe on `/dmx/`.

## Required workflow

### VS Code diagnostics

1. Before completing any change, review the VS Code **Problems** diagnostics for the workspace, with particular attention to every modified file.
2. Investigate and fix all errors and warnings introduced by the change. Do not silently ignore diagnostics on modified lines.
3. If VS Code diagnostics are not directly available, run the equivalent repository command-line checks (for example the compiler, formatter, linter, or markdownlint) for the modified files.
4. Report any remaining diagnostic that cannot be fixed safely, including whether it was pre-existing and why it remains.

### Bug fix

1. For a bug fix, first add a regression test and confirm that it fails in the isolated environment.
2. Use `/dmx-test/` or the repository-local PHP development server for every automated test.
3. Before browser automation, inspect the resolved base URL and stop if its path is `/dmx/`.
4. Synchronize the automation playground with `scripts/update_xampp_server.ps1 -AppFolder dmx-test -BaseUrl http://localhost//dmx-test/`.
5. Deploy user-facing source changes only with `scripts/update_xampp_server.ps1 -AppFolder dmx -BaseUrl http://localhost/dmx/`.
6. Verify the user's environment only through manual browser use or read-only HTTP GET requests. Never use a test suite as deployment verification.
7. Generate documentation and screenshots with `scripts/update_user_manual.ps1 -LocalOnly` and deterministic repository data, or another explicitly isolated playground.
8. Run hardware tests only for firmware changes or when explicitly requested by the user.
9. Ask the user to confirm the next commit
10. Create a commit and changelog entry for each feature

### New feature

1. Implement the feature.
2. Synchronize the automation playground with `scripts/update_xampp_server.ps1 -AppFolder dmx-test -BaseUrl http://localhost//dmx-test/`.
3. Deploy user-facing source changes only with `scripts/update_xampp_server.ps1 -AppFolder dmx -BaseUrl http://localhost/dmx/`.
4. Only create manuals and screenshots if the user asks for them.
5. Ask the user to confirm the next commit.
6. Create a commit and changelog entry for each feature.

## Release

1. Document everything.
2. Run the release scripts for the current platform.
3. Create a GitHub Release with the installer.

Before an authorized data recovery, make a recoverable snapshot and restore only the approved files. Deployment authorization does not imply authorization to modify user data.
