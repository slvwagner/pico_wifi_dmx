# Fusion Electronics files

`WiFiPicoDMX_RevA.sch` is a self-contained Autodesk EAGLE XML schematic that
can be uploaded to Autodesk Fusion Electronics. Its component library and
preliminary SMD footprints are embedded in the schematic.

## How the schematic is created

The schematic was not drawn manually in Fusion. EAGLE `.sch` files use an XML
format that Fusion Electronics can import, so
[`scripts/generate_fusion_schematic.mjs`](../../scripts/generate_fusion_schematic.mjs)
builds the file programmatically.

The generator is the single source for:

- schematic symbols and symbolic pin names;
- preliminary package footprints and physical pad numbers;
- component references, values and sheet positions;
- physical pin-to-pad mappings;
- named signals and their connected endpoints;
- the EAGLE XML schematic and both net-list formats.

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
visual arrangement is only a starting point for manual redrawing. Generic and
custom-generated footprints are explicitly preliminary; they were not taken
from a verified Autodesk managed library.

The circuit is based on
[`docs/hardware/SCHEMATIC_DESIGN.md`](../../docs/hardware/SCHEMATIC_DESIGN.md).
It is an engineering prototype, not a manufacturing release. Before creating
Gerbers or ordering a PCB:

1. run Fusion's ERC and resolve every result;
2. verify every package against the latest manufacturer land-pattern drawing;
3. select final footprints for the reset switch and optional common-mode
   choke;
4. confirm the Pico 2 W orientation, antenna keep-out and BOOTSEL access
   against the physical module;
5. review the isolation keep-out and creepage in the PCB layout;
6. independently review the DMX polarity, TVS pin mapping, MIDI input current
   and connector harness pin numbering.

Panel-mounted XLR and MIDI connectors use labelled carrier-board solder pads
with strain-relief holes. They are not represented as PCB-mounted connector
bodies.
