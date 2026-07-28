import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptSource = resolve("scripts/start_version_branch.ps1");

function write(root, relativePath, content) {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

function run(root, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
  );
  return result.stdout.trim();
}

test("starting a committed version branch updates main development metadata", () => {
  const root = mkdtempSync(join(tmpdir(), "pico-dmx-version-"));

  try {
    write(root, "VERSION", "0.9.16\n");
    write(root, "CMakeLists.txt", 'set(PICO_DMX_VERSION "0.9.16")\n');
    write(root, "docs/manual-data/room_plane_setup.json", '{"appVersion":"0.9.16"}\n');
    write(root, "tests/ui/page-link-rules.spec.js", "const version = '0.9.16';\n");
    write(root, "web/assets/dmx-common.js", "const APP_VERSION = '0.9.16';\n");
    write(root, "web/index.html", '<script src="app.js?v=0.9.16"></script>\n');
    write(
      root,
      "README.md",
      [
        "- **Latest stable release:** `0.9.16`",
        "- **Current development version:** `0.9.16`",
        "",
        "Development takes place on a branch named for the next version, such as `0.9.16`.",
        "An asset suffix such as `?v=0.9.16-1` is used.",
        "The browser-cache revision within application version `0.9.16`; remains synchronized.",
        '{"appVersion": "0.9.16"}',
        "",
      ].join("\n"),
    );
    write(root, "CHANGELOG.md", "## 0.9.16 - 2026-07-28\n\nReleased.\n");
    mkdirSync(join(root, "scripts"), { recursive: true });
    cpSync(scriptSource, join(root, "scripts/start_version_branch.ps1"));

    run(root, "git", ["init", "-q"]);
    run(root, "git", ["config", "user.email", "version-test@example.invalid"]);
    run(root, "git", ["config", "user.name", "Version Test"]);
    run(root, "git", ["add", "."]);
    run(root, "git", ["commit", "-q", "-m", "release 0.9.16"]);
    run(root, "git", ["branch", "-M", "main"]);

    run(root, "pwsh.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "scripts/start_version_branch.ps1",
      "-Version",
      "0.9.17",
      "-Commit",
    ]);

    assert.equal(run(root, "git", ["branch", "--show-current"]), "0.9.17");
    const mainReadme = run(root, "git", ["show", "main:README.md"]);
    assert.match(mainReadme, /Latest stable release:\*\* `0\.9\.16`/);
    assert.match(mainReadme, /Current development version:\*\* `0\.9\.17`/);
    assert.equal(run(root, "git", ["show", "main:VERSION"]), "0.9.16");
    assert.equal(run(root, "git", ["show", "0.9.17:VERSION"]), "0.9.17");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
