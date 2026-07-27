import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const schematicPath = resolve("hardware/fusion/WiFiPicoDMX_RevA.sch");
const netlistPath = resolve("hardware/fusion/WiFiPicoDMX_RevA_netlist.csv");
const libraryPath = resolve("hardware/fusion/libraries/WiFiPicoDMX.lbr");
const outputPath = resolve("hardware/fusion/WiFiPicoDMX_RevA.brd");

const schematic = readFileSync(schematicPath, "utf8");
const netlist = readFileSync(netlistPath, "utf8");
const library = readFileSync(libraryPath, "utf8");

const esc = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const unesc = (value) => String(value)
  .replaceAll("&quot;", '"')
  .replaceAll("&gt;", ">")
  .replaceAll("&lt;", "<")
  .replaceAll("&amp;", "&");

function tagAttributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/(\w+)="([^"]*)"/g)]
      .map((match) => [match[1], unesc(match[2])]),
  );
}

function csvFields(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

const placements = {
  C1: [80, 66.5, "R90"],
  C2: [80.5, 59, "R90"],
  C3: [75.5, 59, "R90"],
  C4: [95.5, 59, "R90"],
  C5: [100.5, 59, "R90"],
  C6: [99, 65.5, "R90"],
  C7: [77, 8, "R90"],
  C8: [78, 59, "R90"],
  C9: [98, 59, "R90"],
  D1: [124, 64, "R0"],
  D2: [61, 13, "R0"],
  D3: [43, 40, "R0"],
  D4: [43, 34, "R0"],
  F1: [36, 49, "R0"],
  FB1: [96, 68, "R0"],
  FB2: [96, 65, "R0"],
  J1: [140, 64, "R0"],
  J2: [48, 12, "R0"],
  J3: [52, 75, "R0"],
  J4: [62, 91, "R0"],
  J5: [70, 90, "R0"],
  J6: [88, 90, "R0"],
  L1: [111, 64, "R0"],
  R1: [79, 71, "R0"],
  R2: [79, 68, "R0"],
  R3: [79, 64, "R0"],
  R4: [58, 17, "R0"],
  R5: [58, 7, "R0"],
  R6: [77, 16, "R0"],
  R7: [77, 12, "R0"],
  R8: [36, 40, "R0"],
  R9: [36, 34, "R0"],
  R10: [108, 61, "R0"],
  R11: [108, 58, "R0"],
  SW1: [34, 24, "R0"],
  U1: [18, 25.5, "R0"],
  U2: [88, 64, "R0"],
  U3: [68, 13, "R0"],
};

const layers = library.match(/<layers>([\s\S]*?)<\/layers>/)?.[1];
const libraries = schematic.match(/<libraries>([\s\S]*?)<\/libraries>/)?.[1];
if (!layers || !libraries) {
  throw new Error("Could not extract layers or embedded library data");
}

const devicePackages = new Map();
for (const match of libraries.matchAll(
  /<deviceset\b([^>]*)>([\s\S]*?)<\/deviceset>/g,
)) {
  const deviceSetName = tagAttributes(match[1]).name;
  const packageName = match[2].match(
    /<device\b[^>]*\bpackage="([^"]+)"/,
  )?.[1];
  if (deviceSetName && packageName) {
    devicePackages.set(deviceSetName, packageName);
  }
}

const physicalParts = [];
for (const match of schematic.matchAll(/<part\b([^>]*)\/>/g)) {
  const part = tagAttributes(match[1]);
  const packageName = devicePackages.get(part.deviceset);
  if (!packageName) continue;
  const placement = placements[part.name];
  if (!placement) {
    throw new Error(`No board placement defined for ${part.name}`);
  }
  physicalParts.push({
    ...part,
    packageName,
    x: placement[0],
    y: placement[1],
    rotation: placement[2],
  });
}

const unusedPlacements = Object.keys(placements)
  .filter((name) => !physicalParts.some((part) => part.name === name));
if (unusedPlacements.length > 0) {
  throw new Error(`Placements do not match schematic: ${unusedPlacements.join(", ")}`);
}

const packageBodies = new Map(
  [...libraries.matchAll(/<package\b([^>]*)>([\s\S]*?)<\/package>/g)]
    .map((match) => [tagAttributes(match[1]).name, match[2]]),
);

function dynamicText(packageName, marker, fallback) {
  const body = packageBodies.get(packageName);
  if (!body) throw new Error(`Package ${packageName} is missing`);
  const match = body.match(
    new RegExp(`<text\\b([^>]*)>&gt;${marker}<\\/text>`),
  );
  return match ? { ...fallback, ...tagAttributes(match[1]) } : fallback;
}

function rotatePoint(x, y, rotation) {
  if (rotation === "R0") return [x, y];
  if (rotation === "R90") return [-y, x];
  if (rotation === "R180") return [-x, -y];
  if (rotation === "R270") return [y, -x];
  throw new Error(`Unsupported placement rotation ${rotation}`);
}

function combinedRotation(textRotation = "R0", partRotation = "R0") {
  const angle = (rotation) => Number(rotation.slice(1));
  return `R${(angle(textRotation) + angle(partRotation)) % 360}`;
}

function explicitAttribute(part, name, fallback) {
  const source = dynamicText(part.packageName, name, fallback);
  const [offsetX, offsetY] = rotatePoint(
    Number(source.x),
    Number(source.y),
    part.rotation,
  );
  const rotation = combinedRotation(source.rot ?? "R0", part.rotation);
  return `            <attribute name="${name}" `
    + `x="${Number((part.x + offsetX).toFixed(4))}" `
    + `y="${Number((part.y + offsetY).toFixed(4))}" `
    + `size="${source.size}" layer="${source.layer}" `
    + `${source.ratio ? `ratio="${source.ratio}" ` : ""}`
    + `${source.align ? `align="${source.align}" ` : ""}`
    + `${rotation === "R0" ? "" : `rot="${rotation}" `}/>`;
}

const signals = new Map();
for (const line of netlist.trim().split(/\r?\n/).slice(1)) {
  const [net, reference, , physicalPad] = csvFields(line);
  if (!net || !reference || !physicalPad) continue;
  if (!placements[reference]) continue;
  if (!signals.has(net)) signals.set(net, []);
  signals.get(net).push({ reference, physicalPad });
}

const outline = [
  [0, 0, 11, 0],
  [11, 0, 11, 9],
  [11, 9, 25, 9],
  [25, 9, 25, 0],
  [25, 0, 150, 0],
  [150, 0, 150, 100],
  [150, 100, 0, 100],
  [0, 100, 0, 0],
].map(([x1, y1, x2, y2]) => (
  `          <wire x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" width="0" layer="20"/>`
)).join("\n");

const elementXml = physicalParts.map((part) => (
  `          <element name="${esc(part.name)}" library="${esc(part.library)}" `
  + `package="${esc(part.packageName)}" value="${esc(part.value ?? "")}" `
  + `x="${part.x}" y="${part.y}" smashed="yes" rot="${part.rotation}">\n`
  + `${explicitAttribute(part, "NAME", {
    x: 0, y: 3, size: 1.27, layer: 25,
  })}\n`
  + `${explicitAttribute(part, "VALUE", {
    x: 0, y: -3, size: 1.27, layer: 27,
  })}\n`
  + "          </element>"
)).join("\n");

const signalXml = [...signals.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, contacts]) => {
    const contactXml = contacts
      .map(({ reference, physicalPad }) => (
        `            <contactref element="${esc(reference)}" pad="${esc(physicalPad)}"/>`
      ))
      .join("\n");
    return `          <signal name="${esc(name)}" class="0">\n`
      + `${contactXml}\n`
      + "          </signal>";
  })
  .join("\n");

const board = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE eagle SYSTEM "eagle.dtd">
<eagle version="9.6.2">
  <drawing>
    <settings>
      <setting alwaysvectorfont="no"/>
      <setting verticaltext="up"/>
    </settings>
    <grid distance="1" unitdist="mm" unit="mm" style="lines" multiple="1" display="yes" altdistance="0.1" altunitdist="mm" altunit="mm"/>
    <layers>${layers}
    </layers>
    <board>
      <description>WiFiPicoDMX Rev. A basic two-layer placement. Unrouted engineering starting point: run DRC, review isolation, and complete routing manually before manufacture.</description>
      <plain>
${outline}
        <hole x="4" y="4" drill="3.2"/>
        <hole x="146" y="4" drill="3.2"/>
        <hole x="4" y="96" drill="3.2"/>
        <hole x="146" y="96" drill="3.2"/>
        <rectangle x1="11" y1="0" x2="25" y2="10.5" layer="41"/>
        <rectangle x1="11" y1="0" x2="25" y2="10.5" layer="42"/>
        <rectangle x1="11" y1="0" x2="25" y2="10.5" layer="43"/>
        <rectangle x1="38" y1="0" x2="40" y2="24" layer="41"/>
        <rectangle x1="38" y1="0" x2="40" y2="24" layer="42"/>
        <rectangle x1="38" y1="0" x2="40" y2="24" layer="43"/>
        <rectangle x1="38" y1="22" x2="65.5" y2="24" layer="41"/>
        <rectangle x1="38" y1="22" x2="65.5" y2="24" layer="42"/>
        <rectangle x1="38" y1="22" x2="65.5" y2="24" layer="43"/>
        <rectangle x1="65.5" y1="0" x2="70.5" y2="24" layer="41"/>
        <rectangle x1="65.5" y1="0" x2="70.5" y2="24" layer="42"/>
        <rectangle x1="65.5" y1="0" x2="70.5" y2="24" layer="43"/>
        <wire x1="40" y1="0" x2="40" y2="22" width="0.2" layer="51"/>
        <wire x1="40" y1="22" x2="65.5" y2="22" width="0.2" layer="51"/>
        <wire x1="65.5" y1="22" x2="65.5" y2="0" width="0.2" layer="51"/>
        <text x="41" y="20.5" size="1.016" layer="51">MIDI ISOLATED INPUT - NO LOGIC COPPER</text>
        <rectangle x1="5" y1="51" x2="31" y2="65" layer="39"/>
        <wire x1="5" y1="51" x2="31" y2="51" width="0.2" layer="51"/>
        <wire x1="31" y1="51" x2="31" y2="65" width="0.2" layer="51"/>
        <wire x1="31" y1="65" x2="5" y2="65" width="0.2" layer="51"/>
        <wire x1="5" y1="65" x2="5" y2="51" width="0.2" layer="51"/>
        <text x="6" y="63" size="1.27" layer="51">Pico USB, BOOTSEL and RESET access zone</text>
        <rectangle x1="84.5" y1="0" x2="91.5" y2="100" layer="41"/>
        <rectangle x1="84.5" y1="0" x2="91.5" y2="100" layer="42"/>
        <rectangle x1="84.5" y1="0" x2="91.5" y2="100" layer="43"/>
        <wire x1="88" y1="0" x2="88" y2="100" width="0.2" layer="51"/>
        <text x="86.5" y="2" size="1.27" layer="51" rot="R90">ISOLATION CORRIDOR - NO COPPER OR VIAS</text>
        <text x="2" y="98" size="1.778" layer="21">WiFiPicoDMX Rev. A - BASIC UNROUTED LAYOUT</text>
        <text x="2" y="94.5" size="1.27" layer="21">Logic / Pico</text>
        <text x="94" y="94.5" size="1.27" layer="21">Isolated DMX</text>
      </plain>
      <libraries>${libraries}
      </libraries>
      <attributes/>
      <variantdefs/>
      <classes>
        <class number="0" name="default" width="0.25" drill="0.3">
          <clearance class="0" value="0.2"/>
        </class>
      </classes>
      <designrules name="WiFiPicoDMX_2Layer">
        <description language="en">Conservative prototype defaults only. Confirm with the selected PCB manufacturer and perform an isolation review before fabrication.</description>
        <param name="layerSetup" value="(1*16)"/>
        <param name="mtCopper" value="0.035mm 0.035mm 0.035mm 0.035mm 0.035mm 0.035mm 0.035mm 0.035mm 0.035mm 0.035mm 0.035mm 0.035mm 0.035mm 0.035mm 0.035mm 0.035mm"/>
        <param name="mtIsolate" value="1.5mm 0.15mm 0.15mm 0.15mm 0.15mm 0.15mm 0.15mm 0.15mm 0.15mm 0.15mm 0.15mm 0.15mm 0.15mm 0.15mm 0.15mm"/>
        <param name="mdWireWire" value="0.2mm"/>
        <param name="mdWirePad" value="0.2mm"/>
        <param name="mdWireVia" value="0.2mm"/>
        <param name="mdPadPad" value="0.2mm"/>
        <param name="mdPadVia" value="0.2mm"/>
        <param name="mdViaVia" value="0.2mm"/>
        <param name="mdCopperDimension" value="0.3mm"/>
        <param name="mdDrill" value="0.25mm"/>
        <param name="msWidth" value="0.2mm"/>
        <param name="msDrill" value="0.3mm"/>
      </designrules>
      <autorouter>
        <pass name="Default">
          <param name="RoutingGrid" value="0.25mm"/>
          <param name="AutoGrid" value="1"/>
          <param name="Efforts" value="0"/>
          <param name="TopRouterVariant" value="1"/>
          <param name="tpPrefDir" value="0"/>
          <param name="btPrefDir" value="0"/>
        </pass>
      </autorouter>
      <elements>
${elementXml}
      </elements>
      <signals>
${signalXml}
      </signals>
      <errors/>
    </board>
  </drawing>
</eagle>
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, board, "utf8");
console.log(`Generated ${outputPath}`);
console.log(`${physicalParts.length} placed parts, ${signals.size} named airwire nets, 150 x 100 mm`);
