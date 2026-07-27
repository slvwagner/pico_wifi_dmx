# WiFiPicoDMX Rev. A net list

This is the human-readable electrical handoff for redrawing the Rev. A
schematic in Autodesk Fusion Electronics. The CSV beside this file contains
one row per physical endpoint.

Endpoint notation is `reference.physical-pad (symbol-pin)`. For example,
`U1.40 (VBUS)` means physical Pico pad 40, whose symbol name is `VBUS`.

## Mandatory review before PCB manufacture

- Verify every IC and protection-device physical pin number against the
  current manufacturer datasheet.
- Verify the panel connector harness numbering at both ends. The carrier pads
  are not the panel connector footprints.
- Keep `GND_LOGIC`, `GND_DMX_ISO`, `XLR_SHELL`, and
  `MIDI_DIN_PIN2_SHIELD` distinct unless the enclosure design explicitly
  requires an approved connection.
- Fit R10 and R11 as the default 0 ohm DMX paths. L1 is the selected
  TDK ACT45B-510-2P-TL003 common-mode-choke option, normally DNP until EMC and
  signal-integrity tests justify fitting it. Never populate L1 and the two
  bypass resistors simultaneously.
- Use the Pico 2 W development board's onboard BOOTSEL button below its USB
  connector. Preserve physical access in the PCB and enclosure.
- Recheck every footprint against the current manufacturer drawing before
  fabrication even where the library geometry has been verified.

## References

| Reference | Value / function | Package |
|---|---|---|
| C1 | 100nF 16V 10% X7R 0402 CL05B104KO5NNNC VIO | CAPC1005X60 |
| C2 | 10nF 50V 10% X7R 0402 0402B103K500CT VDD <1mm | CAPC1005X60 |
| C3 | 10uF 35V 10% X5R 0805 GRM21BR6YA106KE43L VDD | CAPC2012X110 |
| C4 | 10nF 50V 10% X7R 0402 0402B103K500CT VISOOUT <1mm | CAPC1005X60 |
| C5 | 10uF 35V 10% X5R 0805 GRM21BR6YA106KE43L VISOOUT | CAPC2012X110 |
| C6 | 100nF 16V 10% X7R 0402 CL05B104KO5NNNC VISOIN | CAPC1005X60 |
| C7 | 100nF 16V 10% X7R 0402 CL05B104KO5NNNC MIDI VCC | CAPC1005X60 |
| C8 | 1uF 50V 10% X5R 0603 CL10A105KB8NNNC VDD 2-4mm | CAPC1608X85 |
| C9 | 1uF 50V 10% X5R 0603 CL10A105KB8NNNC VISOOUT 2-4mm | CAPC1608X85 |
| D1 | SM712.TCT | SM712_SOT23 |
| D2 | 1N4148WS-E3-08 | SOD323_VISHAY |
| D3 | PWR GREEN Lite-On LTST-C190KGKT | LEDC1608X55N_FLAT-B |
| D4 | DMX YELLOW Lite-On LTST-C190KSKT | LEDC1608X55N_FLAT-B |
| F1 | 1206L050YR 0.5A HOLD | PPTC1206_1206L050YR |
| FB1 | BLM15EX331SN1D | INDC1006X60N |
| FB2 | BLM15EX331SN1D | INDC1006X60N |
| FRAME1 |  | undefined |
| FRAME2 |  | undefined |
| FRAME3 |  | undefined |
| J1 | PANEL XLR-5: COM,-,+,SHELL | PANEL4_WIRE_PADS |
| J2 | PANEL DIN-5 MIDI IN | PANEL5_WIRE_PADS |
| J3 | FREE GPIO PADS | PADBANK17 |
| J4 | ANALOG PADS | PADBANK5 |
| J5 | RESERVED SIGNAL TEST PADS | PADBANK7 |
| J6 | POWER/DMX TEST PADS | PADBANK8 |
| L1 | ACT45B-510-2P-TL003 - DNP | ACT45B_4P5X3P2 |
| R1 | 100k 1% 0.063W 0402 Yageo RC0402FR-07100KL | RESC1005X40 |
| R2 | 10k 1% 0.063W 0402 Yageo RC0402FR-0710KL | RESC1005X40 |
| R3 | 10k 1% 0.063W 0402 Yageo RC0402FR-0710KL | RESC1005X40 |
| R4 | 220R 1% 0.1W 0603 Yageo RC0603FR-07220RL | RESC1608X60 |
| R5 | 220R 1% 0.1W 0603 Yageo RC0603FR-07220RL | RESC1608X60 |
| R6 | 4.7k 1% 0.1W 0603 Yageo RC0603FR-074K7L | RESC1608X60 |
| R7 | 47k 1% 0.1W 0603 Yageo RC0603FR-0747KL | RESC1608X60 |
| R8 | 1k 1% 0.1W 0603 Yageo RC0603FR-071KL | RESC1608X60 |
| R9 | 1k 1% 0.1W 0603 Yageo RC0603FR-071KL | RESC1608X60 |
| R10 | 0R 5% 0.1W 0603 Yageo RC0603JR-070RL CMC BYPASS FIT | RESC1608X60 |
| R11 | 0R 5% 0.1W 0603 Yageo RC0603JR-070RL CMC BYPASS FIT | RESC1608X60 |
| SW1 | PTS810SJM250SMTR LFS RESET (NO) | PTS810_J_LEAD |
| U1 | Raspberry Pi Pico 2 W | PICO_2_W_DEVELOPMENT_BOARD |
| U2 | ISOW1412DFMR | DFM0020A_TI |
| U3 | HCPL-0700-500E | HCPL0700_SO8 |

## Nets

| Net | Physical endpoints |
|---|---|
| `ADC_VREF` | J4.4 (P4)<br>U1.35 (ADC_VREF) |
| `ADC0_GPIO26` | J4.1 (P1)<br>U1.31 (GP26_ADC0) |
| `ADC1_GPIO27` | J4.2 (P2)<br>U1.32 (GP27_ADC1) |
| `ADC2_GPIO28` | J4.3 (P3)<br>U1.34 (GP28_ADC2) |
| `AGND` | J4.5 (P5)<br>U1.33 (AGND) |
| `DMX_ACTIVITY_GPIO7` | J5.6 (P6)<br>R9.1 (1)<br>U1.10 (GP7) |
| `DMX_DATA_MINUS` | D1.2 (IO2)<br>J1.2 (P2)<br>J6.8 (P8)<br>L1.3 (B2)<br>R11.2 (2) |
| `DMX_DATA_PLUS` | D1.1 (IO1)<br>J1.3 (P3)<br>J6.7 (P7)<br>L1.2 (A2)<br>R10.2 (2) |
| `DMX_DIR_GPIO4` | J5.3 (P3)<br>R2.1 (1)<br>U1.6 (GP4)<br>U2.3 (DE)<br>U2.5 (RE_N) |
| `DMX_LED_ANODE` | D4.A (A)<br>R9.2 (2) |
| `DMX_RX_GPIO6` | J5.5 (P5)<br>U1.9 (GP6)<br>U2.4 (R) |
| `DMX_TRIGGER_GPIO3` | J5.2 (P2)<br>U1.5 (GP3) |
| `DMX_TRX_MINUS` | L1.4 (B1)<br>R11.1 (1)<br>U2.19 (B)<br>U2.18 (Z) |
| `DMX_TRX_PLUS` | L1.1 (A1)<br>R10.1 (1)<br>U2.20 (A)<br>U2.17 (Y) |
| `DMX_TX_GPIO2` | J5.1 (P1)<br>R1.2 (2)<br>U1.4 (GP2)<br>U2.2 (D) |
| `GND_DMX_CONVERTER` | C4.2 (2)<br>C5.2 (2)<br>C9.2 (2)<br>FB2.1 (1)<br>U2.11 (GND2) |
| `GND_DMX_ISO` | C6.2 (2)<br>D1.3 (GND)<br>FB2.2 (2)<br>J1.1 (P1)<br>J6.6 (P6)<br>U2.15 (GISOIN) |
| `GND_LOGIC` | C1.2 (2)<br>C2.2 (2)<br>C3.2 (2)<br>C7.2 (2)<br>C8.2 (2)<br>D3.C (K)<br>D4.C (K)<br>J6.2 (P2)<br>R2.2 (2)<br>R7.2 (2)<br>SW1.3 (P$3)<br>SW1.4 (P$4)<br>U1.3 (GND3)<br>U1.8 (GND8)<br>U1.13 (GND13)<br>U1.18 (GND18)<br>U1.23 (GND23)<br>U1.28 (GND28)<br>U1.38 (GND38)<br>U2.10 (GND1)<br>U2.6 (GNDIO)<br>U3.5 (GND) |
| `GPIO0_EXP` | J3.1 (P1)<br>U1.1 (GP0) |
| `GPIO1_EXP` | J3.2 (P2)<br>U1.2 (GP1) |
| `GPIO10_EXP` | J3.5 (P5)<br>U1.14 (GP10) |
| `GPIO11_EXP` | J3.6 (P6)<br>U1.15 (GP11) |
| `GPIO12_EXP` | J3.7 (P7)<br>U1.16 (GP12) |
| `GPIO13_EXP` | J3.8 (P8)<br>U1.17 (GP13) |
| `GPIO14_EXP` | J3.9 (P9)<br>U1.19 (GP14) |
| `GPIO15_EXP` | J3.10 (P10)<br>U1.20 (GP15) |
| `GPIO16_EXP` | J3.11 (P11)<br>U1.21 (GP16) |
| `GPIO17_EXP` | J3.12 (P12)<br>U1.22 (GP17) |
| `GPIO18_EXP` | J3.13 (P13)<br>U1.24 (GP18) |
| `GPIO19_EXP` | J3.14 (P14)<br>U1.25 (GP19) |
| `GPIO20_EXP` | J3.15 (P15)<br>U1.26 (GP20) |
| `GPIO21_EXP` | J3.16 (P16)<br>U1.27 (GP21) |
| `GPIO22_EXP` | J3.17 (P17)<br>U1.29 (GP22) |
| `GPIO8_EXP` | J3.3 (P3)<br>U1.11 (GP8) |
| `GPIO9_EXP` | J3.4 (P4)<br>U1.12 (GP9) |
| `ISOW_EN_FLT` | J5.7 (P7)<br>R3.2 (2)<br>U2.8 (EN_FLT) |
| `MIDI_DIN_PIN1_SPARE` | J2.1 (P1) |
| `MIDI_DIN_PIN2_SHIELD` | J2.2 (P2) |
| `MIDI_DIN_PIN3_SPARE` | J2.3 (P3) |
| `MIDI_DIN_PIN4` | J2.4 (P4)<br>R4.1 (1) |
| `MIDI_DIN_PIN5` | J2.5 (P5)<br>R5.2 (2) |
| `MIDI_OPTO_BASE` | R7.1 (1)<br>U3.7 (VB) |
| `MIDI_OPTO_LED_ANODE` | D2.C (K)<br>R4.2 (2)<br>U3.2 (A) |
| `MIDI_OPTO_LED_CATHODE` | D2.A (A)<br>R5.1 (1)<br>U3.3 (K) |
| `MIDI_RX_GPIO5` | J5.4 (P4)<br>R6.2 (2)<br>U1.7 (GP5)<br>U3.6 (VO) |
| `NC_U2_PIN14_IN` | U2.14 (IN) |
| `NC_U2_PIN7_OUT` | U2.7 (OUT) |
| `NC_U3_PIN1` | U3.1 (NC1) |
| `NC_U3_PIN4` | U3.4 (NC4) |
| `PICO_RUN_N` | SW1.1 (P$1)<br>SW1.2 (P$2)<br>U1.30 (RUN) |
| `PICO_SMPS_EN` | U1.37 (3V3_EN) |
| `PICO_VSYS` | U1.39 (VSYS) |
| `PWR_LED_ANODE` | D3.A (A)<br>R8.2 (2) |
| `VBUS_5V_USB` | C7.1 (1)<br>F1.1 (1)<br>J6.3 (P3)<br>U1.40 (VBUS)<br>U3.8 (VCC) |
| `VCC_3V3_LOGIC` | C1.1 (1)<br>J6.1 (P1)<br>R1.1 (1)<br>R3.1 (1)<br>R6.1 (1)<br>R8.1 (1)<br>U1.36 (3V3)<br>U2.1 (VIO) |
| `VCC_5V_DMX_ISO` | C6.1 (1)<br>FB1.2 (2)<br>J6.5 (P5)<br>U2.16 (VISOIN) |
| `VDD_5V_ISOW_FUSED` | C2.1 (1)<br>C3.1 (1)<br>C8.1 (1)<br>F1.2 (2)<br>J6.4 (P4)<br>U2.9 (VDD) |
| `VISO_5V_CONVERTER` | C4.1 (1)<br>C5.1 (1)<br>C9.1 (1)<br>FB1.1 (1)<br>U2.13 (MODE)<br>U2.12 (VISOOUT) |
| `XLR_SHELL` | J1.4 (P4) |
