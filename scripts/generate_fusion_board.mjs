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
  C1: [55.25, 76.5, "R90"],
  C2: [55.25, 65, "R90"],
  C3: [51, 64.75, "R90"],
  C4: [76.2, 54.25, "R270"],
  C5: [85.5, 53.95, "R270"],
  C6: [78.3, 59.35, "R270"],
  C7: [57, 12, "R90"],
  C8: [50.75, 60.25, "R90"],
  C9: [81.6, 54.05, "R270"],
  D1: [83.25, 69.2, "R0"],
  D2: [33, 11, "R270"],
  D3: [59.5, 39.5, "R0"],
  D4: [59.5, 33.5, "R0"],
  F1: [48.25, 33.5, "R0"],
  FB1: [81.55, 59.4, "R90"],
  FB2: [78.35, 57, "R90"],
  J1: [88.8, 65.45, "R90"],
  J2: [13, 10, "R270"],
  J3: [5.5, 45.5, "R0"],
  J4: [14, 79.25, "R0"],
  J5: [5.5, 79.5, "R0"],
  L1: [77.3, 69.15, "R0"],
  R1: [51.25, 68, "R0"],
  R2: [51.25, 76.25, "R0"],
  R3: [51.25, 72.25, "R0"],
  R4: [25, 12, "R0"],
  R5: [25, 7, "R0"],
  R6: [52.2, 28.5, "R0"],
  R7: [50.4, 9.5, "R0"],
  R8: [55.5, 39, "R0"],
  R9: [55.5, 33.5, "R0"],
  R10: [77.25, 72.15, "R0"],
  R11: [77.35, 66.1, "R0"],
  SW1: [49.75, 43.25, "R0"],
  U1: [31.5, 53.5, "R0"],
  U2: [65.5, 64.75, "R0"],
  U3: [42, 11, "R0"],
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
  [0, 0, 95, 0],
  [95, 0, 95, 100],
  [95, 100, 0, 100],
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
        <rectangle x1="0" y1="20" x2="39.5" y2="22" layer="41"/>
        <rectangle x1="0" y1="20" x2="39.5" y2="22" layer="42"/>
        <rectangle x1="0" y1="20" x2="39.5" y2="22" layer="43"/>
        <rectangle x1="39.5" y1="0" x2="44.5" y2="22" layer="41"/>
        <rectangle x1="39.5" y1="0" x2="44.5" y2="22" layer="42"/>
        <rectangle x1="39.5" y1="0" x2="44.5" y2="22" layer="43"/>
        <wire x1="0" y1="20" x2="39.5" y2="20" width="0.2" layer="51"/>
        <wire x1="39.5" y1="20" x2="39.5" y2="0" width="0.2" layer="51"/>
        <text x="2" y="18.5" size="1.016" layer="51">MIDI ISOLATED INPUT - NO LOGIC COPPER</text>
        <rectangle x1="62" y1="43.75" x2="69" y2="88.75" layer="41"/>
        <rectangle x1="62" y1="43.75" x2="69" y2="88.75" layer="42"/>
        <rectangle x1="62" y1="43.75" x2="69" y2="88.75" layer="43"/>
        <wire x1="65.5" y1="43.75" x2="65.5" y2="88.75" width="0.2" layer="51"/>
        <text x="64" y="45.75" size="1.27" layer="51" rot="R90">DMX ISOLATION - NO COPPER OR VIAS</text>
        <text x="2" y="98" size="1.778" layer="21">WiFiPicoDMX Rev. A - BASIC UNROUTED LAYOUT</text>
        <text x="2" y="94.5" size="1.27" layer="21">GPIO / analog inputs</text>
        <text x="23" y="82" size="1.27" layer="21">Pico 2 W</text>
        <text x="70" y="97" size="1.27" layer="21">Isolated DMX output</text>
        <text x="46" y="3" size="1.27" layer="21">MIDI logic output to Pico</text>
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
console.log(`${physicalParts.length} placed parts, ${signals.size} named airwire nets, 95 x 100 mm`);
