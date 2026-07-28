# WiFiPicoDMX Rev. A frozen passive BOM

This file freezes the manufacturer and ordering code for the resistors,
capacitors, ferrites, optional common-mode choke, resettable fuse, and status
LEDs used by the Rev. A schematic. Substitute parts require an explicit BOM
review for value, tolerance, voltage or power rating, package, temperature
range, availability, and—especially for capacitors—DC-bias performance.

## Resistors

| References | Qty | Function | Value and rating | Manufacturer | Ordering code | Package |
|---|---:|---|---|---|---|---|
| R1 | 1 | ISOW1412 D-input pull-up | 100 kΩ, ±1%, 0.063 W | Yageo | `RC0402FR-07100KL` | 0402 |
| R2, R3 | 2 | Direction pull-down and EN/FLT pull-up | 10 kΩ, ±1%, 0.063 W | Yageo | `RC0402FR-0710KL` | 0402 |
| R4, R5 | 2 | MIDI input current limiting | 220 Ω, ±1%, 0.063 W | Yageo | `RC0402FR-07220RL` | 0402 |
| R6 | 1 | MIDI output pull-up | 4.7 kΩ, ±1%, 0.063 W | Yageo | `RC0402FR-074K7L` | 0402 |
| R7 | 1 | HCPL-0700 base speed-up | 47 kΩ, ±1%, 0.063 W | Yageo | `RC0402FR-0747KL` | 0402 |
| R8, R9 | 2 | Power and DMX LED current limiting | 1 kΩ, ±1%, 0.063 W | Yageo | `RC0402FR-071KL` | 0402 |
| R10, R11 | 2 | Default DMX common-mode-choke bypass | 0 Ω, ±5%, 0.063 W | Yageo | `RC0402JR-070RL` | 0402 |

## Capacitors

| References | Qty | Function | Value and rating | Manufacturer | Ordering code | Package |
|---|---:|---|---|---|---|---|
| C1, C6, C7 | 3 | VIO, VISOIN, and MIDI VCC bypass | 100 nF, 16 V, ±10%, X7R | Samsung Electro-Mechanics | `CL05B104KO5NNNC` | 0402 |
| C2, C4 | 2 | VDD and VISOOUT high-frequency bypass | 10 nF, 50 V, ±10%, X7R | Walsin | `0402B103K500CT` | 0402 |
| C3, C5 | 2 | VDD and VISOOUT bulk | 10 µF, 35 V, ±10%, X5R | Murata | `GRM21BR6YA106KE43L` | 0805 |
| C8, C9 | 2 | VDD and VISOOUT intermediate bypass | 1 µF, 50 V, ±10%, X5R | Samsung Electro-Mechanics | `CL10A105KB8NNNC` | 0603 |

The capacitor set follows the TI ISOW1412 application circuit and EVM BOM.
The original TI EVM used Murata `GRM188R61H105KAALD` for 1 µF, but that
ordering code is obsolete. The active Samsung part above keeps the same
capacitance, voltage, tolerance, dielectric, and 0603 package.

C1, C2, C4, C6, and C7 are already 0402. C8 and C9 remain 0603, and C3
and C5 remain 0805, because the frozen design follows TI's 50 V 1 µF and
35 V 10 µF EVM selections. Reducing those packages without qualifying
effective capacitance under 5 V DC bias would weaken the supply network.

## Magnetics, protection, and indicators

| References | Qty | Function | Manufacturer | Ordering code | Package / population |
|---|---:|---|---|---|---|
| FB1, FB2 | 2 | Isolated supply and return ferrites | Murata | `BLM15EX331SN1D` | 0402, fit |
| L1 | 1 | Optional DMX pair common-mode choke | TDK | `ACT45B-510-2P-TL003` | 4.5 × 3.2 mm, DNP by default |
| F1 | 1 | ISOW1412 VDD branch resettable fuse | Littelfuse | `1206L050YR` | 1206, fit |
| D3 | 1 | Green power indicator | Lite-On | `LTST-C190KGKT` | 0603, fit |
| D4 | 1 | Yellow DMX activity indicator | Lite-On | `LTST-C190KSKT` | 0603, fit |

## Mandatory placement and population rules

- Place C2 and C4 less than 1 mm from the corresponding ISOW1412 VDD and
  VISOOUT pins with short, symmetric supply and return paths.
- Place C8 and C9 in TI's recommended 2 mm to 4 mm zone. Place C3 and C5
  immediately behind that local high-frequency network.
- Place C1 and C6 close to VIO and VISOIN respectively. Place C7 beside the
  HCPL-0700 VCC and GND pins.
- Default prototype population is R10 and R11 fitted and L1 not fitted.
  Never populate L1 at the same time as R10 and R11.
- Before a production release, measure ISOW1412 input/output ripple and verify
  the effective 10 µF capacitance under 5 V DC bias on assembled boards.
- Stock observations are not lifetime guarantees. Recheck authorized
  distributor stock and product status when creating a purchase order.
