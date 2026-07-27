import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const board = readFileSync(
  resolve("hardware/fusion/WiFiPicoDMX_RevA.brd"),
  "utf8",
);
const schematic = readFileSync(
  resolve("hardware/fusion/WiFiPicoDMX_RevA.sch"),
  "utf8",
);
const netlist = readFileSync(
  resolve("hardware/fusion/WiFiPicoDMX_RevA_netlist.csv"),
  "utf8",
);
const library = readFileSync(
  resolve("hardware/fusion/libraries/WiFiPicoDMX.lbr"),
  "utf8",
);

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/(\w+)="([^"]*)"/g)]
      .map((match) => [match[1], match[2]]),
  );
}

function packageBody(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = board.match(
    new RegExp(
      `<package\\b[^>]*\\bname="${escapedName}"[^>]*>`
      + `([\\s\\S]*?)<\\/package>`,
    ),
  );
  assert.ok(match, `package ${name} is missing from board`);
  return match[1];
}

function packageBounds(name) {
  const points = [];
  const add = (x, y) => {
    if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
  };
  const body = packageBody(name);
  for (const match of body.matchAll(/<(?:smd|pad)\b([^>]*)\/>/g)) {
    const item = attributes(match[1]);
    const x = Number(item.x);
    const y = Number(item.y);
    const dx = Number(item.dx ?? item.diameter ?? 1.7);
    const dy = Number(item.dy ?? item.diameter ?? 1.7);
    add(x - dx / 2, y - dy / 2);
    add(x + dx / 2, y + dy / 2);
  }
  for (const match of body.matchAll(/<wire\b([^>]*)\/>/g)) {
    const item = attributes(match[1]);
    if (!["21", "51"].includes(item.layer)) continue;
    add(Number(item.x1), Number(item.y1));
    add(Number(item.x2), Number(item.y2));
  }
  for (const match of body.matchAll(/<(?:hole|circle)\b([^>]*)\/>/g)) {
    const item = attributes(match[1]);
    const radius = Number(item.radius ?? item.drill) / 2;
    add(Number(item.x) - radius, Number(item.y) - radius);
    add(Number(item.x) + radius, Number(item.y) + radius);
  }
  assert.ok(points.length > 0, `package ${name} has no measurable geometry`);
  return {
    minX: Math.min(...points.map(({ x }) => x)),
    minY: Math.min(...points.map(({ y }) => y)),
    maxX: Math.max(...points.map(({ x }) => x)),
    maxY: Math.max(...points.map(({ y }) => y)),
  };
}

test("basic board contains every physical schematic part and named net", () => {
  const elements = [...board.matchAll(/<element\b[^>]*\bname="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.equal(elements.length, 37);
  assert.equal(new Set(elements).size, 37);
  assert.doesNotMatch(board, /<element\b[^>]*\bname="FRAME/);

  const signals = [...board.matchAll(/<signal\b[^>]*\bname="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.equal(signals.length, 55);
  assert.equal(new Set(signals).size, 55);
  assert.doesNotMatch(board, /name="NC_U[23]_PIN/);
});

test("removed J6 diagnostic pad bank is absent from the design", () => {
  assert.doesNotMatch(schematic, /<part\b[^>]*\bname="J6"/);
  assert.doesNotMatch(board, /<element\b[^>]*\bname="J6"/);
  assert.doesNotMatch(netlist, /(?:^|,)J6,/m);
});

test("every generated board element has an explicit reference designator", () => {
  const elements = [...board.matchAll(
    /<element\b([^>]*)>([\s\S]*?)<\/element>/g,
  )];
  assert.equal(elements.length, 37);

  for (const [, rawAttributes, body] of elements) {
    const element = attributes(rawAttributes);
    assert.equal(element.smashed, "yes", `${element.name} is not smashed`);
    assert.match(
      body,
      /<attribute\b[^>]*\bname="NAME"[^>]*\/>/,
      `${element.name} has no explicit NAME attribute`,
    );
  }
});

test("schematic and board use identical routing classes", () => {
  function classes(xml) {
    const body = xml.match(/<classes>([\s\S]*?)<\/classes>/)?.[1];
    assert.ok(body, "routing classes are missing");
    return [...body.matchAll(/<class\b([^>]*)>/g)]
      .map((match) => attributes(match[1]))
      .map(({ number, name, width, drill }) => ({
        number: Number(number),
        name,
        width,
        drill,
      }));
  }
  assert.deepEqual(classes(board), classes(schematic));

  for (const match of board.matchAll(
    /<signal\b[^>]*\bname="([^"]+)"[^>]*\bclass="([^"]+)"/g,
  )) {
    const [, name, routingClass] = match;
    assert.match(
      schematic,
      new RegExp(
        `<net\\b[^>]*\\bname="${name}"[^>]*\\bclass="${routingClass}"`,
      ),
      `schematic net class differs for ${name}`,
    );
  }
});

test("Fusion import does not synthesize nets for intentionally unused IC pads", () => {
  function deviceSetBody(name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = schematic.match(
      new RegExp(
        `<deviceset\\b[^>]*\\bname="${escapedName}"[^>]*>`
        + `([\\s\\S]*?)<\\/deviceset>`,
      ),
    );
    assert.ok(match, `deviceset ${name} is missing`);
    return match[1];
  }

  const isow = deviceSetBody("ISOW1412DFMR");
  assert.doesNotMatch(
    isow,
    /<connect\b[^>]*\bpin="(?:IN|OUT)"/,
    "unused ISOW1412 IN/OUT pads must not be mapped to schematic pins",
  );

  const optocoupler = deviceSetBody("HCPL_0700_500E");
  assert.doesNotMatch(
    optocoupler,
    /<connect\b[^>]*\bpin="(?:NC1|NC4)"/,
    "HCPL-0700 NC pads must not be mapped to schematic pins",
  );
});

test("generated Fusion pair avoids independently imported custom net classes", () => {
  for (const [kind, xml] of [["schematic", schematic], ["board", board]]) {
    const body = xml.match(/<classes>([\s\S]*?)<\/classes>/)?.[1];
    assert.ok(body, `${kind} routing classes are missing`);
    const classes = [...body.matchAll(/<class\b([^>]*)>/g)]
      .map((match) => attributes(match[1]));
    assert.deepEqual(
      classes.map(({ number, name }) => ({ number, name })),
      [{ number: "0", name: "default" }],
      `${kind} must use only Fusion's shared default class`,
    );
  }
  assert.doesNotMatch(schematic, /<net\b[^>]*\bclass="[12]"/);
  assert.doesNotMatch(board, /<signal\b[^>]*\bclass="[12]"/);
});

test("carrier has a simple rectangular outline without a Pico cutout", () => {
  const expectedOutline = [
    { x1: 0, y1: 0, x2: 95, y2: 0 },
    { x1: 95, y1: 0, x2: 95, y2: 100 },
    { x1: 95, y1: 100, x2: 0, y2: 100 },
    { x1: 0, y1: 100, x2: 0, y2: 0 },
  ];
  const outline = [...board.matchAll(/<wire\b[^>]*\blayer="20"[^>]*\/>/g)]
    .map((match) => attributes(match[0]))
    .map(({ x1, y1, x2, y2 }) => ({
      x1: Number(x1),
      y1: Number(y1),
      x2: Number(x2),
      y2: Number(y2),
    }));
  assert.deepEqual(outline, expectedOutline);
});

test("Pico uses the supplied through-hole footprint without carrier keepouts", () => {
  assert.match(
    board,
    /<element\b[^>]*\bname="U1"[^>]*\bpackage="PICO_2_W_DEVELOPMENT_BOARD"[^>]*\bx="31\.5"[^>]*\by="53\.5"/,
  );
  assert.doesNotMatch(board, /Pico USB, BOOTSEL and RESET access zone/);
  assert.doesNotMatch(
    board,
    /<rectangle x1="11" y1="0" x2="25" y2="10\.5" layer="4[123]"\/>/,
  );
  assert.doesNotMatch(
    packageBody("PICO_2_W_DEVELOPMENT_BOARD"),
    /\blayer="39"/,
    "the supplied Pico header footprint must not add a carrier keepout",
  );
});

test("upper DMX section has a local isolation corridor", () => {
  assert.match(
    board,
    /<rectangle x1="62" y1="43\.75" x2="69" y2="88\.75" layer="41"\/>/,
  );
  assert.match(
    board,
    /<rectangle x1="62" y1="43\.75" x2="69" y2="88\.75" layer="42"\/>/,
  );
  assert.match(
    board,
    /<rectangle x1="62" y1="43\.75" x2="69" y2="88\.75" layer="43"\/>/,
  );
});

test("MIDI DIN input is enclosed at the bottom edge by a via-restrict moat", () => {
  const moatRectangles = [
    [0, 20, 39.5, 22],
    [39.5, 0, 44.5, 22],
  ];
  for (const layer of [41, 42, 43]) {
    for (const [x1, y1, x2, y2] of moatRectangles) {
      assert.match(
        board,
        new RegExp(
          `<rectangle x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" layer="${layer}"\\/>`,
        ),
        `missing MIDI isolation moat on layer ${layer}`,
      );
    }
  }
  assert.match(board, /MIDI ISOLATED INPUT - NO LOGIC COPPER/);

  const inputPlacements = {
    J2: [13, 10],
    R4: [25, 12],
    R5: [25, 7],
    D2: [33, 11],
  };
  for (const [name, [x, y]] of Object.entries(inputPlacements)) {
    assert.match(
      board,
      new RegExp(
        `<element\\b[^>]*\\bname="${name}"[^>]*\\bx="${x}"[^>]*\\by="${y}"`,
      ),
      `${name} is not inside the MIDI input island`,
    );
  }
  assert.match(
    board,
    /<element\b[^>]*\bname="U3"[^>]*\bx="42"[^>]*\by="11"/,
  );

  const logicGround = board.match(
    /<signal\b[^>]*\bname="GND_LOGIC"[^>]*>([\s\S]*?)<\/signal>/,
  )?.[1];
  assert.ok(logicGround, "GND_LOGIC signal is missing");
  for (const name of Object.keys(inputPlacements)) {
    assert.doesNotMatch(
      logicGround,
      new RegExp(`<contactref\\b[^>]*\\belement="${name}"`),
      `${name} must not connect to logic ground`,
    );
  }
});

test("component placement preserves functional zones and DMX signal flow", () => {
  const placements = Object.fromEntries(
    [...board.matchAll(/<element\b([^>]*)>/g)]
      .map((match) => attributes(match[1]))
      .map((element) => [
        element.name,
        { x: Number(element.x), y: Number(element.y) },
      ]),
  );

  assert.ok(placements.J3.x < placements.U1.x, "GPIO bank must be left of Pico");
  assert.ok(placements.J4.x < placements.U1.x, "analog bank must be left of Pico");

  assert.ok(placements.U2.x > placements.U1.x, "DMX isolator must be right of Pico");
  assert.ok(placements.J1.x > placements.U2.x, "DMX connector must be right of isolator");
  for (const name of ["U2", "L1", "D1", "J1"]) {
    assert.ok(placements[name].y >= 55, `${name} must be in the upper DMX section`);
  }

  assert.ok(placements.J2.x < placements.D2.x, "MIDI connector must feed right");
  assert.ok(placements.D2.x < placements.U3.x, "MIDI input network must precede optocoupler");
  assert.ok(placements.U3.y < placements.U1.y, "MIDI optocoupler must remain below Pico");
  for (const name of ["J2", "R4", "R5", "D2", "U3", "R7", "C7"]) {
    assert.ok(placements[name].y <= 20, `${name} must be in the lower MIDI section`);
  }
  assert.ok(placements.R6.y < placements.U1.y, "MIDI pull-up must remain below Pico");
});

test("generated component positions match the manually arranged Fusion layout", () => {
  const expected = {
    C1: [55.25, 76.5, "R90"], C2: [55.25, 65, "R90"],
    C3: [51, 64.75, "R90"], C4: [76.2, 54.25, "R270"],
    C5: [85.5, 53.95, "R270"], C6: [78.3, 59.35, "R270"],
    C7: [57, 12, "R90"], C8: [50.75, 60.25, "R90"],
    C9: [81.6, 54.05, "R270"], D1: [83.25, 69.2, "R0"],
    D2: [33, 11, "R270"], D3: [59.5, 39.5, "R0"],
    D4: [59.5, 33.5, "R0"], F1: [48.25, 33.5, "R0"],
    FB1: [81.55, 59.4, "R90"], FB2: [78.35, 57, "R90"],
    J1: [88.8, 65.45, "R90"], J2: [13, 10, "R270"],
    J3: [5.5, 45.5, "R0"], J4: [14, 79.25, "R0"],
    J5: [5.5, 79.5, "R0"], L1: [77.3, 69.15, "R0"],
    R1: [51.25, 68, "R0"], R2: [51.25, 76.25, "R0"],
    R3: [51.25, 72.25, "R0"], R4: [25, 12, "R0"],
    R5: [25, 7, "R0"], R6: [52.2, 28.5, "R0"],
    R7: [50.4, 9.5, "R0"], R8: [55.5, 39, "R0"],
    R9: [55.5, 33.5, "R0"], R10: [77.25, 72.15, "R0"],
    R11: [77.35, 66.1, "R0"], SW1: [49.75, 43.25, "R0"],
    U1: [31.5, 53.5, "R0"], U2: [65.5, 64.75, "R0"],
    U3: [42, 11, "R0"],
  };
  const actual = Object.fromEntries(
    [...board.matchAll(/<element\b([^>]*)>/g)]
      .map((match) => attributes(match[1]))
      .map(({ name, x, y, rot }) => [
        name,
        [Number(x), Number(y), rot ?? "R0"],
      ]),
  );
  assert.deepEqual(actual, expected);
});

test("panel harnesses use the selected JST XH board connectors", () => {
  assert.match(
    board,
    /<element\b[^>]*\bname="J1"[^>]*\bpackage="B4B-XH-A"[^>]*\bvalue="JST XH B4B-XH-A DMX: COM,-,\+,SHELL"/,
  );
  assert.match(
    board,
    /<element\b[^>]*\bname="J2"[^>]*\bpackage="B5B-XH-A"[^>]*\bvalue="JST XH B5B-XH-A MIDI: 1,2,3,4,5"/,
  );

  const expectedContacts = [
    ["GND_DMX_ISO", "J1", "1"],
    ["DMX_DATA_MINUS", "J1", "2"],
    ["DMX_DATA_PLUS", "J1", "3"],
    ["XLR_SHELL", "J1", "4"],
    ["MIDI_DIN_PIN1_SPARE", "J2", "1"],
    ["MIDI_DIN_PIN2_SHIELD", "J2", "2"],
    ["MIDI_DIN_PIN3_SPARE", "J2", "3"],
    ["MIDI_DIN_PIN4", "J2", "4"],
    ["MIDI_DIN_PIN5", "J2", "5"],
  ];
  for (const [signal, element, pad] of expectedContacts) {
    const signalBody = board.match(
      new RegExp(
        `<signal\\b[^>]*\\bname="${signal}"[^>]*>([\\s\\S]*?)<\\/signal>`,
      ),
    )?.[1];
    assert.ok(signalBody, `signal ${signal} is missing`);
    assert.match(
      signalBody,
      new RegExp(`<contactref element="${element}" pad="${pad}"\\/>`),
      `${element}.${pad} is not connected to ${signal}`,
    );
  }
});

test("diagnostic pads keep logic and isolated groups physically separated", () => {
  const packageBody = library.match(
    /<package name="PADBANK8">([\s\S]*?)<\/package>/,
  )?.[1];
  assert.ok(packageBody, "PADBANK8 package is missing");
  const pads = [...packageBody.matchAll(/<smd\b([^>]*)\/>/g)]
    .map((match) => attributes(match[1]));
  assert.equal(pads.length, 8);

  const logic = pads.filter(({ name }) => Number(name) <= 4);
  const isolated = pads.filter(({ name }) => Number(name) >= 5);
  assert.ok(logic.every(({ x }) => Number(x) === -6));
  assert.ok(isolated.every(({ x }) => Number(x) === 6));

  const edgeGap = 12 - Number(logic[0].dx) / 2 - Number(isolated[0].dx) / 2;
  assert.ok(edgeGap >= 8, `diagnostic-domain copper gap is only ${edgeGap} mm`);
});

test("starter placement keeps physical package bodies from overlapping", () => {
  const elements = [...board.matchAll(/<element\b([^>]*)>/g)]
    .map((match) => attributes(match[1]))
    .map((element) => {
      const local = packageBounds(element.package);
      const x = Number(element.x);
      const y = Number(element.y);
      const rotation = element.rot ?? "R0";
      const rotated = rotation === "R90"
        ? {
          minX: -local.maxY,
          minY: local.minX,
          maxX: -local.minY,
          maxY: local.maxX,
        }
        : local;
      return {
        name: element.name,
        minX: x + rotated.minX,
        minY: y + rotated.minY,
        maxX: x + rotated.maxX,
        maxY: y + rotated.maxY,
      };
    });

  for (let leftIndex = 0; leftIndex < elements.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < elements.length; rightIndex += 1) {
      const left = elements[leftIndex];
      const right = elements[rightIndex];
      const overlaps = left.minX < right.maxX
        && left.maxX > right.minX
        && left.minY < right.maxY
        && left.maxY > right.minY;
      assert.ok(!overlaps, `${left.name} overlaps ${right.name}`);
    }
  }
});
