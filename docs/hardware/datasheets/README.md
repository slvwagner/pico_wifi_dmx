# WiFiPicoDMX Rev. A datasheet index

This directory contains the critical component documentation for the proposed
WiFiPicoDMX Rev. A controller hardware. The local copies are stored in
[`pdfs/`](pdfs/); source links are retained so revisions can be checked.

| Ref. | Part | Local document | Manufacturer source |
|---|---|---|---|
| U1 | Raspberry Pi Pico 2 W (SC1633) | [Datasheet](pdfs/U1_Pico_2_W_Datasheet.pdf), [pinout](pdfs/U1_Pico_2_W_Pinout.pdf), [schematic](pdfs/U1_Pico_2_W_Schematic.pdf) | [Raspberry Pi documentation](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html) |
| U2 | ISOW1412DFMR | [Datasheet](pdfs/U2_ISOW1412.pdf) | [TI datasheet](https://www.ti.com/lit/ds/symlink/isow1412.pdf) |
| U3 | HCPL-0700-500E, genuine SOIC-8 | [Datasheet](pdfs/U3_HCPL-0700.pdf) | [Broadcom datasheet](https://docs.broadcom.com/doc/AV02-1359EN) |
| D1 | SM712.TCT | [Datasheet](pdfs/D2_SM712.pdf) | [Semtech product page](https://www.semtech.com/products/circuit-protection/esd-protection/sm712) |
| D2 | 1N4148WS-E3-08 | [Datasheet](pdfs/D3_1N4148WS.pdf) | [Vishay datasheet](https://www.vishay.com/docs/86455/1n4148ws.pdf) |
| F1 | 1206L050YR (0.5 A hold / 1.0 A trip) | [1206L series datasheet](pdfs/F1_1206L_PTC_Series.pdf) | [Littelfuse 1206L datasheet](https://www.littelfuse.com/assetdocs/littelfuse-ptc-1206l-datasheet?assetguid=2b6a1515-d4ee-4c83-8bd4-152b4901b8f5) |
| L1 | TDK ACT45B-510-2P-TL003 | [ACT45B datasheet](pdfs/L1_TDK_ACT45B.pdf) | [TDK datasheet](https://www.tdk-electronics.tdk.com/inf/30/ds/act45b.pdf) |
| J2 | Neutrik NC5FAH | [Mechanical drawing](pdfs/J2_Neutrik_NC5FAH-3.pdf) | [Neutrik drawing](https://www.neutrik.com/media/8323/download/nc5fah-3.pdf?v=1) |
| SW1 | C&K/Littelfuse PTS810SJM250SMTR LFS | [PTS810 datasheet](pdfs/SW1_PTS810.pdf) | [Littelfuse datasheet](https://www.littelfuse.com/assetdocs/littelfuse-c-k-tactile-pts810-series-datasheet?assetguid=f1e4bc97-66e9-4beb-99c6-eaef0bd3bff4) |

The exact DIN-5 MIDI connector, terminal block, headers, and generic
mechanical/passive parts still depend on mechanical design. `L1` now has a
final manufacturer part number, but remains DNP by default until EMC and
signal-integrity testing confirms that it should replace the two zero-ohm
bypasses.

Broadcom publishes the `HCPL-0700` in a combined family datasheet. U3 is fixed
as `HCPL-0700-500E`; its generated SOIC-8 footprint remains preliminary and
must be checked against the manufacturer's land-pattern dimensions before PCB
production.

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
- [SS34](pdfs/D1_SS34.pdf) — not required when Rev. A is powered only through
  the Pico 2 W USB connector;
- [ISO1410](pdfs/U3_ISO1410.pdf) — replaced by integrated-power ISOW1412;
- [MEJ2S0505SC](pdfs/U4_MEJ2S0505SC_MEJ2_Series.pdf) — through-hole converter
  replaced by ISOW1412 integrated isolated power;
- [through-hole 6N138](pdfs/U5_6N138.pdf);
- [axial 1N4148](pdfs/D3_1N4148.pdf).
