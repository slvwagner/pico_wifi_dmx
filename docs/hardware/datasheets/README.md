# WiFiPicoDMX Rev. A datasheet index

This directory contains the critical component documentation for the proposed
WiFiPicoDMX Rev. A controller hardware. The local copies are stored in
[`pdfs/`](pdfs/); source links are retained so revisions can be checked.

| Ref. | Part | Local document | Manufacturer source |
|---|---|---|---|
| U1 | Raspberry Pi Pico 2 W (SC1633) | [Datasheet](pdfs/U1_Pico_2_W_Datasheet.pdf), [pinout](pdfs/U1_Pico_2_W_Pinout.pdf), [schematic](pdfs/U1_Pico_2_W_Schematic.pdf) | [Raspberry Pi documentation](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html) |
| U2 | SN74LVC1G04DBVR | [Datasheet](pdfs/U2_SN74LVC1G04.pdf) | [TI datasheet](https://www.ti.com/lit/ds/symlink/sn74lvc1g04.pdf) |
| U3 | ISO1410DW / ISO1410BDW | [Datasheet](pdfs/U3_ISO1410.pdf) | [TI datasheet](https://www.ti.com/lit/ds/symlink/iso1410.pdf) |
| U4 | MEJ2S0505SC | [Datasheet](pdfs/U4_MEJ2S0505SC_MEJ2_Series.pdf) | [Murata datasheet](https://www.murata.com/-/media/webrenewal/products/power/datasheet/kdc_mej2.ashx?cvid=20200224051005000000&la=en) |
| U5 | 6N138 | [Datasheet](pdfs/U5_6N138.pdf) | [Vishay document](https://www.vishay.com/doc?83605=) |
| D1 | SS34 | [SS32–SS36 datasheet](pdfs/D1_SS34.pdf) | [Vishay document](https://www.vishay.com/doc?88751=) |
| D2 | SM712.TCT | [Datasheet](pdfs/D2_SM712.pdf) | [Semtech product page](https://www.semtech.com/products/circuit-protection/esd-protection/sm712) |
| D3 | 1N4148 | [Datasheet](pdfs/D3_1N4148.pdf) | [Vishay document](https://www.vishay.com/doc?81857=) |
| F1 | 1206L075THYR | [1206L series datasheet](pdfs/F1_1206L_PTC_Series.pdf) | [Littelfuse 1206L datasheet](https://www.littelfuse.com/assetdocs/littelfuse-ptc-1206l-datasheet?assetguid=2b6a1515-d4ee-4c83-8bd4-152b4901b8f5) |
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
