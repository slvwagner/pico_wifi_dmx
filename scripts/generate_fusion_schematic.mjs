import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve("hardware/fusion/WiFiPicoDMX_RevA.sch");
const netlistCsvPath = resolve("hardware/fusion/WiFiPicoDMX_RevA_netlist.csv");
const netlistMarkdownPath = resolve("hardware/fusion/WiFiPicoDMX_RevA_netlist.md");
const projectLibraryPath = resolve("hardware/fusion/libraries/WiFiPicoDMX.lbr");
const projectLibraryXml = readFileSync(projectLibraryPath, "utf8");
const designLibraryName = "WiFiPicoDMX_RevA_used";

const esc = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const attrs = (values) => Object.entries(values)
  .filter(([, value]) => value !== undefined)
  .map(([name, value]) => `${name}="${esc(value)}"`)
  .join(" ");

const element = (name, values = {}, content = "") => {
  const attributeText = attrs(values);
  const opening = attributeText ? `<${name} ${attributeText}` : `<${name}`;
  return content === "" ? `${opening}/>` : `${opening}>${content}</${name}>`;
};

const lines = (items, indent = "        ") => items
  .filter(Boolean)
  .map((item) => item.split("\n").map((line) => `${indent}${line}`).join("\n"))
  .join("\n");

const pinDirections = {
  passive: "pas",
  input: "in",
  output: "out",
  io: "io",
  power: "pwr",
  nc: "nc",
};

const libraries = new Map();
const symbols = new Map();
const packages = new Map();
const deviceSets = new Map();
const projectLibrary3dByPackage = new Map();
const parts = [];
const instances = [];
const connections = new Map();
const notes = new Map();

for (const match of projectLibraryXml.matchAll(
  /<package3d\b([^>]*)>([\s\S]*?)<\/package3d>/g,
)) {
  const urn = match[1].match(/\burn="([^"]+)"/)?.[1]
    || match[1].match(/\bwip_urn="([^"]+)"/)?.[1];
  if (!urn) continue;
  for (const packageMatch of match[2].matchAll(
    /<packageinstance\b[^>]*\bname="([^"]+)"/g,
  )) {
    projectLibrary3dByPackage.set(packageMatch[1], {
      urn,
      xml: match[0],
    });
  }
}

function defineSymbol(name, pins, body = {}) {
  symbols.set(name, { name, pins, body });
}

function definePackage(name, xml) {
  packages.set(name, xml);
}

function importProjectLibraryPackage(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = projectLibraryXml.match(
    new RegExp(`<package\\s+name="${escapedName}"[^>]*>([\\s\\S]*?)<\\/package>`),
  );
  if (!match) {
    throw new Error(`Package ${name} is missing from ${projectLibraryPath}`);
  }
  definePackage(name, match[1].trim());
}

function importProjectLibrarySymbol(
  sourceName,
  generatedName = sourceName,
  pinNameMap = {},
  excludedPins = [],
) {
  const escapedName = sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = projectLibraryXml.match(
    new RegExp(`<symbol\\s+name="${escapedName}"[^>]*>([\\s\\S]*?)<\\/symbol>`),
  );
  if (!match) {
    throw new Error(`Symbol ${sourceName} is missing from ${projectLibraryPath}`);
  }

  let rawXml = match[1].trim();
  for (const [sourcePin, generatedPin] of Object.entries(pinNameMap)) {
    const escapedPin = sourcePin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    rawXml = rawXml.replace(
      new RegExp(`(<pin\\b[^>]*\\bname=")${escapedPin}(")`, "g"),
      `$1${generatedPin}$2`,
    );
  }
  for (const excludedPin of excludedPins) {
    const escapedPin = excludedPin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    rawXml = rawXml.replace(
      new RegExp(
        `[ \\t]*<pin\\b[^>]*\\bname="${escapedPin}"[^>]*/>\\r?\\n?`,
        "g",
      ),
      "",
    );
  }
  const pins = [...rawXml.matchAll(/<pin\b([^>]*)\/>/g)].map((pinMatch) => {
    const attribute = (name) => pinMatch[1].match(
      new RegExp(`\\b${name}="([^"]+)"`),
    )?.[1];
    return {
      name: attribute("name"),
      x: Number(attribute("x")),
      y: Number(attribute("y")),
      rot: attribute("rot") ?? "R0",
      direction: attribute("direction") ?? "pas",
    };
  });
  if (pins.some((pin) => !pin.name || !Number.isFinite(pin.x) || !Number.isFinite(pin.y))) {
    throw new Error(`Symbol ${sourceName} has an unsupported pin definition`);
  }

  defineSymbol(generatedName, pins, { rawXml });
}

function defineDeviceSet(name, prefix, symbol, packageName, connects, description) {
  deviceSets.set(name, {
    name,
    prefix,
    symbol,
    packageName,
    connects,
    description,
    package3dUrn: packageName
      ? projectLibrary3dByPackage.get(packageName)?.urn
      : undefined,
  });
}

function addPart(name, deviceSet, value, sheet, x, y, rotation = "R0") {
  const device = deviceSets.get(deviceSet);
  if (!device) throw new Error(`Unknown device set ${deviceSet}`);
  parts.push({ name, deviceSet, value });
  instances.push({ name, gate: "G$1", sheet, x, y, rotation });
}

function connect(net, part, pin) {
  if (!connections.has(net)) connections.set(net, []);
  connections.get(net).push({ part, pin });
}

function connectMany(net, refs) {
  refs.forEach(([part, pin]) => connect(net, part, pin));
}

function addNote(sheet, x, y, text, size = 1.778, ratio = 12) {
  if (!notes.has(sheet)) notes.set(sheet, []);
  notes.get(sheet).push({ x, y, text, size, ratio });
}

function boxSymbol(name, leftPins, rightPins, width = 30.48, pitch = 5.08) {
  const halfWidth = width / 2;
  const count = Math.max(leftPins.length, rightPins.length);
  const top = ((count - 1) * pitch) / 2;
  const halfHeight = top + 3.81;
  const pins = [];
  leftPins.forEach((pin, index) => pins.push({
    ...pin,
    x: -halfWidth - 5.08,
    y: top - index * pitch,
    rot: "R0",
  }));
  rightPins.forEach((pin, index) => pins.push({
    ...pin,
    x: halfWidth + 5.08,
    y: top - index * pitch,
    rot: "R180",
  }));
  defineSymbol(name, pins, {
    x1: -halfWidth,
    y1: -halfHeight,
    x2: halfWidth,
    y2: halfHeight,
  });
}

function twoPinSymbol(name, label, pin1 = "1", pin2 = "2") {
  defineSymbol(name, [
    { name: pin1, x: -7.62, y: 0, rot: "R0", direction: "passive" },
    { name: pin2, x: 7.62, y: 0, rot: "R180", direction: "passive" },
  ], { x1: -2.54, y1: -2.54, x2: 2.54, y2: 2.54, label });
}

function connectorSymbol(name, pinCount) {
  const pins = [];
  const top = ((pinCount - 1) * 5.08) / 2;
  for (let index = 0; index < pinCount; index += 1) {
    pins.push({
      name: `P${index + 1}`,
      x: -5.08,
      y: top - index * 5.08,
      rot: "R0",
      direction: "passive",
    });
  }
  defineSymbol(name, pins, {
    x1: 0,
    y1: -top - 2.54,
    x2: 7.62,
    y2: top + 2.54,
  });
}

function smdTwoPadPackage(name, dx, dy, spacing) {
  return lines([
    element("smd", { name: "1", x: -spacing / 2, y: 0, dx, dy, layer: 1 }),
    element("smd", { name: "2", x: spacing / 2, y: 0, dx, dy, layer: 1 }),
    element("wire", { x1: -spacing / 2, y1: dy, x2: spacing / 2, y2: dy, width: 0.1524, layer: 21 }),
    element("wire", { x1: spacing / 2, y1: dy, x2: spacing / 2, y2: -dy, width: 0.1524, layer: 21 }),
    element("wire", { x1: spacing / 2, y1: -dy, x2: -spacing / 2, y2: -dy, width: 0.1524, layer: 21 }),
    element("wire", { x1: -spacing / 2, y1: -dy, x2: -spacing / 2, y2: dy, width: 0.1524, layer: 21 }),
    element("text", { x: -spacing / 2, y: dy + 0.8, size: 1.016, layer: 25 }, "&gt;NAME"),
  ], "          ");
}

function padBankPackage(pinCount, pitch = 2.54) {
  const pads = [];
  const start = -((pinCount - 1) * pitch) / 2;
  for (let index = 0; index < pinCount; index += 1) {
    pads.push(element("smd", {
      name: index + 1,
      x: 0,
      y: start + index * pitch,
      dx: 2.2,
      dy: 1.6,
      layer: 1,
    }));
  }
  pads.push(element("wire", {
    x1: -1.5,
    y1: start - 1.5,
    x2: 1.5,
    y2: start - 1.5,
    width: 0.1524,
    layer: 21,
  }));
  pads.push(element("text", {
    x: -1.5,
    y: start + pinCount * pitch,
    size: 1.016,
    layer: 25,
    rot: "R90",
  }, "&gt;NAME"));
  return lines(pads, "          ");
}

// Symbols
importProjectLibrarySymbol("R", "RESISTOR");
importProjectLibrarySymbol("C", "CAPACITOR");
twoPinSymbol("FUSE", "F");
importProjectLibrarySymbol("L", "FERRITE");
twoPinSymbol("SWITCH", "SW");
defineSymbol("DIODE", [
  { name: "A", x: -7.62, y: 0, rot: "R0", direction: "passive" },
  { name: "K", x: 7.62, y: 0, rot: "R180", direction: "passive" },
], { x1: -2.54, y1: -2.54, x2: 2.54, y2: 2.54, label: "D" });
defineSymbol("LED", [
  { name: "A", x: -7.62, y: 0, rot: "R0", direction: "passive" },
  { name: "K", x: 7.62, y: 0, rot: "R180", direction: "passive" },
], { x1: -2.54, y1: -2.54, x2: 2.54, y2: 2.54, label: "LED" });

const picoPins = [
  ["GP0", 1, "io"], ["GP1", 2, "io"], ["GND3", 3, "power"],
  ["GP2", 4, "io"], ["GP3", 5, "io"], ["GP4", 6, "io"],
  ["GP5", 7, "io"], ["GND8", 8, "power"], ["GP6", 9, "io"],
  ["GP7", 10, "io"], ["GP8", 11, "io"], ["GP9", 12, "io"],
  ["GND13", 13, "power"], ["GP10", 14, "io"], ["GP11", 15, "io"],
  ["GP12", 16, "io"], ["GP13", 17, "io"], ["GND18", 18, "power"],
  ["GP14", 19, "io"], ["GP15", 20, "io"], ["GP16", 21, "io"],
  ["GP17", 22, "io"], ["GND23", 23, "power"], ["GP18", 24, "io"],
  ["GP19", 25, "io"], ["GP20", 26, "io"], ["GP21", 27, "io"],
  ["GND28", 28, "power"], ["GP22", 29, "io"], ["RUN", 30, "input"],
  ["GP26_ADC0", 31, "io"], ["GP27_ADC1", 32, "io"], ["AGND", 33, "power"],
  ["GP28_ADC2", 34, "io"], ["ADC_VREF", 35, "power"], ["3V3", 36, "power"],
  ["3V3_EN", 37, "input"], ["GND38", 38, "power"], ["VSYS", 39, "power"],
  ["VBUS", 40, "power"],
].map(([name, pad, direction]) => ({ name, pad, direction }));
boxSymbol("PICO2W", picoPins.slice(0, 20), picoPins.slice(20), 35.56, 4.064);

const isowLeft = [
  { name: "VIO", direction: "power" },
  { name: "D", direction: "input" },
  { name: "DE", direction: "input" },
  { name: "R", direction: "output" },
  { name: "RE_N", direction: "input" },
  { name: "GNDIO", direction: "power" },
  { name: "OUT", direction: "output" },
  { name: "EN_FLT", direction: "io" },
  { name: "VDD", direction: "power" },
  { name: "GND1", direction: "power" },
];
const isowRight = [
  { name: "A", direction: "input" },
  { name: "B", direction: "input" },
  { name: "Z", direction: "output" },
  { name: "Y", direction: "output" },
  { name: "VISOIN", direction: "power" },
  { name: "GISOIN", direction: "power" },
  { name: "IN", direction: "input" },
  { name: "MODE", direction: "input" },
  { name: "VISOOUT", direction: "power" },
  { name: "GND2", direction: "power" },
];
boxSymbol("ISOW1412", isowLeft, isowRight, 30.48, 5.08);

boxSymbol("OPTO_HCPL0700", [
  { name: "NC1", direction: "nc" },
  { name: "A", direction: "input" },
  { name: "K", direction: "input" },
  { name: "NC4", direction: "nc" },
], [
  { name: "VCC", direction: "power" },
  { name: "VB", direction: "input" },
  { name: "VO", direction: "output" },
  { name: "GND", direction: "power" },
], 20.32, 7.62);

defineSymbol("TVS_SM712", [
  { name: "IO1", x: -7.62, y: 2.54, rot: "R0", direction: "passive" },
  { name: "IO2", x: -7.62, y: -2.54, rot: "R0", direction: "passive" },
  { name: "GND", x: 7.62, y: 0, rot: "R180", direction: "power" },
], { x1: -2.54, y1: -5.08, x2: 2.54, y2: 5.08, label: "SM712" });

defineSymbol("CMC", [
  { name: "A1", x: -7.62, y: 2.54, rot: "R0", direction: "passive" },
  { name: "B1", x: -7.62, y: -2.54, rot: "R0", direction: "passive" },
  { name: "A2", x: 7.62, y: 2.54, rot: "R180", direction: "passive" },
  { name: "B2", x: 7.62, y: -2.54, rot: "R180", direction: "passive" },
], { x1: -2.54, y1: -5.08, x2: 2.54, y2: 5.08, label: "CMC" });

[4, 5, 7, 8, 17].forEach((count) => connectorSymbol(`CONN${count}`, count));

// For every library-backed component, the maintained Fusion symbol is the
// canonical drawing. Pin aliases retain the schematic's descriptive netlist
// names where the source library uses physical or generic pin labels.
importProjectLibrarySymbol("FUSE-1", "FUSE");
importProjectLibrarySymbol("SWITCH_1", "SWITCH");
importProjectLibrarySymbol("LED", "LED", { C: "K" });
importProjectLibrarySymbol("DIODE", "DIODE", { "A$1": "A", "K$2": "K" });
importProjectLibrarySymbol("TVS_SM712");
importProjectLibrarySymbol("CMC");
importProjectLibrarySymbol("ISOW1412", "ISOW1412", {}, ["IN", "OUT"]);
importProjectLibrarySymbol(
  "OPTO_HCPL0700",
  "OPTO_HCPL0700",
  {},
  ["NC1", "NC4"],
);
importProjectLibrarySymbol("CONN8");
importProjectLibrarySymbol("CONN17");
importProjectLibrarySymbol("A3");
importProjectLibrarySymbol("RPI-PICO2W", "PICO2W", {
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
});

// Packages. Footprints are embedded so Fusion can create a PCB, but the
// prototype must not be manufactured until every land pattern is checked
// against the current manufacturer drawing and the chosen assembly process.
definePackage("R0402", smdTwoPadPackage("R0402", 1.0, 0.9, 1.2));
definePackage("R0603", smdTwoPadPackage("R0603", 1.1, 1.0, 1.8));
definePackage("C0402", smdTwoPadPackage("C0402", 1.0, 0.9, 1.2));
definePackage("C0805", smdTwoPadPackage("C0805", 1.4, 1.3, 2.2));
definePackage("PPTC1206", smdTwoPadPackage("PPTC1206", 1.6, 1.8, 2.8));
definePackage("LED0603", smdTwoPadPackage("LED0603", 1.1, 1.0, 1.8));
definePackage("SOD323", smdTwoPadPackage("SOD323", 0.8, 0.8, 2.4));
definePackage("PTS810_PRELIMINARY", lines([
  element("smd", { name: "1", x: -2.0, y: 0.8, dx: 1.2, dy: 1.5, layer: 1 }),
  element("smd", { name: "3", x: -2.0, y: -0.8, dx: 1.2, dy: 1.5, layer: 1 }),
  element("smd", { name: "2", x: 2.0, y: 0.8, dx: 1.2, dy: 1.5, layer: 1 }),
  element("smd", { name: "4", x: 2.0, y: -0.8, dx: 1.2, dy: 1.5, layer: 1 }),
  element("wire", { x1: -2.1, y1: -1.6, x2: 2.1, y2: -1.6, width: 0.1524, layer: 21 }),
  element("wire", { x1: 2.1, y1: -1.6, x2: 2.1, y2: 1.6, width: 0.1524, layer: 21 }),
  element("wire", { x1: 2.1, y1: 1.6, x2: -2.1, y2: 1.6, width: 0.1524, layer: 21 }),
  element("wire", { x1: -2.1, y1: 1.6, x2: -2.1, y2: -1.6, width: 0.1524, layer: 21 }),
  element("text", { x: -2.1, y: 2.0, size: 1.016, layer: 25 }, "&gt;NAME"),
], "          "));

definePackage("SOT23", lines([
  element("smd", { name: "1", x: -0.95, y: -1.1, dx: 1.0, dy: 1.1, layer: 1 }),
  element("smd", { name: "2", x: 0.95, y: -1.1, dx: 1.0, dy: 1.1, layer: 1 }),
  element("smd", { name: "3", x: 0, y: 1.1, dx: 1.0, dy: 1.1, layer: 1 }),
  element("wire", { x1: -1.5, y1: -0.7, x2: 1.5, y2: -0.7, width: 0.1524, layer: 21 }),
  element("wire", { x1: 1.5, y1: -0.7, x2: 1.5, y2: 0.7, width: 0.1524, layer: 21 }),
  element("wire", { x1: 1.5, y1: 0.7, x2: -1.5, y2: 0.7, width: 0.1524, layer: 21 }),
  element("wire", { x1: -1.5, y1: 0.7, x2: -1.5, y2: -0.7, width: 0.1524, layer: 21 }),
  element("circle", { x: -0.8, y: -0.3, radius: 0.2, width: 0, layer: 21 }),
  element("text", { x: -1.5, y: 1.8, size: 1.016, layer: 25 }, "&gt;NAME"),
], "          "));

definePackage("TDK_ACT45B_PRELIMINARY", lines([
  element("smd", { name: "1", x: -2.2, y: 1.1, dx: 1.2, dy: 1.0, layer: 1 }),
  element("smd", { name: "2", x: 2.2, y: 1.1, dx: 1.2, dy: 1.0, layer: 1 }),
  element("smd", { name: "4", x: -2.2, y: -1.1, dx: 1.2, dy: 1.0, layer: 1 }),
  element("smd", { name: "3", x: 2.2, y: -1.1, dx: 1.2, dy: 1.0, layer: 1 }),
  element("wire", { x1: -1.6, y1: -1.8, x2: 1.6, y2: -1.8, width: 0.1524, layer: 21 }),
  element("wire", { x1: 1.6, y1: -1.8, x2: 1.6, y2: 1.8, width: 0.1524, layer: 21 }),
  element("wire", { x1: 1.6, y1: 1.8, x2: -1.6, y2: 1.8, width: 0.1524, layer: 21 }),
  element("wire", { x1: -1.6, y1: 1.8, x2: -1.6, y2: -1.8, width: 0.1524, layer: 21 }),
  element("text", { x: -1.6, y: 2.2, size: 1.016, layer: 25 }, "&gt;NAME"),
], "          "));

const isowPads = [];
for (let index = 0; index < 10; index += 1) {
  const y = 5.715 - index * 1.27;
  isowPads.push(element("smd", { name: index + 1, x: -6.45, y, dx: 2.2, dy: 0.6, layer: 1 }));
  isowPads.push(element("smd", { name: 20 - index, x: 6.45, y, dx: 2.2, dy: 0.6, layer: 1 }));
}
isowPads.push(element("wire", { x1: -5.2, y1: -6.5, x2: 5.2, y2: -6.5, width: 0.1524, layer: 21 }));
isowPads.push(element("wire", { x1: 5.2, y1: -6.5, x2: 5.2, y2: 6.5, width: 0.1524, layer: 21 }));
isowPads.push(element("wire", { x1: 5.2, y1: 6.5, x2: -5.2, y2: 6.5, width: 0.1524, layer: 21 }));
isowPads.push(element("wire", { x1: -5.2, y1: 6.5, x2: -5.2, y2: -6.5, width: 0.1524, layer: 21 }));
isowPads.push(element("circle", { x: -4.5, y: 5.5, radius: 0.35, width: 0, layer: 21 }));
isowPads.push(element("text", { x: -5.2, y: 7.1, size: 1.016, layer: 25 }, "&gt;NAME"));
definePackage("DFM20_PRELIMINARY", lines(isowPads, "          "));

const optoPads = [];
const optoY = [1.905, 0.635, -0.635, -1.905];
for (let index = 0; index < 4; index += 1) {
  optoPads.push(element("smd", { name: index + 1, x: -2.9, y: optoY[index], dx: 1.6, dy: 0.6, layer: 1 }));
  optoPads.push(element("smd", { name: 8 - index, x: 2.9, y: optoY[index], dx: 1.6, dy: 0.6, layer: 1 }));
}
optoPads.push(element("wire", { x1: -2.0, y1: -2.6, x2: 2.0, y2: -2.6, width: 0.1524, layer: 21 }));
optoPads.push(element("wire", { x1: 2.0, y1: -2.6, x2: 2.0, y2: 2.6, width: 0.1524, layer: 21 }));
optoPads.push(element("wire", { x1: 2.0, y1: 2.6, x2: -2.0, y2: 2.6, width: 0.1524, layer: 21 }));
optoPads.push(element("wire", { x1: -2.0, y1: 2.6, x2: -2.0, y2: -2.6, width: 0.1524, layer: 21 }));
optoPads.push(element("circle", { x: -1.5, y: 2.05, radius: 0.25, width: 0, layer: 21 }));
optoPads.push(element("text", { x: -2.0, y: 3.1, size: 1.016, layer: 25 }, "&gt;NAME"));
definePackage("SOIC8_HCPL0700_PRELIMINARY", lines(optoPads, "          "));

const picoPackage = [];
for (let index = 0; index < 20; index += 1) {
  const y = 24.13 - index * 2.54;
  picoPackage.push(element("smd", { name: index + 1, x: -10.5, y, dx: 2.2, dy: 1.7, layer: 1 }));
  picoPackage.push(element("smd", { name: 40 - index, x: 10.5, y, dx: 2.2, dy: 1.7, layer: 1 }));
}
picoPackage.push(element("wire", { x1: -10.5, y1: -25.5, x2: 10.5, y2: -25.5, width: 0.254, layer: 21 }));
picoPackage.push(element("wire", { x1: 10.5, y1: -25.5, x2: 10.5, y2: 25.5, width: 0.254, layer: 21 }));
picoPackage.push(element("wire", { x1: 10.5, y1: 25.5, x2: -10.5, y2: 25.5, width: 0.254, layer: 21 }));
picoPackage.push(element("wire", { x1: -10.5, y1: 25.5, x2: -10.5, y2: -25.5, width: 0.254, layer: 21 }));
picoPackage.push(element("wire", { x1: -10.5, y1: -25.5, x2: 10.5, y2: -25.5, width: 0.254, layer: 39 }));
picoPackage.push(element("wire", { x1: 10.5, y1: -25.5, x2: 10.5, y2: -15.0, width: 0.254, layer: 39 }));
picoPackage.push(element("wire", { x1: 10.5, y1: -15.0, x2: -10.5, y2: -15.0, width: 0.254, layer: 39 }));
picoPackage.push(element("wire", { x1: -10.5, y1: -15.0, x2: -10.5, y2: -25.5, width: 0.254, layer: 39 }));
picoPackage.push(element("text", { x: -9.5, y: 26.0, size: 1.27, layer: 25 }, "&gt;NAME"));
picoPackage.push(element("text", { x: -9.5, y: -23.5, size: 1.0, layer: 21 }, "ANTENNA / COPPER KEEPOUT"));
definePackage("PICO2W_CASTELLATED_PRELIMINARY", lines(picoPackage, "          "));

definePackage("PADBANK7", padBankPackage(7));
definePackage("PADBANK17", padBankPackage(17));
definePackage("PADBANK5", padBankPackage(5));

// Import the matching Fusion-created land patterns from the maintained project
// library. Project-specific generated footprints remain in use where the
// library entry does not match the selected physical part or mounting method.
[
  "PICO_2_W_DEVELOPMENT_BOARD",
  "PTS810_J_LEAD",
  "PPTC1206_1206L050YR",
  "RESC1005X40",
  "RESC1608X60",
  "CAPC1005X60",
  "CAPC1608X85",
  "CAPC2012X110",
  "INDC1006X60N",
  "LEDC1608X55N_FLAT-B",
  "DFM0020A_TI",
  "SOT23_",
  "HCPL0700_SO8",
  "SOD323_VISHAY",
  "ACT45B_4P5X3P2",
  "B4B-XH-A",
  "B5B-XH-A",
  "PADBANK17",
].forEach(importProjectLibraryPackage);

// Devices
defineDeviceSet("RES0402", "R", "RESISTOR", "RESC1005X40", { 1: "1", 2: "2" }, "0402 resistor using project-library land pattern");
defineDeviceSet("RES0603", "R", "RESISTOR", "RESC1608X60", { 1: "1", 2: "2" }, "0603 resistor using project-library land pattern");
defineDeviceSet("CAP0402", "C", "CAPACITOR", "CAPC1005X60", { 1: "1", 2: "2" }, "0402 capacitor using project-library land pattern");
defineDeviceSet("CAP0603", "C", "CAPACITOR", "CAPC1608X85", { 1: "1", 2: "2" }, "0603 capacitor using project-library land pattern");
defineDeviceSet("CAP0805", "C", "CAPACITOR", "CAPC2012X110", { 1: "1", 2: "2" }, "0805 capacitor using project-library land pattern");
defineDeviceSet("PPTC1206", "F", "FUSE", "PPTC1206_1206L050YR", { 1: "1", 2: "2" }, "Littelfuse 1206L050YR using project-library land pattern");
defineDeviceSet("FERRITE0402", "FB", "FERRITE", "INDC1006X60N", { 1: "1", 2: "2" }, "Murata BLM15EX331SN1D using project-library land pattern");
defineDeviceSet("LED0603", "D", "LED", "LEDC1608X55N_FLAT-B", { A: "A", K: "C" }, "0603 indicator LED using project-library land pattern");
defineDeviceSet("DIODE_SOD323", "D", "DIODE", "SOD323_VISHAY", { A: "A", K: "C" }, "Vishay 1N4148WS-E3-08 using manufacturer-recommended project-library land pattern");
defineDeviceSet("SWITCH_SMD", "SW", "SWITCH", "PTS810_J_LEAD", {
  "P$1": "1",
  "P$2": "2",
  "P$3": "3",
  "P$4": "4",
}, "C&amp;K/Littelfuse PTS810SJM250SMTR LFS using project-library land pattern");
defineDeviceSet("SM712", "D", "TVS_SM712", "SOT23_", { IO1: "1", IO2: "2", GND: "3" }, "Semtech SM712.TCT RS-485 TVS using the user-supplied project-library SOT-23 package");
defineDeviceSet("CMC_OPTION", "L", "CMC", "ACT45B_4P5X3P2", { A1: "1", A2: "2", B1: "4", B2: "3" }, "TDK ACT45B-510-2P-TL003 two-line common-mode choke using project-library land pattern; normally DNP pending EMC and signal-integrity testing");
defineDeviceSet("ISOW1412DFMR", "U", "ISOW1412", "DFM0020A_TI", {
  VIO: "1", D: "2", DE: "3", R: "4", RE_N: "5", GNDIO: "6",
  EN_FLT: "8", VDD: "9", GND1: "10", GND2: "11", VISOOUT: "12",
  MODE: "13", GISOIN: "15", VISOIN: "16", Y: "17", Z: "18",
  B: "19", A: "20",
}, "TI reinforced isolated RS-485/RDM transceiver with integrated isolated DC/DC");
defineDeviceSet("PICO2W", "U", "PICO2W", "PICO_2_W_DEVELOPMENT_BOARD",
  Object.fromEntries(picoPins.map((pin) => [pin.name, String(pin.pad)])),
  "Raspberry Pi Pico 2 W development board using project-library through-hole header land pattern");
defineDeviceSet("HCPL_0700_500E", "U", "OPTO_HCPL0700", "HCPL0700_SO8", {
  A: "2", K: "3", GND: "5", VO: "6", VB: "7", VCC: "8",
}, "Broadcom HCPL-0700-500E SOIC-8 optocoupler using project-library land pattern");
defineDeviceSet(
  "FRAME_A3",
  "FRAME",
  "A3",
  undefined,
  {},
  "wagnius GmbH A3 schematic template from the maintained project library",
);

function defineConnector(count, name, packageName, description) {
  defineDeviceSet(name, "J", `CONN${count}`, packageName,
    Object.fromEntries(Array.from({ length: count }, (_, index) => [`P${index + 1}`, String(index + 1)])),
    description);
}
defineConnector(4, "PANEL_DMX4", "B4B-XH-A", "JST XH B4B-XH-A board header for the panel XLR harness");
defineConnector(5, "PANEL_MIDI5", "B5B-XH-A", "JST XH B5B-XH-A board header for the panel DIN-5 harness");
defineConnector(7, "PADBANK7", "PADBANK7", "Diagnostic SMD pad bank");
defineConnector(17, "PADBANK17", "PADBANK17", "Free GPIO SMD pad bank");
defineConnector(5, "PADBANK5", "PADBANK5", "Analog SMD pad bank");

function packagePadNames(packageXml) {
  const padNames = new Set();
  for (const match of packageXml.matchAll(/<(?:smd|pad)\b[^>]*>/g)) {
    const name = match[0].match(/\bname="([^"]+)"/)?.[1];
    if (name) padNames.add(name);
  }
  return padNames;
}

for (const device of deviceSets.values()) {
  if (!device.packageName) continue;
  const packageXml = packages.get(device.packageName);
  if (!packageXml) {
    throw new Error(
      `Device set ${device.name} references missing package ${device.packageName}`,
    );
  }
  const padNames = packagePadNames(packageXml);
  for (const [pin, mappedPads] of Object.entries(device.connects)) {
    for (const pad of String(mappedPads).split(/\s+/).filter(Boolean)) {
      if (!padNames.has(pad)) {
        throw new Error(
          `Device set ${device.name} maps pin ${pin} to missing `
          + `package pad ${device.packageName}.${pad}`,
        );
      }
    }
  }
}

// The maintained A3 frame is a schematic-only component and must appear once
// per sheet. It intentionally has no PCB package.
addPart("FRAME1", "FRAME_A3", "", 1, 0, 0);
addPart("FRAME2", "FRAME_A3", "", 2, 0, 0);
addPart("FRAME3", "FRAME_A3", "", 3, 0, 0);

// Parts and placement: sheet 1, controller/power/status/expansion
addPart("U1", "PICO2W", "Raspberry Pi Pico 2 W", 1, 76.2, 101.6);
addPart("F1", "PPTC1206", "1206L050YR 0.5A HOLD", 1, 137.16, 172.72);
addPart("SW1", "SWITCH_SMD", "PTS810SJM250SMTR LFS RESET (NO)", 1, 137.16, 157.48);
addPart("R8", "RES0402", "1k 1% 0.063W 0402 Yageo RC0402FR-071KL", 1, 132.08, 139.7);
addPart("D3", "LED0603", "PWR GREEN Lite-On LTST-C190KGKT", 1, 208.28, 139.7);
addPart("R9", "RES0402", "1k 1% 0.063W 0402 Yageo RC0402FR-071KL", 1, 182.88, 124.46);
addPart("D4", "LED0603", "DMX YELLOW Lite-On LTST-C190KSKT", 1, 254, 124.46);
addPart("J3", "PADBANK17", "FREE GPIO PADS", 1, 320.04, 134.62);
addPart("J4", "PADBANK5", "ANALOG PADS", 1, 213.36, 71.12);
addPart("J5", "PADBANK7", "RESERVED SIGNAL TEST PADS", 1, 213.36, 33.02);

// Sheet 2, isolated DMX/RDM
addPart("U2", "ISOW1412DFMR", "ISOW1412DFMR", 2, 111.76, 101.6);
addPart("R1", "RES0402", "100k 1% 0.063W 0402 Yageo RC0402FR-07100KL", 2, 50.8, 157.48);
addPart("R2", "RES0402", "10k 1% 0.063W 0402 Yageo RC0402FR-0710KL", 2, 50.8, 142.24);
addPart("R3", "RES0402", "10k 1% 0.063W 0402 Yageo RC0402FR-0710KL", 2, 50.8, 127);
addPart("C1", "CAP0402", "100nF 16V 10% X7R 0402 CL05B104KO5NNNC VIO", 2, 50.8, 111.76);
addPart("C2", "CAP0402", "10nF 50V 10% X7R 0402 0402B103K500CT VDD <1mm", 2, 50.8, 96.52);
addPart("C3", "CAP0805", "10uF 35V 10% X5R 0805 GRM21BR6YA106KE43L VDD", 2, 50.8, 81.28);
addPart("C8", "CAP0603", "1uF 50V 10% X5R 0603 CL10A105KB8NNNC VDD 2-4mm", 2, 50.8, 66.04);
addPart("FB1", "FERRITE0402", "BLM15EX331SN1D", 2, 172.72, 149.86);
addPart("FB2", "FERRITE0402", "BLM15EX331SN1D", 2, 172.72, 134.62);
addPart("C4", "CAP0402", "10nF 50V 10% X7R 0402 0402B103K500CT VISOOUT <1mm", 2, 264.16, 149.86);
addPart("C5", "CAP0805", "10uF 35V 10% X5R 0805 GRM21BR6YA106KE43L VISOOUT", 2, 264.16, 134.62);
addPart("C6", "CAP0402", "100nF 16V 10% X7R 0402 CL05B104KO5NNNC VISOIN", 2, 264.16, 119.38);
addPart("C9", "CAP0603", "1uF 50V 10% X5R 0603 CL10A105KB8NNNC VISOOUT 2-4mm", 2, 264.16, 104.14);
addPart("L1", "CMC_OPTION", "ACT45B-510-2P-TL003 - DNP", 2, 223.52, 91.44);
addPart("R10", "RES0402", "0R 5% 0.063W 0402 Yageo RC0402JR-070RL CMC BYPASS FIT", 2, 172.72, 76.2);
addPart("R11", "RES0402", "0R 5% 0.063W 0402 Yageo RC0402JR-070RL CMC BYPASS FIT", 2, 172.72, 60.96);
addPart("D1", "SM712", "SM712.TCT", 2, 314.96, 91.44);
addPart("J1", "PANEL_DMX4", "JST XH B4B-XH-A DMX: COM,-,+,SHELL", 2, 381, 91.44);

// Sheet 3, MIDI input
addPart("J2", "PANEL_MIDI5", "JST XH B5B-XH-A MIDI: 1,2,3,4,5", 3, 45.72, 101.6);
addPart("R4", "RES0402", "220R 1% 0.063W 0402 Yageo RC0402FR-07220RL", 3, 83.82, 116.84);
addPart("R5", "RES0402", "220R 1% 0.063W 0402 Yageo RC0402FR-07220RL", 3, 83.82, 86.36);
addPart("D2", "DIODE_SOD323", "1N4148WS-E3-08", 3, 111.76, 101.6);
addPart("U3", "HCPL_0700_500E", "HCPL-0700-500E", 3, 157.48, 101.6);
addPart("R6", "RES0402", "4.7k 1% 0.063W 0402 Yageo RC0402FR-074K7L", 3, 203.2, 119.38);
addPart("R7", "RES0402", "47k 1% 0.063W 0402 Yageo RC0402FR-0747KL", 3, 203.2, 101.6);
addPart("C7", "CAP0402", "100nF 16V 10% X7R 0402 CL05B104KO5NNNC MIDI VCC", 3, 203.2, 83.82);

// Controller and expansion connectivity
connectMany("GND_LOGIC", [
  ["U1", "GND3"], ["U1", "GND8"], ["U1", "GND13"], ["U1", "GND18"],
  ["U1", "GND23"], ["U1", "GND28"], ["U1", "GND38"],
  ["SW1", "P$3"], ["SW1", "P$4"],
  ["D3", "K"], ["D4", "K"],
  ["U2", "GNDIO"], ["U2", "GND1"], ["R2", "2"], ["C1", "2"], ["C2", "2"],
  ["C3", "2"], ["C8", "2"], ["U3", "GND"], ["R7", "2"], ["C7", "2"],
]);
connectMany("VCC_3V3_LOGIC", [
  ["U1", "3V3"], ["R8", "1"], ["U2", "VIO"], ["R1", "1"],
  ["R3", "1"], ["C1", "1"], ["R6", "1"],
]);
connectMany("VBUS_5V_USB", [["U1", "VBUS"], ["F1", "1"], ["U3", "VCC"], ["C7", "1"]]);
connectMany("VDD_5V_ISOW_FUSED", [["F1", "2"], ["U2", "VDD"], ["C2", "1"], ["C3", "1"], ["C8", "1"]]);
connectMany("PICO_RUN_N", [
  ["U1", "RUN"], ["SW1", "P$1"], ["SW1", "P$2"],
]);
connectMany("PWR_LED_ANODE", [["R8", "2"], ["D3", "A"]]);
connectMany("DMX_ACTIVITY_GPIO7", [["U1", "GP7"], ["R9", "1"], ["J5", "P6"]]);
connectMany("DMX_LED_ANODE", [["R9", "2"], ["D4", "A"]]);
connectMany("DMX_TX_GPIO2", [["U1", "GP2"], ["U2", "D"], ["R1", "2"], ["J5", "P1"]]);
connectMany("DMX_TRIGGER_GPIO3", [["U1", "GP3"], ["J5", "P2"]]);
connectMany("DMX_DIR_GPIO4", [["U1", "GP4"], ["U2", "DE"], ["U2", "RE_N"], ["R2", "1"], ["J5", "P3"]]);
connectMany("MIDI_RX_GPIO5", [["U1", "GP5"], ["U3", "VO"], ["R6", "2"], ["J5", "P4"]]);
connectMany("DMX_RX_GPIO6", [["U1", "GP6"], ["U2", "R"], ["J5", "P5"]]);
connectMany("ISOW_EN_FLT", [["U2", "EN_FLT"], ["R3", "2"], ["J5", "P7"]]);
connectMany("ADC0_GPIO26", [["U1", "GP26_ADC0"], ["J4", "P1"]]);
connectMany("ADC1_GPIO27", [["U1", "GP27_ADC1"], ["J4", "P2"]]);
connectMany("ADC2_GPIO28", [["U1", "GP28_ADC2"], ["J4", "P3"]]);
connectMany("ADC_VREF", [["U1", "ADC_VREF"], ["J4", "P4"]]);
connectMany("AGND", [["U1", "AGND"], ["J4", "P5"]]);
connectMany("PICO_SMPS_EN", [["U1", "3V3_EN"]]);
connectMany("PICO_VSYS", [["U1", "VSYS"]]);

const freeGpios = [0, 1, ...Array.from({ length: 15 }, (_, index) => index + 8)];
freeGpios.forEach((gpio, index) => connectMany(`GPIO${gpio}_EXP`, [["U1", `GP${gpio}`], ["J3", `P${index + 1}`]]));

// Isolated side and DMX connector
connectMany("VISO_5V_CONVERTER", [["U2", "VISOOUT"], ["U2", "MODE"], ["FB1", "1"], ["C4", "1"], ["C5", "1"], ["C9", "1"]]);
connectMany("GND_DMX_CONVERTER", [["U2", "GND2"], ["FB2", "1"], ["C4", "2"], ["C5", "2"], ["C9", "2"]]);
connectMany("VCC_5V_DMX_ISO", [["FB1", "2"], ["U2", "VISOIN"], ["C6", "1"]]);
connectMany("GND_DMX_ISO", [
  ["FB2", "2"], ["U2", "GISOIN"], ["C6", "2"], ["D1", "GND"], ["J1", "P1"],
]);
connectMany("DMX_TRX_PLUS", [["U2", "Y"], ["U2", "A"], ["L1", "A1"], ["R10", "1"]]);
connectMany("DMX_TRX_MINUS", [["U2", "Z"], ["U2", "B"], ["L1", "B1"], ["R11", "1"]]);
connectMany("DMX_DATA_PLUS", [["L1", "A2"], ["R10", "2"], ["D1", "IO1"], ["J1", "P3"]]);
connectMany("DMX_DATA_MINUS", [["L1", "B2"], ["R11", "2"], ["D1", "IO2"], ["J1", "P2"]]);
connectMany("XLR_SHELL", [["J1", "P4"]]);

// MIDI input
connectMany("MIDI_DIN_PIN1_SPARE", [["J2", "P1"]]);
connectMany("MIDI_DIN_PIN2_SHIELD", [["J2", "P2"]]);
connectMany("MIDI_DIN_PIN3_SPARE", [["J2", "P3"]]);
connectMany("MIDI_DIN_PIN4", [["J2", "P4"], ["R4", "1"]]);
connectMany("MIDI_OPTO_LED_ANODE", [["R4", "2"], ["U3", "A"], ["D2", "K"]]);
connectMany("MIDI_OPTO_LED_CATHODE", [["U3", "K"], ["D2", "A"], ["R5", "1"]]);
connectMany("MIDI_DIN_PIN5", [["R5", "2"], ["J2", "P5"]]);
connectMany("MIDI_OPTO_BASE", [["U3", "VB"], ["R7", "1"]]);

addNote(1, 20.32, 187.96, "WiFiPicoDMX Rev. A — Controller, power, controls and expansion", 2.54, 15);
addNote(1, 20.32, 15.24, "Power only through Pico Micro-USB. Do not feed VSYS/VBUS from the carrier.");
addNote(1, 20.32, 10.16, "Verify every project-library and generated land pattern against the selected manufacturer part before PCB release.");
addNote(1, 20.32, 5.08, "Use the Pico 2 W development board's onboard BOOTSEL button below the USB connector; preserve finger/tool access in the PCB and enclosure.");

addNote(2, 20.32, 187.96, "WiFiPicoDMX Rev. A — Reinforced-isolated DMX/RDM output", 2.54, 15);
addNote(2, 20.32, 20.32, "Default: FIT R10/R11 (0R), DNP L1. L1 option is TDK ACT45B-510-2P-TL003; fit it only after EMC/signal-integrity testing.");
addNote(2, 20.32, 15.24, "No permanent 120R termination: terminate only at the far end of the DMX cable.");
addNote(2, 20.32, 10.16, "Keep GND_LOGIC and GND_DMX_ISO separate. Preserve TI isolation keep-outs and place bypass parts per TI layout.");
addNote(2, 20.32, 5.08, "J1 pad order: P1 DMX COM/XLR1, P2 DMX-/XLR2, P3 DMX+/XLR3, P4 shell. Panel connector is wired, not PCB-mounted.");

addNote(3, 20.32, 187.96, "WiFiPicoDMX Rev. A — Isolated MIDI IN", 2.54, 15);
addNote(3, 20.32, 20.32, "J2 exposes all five panel DIN pins. Pins 1/3 are NC; pin 2 shield treatment remains configurable.");
addNote(3, 20.32, 15.24, "HCPL-0700 output side uses 5V VCC with a 3.3V output pull-up. Verify timing/CTR on the assembled prototype.");
addNote(3, 20.32, 10.16, "The DIN input current loop remains galvanically isolated from GND_LOGIC.");

function symbolXml(symbol) {
  const body = symbol.body;
  if (body.rawXml) {
    return element(
      "symbol",
      { name: symbol.name },
      `\n${lines([body.rawXml], "              ")}\n            `,
    );
  }
  const shape = [];
  if (body.x1 !== undefined) {
    shape.push(element("wire", { x1: body.x1, y1: body.y1, x2: body.x2, y2: body.y1, width: 0.254, layer: 94 }));
    shape.push(element("wire", { x1: body.x2, y1: body.y1, x2: body.x2, y2: body.y2, width: 0.254, layer: 94 }));
    shape.push(element("wire", { x1: body.x2, y1: body.y2, x2: body.x1, y2: body.y2, width: 0.254, layer: 94 }));
    shape.push(element("wire", { x1: body.x1, y1: body.y2, x2: body.x1, y2: body.y1, width: 0.254, layer: 94 }));
  }
  if (body.label) {
    shape.push(element("text", { x: -1.27, y: -0.635, size: 1.27, layer: 94, align: "center" }, body.label));
  }
  shape.push(element("text", { x: body.x1 ?? -2.54, y: (body.y2 ?? 2.54) + 2.54, size: 1.778, layer: 95 }, "&gt;NAME"));
  shape.push(element("text", { x: body.x1 ?? -2.54, y: (body.y1 ?? -2.54) - 3.81, size: 1.27, layer: 96 }, "&gt;VALUE"));
  symbol.pins.forEach((pin) => shape.push(element("pin", {
    name: pin.name,
    x: pin.x,
    y: pin.y,
    visible: "pin",
    length: "middle",
    direction: pinDirections[pin.direction] ?? "pas",
    rot: pin.rot,
  })));
  return element("symbol", { name: symbol.name }, `\n${lines(shape, "              ")}\n            `);
}

function deviceSetXml(device) {
  const connectXml = Object.entries(device.connects).map(([pin, pad]) =>
    element("connect", { gate: "G$1", pin, pad }));
  const connectsBlock = connectXml.length > 0
    ? `                  <connects>
${lines(connectXml, "                    ")}
                  </connects>
`
    : "";
  const package3dXml = device.package3dUrn
    ? `                  <package3dinstances>
                    ${element("package3dinstance", { package3d_urn: device.package3dUrn })}
                  </package3dinstances>
`
    : "";
  const deviceAttributes = { name: "" };
  if (device.packageName) deviceAttributes.package = device.packageName;
  return element("deviceset", { name: device.name, prefix: device.prefix }, `
              ${element("description", {}, device.description)}
              <gates>
                ${element("gate", { name: "G$1", symbol: device.symbol, x: 0, y: 0 })}
              </gates>
              <devices>
                <device ${attrs(deviceAttributes)}>
${connectsBlock}${package3dXml}                  <technologies>
                    <technology name=""/>
                  </technologies>
                </device>
              </devices>
            `);
}

const partMap = new Map(parts.map((part) => [part.name, part]));
const instanceMap = new Map(instances.map((instance) => [instance.name, instance]));

function endpointFor(partName, pinName) {
  const part = partMap.get(partName);
  const instance = instanceMap.get(partName);
  const device = deviceSets.get(part.deviceSet);
  const symbol = symbols.get(device.symbol);
  const pin = symbol.pins.find((candidate) => candidate.name === pinName);
  if (!pin) throw new Error(`Unknown pin ${partName}.${pinName}`);
  if (instance.rotation !== "R0") {
    throw new Error(`Stub generation currently expects R0 instances: ${partName}`);
  }
  const x = instance.x + pin.x;
  const y = instance.y + pin.y;
  let x2 = x;
  let y2 = y;
  let labelRotation = "R0";

  const pinXs = symbol.pins.map((candidate) => candidate.x);
  const minPinX = Math.min(...pinXs);
  const maxPinX = Math.max(...pinXs);
  const tolerance = 0.001;
  let side;
  if (maxPinX - minPinX > tolerance) {
    if (Math.abs(pin.x - minPinX) <= tolerance) side = "left";
    if (Math.abs(pin.x - maxPinX) <= tolerance) side = "right";
  } else if (pin.x < -tolerance) {
    side = "left";
  } else if (pin.x > tolerance) {
    side = "right";
  }

  if (!side) {
    if (pin.rot === "R0") side = "left";
    if (pin.rot === "R180") side = "right";
    if (pin.rot === "R90") side = "bottom";
    if (pin.rot === "R270") side = "top";
  }

  if (side === "left") {
    x2 -= 5.08;
    labelRotation = "R180";
  }
  if (side === "right") {
    x2 += 5.08;
  }
  if (side === "bottom") {
    y2 -= 5.08;
    labelRotation = "R270";
  }
  if (side === "top") {
    y2 += 5.08;
    labelRotation = "R90";
  }
  if (!side) throw new Error(`Cannot determine symbol side for ${partName}.${pinName}`);

  return { x, y, x2, y2, labelRotation };
}

function sheetXml(sheetNumber) {
  const sheetInstances = instances.filter((instance) => instance.sheet === sheetNumber);
  const instanceXml = sheetInstances.map((instance) => element("instance", {
    part: instance.name,
    gate: instance.gate,
    x: instance.x,
    y: instance.y,
    rot: instance.rotation,
    smashed: "no",
  }));
  const noteXml = (notes.get(sheetNumber) ?? []).map((note) => element("text", {
    x: note.x,
    y: note.y,
    size: note.size,
    layer: 91,
    ratio: note.ratio,
  }, note.text));

  const netXml = [];
  for (const [netName, refs] of [...connections.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sheetRefs = refs.filter((ref) => instanceMap.get(ref.part).sheet === sheetNumber);
    if (sheetRefs.length === 0) continue;
    const segments = sheetRefs.map((ref) => {
      const endpoint = endpointFor(ref.part, ref.pin);
      return `<segment>
                  ${element("pinref", { part: ref.part, gate: "G$1", pin: ref.pin })}
                  ${element("wire", { x1: endpoint.x, y1: endpoint.y, x2: endpoint.x2, y2: endpoint.y2, width: 0.1524, layer: 91 })}
                  ${element("label", {
                    x: endpoint.x2,
                    y: endpoint.y2,
                    size: 1.27,
                    layer: 95,
                    xref: "yes",
                    rot: endpoint.labelRotation === "R0"
                      ? undefined
                      : endpoint.labelRotation,
                  })}
                </segment>`;
    });
    netXml.push(`<net name="${esc(netName)}" class="0">
${lines(segments, "              ")}
            </net>`);
  }

  return `<sheet>
          <plain>
${lines(noteXml, "            ")}
          </plain>
          <instances>
${lines(instanceXml, "            ")}
          </instances>
          <busses/>
          <nets>
${lines(netXml, "            ")}
          </nets>
        </sheet>`;
}

const usedPackageNames = new Set(
  [...deviceSets.values()]
    .map((device) => device.packageName)
    .filter(Boolean),
);
const usedPackage3dModels = new Map();
for (const packageName of usedPackageNames) {
  const model = projectLibrary3dByPackage.get(packageName);
  if (model) usedPackage3dModels.set(model.urn, model.xml);
}

const libraryXml = `<library name="${designLibraryName}">
          <description>Embedded copy of the WiFiPicoDMX Rev. A used-component library. The matching standalone library is hardware/fusion/WiFiPicoDMX_RevA_used.lbr. Verify every footprint before PCB manufacture.</description>
          <packages>
${lines([...packages.entries()]
    .filter(([name]) => usedPackageNames.has(name))
    .map(([name, content]) => `<package name="${esc(name)}">
${content}
            </package>`), "            ")}
          </packages>
          <packages3d>
${lines([...usedPackage3dModels.values()], "            ")}
          </packages3d>
          <symbols>
${lines([...symbols.values()].map(symbolXml), "            ")}
          </symbols>
          <devicesets>
${lines([...deviceSets.values()].map(deviceSetXml), "            ")}
          </devicesets>
        </library>`;

const layerDefinitions = [
  [1, "Top", 4, 1], [16, "Bottom", 1, 1], [17, "Pads", 2, 1],
  [18, "Vias", 2, 1], [19, "Unrouted", 6, 1], [20, "Dimension", 15, 1],
  [21, "tPlace", 7, 1], [22, "bPlace", 7, 1], [25, "tNames", 7, 1],
  [27, "tValues", 7, 1], [29, "tStop", 7, 3], [31, "tCream", 7, 4],
  [39, "tKeepout", 4, 11], [41, "tRestrict", 4, 10], [44, "Drills", 7, 1],
  [45, "Holes", 7, 1], [90, "Modules", 5, 1], [91, "Nets", 2, 1],
  [92, "Busses", 1, 1], [93, "Pins", 2, 1], [94, "Symbols", 4, 1],
  [95, "Names", 7, 1], [96, "Values", 7, 1],
].map(([number, name, color, fill]) => element("layer", {
  number, name, color, fill, visible: "yes", active: "yes",
}));

const partsXml = parts.map((part) => element("part", {
  name: part.name,
  library: designLibraryName,
  deviceset: part.deviceSet,
  device: "",
  value: part.value,
}));

const schematic = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE eagle SYSTEM "eagle.dtd">
<eagle version="9.6.2">
  <drawing>
    <settings>
      <setting alwaysvectorfont="no"/>
      <setting verticaltext="up"/>
    </settings>
    <grid distance="0.1" unitdist="inch" unit="inch" style="lines" multiple="1" display="yes" altdistance="0.01" altunitdist="inch" altunit="inch"/>
    <layers>
${lines(layerDefinitions, "      ")}
    </layers>
    <schematic xreflabel="%F%N/%S.%C%R" xrefpart="/%S.%C%R">
      <description>WiFiPicoDMX Rev. A preliminary Fusion/EAGLE schematic. Generated from docs/hardware/SCHEMATIC_DESIGN.md. Electrical review and manufacturer footprint verification are mandatory before PCB release.</description>
      <libraries>
        ${libraryXml}
      </libraries>
      <attributes/>
      <variantdefs/>
      <classes>
        <class number="0" name="default" width="0.25" drill="0.3">
          <clearance class="0" value="0.2"/>
        </class>
      </classes>
      <parts>
${lines(partsXml, "        ")}
      </parts>
      <sheets>
${lines([sheetXml(1), sheetXml(2), sheetXml(3)], "        ")}
      </sheets>
      <errors/>
    </schematic>
  </drawing>
</eagle>
`;

function physicalPad(partName, pinName) {
  const part = partMap.get(partName);
  const device = deviceSets.get(part.deviceSet);
  const pad = device.connects[pinName];
  if (pad === undefined) {
    throw new Error(`No physical package pad for ${partName}.${pinName}`);
  }
  return String(pad);
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const sortedConnections = [...connections.entries()]
  .sort(([left], [right]) => left.localeCompare(right));

const csvRows = [
  ["net", "reference", "symbol_pin", "physical_pad", "value"],
];
for (const [netName, refs] of sortedConnections) {
  for (const ref of [...refs].sort((left, right) =>
    left.part.localeCompare(right.part, undefined, { numeric: true })
      || left.pin.localeCompare(right.pin, undefined, { numeric: true }))) {
    csvRows.push([
      netName,
      ref.part,
      ref.pin,
      physicalPad(ref.part, ref.pin),
      partMap.get(ref.part).value,
    ]);
  }
}
const netlistCsv = `${csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;

const markdownRows = sortedConnections.map(([netName, refs]) => {
  const endpoints = [...refs]
    .sort((left, right) =>
      left.part.localeCompare(right.part, undefined, { numeric: true })
        || left.pin.localeCompare(right.pin, undefined, { numeric: true }))
    .map((ref) => `${ref.part}.${physicalPad(ref.part, ref.pin)} (${ref.pin})`)
    .join("<br>");
  return `| \`${netName}\` | ${endpoints} |`;
});

const referenceRows = [...parts]
  .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
  .map((part) => {
    const device = deviceSets.get(part.deviceSet);
    return `| ${part.name} | ${part.value.replaceAll("|", "\\|")} | ${device.packageName} |`;
  });

const netlistMarkdown = `# WiFiPicoDMX Rev. A net list

This is the human-readable electrical handoff for redrawing the Rev. A
schematic in Autodesk Fusion Electronics. The CSV beside this file contains
one row per physical endpoint.

Endpoint notation is \`reference.physical-pad (symbol-pin)\`. For example,
\`U1.40 (VBUS)\` means physical Pico pad 40, whose symbol name is \`VBUS\`.

## Mandatory review before PCB manufacture

- Verify every IC and protection-device physical pin number against the
  current manufacturer datasheet.
- Verify the panel connector harness numbering at both ends. The carrier pads
  are not the panel connector footprints.
- Keep \`GND_LOGIC\`, \`GND_DMX_ISO\`, \`XLR_SHELL\`, and
  \`MIDI_DIN_PIN2_SHIELD\` distinct unless the enclosure design explicitly
  requires an approved connection.
- Fit R10 and R11 as the default 0 ohm DMX paths. L1 is the selected
  TDK ACT45B-510-2P-TL003 common-mode-choke option, normally DNP until EMC and
  signal-integrity tests justify fitting it. Never populate L1 and the two
  bypass resistors simultaneously.
- Use the Pico 2 W development board's onboard BOOTSEL button below its USB
  connector. Preserve physical access in the PCB and enclosure.
- Recheck every footprint against the current manufacturer drawing before
  fabrication even where the library geometry has been verified.

## References

| Reference | Value / function | Package |
|---|---|---|
${referenceRows.join("\n")}

## Nets

| Net | Physical endpoints |
|---|---|
${markdownRows.join("\n")}
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, schematic, "utf8");
writeFileSync(netlistCsvPath, netlistCsv, "utf8");
writeFileSync(netlistMarkdownPath, netlistMarkdown, "utf8");
console.log(`Generated ${outputPath}`);
console.log(`Generated ${netlistCsvPath}`);
console.log(`Generated ${netlistMarkdownPath}`);
console.log(`${parts.length} parts, ${connections.size} named nets, 3 sheets`);
