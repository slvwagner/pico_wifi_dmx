# Fusion Electronics files

`WiFiPicoDMX_RevA.sch` is a self-contained Autodesk EAGLE XML schematic that
can be uploaded to Autodesk Fusion Electronics. Its component definitions and
land patterns are embedded in the schematic.

The maintained Fusion/EAGLE source library is
[`libraries/WiFiPicoDMX.lbr`](libraries/WiFiPicoDMX.lbr). The generator reads
that file directly and imports the matching land patterns for the Pico 2 W,
resistors, capacitors, ferrites, LEDs, reset switch, PPTC fuse, ISOW1412,
SM712, ACT45B, HCPL-0700, 1N4148WS, and the available diagnostic pad banks. If
the library file is missing or one of those package names is removed,
generation stops instead of silently falling back to another footprint.

## How the schematic is created

The schematic was not drawn manually in Fusion. EAGLE `.sch` files use an XML
format that Fusion Electronics can import, so
[`scripts/generate_fusion_schematic.mjs`](../../scripts/generate_fusion_schematic.mjs)
builds the file programmatically.

The generator is the single source for:

- schematic symbols and symbolic pin names;
- the selection of package footprints and physical pad numbers;
- component references, values and sheet positions;
- physical pin-to-pad mappings;
- named signals and their connected endpoints;
- the EAGLE XML schematic and both net-list formats.

The project library is the source for the imported land-pattern geometry.
See [`libraries/README.md`](libraries/README.md) for the import list and the
footprints deliberately retained as project-specific definitions.

The generator also copies every available `packages3d` model and
device-to-model association for packages actually used by the schematic.
Unused library models are intentionally omitted from the self-contained
schematic. A corrected custom footprint is left without a 3D model when the
library contains no dimensionally correct model for it; the generator never
reuses a model belonging to the former, incorrect package.

For example, one `connectMany()` declaration connects the Pico DMX output,
ISOW1412 data input, pull-up resistor and diagnostic pad to the named
`DMX_TX_GPIO2` signal. The generator translates that declaration into EAGLE
XML net segments and also writes the corresponding physical endpoints into
the CSV and Markdown net lists. This prevents the three generated files from
having separately maintained connection data.

The generator validates that every referenced component and symbolic pin has
a physical package-pad mapping before writing the files. XML and endpoint
count checks should still be run after generation. This structural validation
does not certify the circuit or its footprints.

For redrawing or independently reviewing the circuit:

- `WiFiPicoDMX_RevA_netlist.csv` contains one row per physical connection;
- `WiFiPicoDMX_RevA_netlist.md` groups the same physical endpoints by net and
  includes the reference/value table and critical review notes.

Regenerate the schematic and both net lists from the repository root with:

```powershell
node scripts/generate_fusion_schematic.mjs
```

Expected output:

- `hardware/fusion/WiFiPicoDMX_RevA.sch`;
- `hardware/fusion/WiFiPicoDMX_RevA_netlist.csv`;
- `hardware/fusion/WiFiPicoDMX_RevA_netlist.md`.

## Basic carrier-board layout

`WiFiPicoDMX_RevA.brd` is a basic, deliberately unrouted two-layer carrier
layout generated from the schematic and physical net list. Regenerate it
after regenerating the schematic:

```powershell
node scripts/generate_fusion_schematic.mjs
node scripts/generate_fusion_board.mjs
```

The starter layout provides:

- all 38 physical components and all 55 named airwire nets;
- a plain rectangular 150 mm × 100 mm board outline with four 3.2 mm carrier
  mounting holes;
- the complete Pico 2 W development board mounted through the two 20-pin
  header rows from the supplied library footprint, without a carrier cutout
  or Pico-specific keepout/access zone;
- free GPIO and analog pad banks to the left of the centrally placed Pico;
- an upper DMX signal path running left to right from the Pico, through the
  ISOW1412 and line protection, to the panel-harness connector;
- a local top, bottom, and via restrict corridor beneath the upper ISOW1412
  isolation barrier;
- a lower MIDI signal path running left to right from the panel-harness
  connector and protected input network, through the HCPL-0700, to the Pico;
- a board-edge MIDI input island enclosed by the carrier edges and top,
  bottom, and via-restrict moats, with the HCPL-0700 straddling its boundary;
- separated J6 logic and isolated diagnostic pad groups;
- one shared conservative default net class for clean Fusion
  schematic/board import consistency.

The generated placement is an engineering starting point, not an autorouted
or production-ready PCB. Fusion must still be used to review the mechanical
fit, set the fabricator-specific design rules, route the board, add suitable
planes, inspect return paths, and run DRC. Do not remove or bridge the
isolation corridor with copper, vias, silkscreen conductive material, test
fixtures, or mounting hardware.

### Fusion ERC consistency

The generated schematic and board deliberately use only Fusion's shared
`default` routing class. Independently importing a generated `.sch` and `.brd`
can cause Fusion to discard custom schematic-class metadata while retaining
the board classes, producing code 303 consistency errors. Define final
signal-specific routing rules inside Fusion after import and keep them
synchronized there.

The unused ISOW1412 general-purpose `IN`/`OUT` isolation channel and the two
HCPL-0700 NC pads remain present in their physical packages but are omitted
from the schematic symbols and device pin mappings. This prevents Fusion from
synthesizing named one-pin nets: an input-only named net produces error 209,
and connecting NC pins produces warning 103.

Fusion may still report reviewed warnings for:

- supply pins connected to the project's explicit domain names such as
  `GND_LOGIC`, `VCC_3V3_LOGIC`, and `GND_DMX_ISO`;
- deliberately open panel pins (`MIDI_DIN_PIN1_SPARE`,
  `MIDI_DIN_PIN2_SHIELD`, `MIDI_DIN_PIN3_SPARE`, and `XLR_SHELL`);
- intentionally unused Pico header pins such as `PICO_VSYS` and
  `PICO_SMPS_EN`.

Those warnings document deliberate design decisions. Recheck them after any
connectivity change rather than globally suppressing the warning codes.

The connectivity and physical pin mappings were deliberately specified from
the design decisions and component datasheets. The schematic's automatic
visual arrangement is only a starting point for manual redrawing. Importing a
land pattern from the project library does not by itself certify it for
manufacturing; every package still requires comparison with the selected
manufacturer part.

The circuit is based on
[`docs/hardware/SCHEMATIC_DESIGN.md`](../../docs/hardware/SCHEMATIC_DESIGN.md).
It is an engineering prototype, not a manufacturing release. Before creating
Gerbers or ordering a PCB:

1. run Fusion's ERC and resolve every result (the current Rev. A schematic
   was checked without errors, but repeat ERC after later edits);
2. verify every package against the latest manufacturer land-pattern drawing;
3. independently recheck the imported `PTS810_J_LEAD`,
   `PPTC1206_1206L050YR`, `ACT45B_4P5X3P2`, `DFM0020A_TI`,
   `SOT23_`, `SOD323_VISHAY`, and `HCPL0700_SO8` land patterns
   against the current manufacturer drawings before fabrication;
4. confirm the Pico 2 W orientation, antenna keep-out and BOOTSEL access
   against the physical module;
5. review the isolation keep-out and creepage in the PCB layout;
6. independently review the DMX polarity, TVS pin mapping, MIDI input current
   and connector harness pin numbering.

Panel-mounted XLR and MIDI connectors connect to carrier-board JST XH headers:
J1 is `B4B-XH-A` for DMX common, Data−, Data+, and shell; J2 is `B5B-XH-A`
for DIN pins 1-5. The panel connector bodies are not mounted on the PCB.
