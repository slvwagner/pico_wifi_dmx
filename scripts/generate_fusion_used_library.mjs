import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const schematicPath = resolve("hardware/fusion/WiFiPicoDMX_RevA.sch");
const outputPath = resolve(
  "hardware/fusion/WiFiPicoDMX_RevA_used.lbr",
);
const schematic = readFileSync(schematicPath, "utf8");

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function namedElements(xml, tagName) {
  return new Map(
    [...xml.matchAll(
      new RegExp(
        `<${tagName}\\b([^>]*)>[\\s\\S]*?<\\/${tagName}>`,
        "g",
      ),
    )].map((match) => {
      const name = match[1].match(/\bname="([^"]+)"/)?.[1];
      if (!name) throw new Error(`${tagName} without a name attribute`);
      return [name, match[0]];
    }),
  );
}

function requiredMatch(xml, expression, description) {
  const match = xml.match(expression);
  if (!match) throw new Error(`Missing ${description} in ${schematicPath}`);
  return match[0];
}

function indent(xml, spaces) {
  const prefix = " ".repeat(spaces);
  const normalized = xml.trim().replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const nonEmpty = lines.filter((line) => line.trim());
  const existingIndent = Math.min(
    ...nonEmpty.map((line) => line.match(/^\s*/)[0].length),
  );
  return lines
    .map((line) => `${prefix}${line.slice(existingIndent)}`)
    .join("\n");
}

const eagleVersion = schematic.match(/<eagle\b[^>]*\bversion="([^"]+)"/)?.[1];
if (!eagleVersion) throw new Error(`Missing EAGLE version in ${schematicPath}`);

const embeddedLibrary = requiredMatch(
  schematic,
  /<library\b[^>]*\bname="WiFiPicoDMX_RevA_used"[^>]*>[\s\S]*?<\/library>/,
  "embedded Rev. A library",
);
const allDeviceSets = namedElements(embeddedLibrary, "deviceset");
const allSymbols = namedElements(embeddedLibrary, "symbol");
const allPackages = namedElements(embeddedLibrary, "package");
const allPackage3d = namedElements(embeddedLibrary, "package3d");

const usedDeviceSetNames = new Set(
  [...schematic.matchAll(/<part\b[^>]*\bdeviceset="([^"]+)"/g)]
    .map((match) => match[1]),
);
const selectedDeviceSets = [...usedDeviceSetNames].map((name) => {
  const xml = allDeviceSets.get(name);
  if (!xml) throw new Error(`Used device set ${name} is missing`);
  return xml;
});

const usedSymbolNames = new Set();
const usedPackageNames = new Set();
for (const deviceSet of selectedDeviceSets) {
  for (const match of deviceSet.matchAll(
    /<gate\b[^>]*\bsymbol="([^"]+)"/g,
  )) {
    usedSymbolNames.add(match[1]);
  }
  for (const match of deviceSet.matchAll(
    /<device\b[^>]*\bpackage="([^"]+)"/g,
  )) {
    usedPackageNames.add(match[1]);
  }
}

const selectedSymbols = [...usedSymbolNames].map((name) => {
  const xml = allSymbols.get(name);
  if (!xml) throw new Error(`Used symbol ${name} is missing`);
  return xml;
});
const selectedPackages = [...usedPackageNames].map((name) => {
  const xml = allPackages.get(name);
  if (!xml) throw new Error(`Used package ${name} is missing`);
  return xml;
});
const selectedPackage3d = [...allPackage3d.values()].filter((xml) =>
  [...xml.matchAll(/<packageinstance\b[^>]*\bname="([^"]+)"/g)]
    .some((match) => usedPackageNames.has(match[1]))
);

const settings = requiredMatch(
  schematic,
  /<settings>[\s\S]*?<\/settings>/,
  "settings",
);
const grid = requiredMatch(schematic, /<grid\b[^>]*\/>/, "grid");
const layers = requiredMatch(
  schematic,
  /<layers>[\s\S]*?<\/layers>/,
  "layers",
);

const sections = [
  "      <description>Generated WiFiPicoDMX Rev. A library containing only the symbols, packages, 3D associations, and device sets used by the current schematic. Regenerate with scripts/generate_fusion_used_library.mjs.</description>",
  "      <packages>",
  ...selectedPackages.map((xml) => indent(xml, 8)),
  "      </packages>",
];
if (selectedPackage3d.length > 0) {
  sections.push(
    "      <packages3d>",
    ...selectedPackage3d.map((xml) => indent(xml, 8)),
    "      </packages3d>",
  );
}
sections.push(
  "      <symbols>",
  ...selectedSymbols.map((xml) => indent(xml, 8)),
  "      </symbols>",
  "      <devicesets>",
  ...selectedDeviceSets.map((xml) => indent(xml, 8)),
  "      </devicesets>",
);

const output = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<!DOCTYPE eagle SYSTEM "eagle.dtd">',
  `<eagle version="${eagleVersion}">`,
  "  <drawing>",
  indent(settings, 4),
  indent(grid, 4),
  indent(layers, 4),
  "    <library>",
  ...sections,
  "    </library>",
  "  </drawing>",
  "</eagle>",
  "",
].join("\n");

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, output, "utf8");

console.log(
  `Wrote ${outputPath} with ${selectedDeviceSets.length} device sets, `
  + `${selectedSymbols.length} symbols, ${selectedPackages.length} packages, `
  + `and ${selectedPackage3d.length} 3D associations.`,
);
