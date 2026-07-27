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

function symbolBody(xml, name) {
  const match = xml.match(
    new RegExp(
      `<symbol\\b[^>]*\\bname="${escaped(name)}"[^>]*>`
      + `([\\s\\S]*?)<\\/symbol>`,
    ),
  );
  assert.ok(match, `symbol ${name} is missing`);
  return match[1].trim().replace(/>\s+</g, "><");
}

function tagAttributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/(\w+)="([^"]*)"/g)]
      .map((match) => [match[1], match[2]]),
  );
}

function labelTextBounds(netName, label) {
  const x = Number(label.x);
  const y = Number(label.y);
  const size = Number(label.size);
  const displayedText = label.xref === "yes" ? `${netName}/99.99` : netName;
  // Fusion renders schematic labels as arrow boxes. The conservative width
  // includes the vector-font text plus the arrow head and horizontal padding.
  const textWidth = Math.max(
    size * 3,
    displayedText.length * size * 0.9 + size * 2,
  );
  const textHeight = size * 1.6;
  const rotation = label.rot ?? "R0";
  if (rotation === "R0") {
    return {
      minX: x,
      maxX: x + textWidth,
      minY: y - textHeight / 2,
      maxY: y + textHeight / 2,
    };
  }
  if (rotation === "R180") {
    return {
      minX: x - textWidth,
      maxX: x,
      minY: y - textHeight / 2,
      maxY: y + textHeight / 2,
    };
  }
  if (rotation === "R90") {
    return {
      minX: x - textHeight / 2,
      maxX: x + textHeight / 2,
      minY: y,
      maxY: y + textWidth,
    };
  }
  return {
    minX: x - textHeight / 2,
    maxX: x + textHeight / 2,
    minY: y - textWidth,
    maxY: y,
  };
}

function symbolBounds(xml, name) {
  const body = symbolBody(xml, name);
  const points = [];
  const addPoint = (x, y) => {
    const numericX = Number(x);
    const numericY = Number(y);
    if (Number.isFinite(numericX) && Number.isFinite(numericY)) {
      points.push({ x: numericX, y: numericY });
    }
  };

  for (const match of body.matchAll(/<(?:wire|rectangle)\b[^>]*\/>/g)) {
    const attributes = tagAttributes(match[0]);
    addPoint(attributes.x1, attributes.y1);
    addPoint(attributes.x2, attributes.y2);
  }
  for (const match of body.matchAll(/<(?:pin|text|vertex)\b[^>]*\/?>/g)) {
    const attributes = tagAttributes(match[0]);
    addPoint(attributes.x, attributes.y);
  }
  for (const match of body.matchAll(/<circle\b[^>]*\/>/g)) {
    const attributes = tagAttributes(match[0]);
    const x = Number(attributes.x);
    const y = Number(attributes.y);
    const radius = Number(attributes.radius);
    addPoint(x - radius, y - radius);
    addPoint(x + radius, y + radius);
  }

  assert.ok(points.length > 0, `symbol ${name} has no measurable geometry`);
  return {
    minX: Math.min(...points.map(({ x }) => x)),
    minY: Math.min(...points.map(({ y }) => y)),
    maxX: Math.max(...points.map(({ x }) => x)),
    maxY: Math.max(...points.map(({ y }) => y)),
  };
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

test("PTS810 switch exposes and maps all four physical terminals", () => {
  const cases = [
    {
      xml: sourceLibrary,
      symbolName: "SWITCH_1",
      deviceSetName: "PTS810SJM250SMTR_LFS",
    },
    {
      xml: generatedSchematic,
      symbolName: "SWITCH",
      deviceSetName: "SWITCH_SMD",
    },
  ];

  for (const {
    xml,
    symbolName,
    deviceSetName,
  } of cases) {
    const symbol = symbolBody(xml, symbolName);
    const symbolPins = [...symbol.matchAll(/<pin\b[^>]*\bname="([^"]+)"/g)]
      .map((match) => match[1]);
    assert.deepEqual(symbolPins, ["P$1", "P$2", "P$3", "P$4"]);

    const deviceSet = xml.match(
      new RegExp(
        `<deviceset\\b[^>]*\\bname="${escaped(deviceSetName)}"[^>]*>`
        + `([\\s\\S]*?)<\\/deviceset>`,
      ),
    )?.[1];
    assert.ok(deviceSet, `device set ${deviceSetName} is missing`);
    for (const pin of ["P$1", "P$2", "P$3", "P$4"]) {
      const pad = pin.slice(2);
      assert.match(
        deviceSet,
        new RegExp(
          `<connect\\b[^>]*\\bpin="${escaped(pin)}"[^>]*\\bpad="${pad}"`,
        ),
      );
    }
  }
});

test("generated schematic uses maintained symbols for library-backed parts", () => {
  const expectedSymbols = [
    { generatedName: "RESISTOR", libraryName: "R" },
    { generatedName: "CAPACITOR", libraryName: "C" },
    { generatedName: "FERRITE", libraryName: "L" },
    { generatedName: "FUSE", libraryName: "FUSE-1" },
    { generatedName: "SWITCH", libraryName: "SWITCH_1" },
    { generatedName: "LED", libraryName: "LED", pins: { C: "K" } },
    {
      generatedName: "DIODE",
      libraryName: "DIODE",
      pins: { "A$1": "A", "K$2": "K" },
    },
    { generatedName: "TVS_SM712", libraryName: "TVS_SM712" },
    { generatedName: "CMC", libraryName: "CMC" },
    { generatedName: "ISOW1412", libraryName: "ISOW1412" },
    { generatedName: "OPTO_HCPL0700", libraryName: "OPTO_HCPL0700" },
    { generatedName: "CONN8", libraryName: "CONN8" },
    { generatedName: "CONN17", libraryName: "CONN17" },
    {
      generatedName: "PICO2W",
      libraryName: "RPI-PICO2W",
      pins: {
        "GND@1": "GND3",
        "GND@2": "GND8",
        "GND@3": "GND13",
        "GND@4": "GND18",
        "GND@5": "GND23",
        "GND@6": "GND28",
        GP26: "GP26_ADC0",
        GP27: "GP27_ADC1",
        "GND@7": "AGND",
        GP28: "GP28_ADC2",
        "3.3V_OUT": "3V3",
        "3.3V_EN": "3V3_EN",
        "GND@8": "GND38",
        VBUS_USB: "VBUS",
      },
    },
  ];

  for (const {
    generatedName,
    libraryName,
    pins = {},
  } of expectedSymbols) {
    let expectedBody = symbolBody(sourceLibrary, libraryName);
    for (const [libraryPin, generatedPin] of Object.entries(pins)) {
      expectedBody = expectedBody.replace(
        new RegExp(
          `(<pin\\b[^>]*\\bname=")${escaped(libraryPin)}(")`,
          "g",
        ),
        `$1${generatedPin}$2`,
      );
    }
    assert.equal(
      symbolBody(generatedSchematic, generatedName),
      expectedBody,
      `${generatedName} must use the current ${libraryName} library drawing`,
    );
  }
});

test("placed schematic symbols do not overlap", () => {
  const deviceSymbols = new Map(
    [...generatedSchematic.matchAll(
      /<deviceset\b([^>]*)>([\s\S]*?)<\/deviceset>/g,
    )].map((match) => {
      const deviceSet = tagAttributes(match[1]).name;
      const gate = match[2].match(/<gate\b[^>]*\bsymbol="([^"]+)"/);
      assert.ok(gate, `device set ${deviceSet} has no symbol gate`);
      return [deviceSet, gate[1]];
    }),
  );
  const partDeviceSets = new Map(
    [...generatedSchematic.matchAll(/<part\b([^>]*)\/>/g)]
      .map((match) => {
        const attributes = tagAttributes(match[1]);
        return [attributes.name, attributes.deviceset];
      }),
  );

  const overlaps = [];
  const sheets = [...generatedSchematic.matchAll(
    /<sheet>([\s\S]*?)<\/sheet>/g,
  )];
  sheets.forEach((sheetMatch, sheetIndex) => {
    const placed = [...sheetMatch[1].matchAll(/<instance\b([^>]*)\/>/g)]
      .filter((match) => {
        const { part } = tagAttributes(match[1]);
        return partDeviceSets.get(part) !== "FRAME_A3";
      })
      .map((match) => {
        const attributes = tagAttributes(match[1]);
        assert.equal(
          attributes.rot ?? "R0",
          "R0",
          `${attributes.part} uses an unsupported test rotation`,
        );
        const symbolName = deviceSymbols.get(partDeviceSets.get(attributes.part));
        assert.ok(symbolName, `symbol for ${attributes.part} is missing`);
        const bounds = symbolBounds(generatedSchematic, symbolName);
        const x = Number(attributes.x);
        const y = Number(attributes.y);
        return {
          part: attributes.part,
          minX: bounds.minX + x,
          minY: bounds.minY + y,
          maxX: bounds.maxX + x,
          maxY: bounds.maxY + y,
        };
      });

    for (let leftIndex = 0; leftIndex < placed.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < placed.length;
        rightIndex += 1
      ) {
        const left = placed[leftIndex];
        const right = placed[rightIndex];
        const overlapX = Math.min(left.maxX, right.maxX)
          - Math.max(left.minX, right.minX);
        const overlapY = Math.min(left.maxY, right.maxY)
          - Math.max(left.minY, right.minY);
        if (overlapX > 0.001 && overlapY > 0.001) {
          overlaps.push(
            `sheet ${sheetIndex + 1}: ${left.part}/${right.part}`
            + ` (${overlapX.toFixed(2)} x ${overlapY.toFixed(2)} mm)`,
          );
        }
      }
    }
  });

  assert.deepEqual(overlaps, []);
});

test("every schematic sheet uses the library A3 frame and stays inside it", () => {
  assert.equal(
    symbolBody(generatedSchematic, "A3"),
    symbolBody(sourceLibrary, "A3"),
  );

  const frameDeviceSet = generatedSchematic.match(
    /<deviceset\b[^>]*\bname="FRAME_A3"[^>]*>([\s\S]*?)<\/deviceset>/,
  )?.[1];
  assert.ok(frameDeviceSet, "FRAME_A3 device set is missing");
  assert.match(frameDeviceSet, /<gate\b[^>]*\bsymbol="A3"/);

  const frameParts = new Set(
    [...generatedSchematic.matchAll(
      /<part\b([^>]*)\/>/g,
    )]
      .map((match) => tagAttributes(match[1]))
      .filter(({ deviceset }) => deviceset === "FRAME_A3")
      .map(({ name }) => name),
  );

  const sheets = [...generatedSchematic.matchAll(
    /<sheet>([\s\S]*?)<\/sheet>/g,
  )];
  assert.equal(frameParts.size, sheets.length);

  const innerBorder = {
    minX: 2.54,
    minY: 2.54,
    maxX: 416.56,
    maxY: 294.64,
  };
  sheets.forEach((sheetMatch, sheetIndex) => {
    const instances = [...sheetMatch[1].matchAll(
      /<instance\b([^>]*)\/>/g,
    )].map((match) => tagAttributes(match[1]));
    const frames = instances.filter(({ part }) => frameParts.has(part));
    assert.equal(frames.length, 1, `sheet ${sheetIndex + 1} needs one A3 frame`);
    assert.equal(frames[0].x, "0");
    assert.equal(frames[0].y, "0");

    for (const instance of instances.filter(({ part }) => !frameParts.has(part))) {
      const part = generatedSchematic.match(
        new RegExp(`<part\\b[^>]*\\bname="${escaped(instance.part)}"[^>]*/>`),
      );
      assert.ok(part, `part ${instance.part} is missing`);
      const deviceSet = tagAttributes(part[0]).deviceset;
      const deviceBlock = generatedSchematic.match(
        new RegExp(
          `<deviceset\\b[^>]*\\bname="${escaped(deviceSet)}"[^>]*>`
          + `([\\s\\S]*?)<\\/deviceset>`,
        ),
      )?.[1];
      const symbolName = deviceBlock?.match(
        /<gate\b[^>]*\bsymbol="([^"]+)"/,
      )?.[1];
      assert.ok(symbolName, `symbol for ${instance.part} is missing`);
      const bounds = symbolBounds(generatedSchematic, symbolName);
      const translated = {
        minX: bounds.minX + Number(instance.x),
        minY: bounds.minY + Number(instance.y),
        maxX: bounds.maxX + Number(instance.x),
        maxY: bounds.maxY + Number(instance.y),
      };
      assert.ok(
        translated.minX >= innerBorder.minX
        && translated.minY >= innerBorder.minY
        && translated.maxX <= innerBorder.maxX
        && translated.maxY <= innerBorder.maxY,
        `${instance.part} on sheet ${sheetIndex + 1} is outside the A3 frame`,
      );
    }
  });
});

test("net labels face away from the component side", () => {
  const checked = [];
  for (const segmentMatch of generatedSchematic.matchAll(
    /<segment>([\s\S]*?)<\/segment>/g,
  )) {
    const pinref = segmentMatch[1].match(/<pinref\b([^>]*)\/>/);
    const wire = segmentMatch[1].match(/<wire\b([^>]*)\/>/);
    const label = segmentMatch[1].match(/<label\b([^>]*)\/>/);
    assert.ok(pinref && wire && label, "net segment is incomplete");

    const pin = tagAttributes(pinref[1]);
    const wireAttributes = tagAttributes(wire[1]);
    const labelAttributes = tagAttributes(label[1]);
    const deltaX = Number(wireAttributes.x2) - Number(wireAttributes.x1);
    const deltaY = Number(wireAttributes.y2) - Number(wireAttributes.y1);
    let expectedRotation;
    if (deltaX < -0.001) expectedRotation = "R180";
    if (deltaX > 0.001) expectedRotation = "R0";
    if (deltaY < -0.001) expectedRotation = "R270";
    if (deltaY > 0.001) expectedRotation = "R90";
    assert.ok(expectedRotation, `${pin.part}.${pin.pin} has a zero-length stub`);
    assert.equal(
      labelAttributes.rot ?? "R0",
      expectedRotation,
      `${pin.part}.${pin.pin} label faces the wrong direction`,
    );
    checked.push(`${pin.part}.${pin.pin}`);
  }

  assert.ok(checked.includes("U1.GP0"), "GPIO0_EXP/Pico pin 1 was not checked");
  assert.ok(checked.includes("U1.VBUS"), "VBUS_5V_USB/Pico pin 40 was not checked");
});

test("net label text does not overlap unrelated schematic symbols", () => {
  const partDeviceSets = new Map(
    [...generatedSchematic.matchAll(/<part\b([^>]*)\/>/g)]
      .map((match) => {
        const attributes = tagAttributes(match[1]);
        return [attributes.name, attributes.deviceset];
      }),
  );
  const deviceSymbols = new Map(
    [...generatedSchematic.matchAll(
      /<deviceset\b([^>]*)>([\s\S]*?)<\/deviceset>/g,
    )].map((match) => {
      const deviceSet = tagAttributes(match[1]).name;
      const symbol = match[2].match(/<gate\b[^>]*\bsymbol="([^"]+)"/)?.[1];
      return [deviceSet, symbol];
    }),
  );
  const collisions = [];

  const sheets = [...generatedSchematic.matchAll(
    /<sheet>([\s\S]*?)<\/sheet>/g,
  )];
  sheets.forEach((sheetMatch, sheetIndex) => {
    const placed = [...sheetMatch[1].matchAll(/<instance\b([^>]*)\/>/g)]
      .map((match) => tagAttributes(match[1]))
      .filter(({ part }) => partDeviceSets.get(part) !== "FRAME_A3")
      .map((instance) => {
        const symbol = deviceSymbols.get(partDeviceSets.get(instance.part));
        const bounds = symbolBounds(generatedSchematic, symbol);
        const x = Number(instance.x);
        const y = Number(instance.y);
        return {
          part: instance.part,
          minX: bounds.minX + x,
          minY: bounds.minY + y,
          maxX: bounds.maxX + x,
          maxY: bounds.maxY + y,
        };
      });

    for (const netMatch of sheetMatch[1].matchAll(
      /<net\b([^>]*)>([\s\S]*?)<\/net>/g,
    )) {
      const netName = tagAttributes(netMatch[1]).name;
      for (const segmentMatch of netMatch[2].matchAll(
        /<segment>([\s\S]*?)<\/segment>/g,
      )) {
        const pinrefMatch = segmentMatch[1].match(/<pinref\b([^>]*)\/>/);
        const labelMatch = segmentMatch[1].match(/<label\b([^>]*)\/>/);
        assert.ok(pinrefMatch && labelMatch, `incomplete ${netName} segment`);
        const pinref = tagAttributes(pinrefMatch[1]);
        const label = tagAttributes(labelMatch[1]);
        const x = Number(label.x);
        const y = Number(label.y);
        const size = Number(label.size);
        const textWidth = Math.max(size, netName.length * size * 0.6);
        const textHeight = size * 1.2;
        const rotation = label.rot ?? "R0";
        let bounds;
        if (rotation === "R0") {
          bounds = {
            minX: x,
            maxX: x + textWidth,
            minY: y - textHeight / 2,
            maxY: y + textHeight / 2,
          };
        } else if (rotation === "R180") {
          bounds = {
            minX: x - textWidth,
            maxX: x,
            minY: y - textHeight / 2,
            maxY: y + textHeight / 2,
          };
        } else if (rotation === "R90") {
          bounds = {
            minX: x - textHeight / 2,
            maxX: x + textHeight / 2,
            minY: y,
            maxY: y + textWidth,
          };
        } else {
          bounds = {
            minX: x - textHeight / 2,
            maxX: x + textHeight / 2,
            minY: y - textWidth,
            maxY: y,
          };
        }

        for (const component of placed) {
          if (component.part === pinref.part) continue;
          const overlapX = Math.min(bounds.maxX, component.maxX)
            - Math.max(bounds.minX, component.minX);
          const overlapY = Math.min(bounds.maxY, component.maxY)
            - Math.max(bounds.minY, component.minY);
          if (overlapX > 0.001 && overlapY > 0.001) {
            collisions.push(
              `sheet ${sheetIndex + 1}: ${netName}/${pinref.part}`
              + ` label overlaps ${component.part}`,
            );
          }
        }
      }
    }
  });

  assert.deepEqual(collisions, []);
});

test("net labels do not overlap other net labels", () => {
  const collisions = [];
  const sheets = [...generatedSchematic.matchAll(
    /<sheet>([\s\S]*?)<\/sheet>/g,
  )];
  sheets.forEach((sheetMatch, sheetIndex) => {
    const labels = [];
    for (const netMatch of sheetMatch[1].matchAll(
      /<net\b([^>]*)>([\s\S]*?)<\/net>/g,
    )) {
      const netName = tagAttributes(netMatch[1]).name;
      for (const segmentMatch of netMatch[2].matchAll(
        /<segment>([\s\S]*?)<\/segment>/g,
      )) {
        const pinrefMatch = segmentMatch[1].match(/<pinref\b([^>]*)\/>/);
        const labelMatch = segmentMatch[1].match(/<label\b([^>]*)\/>/);
        assert.ok(pinrefMatch && labelMatch, `incomplete ${netName} segment`);
        const pinref = tagAttributes(pinrefMatch[1]);
        const label = tagAttributes(labelMatch[1]);
        labels.push({
          netName,
          endpoint: `${pinref.part}.${pinref.pin}`,
          ...labelTextBounds(netName, label),
        });
      }
    }

    for (let leftIndex = 0; leftIndex < labels.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < labels.length;
        rightIndex += 1
      ) {
        const left = labels[leftIndex];
        const right = labels[rightIndex];
        const overlapX = Math.min(left.maxX, right.maxX)
          - Math.max(left.minX, right.minX);
        const overlapY = Math.min(left.maxY, right.maxY)
          - Math.max(left.minY, right.minY);
        if (overlapX > 0.001 && overlapY > 0.001) {
          collisions.push(
            `sheet ${sheetIndex + 1}: ${left.netName}/${left.endpoint}`
            + ` overlaps ${right.netName}/${right.endpoint}`,
          );
        }
      }
    }
  });

  assert.deepEqual(collisions, []);
});
