# WiFiPicoDMX Fusion library

`WiFiPicoDMX.lbr` is the maintained Autodesk Fusion Electronics/EAGLE source
library supplied for the carrier-board schematic.

`../WiFiPicoDMX_RevA_used.lbr` is the generated, design-specific library. It
is placed beside the matching `.sch` and `.brd` files and contains exactly the
device sets used by the current Rev. A schematic, including their symbols,
packages, available 3D associations, and the A3 schematic frame. Generate or
refresh it after regenerating the schematic:

```powershell
node scripts/generate_fusion_used_library.mjs
```

Use the generated library when you want to import or share only the components
that are actually present in this design. The schematic and board identify
their mandatory embedded component records with the same
`WiFiPicoDMX_RevA_used` library name. Continue to edit `WiFiPicoDMX.lbr`; the
generated subset is replaced by the command above.

The schematic generator reads the library directly and imports these package
definitions:

| Schematic parts | Imported package |
|---|---|
| U1 | `PICO_2_W_DEVELOPMENT_BOARD` (two through-hole header rows) |
| R1-R11 | `RESC1005X40` |
| C1, C2, C4, C6, C7 | `CAPC1005X60` |
| C8, C9 | `CAPC1608X85` |
| C3, C5 | `CAPC2012X110` |
| FB1, FB2 | `INDC1006X60N` |
| D3, D4 | `LEDC1608X55N_FLAT-B` |
| SW1 | `PTS810_J_LEAD` (pads 1/2 and 3/4 are paired contacts) |
| F1 | `PPTC1206_1206L050YR` |
| U2 | `DFM0020A_TI` |
| D1 | `SOT23_` |
| D2 | `SOD323_VISHAY` |
| U3 | `HCPL0700_SO8` |
| L1 | `ACT45B_4P5X3P2` |
| J1 | `B4B-XH-A` |
| J2 | `B5B-XH-A` |
| J3 | `PADBANK17` |

The `B7B-XH-A` library entry remains intentionally unselected. Rev. A uses
`B4B-XH-A` and `B5B-XH-A` as board-mounted harness headers for the
panel-mounted XLR and DIN connectors.

The supplied library was corrected before use, except for its Pico
development-board mounting, which is intentionally retained:

- the Pico uses the original 40 through-hole pads in two 20-pin header rows,
  without an added carrier-board antenna keepout;
- the 1206L050 device now uses the `1206L050YR` ordering code, correct
  electrical metadata, and a 1206 pad layout instead of an 1812 footprint;
- the PTS810 is represented as a two-terminal normally-open switch with pads
  1/2 and 3/4 paired internally;
- the ACT45B uses a 4.5 × 3.2 mm package with windings 1-2 and 4-3;
- the ISOW1412 uses TI's DFM0020A 1.27 mm pitch, 9.70 mm row-centre
  spacing, and 2.10 × 0.60 mm land pattern;
- the HCPL-0700 uses Broadcom's 7.49 mm row-centre spacing and
  1.90 × 0.64 mm SO-8 pads;
- the SM712 uses the user-supplied Fusion `SOT23_` footprint and 3D
  association; the 1N4148WS uses Vishay's SOD-323 recommended land pattern;
- component prefixes and HCPL-0700 naming were normalized.

Panel wiring pads and the pad-bank sizes missing from the library continue to
use documented project-specific definitions generated into the self-contained
schematic. Every imported and project-specific land pattern must still be
checked against the latest manufacturer drawing before PCB manufacture.

## 3D models

The library retains its existing Autodesk-managed 3D package records. The
schematic generator copies the available models and associations for packages
currently used by Rev. A, including the B4B-XH-A model. B5B-XH-A currently
has no valid 3D association in the source library.

The old `FUSC4532X125` 1812 fuse model was removed deliberately because it
does not represent the selected 1206L050YR. The corrected Pico, PTS810,
1206L050YR, ISOW1412, SM712, ACT45B, HCPL-0700, and 1N4148WS packages do not
yet have valid 3D associations in this library. Add the corresponding
manufacturer STEP models through Fusion's Package Editor; once the `.lbr`
contains those `packages3d` associations, the generator preserves them
automatically.
