import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const schematic = readFileSync(
  resolve("hardware/fusion/WiFiPicoDMX_RevA.sch"),
  "utf8",
);
const usedLibrary = readFileSync(
  resolve("hardware/fusion/WiFiPicoDMX_RevA_used.lbr"),
  "utf8",
);

const names = (xml, expression) => new Set(
  [...xml.matchAll(expression)].map((match) => match[1]),
);

const sorted = (values) => [...values].sort();

test("used-component library contains exactly the schematic device sets", () => {
  const usedDeviceSets = names(
    schematic,
    /<part\b[^>]*\bdeviceset="([^"]+)"/g,
  );
  const libraryDeviceSets = names(
    usedLibrary,
    /<deviceset\b[^>]*\bname="([^"]+)"/g,
  );

  assert.deepEqual(sorted(libraryDeviceSets), sorted(usedDeviceSets));
  assert.ok(!libraryDeviceSets.has("RES0603"));
});

test("used-component library includes every referenced symbol and package", () => {
  const symbolNames = names(
    usedLibrary,
    /<symbol\b[^>]*\bname="([^"]+)"/g,
  );
  const packageNames = names(
    usedLibrary,
    /<package\b[^>]*\bname="([^"]+)"/g,
  );
  const referencedSymbols = names(
    usedLibrary,
    /<gate\b[^>]*\bsymbol="([^"]+)"/g,
  );
  const referencedPackages = names(
    usedLibrary,
    /<device\b[^>]*\bpackage="([^"]+)"/g,
  );

  assert.deepEqual(sorted(symbolNames), sorted(referencedSymbols));
  assert.deepEqual(sorted(packageNames), sorted(referencedPackages));
  assert.ok(symbolNames.has("A3"), "the schematic frame symbol is missing");
  assert.ok(packageNames.has("PICO_2_W_DEVELOPMENT_BOARD"));
  assert.ok(packageNames.has("SOT23_"));
});

test("used-component library retains available 3D package associations", () => {
  const packageNames = names(
    usedLibrary,
    /<package\b[^>]*\bname="([^"]+)"/g,
  );
  const modelPackageNames = names(
    usedLibrary,
    /<packageinstance\b[^>]*\bname="([^"]+)"/g,
  );

  assert.ok(modelPackageNames.size > 0);
  for (const packageName of modelPackageNames) {
    assert.ok(
      packageNames.has(packageName),
      `3D association references unused package ${packageName}`,
    );
  }
  assert.match(
    usedLibrary,
    /<packageinstance\b[^>]*\bname="SOT23_"/,
    "the user-supplied SM712 3D association is missing",
  );
});

test("used-component library is a standalone Fusion/EAGLE library", () => {
  assert.match(usedLibrary, /^<\?xml version="1\.0"/);
  assert.match(usedLibrary, /<!DOCTYPE eagle SYSTEM "eagle\.dtd">/);
  assert.match(usedLibrary, /<eagle version="9\.6\.2">/);
  assert.match(usedLibrary, /<drawing>[\s\S]*<library>/);
  assert.doesNotMatch(usedLibrary, /<schematic\b/);
});
