import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const sourceLibrary = readFileSync(
  resolve("hardware/fusion/libraries/WiFiPicoDMX.lbr"),
  "utf8",
);
const generatedSchematic = readFileSync(
  resolve("hardware/fusion/WiFiPicoDMX_RevA.sch"),
  "utf8",
);

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function package3dModels(xml) {
  const models = [];
  for (const match of xml.matchAll(
    /<package3d\b([^>]*)>([\s\S]*?)<\/package3d>/g,
  )) {
    const urn = match[1].match(/\burn="([^"]+)"/)?.[1];
    const packageName = match[2].match(
      /<packageinstance\b[^>]*\bname="([^"]+)"/,
    )?.[1];
    if (urn && packageName) models.push({ urn, packageName });
  }
  return models;
}

test("generated Fusion schematic preserves available project-library 3D models", () => {
  const generatedPackages = new Set(
    [...generatedSchematic.matchAll(/<package\b[^>]*\bname="([^"]+)"/g)]
      .map((match) => match[1]),
  );
  const expectedModels = package3dModels(sourceLibrary)
    .filter(({ packageName }) => generatedPackages.has(packageName));

  assert.ok(
    expectedModels.length > 0,
    "test requires at least one used project-library package with a 3D model",
  );

  for (const { packageName, urn } of expectedModels) {
    assert.match(
      generatedSchematic,
      new RegExp(
        `<package3d\\b[^>]*\\burn="${escaped(urn)}"[\\s\\S]*?`
        + `<packageinstance\\b[^>]*\\bname="${escaped(packageName)}"`,
      ),
      `missing embedded 3D model for ${packageName}`,
    );

    const deviceWithPackage = new RegExp(
      `<device\\b[^>]*\\bpackage="${escaped(packageName)}"[^>]*>`
      + `[\\s\\S]*?<package3dinstance\\b[^>]*`
      + `\\bpackage3d_urn="${escaped(urn)}"`,
    );
    assert.match(
      generatedSchematic,
      deviceWithPackage,
      `missing device-to-3D association for ${packageName}`,
    );
  }
});

test("Pico 2 W development board uses two through-hole header rows", () => {
  const packageMatch = sourceLibrary.match(
    new RegExp(
      `<package\\b[^>]*\\bname="PICO_2_W_DEVELOPMENT_BOARD"[^>]*>`
      + `([\\s\\S]*?)<\\/package>`,
    ),
  );
  assert.ok(packageMatch, "Pico 2 W package is missing");

  const throughHolePads = [
    ...packageMatch[1].matchAll(/<pad\b[^>]*\bname="([^"]+)"/g),
  ];
  const smdPads = [
    ...packageMatch[1].matchAll(/<smd\b[^>]*\bname="([^"]+)"/g),
  ];

  assert.equal(throughHolePads.length, 40);
  assert.equal(smdPads.length, 0);
  assert.match(packageMatch[1], /<pad\b[^>]*\bname="1"[^>]*\bx="-8\.89"/);
  assert.match(packageMatch[1], /<pad\b[^>]*\bname="40"[^>]*\bx="8\.89"/);
});
