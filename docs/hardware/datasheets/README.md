# WiFiPicoDMX Rev. A datasheet index

This directory contains the critical component documentation for the proposed
WiFiPicoDMX Rev. A controller hardware. The local copies are stored in
[`pdfs/`](pdfs/); source links are retained so revisions can be checked.

| Ref. | Part | Local document | Manufacturer source |
|---|---|---|---|
| U1 | Raspberry Pi Pico 2 W (SC1633) | [Datasheet](pdfs/U1_Pico_2_W_Datasheet.pdf), [pinout](pdfs/U1_Pico_2_W_Pinout.pdf), [schematic](pdfs/U1_Pico_2_W_Schematic.pdf) | [Raspberry Pi documentation](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html) |
| U2 | ISOW1412DFMR | [Datasheet](pdfs/U2_ISOW1412.pdf) | [TI datasheet](https://www.ti.com/lit/ds/symlink/isow1412.pdf) |
| U3 | 6N138-500E | [Datasheet](pdfs/U3_6N138-500E.pdf) | [Broadcom datasheet](https://docs.broadcom.com/doc/AV02-1359EN) |
| D1 | SS34 | [SS32–SS36 datasheet](pdfs/D1_SS34.pdf) | [Vishay document](https://www.vishay.com/doc?88751=) |
| D2 | SM712.TCT | [Datasheet](pdfs/D2_SM712.pdf) | [Semtech product page](https://www.semtech.com/products/circuit-protection/esd-protection/sm712) |
| D3 | 1N4148WS-E3-08 | [Datasheet](pdfs/D3_1N4148WS.pdf) | [Vishay datasheet](https://www.vishay.com/docs/86455/1n4148ws.pdf) |
| F1 | 1206L050YR (0.5 A hold / 1.0 A trip) | [1206L series datasheet](pdfs/F1_1206L_PTC_Series.pdf) | [Littelfuse 1206L datasheet](https://www.littelfuse.com/assetdocs/littelfuse-ptc-1206l-datasheet?assetguid=2b6a1515-d4ee-4c83-8bd4-152b4901b8f5) |
| J2 | Neutrik NC5FAH | [Mechanical drawing](pdfs/J2_Neutrik_NC5FAH-3.pdf) | [Neutrik drawing](https://www.neutrik.com/media/8323/download/nc5fah-3.pdf?v=1) |

The exact DIN-5 MIDI connector, terminal block, headers, reset switch, optional
common-mode choke, and generic mechanical/passive parts do not yet have final
manufacturer part numbers. Add their definitive datasheets after those parts
are selected during mechanical and PCB design.

For a browser-friendly version, open
[DATASHEET_INDEX.html](DATASHEET_INDEX.html).

File sizes, retrieval sources, and SHA-256 hashes are recorded in
[`SOURCES.md`](SOURCES.md).

The downloaded documents remain copyrighted by their respective owners and
are retained here solely as engineering references.

## Superseded design references

The following documents are retained for design history and fallback review,
but their parts are not in the current production BOM:

- [SN74LVC1G04](pdfs/U2_SN74LVC1G04.pdf) — inverter removed;
- [ISO1410](pdfs/U3_ISO1410.pdf) — replaced by integrated-power ISOW1412;
- [MEJ2S0505SC](pdfs/U4_MEJ2S0505SC_MEJ2_Series.pdf) — through-hole converter
  replaced by ISOW1412 integrated isolated power;
- [through-hole 6N138](pdfs/U5_6N138.pdf);
- [axial 1N4148](pdfs/D3_1N4148.pdf).
