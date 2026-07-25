# Fusion Electronics files

`WiFiPicoDMX_RevA.sch` is a self-contained Autodesk EAGLE XML schematic that
can be uploaded to Autodesk Fusion Electronics. Its component library and
preliminary SMD footprints are embedded in the schematic.

Regenerate the file from the repository root with:

```powershell
node scripts/generate_fusion_schematic.mjs
```

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
