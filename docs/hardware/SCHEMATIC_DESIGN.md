# WiFiPicoDMX Rev. A schematic design specification

This document freezes the architecture to be captured in Autodesk Eagle. It is
an engineering design input, not a declaration that the finished product is
DMX512-A, EMC, or safety certified. Those claims require prototype
measurements and the applicable conformity testing.

## Design rules

- Use SMD parts for all semiconductors, protection devices, resistors, and
  capacitors.
- Solder the Raspberry Pi Pico 2 W directly through its castellated pads. Do
  not fit socket headers in the production design.
- Use through-hole or mechanically reinforced footprints for connectors that
  experience cable insertion force. The XLR connector is explicitly exempt
  from the SMD requirement.
- Prefer SMD when the total assembled cost is comparable. Component price
  alone must not override isolation, creepage, availability, or connector
  strength.
- Do not use the SN74LVC1G04 inverter. DMX polarity is generated correctly in
  firmware and GPIO2 drives the isolated transceiver directly.

## Isolated DMX output

### Preferred transceiver and isolated supply

Use `ISOW1412DFMR` in the reinforced-isolation version, 20-pin DFM/SOIC SMD
package. Do not substitute the `ISOW1412B` basic-isolation version without an
explicit design review.

This device replaces both the earlier `ISO1410DW` transceiver and the
through-hole `MEJ2S0505SC` isolated converter:

- 500 kbit/s maximum data rate, suitable for 250 kbit/s DMX;
- integrated low-emissions isolated DC/DC converter;
- 5 kVRMS signal and power isolation;
- 8 mm minimum package creepage and clearance;
- 5 V isolated output with ±5% accuracy;
- fewer placements and a lower current distributor cost than the two-part
  `ISO1410DW + NXJ1S0505MC` alternative.

The reinforced part was active/production at the time of selection. It was
temporarily backordered at DigiKey and Mouser in July 2026, with replenishment
listed for July/August 2026. Confirm stock before ordering a production run.

### Logic-side connections

| ISOW1412 signal | Connection |
|---|---|
| `VIO` | Pico `3V3` |
| `VDD` | Protected Pico `VBUS` / 5 V rail |
| `GNDIO`, `GND1` | Logic ground; short directly as required by TI |
| `D` | Pico `GPIO2` directly; no inverter |
| `DE`, `/RE` | Short together and connect to Pico `GPIO4` (`DMX_DIR_PIN`) with a hardware pull-down |
| `R` | Pico `GPIO6` (`DMX_RX_PIN`) for future RDM reception |
| `EN/FLT` | 10 kΩ pull-up to `VIO`, plus a test point |

`GPIO4` is the half-duplex direction control. Low disables the driver and
enables the receiver; high enables the driver and disables the receiver. Its
hardware pull-down keeps the line driver disabled during Pico reset and boot.
Firmware must drive it high only after the PIO output is configured and
holding the DMX Mark state. GPIO4 and GPIO6 must therefore be added to the
firmware's reserved GPIO mask.

Add a 47 kΩ to 100 kΩ pull-up from `D` to `VIO` so that the isolated driver
sees a defined Mark level while the Pico pin is high-impedance.

### Isolated-side connections

| ISOW1412 signal | Connection |
|---|---|
| `MODE` | `VISOOUT` for a regulated 5 V isolated bus-side rail |
| `VISOOUT` to `VISOIN` | Through `BLM15EX331SN1D` ferrite bead |
| `GND2` to `GISOIN` | Through `BLM15EX331SN1D` ferrite bead |
| `Y`, `A` | Short together: DMX Data+ path to XLR pin 3 |
| `Z`, `B` | Short together: DMX Data− path to XLR pin 2 |

Use the following power-network components and place them exactly as the TI
layout guidance requires:

- 10 nF 0402 ceramic within 1 mm of both `VDD` and `VISOOUT`;
- 100 nF 0402 ceramic at `VIO` and `VISOIN`;
- at least 10 µF X7R bulk capacitance at `VDD` and `VISOOUT`;
- optional 1 µF X7R capacitors matching the TI application layout;
- two `BLM15EX331SN1D` 0402 ferrite beads on the isolated supply and return.

Higher bulk capacitance may be fitted after checking inrush and the actual
ripple measurement. Use voltage-rated capacitors whose effective capacitance
remains adequate after DC-bias derating.

### DMX connector and protection

- Use a panel-mounted Neutrik 5-pin female XLR connector.
- XLR pin 3 is Data+ and connects to `Y`.
- XLR pin 2 is Data− and connects to `Z`.
- XLR pin 1/shield treatment depends on the final enclosure:
  - metal enclosure: bond the cable shield to chassis at the connector entry;
  - insulated enclosure: connect the defined DMX common only to the isolated
    bus-side reference, never to Pico logic ground.
- Place the `SM712` SOT-23 TVS directly at the connector with the shortest
  possible discharge path to the isolated/chassis reference selected above.
- Do not fit a permanent 120 Ω termination in the controller. Termination
  belongs at the far end of the DMX cable.
- Reserve the manufacturer land pattern for a TDK
  `ACT45B-510-2P-TL003` two-line common-mode choke plus zero-ohm bypasses.
  The choke is rated for 200 mA and 50 V DC, with 51 µH typical common-mode
  inductance, 0.15 µH typical stray inductance, and 1 Ω maximum DC resistance
  per line. For the initial prototype, leave `L1` unpopulated and fit the two
  zero-ohm bypasses. Populate the choke only after signal-integrity and EMC
  measurements establish that it improves the assembled controller.

The Y/Z pair must be routed together over its isolated reference plane with no
stubs. Keep the transceiver, protection, and XLR close together.

The joined `Y/A` and `Z/B` connections make the physical port half-duplex and
RDM-ready. Initial firmware may leave GPIO4 high during normal transmission
and ignore GPIO6. Future RDM firmware can release the bus by taking GPIO4 low
and receive the response on GPIO6 without a hardware revision.

## Main power

The complete Rev. A controller is powered from one regulated 5 V supply
connected to the Pico 2 W Micro-USB connector.

- Take the board's 5 V peripheral rail from the Pico `VBUS` pin.
- Feed `ISOW1412.VDD` from that rail through the dedicated `1206L050YR`
  resettable fuse and local filtering. Its 0.5 A hold and 1.0 A trip ratings
  accommodate the transceiver's normal and short peak currents while
  protecting this branch better than the previously considered 0.75 A part.
- Power the ISOW1412 logic interface from Pico `3V3`; do not power the
  isolated converter from `3V3`.
- Do not provide a second board power input or any path that can back-feed the
  USB connector.
- Specify a good-quality regulated 5 V supply rated for at least 1 A for the
  current Rev. A load, with additional margin if external GPIO circuitry or
  accessories are later added.
- Keep the total external load on Pico `3V3` below the Raspberry Pi
  recommendation; the isolated power converter uses the 5 V `VBUS` branch
  specifically to preserve that margin.

## Isolation and PCB layout

- Use a four-layer PCB for the production design.
- Keep logic and isolated copper pours separate.
- Preserve at least the package's 8 mm creepage/clearance intent across the
  isolation boundary.
- Do not route copper, planes, vias, silkscreen conductive ink, mounting
  hardware, or test pads through the barrier keep-out.
- Follow TI's additional 4 mm metal keep-out around `VISOOUT` and `GND2`.
- Keep the high-frequency bypass loops symmetrical and extremely short.
- Add clearly separated `GND_LOGIC` and `GND_DMX_ISO` net names in Eagle.
- Do not bridge the two grounds with a normal capacitor. Any optional
  safety-rated stitching capacitor requires a separate EMC and insulation
  review.

## SMD component choices

| Function | Preferred part | Package / mounting | Status |
|---|---|---|---|
| Controller | Raspberry Pi Pico 2 W | Castellated SMD module | Selected |
| Isolated DMX and power | `ISOW1412DFMR` | DFM/SOIC-20 SMD | Selected |
| DMX TVS | `SM712.TCT` | SOT-23 SMD | Selected |
| Resettable fuse | `1206L050YR` | 1206 SMD, 0.5 A hold / 1.0 A trip | Selected |
| Reverse-polarity/power diode | `SS34` | SMB SMD | Selected; confirm exact ordering code |
| MIDI optocoupler | `HCPL-0700-500E` | Genuine SOIC-8 SMD, tape and reel | Selected |
| MIDI protection diode | `1N4148WS-E3-08` | SOD-323 SMD | Selected |
| Isolated-supply ferrites | `BLM15EX331SN1D` | 0402 SMD | Selected |
| Optional DMX common-mode choke | `ACT45B-510-2P-TL003` | TDK ACT45B, 4.5 × 3.2 mm SMD | Selected; DNP by default pending EMC/signal-integrity tests |
| Reset pushbutton | `PTS810SJM250SMTR LFS` | 4.2 × 3.2 mm, 2.5 mm high, four-pad J-lead SMD | Selected |
| DMX connector | Neutrik 5-pin female XLR | Panel mounted and wired | Exception |
| MIDI connector | 5-pin DIN MIDI IN | Panel mounted and wired | Included; select exact part by enclosure |

The earlier `SN74LVC1G04`, `ISO1410DW`, `MEJ2S0505SC`, axial `1N4148`, and
through-hole 6N138 are not production BOM choices.

## MIDI input

Rev. A includes a standard 5-pin DIN MIDI IN port for future use:

- panel-mounted DIN connector wired to the carrier;
- `HCPL-0700-500E` genuine SOIC-8 SMD optocoupler;
- `1N4148WS-E3-08` SOD-323 input protection diode;
- optocoupler output routed to Pico `GPIO5` / UART1 RX;
- input current-limiting, bias, pull-up, and decoupling components implemented
  as SMD parts;
- MIDI hardware may remain unused by the initial application, but it is fitted
  so enabling it later does not require a PCB revision.

The exact connector manufacturer and footprint remain part of the enclosure
and mechanical-layout decision.

### Panel-connector wiring

The prototype's XLR and MIDI connector bodies do not mount on the carrier PCB.
Provide labelled plated solder pads and nearby non-plated strain-relief holes
for their wire harnesses.

DMX panel wiring:

| Pad label | Eagle net | Panel connector |
|---|---|---|
| `DMX COM` | `GND_DMX_ISO` | XLR pin 1 |
| `DMX -` | `DMX_DATA_MINUS` | XLR pin 2 |
| `DMX +` | `DMX_DATA_PLUS` | XLR pin 3 |
| `SHELL` | `XLR_SHELL` | Connector shell, initially configurable/no-connect |

MIDI panel wiring:

| Pad label | Eagle net | Panel connector |
|---|---|---|
| `MIDI 1` | `MIDI_DIN_PIN1_SPARE` | DIN pin 1 |
| `MIDI 2` | `MIDI_DIN_PIN2_SHIELD` | DIN pin 2; treatment remains configurable |
| `MIDI 3` | `MIDI_DIN_PIN3_SPARE` | DIN pin 3 |
| `MIDI 4` | `MIDI_DIN_PIN4` | DIN pin 4 |
| `MIDI 5` | `MIDI_DIN_PIN5` | DIN pin 5 |

Bring all five DIN pins to distinct pads even though the initial MIDI current
loop uses pins 4 and 5. Do not merge MIDI pin 2, XLR shell, logic ground, or
isolated DMX ground implicitly. Use explicit configurable links where a later
enclosure decision may require a connection.

Use large, clearly separated pads suitable for manually soldered stranded
wire. Add adjacent tie-down holes so cable movement is not transferred to the
solder joints.

## GPIO and expansion pads

Rev. A provides labelled internal SMD solder/test pads for later connection
work. These pads are expansion points, not protected external inputs.

### Free digital GPIO pads

Provide one pad for each currently free, externally available Pico GPIO:

| Silkscreen | Eagle net |
|---|---|
| `GP0` | `GPIO0_EXP` |
| `GP1` | `GPIO1_EXP` |
| `GP8` through `GP22` | `GPIO8_EXP` through `GPIO22_EXP` |

Do not label reserved pins as free:

| Pico pin | Reserved function | Diagnostic net |
|---|---|---|
| GPIO2 | DMX data transmit | `DMX_TX_GPIO2` |
| GPIO3 | DMX frame trigger/debug | `DMX_TRIGGER_GPIO3` |
| GPIO4 | DMX/RDM direction | `DMX_DIR_GPIO4` |
| GPIO5 | MIDI UART receive | `MIDI_RX_GPIO5` |
| GPIO6 | Future RDM receive | `DMX_RX_GPIO6` |
| GPIO7 | DMX/RDM activity LED | `DMX_ACTIVITY_GPIO7` |

Provide a small labelled diagnostic SMD test pad for each reserved signal.

### Analog pads

| Silkscreen | Eagle net |
|---|---|
| `A0/GP26` | `ADC0_GPIO26` |
| `A1/GP27` | `ADC1_GPIO27` |
| `A2/GP28` | `ADC2_GPIO28` |
| `AREF` | `ADC_VREF` |
| `AGND` | `AGND` |

Keep the analog pads grouped together and away from the isolated converter,
DMX pair, Wi-Fi antenna, and digital return-current paths.

### Power and diagnostic pads

Provide clearly distinct pads for:

- `VCC_3V3_LOGIC`;
- `GND_LOGIC` (at least two pads in the expansion area);
- `VBUS_5V_USB` (diagnostic pad only);
- `VDD_5V_ISOW_FUSED`;
- `GND_DMX_ISO`;
- `VCC_5V_DMX_ISO`;
- `DMX_DATA_PLUS`;
- `DMX_DATA_MINUS`.

Power, logic ground, and isolated ground pads must use different silkscreen
names. Never use a generic `GND` label for both isolation domains.
Do not power later accessories from `VDD_5V_ISOW_FUSED`; that branch is dedicated
to the ISOW1412. A later external 5 V connector requires its own fuse and
power-budget review.

Use exposed SMD copper pads large enough for a probe or a manually soldered
wire. Arrange the free digital GPIO pads on a regular 2.54 mm grid where board
space allows so a later connector daughterboard can be designed without
changing the carrier. Add pin-1/orientation markings and keep all labels
readable after the Pico module is fitted.

No cable may be connected directly to these internal pads in the finished
product. Any later externally accessible GPIO, ADC, or power connector must
add suitable ESD protection, voltage limiting, filtering, and mechanical
strain relief.

## Local controls

Rev. A includes a dedicated C&K/Littelfuse `PTS810SJM250SMTR LFS` Reset
pushbutton:

- normally-open momentary, top-actuated SMD switch;
- 4.2 mm × 3.2 mm body, 2.5 mm height, and 1.6 N nominal operating force;
- four physical pads, with pads 1/3 forming one contact and pads 2/4 the
  other;
- connects Pico `RUN` to `GND_LOGIC` only while pressed;
- net names `PICO_RUN_N` and `GND_LOGIC`;
- located where it remains accessible after the Pico and XLR are fitted;
- protected from accidental operation by placement or a recessed enclosure
  opening in the later mechanical design.

The Pico's existing BOOTSEL button remains the programming control. Maintain a
component and finger-access keep-out above it; do not place the carrier PCB,
XLR body, or another tall component where it prevents operation. Also expose
the Pico `TP6/BOOTSEL` signal as a labelled diagnostic pad for optional future
remote programming access.

## Status indicators

Rev. A includes two carrier-board SMD indicators:

- `PWR`: low-current SMD LED from `VCC_3V3_LOGIC` through its own series resistor
  to `GND_LOGIC`;
- `DMX`: low-current SMD LED controlled by Pico GPIO7 through its own series
  resistor.

Use 0603 LEDs and start with 1 kΩ series resistors. Confirm acceptable
brightness with the selected LED before releasing the BOM; increase resistance
where practical to reduce current and light pollution.

The DMX LED must be driven by firmware and must not connect electrically to the
DMX differential pair. Firmware should use a visible activity hold time rather
than reproduce every 43 Hz frame transition directly.

Use the Pico's existing onboard LED for Wi-Fi/application status; do not add a
duplicate Wi-Fi LED to the carrier. GPIO7 is reserved and is no longer part of
the free expansion-pad group.

## Cost and sourcing decision

Indicative authorized-distributor prices checked in July 2026:

| Architecture | Quantity 1 | Quantity 100 | Notes |
|---|---:|---:|---|
| `ISOW1412DFMR` | about CHF 7.14 | about CHF 4.72 | One placement; reinforced signal and power isolation |
| `ISO1410DW` + `NXJ1S0505MC` | about USD 10.89 | about USD 7.70 | Two placements; SMD fallback; lower converter isolation specification |

Currency and regional price differences make this an indicative comparison,
not a quotation. Availability and authorized-distributor pricing must be
rechecked before procurement.

## Firmware implications

The current firmware intentionally inverts data bytes and reverses the
Break/Mark GPIO levels for the previously tested external driver path. Direct
connection to `ISOW1412.D` requires:

1. standard, non-inverted DMX data bytes;
2. Break low and Mark After Break high at GPIO2;
3. GPIO4 held low during boot;
4. GPIO4 driven high only after GPIO2/PIO is stable at Mark;
5. GPIO4 returned low if the DMX engine stops or faults;
6. GPIO6 reserved as the future RDM receive input.

This is a firmware change and therefore requires the project's full firmware
build and hardware-test workflow.

## Prototype acceptance tests

- Confirm GPIO2 and XLR polarity before connecting production lighting.
- Measure 250 kbit/s data, Break, Mark After Break, slot time, and refresh
  period.
- Measure differential amplitude, common-mode voltage, rise/fall time,
  ringing, and overshoot with a 120 Ω far-end termination and representative
  DMX cable.
- Confirm the output stays disabled throughout Pico reset and becomes active
  without a false Break or partial frame.
- Test open cable, shorted pair, reversed pair, hot plug, and repeated power
  cycling.
- Perform pre-compliance ESD, EFT, conducted-emissions, and radiated-emissions
  testing before claiming professional/compliant operation.
