# WiFiPicoDMX Fusion library

`WiFiPicoDMX.lbr` is the maintained Autodesk Fusion Electronics/EAGLE source
library supplied for the carrier-board schematic.

The schematic generator reads the library directly and imports these package
definitions:

| Schematic parts | Imported package |
|---|---|
| U1 | `PICO_2_W_DEVELOPMENT_BOARD` (corrected to castellated SMD) |
| R1-R3 | `RESC1005X40` |
| R4-R11 | `RESC1608X60` |
| C1, C2, C4, C6, C7 | `CAPC1005X60` |
| C3, C5 | `CAPC2012X110` |
| FB1, FB2 | `INDC1006X60N` |
| D3, D4 | `LEDC1608X55N_FLAT-B` |
| SW1 | `PTS810_J_LEAD` (pads 1/2 and 3/4 are paired contacts) |
| F1 | `PPTC1206_1206L050YR` |
| U2 | `DFM20_PRELIMINARY` |
| D1 | `SOT23_` |
| D2 | `SOD323-1.15H` |
| U3 | `SOIC127P600X317-8N` |
| L1 | `ACT45B_4P5X3P2` |
| J3, J6 | `PADBANK17`, `PADBANK8` |

The following library entries remain intentionally unselected:

- `B4B-XH-A`, `B5B-XH-A`, and `B7B-XH-A` are board-mounted XH connectors;
  Rev. A uses labelled carrier-board wiring pads for the panel-mounted XLR and
  DIN connectors and separate diagnostic pad banks.

The supplied library was corrected before use:

- the Pico package now uses 40 castellated SMD pads and includes an antenna
  copper-keepout outline instead of a 40-pin through-hole socket;
- the 1206L050 device now uses the `1206L050YR` ordering code, correct
  electrical metadata, and a 1206 pad layout instead of an 1812 footprint;
- the PTS810 is represented as a two-terminal normally-open switch with pads
  1/2 and 3/4 paired internally;
- the ACT45B uses a 4.5 × 3.2 mm package with windings 1-2 and 4-3;
- component prefixes and HCPL-0700 naming were normalized.

Panel wiring pads and the pad-bank sizes missing from the library continue to
use documented project-specific definitions generated into the self-contained
schematic. Every imported and project-specific land pattern must still be
checked against the latest manufacturer drawing before PCB manufacture.
