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

1. run Fusion's ERC and resolve every result;
2. verify every package against the latest manufacturer land-pattern drawing;
3. independently recheck the imported `PTS810_J_LEAD`,
   `PPTC1206_1206L050YR`, `ACT45B_4P5X3P2`, `DFM0020A_TI`,
   `SM712_SOT23`, `SOD323_VISHAY`, and `HCPL0700_SO8` land patterns
   against the current manufacturer drawings before fabrication;
4. confirm the Pico 2 W orientation, antenna keep-out and BOOTSEL access
   against the physical module;
5. review the isolation keep-out and creepage in the PCB layout;
6. independently review the DMX polarity, TVS pin mapping, MIDI input current
   and connector harness pin numbering.

Panel-mounted XLR and MIDI connectors use labelled carrier-board solder pads
with strain-relief holes. They are not represented as PCB-mounted connector
bodies.
