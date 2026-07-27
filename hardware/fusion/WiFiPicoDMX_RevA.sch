<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE eagle SYSTEM "eagle.dtd">
<eagle version="9.6.2">
  <drawing>
    <settings>
      <setting alwaysvectorfont="no"/>
      <setting verticaltext="up"/>
    </settings>
    <grid distance="0.1" unitdist="inch" unit="inch" style="lines" multiple="1" display="yes" altdistance="0.01" altunitdist="inch" altunit="inch"/>
    <layers>
      <layer number="1" name="Top" color="4" fill="1" visible="yes" active="yes"/>
      <layer number="16" name="Bottom" color="1" fill="1" visible="yes" active="yes"/>
      <layer number="17" name="Pads" color="2" fill="1" visible="yes" active="yes"/>
      <layer number="18" name="Vias" color="2" fill="1" visible="yes" active="yes"/>
      <layer number="19" name="Unrouted" color="6" fill="1" visible="yes" active="yes"/>
      <layer number="20" name="Dimension" color="15" fill="1" visible="yes" active="yes"/>
      <layer number="21" name="tPlace" color="7" fill="1" visible="yes" active="yes"/>
      <layer number="22" name="bPlace" color="7" fill="1" visible="yes" active="yes"/>
      <layer number="25" name="tNames" color="7" fill="1" visible="yes" active="yes"/>
      <layer number="27" name="tValues" color="7" fill="1" visible="yes" active="yes"/>
      <layer number="29" name="tStop" color="7" fill="3" visible="yes" active="yes"/>
      <layer number="31" name="tCream" color="7" fill="4" visible="yes" active="yes"/>
      <layer number="39" name="tKeepout" color="4" fill="11" visible="yes" active="yes"/>
      <layer number="41" name="tRestrict" color="4" fill="10" visible="yes" active="yes"/>
      <layer number="44" name="Drills" color="7" fill="1" visible="yes" active="yes"/>
      <layer number="45" name="Holes" color="7" fill="1" visible="yes" active="yes"/>
      <layer number="90" name="Modules" color="5" fill="1" visible="yes" active="yes"/>
      <layer number="91" name="Nets" color="2" fill="1" visible="yes" active="yes"/>
      <layer number="92" name="Busses" color="1" fill="1" visible="yes" active="yes"/>
      <layer number="93" name="Pins" color="2" fill="1" visible="yes" active="yes"/>
      <layer number="94" name="Symbols" color="4" fill="1" visible="yes" active="yes"/>
      <layer number="95" name="Names" color="7" fill="1" visible="yes" active="yes"/>
      <layer number="96" name="Values" color="7" fill="1" visible="yes" active="yes"/>
    </layers>
    <schematic xreflabel="%F%N/%S.%C%R" xrefpart="/%S.%C%R">
      <description>WiFiPicoDMX Rev. A preliminary Fusion/EAGLE schematic. Generated from docs/hardware/SCHEMATIC_DESIGN.md. Electrical review and manufacturer footprint verification are mandatory before PCB release.</description>
      <libraries>
        <library name="WiFiPicoDMX_RevA_embedded">
          <description>Self-contained preliminary WiFiPicoDMX Rev. A schematic library. Verify every footprint before PCB manufacture.</description>
          <packages>
            <package name="R0402">
                      <smd name="1" x="-0.6" y="0" dx="1" dy="0.9" layer="1"/>
                      <smd name="2" x="0.6" y="0" dx="1" dy="0.9" layer="1"/>
                      <wire x1="-0.6" y1="0.9" x2="0.6" y2="0.9" width="0.1524" layer="21"/>
                      <wire x1="0.6" y1="0.9" x2="0.6" y2="-0.9" width="0.1524" layer="21"/>
                      <wire x1="0.6" y1="-0.9" x2="-0.6" y2="-0.9" width="0.1524" layer="21"/>
                      <wire x1="-0.6" y1="-0.9" x2="-0.6" y2="0.9" width="0.1524" layer="21"/>
                      <text x="-0.6" y="1.7000000000000002" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="R0603">
                      <smd name="1" x="-0.9" y="0" dx="1.1" dy="1" layer="1"/>
                      <smd name="2" x="0.9" y="0" dx="1.1" dy="1" layer="1"/>
                      <wire x1="-0.9" y1="1" x2="0.9" y2="1" width="0.1524" layer="21"/>
                      <wire x1="0.9" y1="1" x2="0.9" y2="-1" width="0.1524" layer="21"/>
                      <wire x1="0.9" y1="-1" x2="-0.9" y2="-1" width="0.1524" layer="21"/>
                      <wire x1="-0.9" y1="-1" x2="-0.9" y2="1" width="0.1524" layer="21"/>
                      <text x="-0.9" y="1.8" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="C0402">
                      <smd name="1" x="-0.6" y="0" dx="1" dy="0.9" layer="1"/>
                      <smd name="2" x="0.6" y="0" dx="1" dy="0.9" layer="1"/>
                      <wire x1="-0.6" y1="0.9" x2="0.6" y2="0.9" width="0.1524" layer="21"/>
                      <wire x1="0.6" y1="0.9" x2="0.6" y2="-0.9" width="0.1524" layer="21"/>
                      <wire x1="0.6" y1="-0.9" x2="-0.6" y2="-0.9" width="0.1524" layer="21"/>
                      <wire x1="-0.6" y1="-0.9" x2="-0.6" y2="0.9" width="0.1524" layer="21"/>
                      <text x="-0.6" y="1.7000000000000002" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="C0805">
                      <smd name="1" x="-1.1" y="0" dx="1.4" dy="1.3" layer="1"/>
                      <smd name="2" x="1.1" y="0" dx="1.4" dy="1.3" layer="1"/>
                      <wire x1="-1.1" y1="1.3" x2="1.1" y2="1.3" width="0.1524" layer="21"/>
                      <wire x1="1.1" y1="1.3" x2="1.1" y2="-1.3" width="0.1524" layer="21"/>
                      <wire x1="1.1" y1="-1.3" x2="-1.1" y2="-1.3" width="0.1524" layer="21"/>
                      <wire x1="-1.1" y1="-1.3" x2="-1.1" y2="1.3" width="0.1524" layer="21"/>
                      <text x="-1.1" y="2.1" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="PPTC1206">
                      <smd name="1" x="-1.4" y="0" dx="1.6" dy="1.8" layer="1"/>
                      <smd name="2" x="1.4" y="0" dx="1.6" dy="1.8" layer="1"/>
                      <wire x1="-1.4" y1="1.8" x2="1.4" y2="1.8" width="0.1524" layer="21"/>
                      <wire x1="1.4" y1="1.8" x2="1.4" y2="-1.8" width="0.1524" layer="21"/>
                      <wire x1="1.4" y1="-1.8" x2="-1.4" y2="-1.8" width="0.1524" layer="21"/>
                      <wire x1="-1.4" y1="-1.8" x2="-1.4" y2="1.8" width="0.1524" layer="21"/>
                      <text x="-1.4" y="2.6" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="LED0603">
                      <smd name="1" x="-0.9" y="0" dx="1.1" dy="1" layer="1"/>
                      <smd name="2" x="0.9" y="0" dx="1.1" dy="1" layer="1"/>
                      <wire x1="-0.9" y1="1" x2="0.9" y2="1" width="0.1524" layer="21"/>
                      <wire x1="0.9" y1="1" x2="0.9" y2="-1" width="0.1524" layer="21"/>
                      <wire x1="0.9" y1="-1" x2="-0.9" y2="-1" width="0.1524" layer="21"/>
                      <wire x1="-0.9" y1="-1" x2="-0.9" y2="1" width="0.1524" layer="21"/>
                      <text x="-0.9" y="1.8" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="SOD323">
                      <smd name="1" x="-1.2" y="0" dx="0.8" dy="0.8" layer="1"/>
                      <smd name="2" x="1.2" y="0" dx="0.8" dy="0.8" layer="1"/>
                      <wire x1="-1.2" y1="0.8" x2="1.2" y2="0.8" width="0.1524" layer="21"/>
                      <wire x1="1.2" y1="0.8" x2="1.2" y2="-0.8" width="0.1524" layer="21"/>
                      <wire x1="1.2" y1="-0.8" x2="-1.2" y2="-0.8" width="0.1524" layer="21"/>
                      <wire x1="-1.2" y1="-0.8" x2="-1.2" y2="0.8" width="0.1524" layer="21"/>
                      <text x="-1.2" y="1.6" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="PTS810_PRELIMINARY">
                      <smd name="1" x="-2" y="0.8" dx="1.2" dy="1.5" layer="1"/>
                      <smd name="3" x="-2" y="-0.8" dx="1.2" dy="1.5" layer="1"/>
                      <smd name="2" x="2" y="0.8" dx="1.2" dy="1.5" layer="1"/>
                      <smd name="4" x="2" y="-0.8" dx="1.2" dy="1.5" layer="1"/>
                      <wire x1="-2.1" y1="-1.6" x2="2.1" y2="-1.6" width="0.1524" layer="21"/>
                      <wire x1="2.1" y1="-1.6" x2="2.1" y2="1.6" width="0.1524" layer="21"/>
                      <wire x1="2.1" y1="1.6" x2="-2.1" y2="1.6" width="0.1524" layer="21"/>
                      <wire x1="-2.1" y1="1.6" x2="-2.1" y2="-1.6" width="0.1524" layer="21"/>
                      <text x="-2.1" y="2" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="SOT23">
                      <smd name="1" x="-0.95" y="-1.1" dx="1" dy="1.1" layer="1"/>
                      <smd name="2" x="0.95" y="-1.1" dx="1" dy="1.1" layer="1"/>
                      <smd name="3" x="0" y="1.1" dx="1" dy="1.1" layer="1"/>
                      <wire x1="-1.5" y1="-0.7" x2="1.5" y2="-0.7" width="0.1524" layer="21"/>
                      <wire x1="1.5" y1="-0.7" x2="1.5" y2="0.7" width="0.1524" layer="21"/>
                      <wire x1="1.5" y1="0.7" x2="-1.5" y2="0.7" width="0.1524" layer="21"/>
                      <wire x1="-1.5" y1="0.7" x2="-1.5" y2="-0.7" width="0.1524" layer="21"/>
                      <circle x="-0.8" y="-0.3" radius="0.2" width="0" layer="21"/>
                      <text x="-1.5" y="1.8" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="TDK_ACT45B_PRELIMINARY">
                      <smd name="1" x="-2.2" y="1.1" dx="1.2" dy="1" layer="1"/>
                      <smd name="2" x="2.2" y="1.1" dx="1.2" dy="1" layer="1"/>
                      <smd name="4" x="-2.2" y="-1.1" dx="1.2" dy="1" layer="1"/>
                      <smd name="3" x="2.2" y="-1.1" dx="1.2" dy="1" layer="1"/>
                      <wire x1="-1.6" y1="-1.8" x2="1.6" y2="-1.8" width="0.1524" layer="21"/>
                      <wire x1="1.6" y1="-1.8" x2="1.6" y2="1.8" width="0.1524" layer="21"/>
                      <wire x1="1.6" y1="1.8" x2="-1.6" y2="1.8" width="0.1524" layer="21"/>
                      <wire x1="-1.6" y1="1.8" x2="-1.6" y2="-1.8" width="0.1524" layer="21"/>
                      <text x="-1.6" y="2.2" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="DFM20_PRELIMINARY">
                      <smd name="1" x="-6.45" y="5.715" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="20" x="6.45" y="5.715" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="2" x="-6.45" y="4.445" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="19" x="6.45" y="4.445" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="3" x="-6.45" y="3.175" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="18" x="6.45" y="3.175" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="4" x="-6.45" y="1.9049999999999998" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="17" x="6.45" y="1.9049999999999998" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="5" x="-6.45" y="0.6349999999999998" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="16" x="6.45" y="0.6349999999999998" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="6" x="-6.45" y="-0.6349999999999998" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="15" x="6.45" y="-0.6349999999999998" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="7" x="-6.45" y="-1.9050000000000002" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="14" x="6.45" y="-1.9050000000000002" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="8" x="-6.45" y="-3.1750000000000007" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="13" x="6.45" y="-3.1750000000000007" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="9" x="-6.45" y="-4.445" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="12" x="6.45" y="-4.445" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="10" x="-6.45" y="-5.715" dx="2.2" dy="0.6" layer="1"/>
                      <smd name="11" x="6.45" y="-5.715" dx="2.2" dy="0.6" layer="1"/>
                      <wire x1="-5.2" y1="-6.5" x2="5.2" y2="-6.5" width="0.1524" layer="21"/>
                      <wire x1="5.2" y1="-6.5" x2="5.2" y2="6.5" width="0.1524" layer="21"/>
                      <wire x1="5.2" y1="6.5" x2="-5.2" y2="6.5" width="0.1524" layer="21"/>
                      <wire x1="-5.2" y1="6.5" x2="-5.2" y2="-6.5" width="0.1524" layer="21"/>
                      <circle x="-4.5" y="5.5" radius="0.35" width="0" layer="21"/>
                      <text x="-5.2" y="7.1" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="SOIC8_HCPL0700_PRELIMINARY">
                      <smd name="1" x="-2.9" y="1.905" dx="1.6" dy="0.6" layer="1"/>
                      <smd name="8" x="2.9" y="1.905" dx="1.6" dy="0.6" layer="1"/>
                      <smd name="2" x="-2.9" y="0.635" dx="1.6" dy="0.6" layer="1"/>
                      <smd name="7" x="2.9" y="0.635" dx="1.6" dy="0.6" layer="1"/>
                      <smd name="3" x="-2.9" y="-0.635" dx="1.6" dy="0.6" layer="1"/>
                      <smd name="6" x="2.9" y="-0.635" dx="1.6" dy="0.6" layer="1"/>
                      <smd name="4" x="-2.9" y="-1.905" dx="1.6" dy="0.6" layer="1"/>
                      <smd name="5" x="2.9" y="-1.905" dx="1.6" dy="0.6" layer="1"/>
                      <wire x1="-2" y1="-2.6" x2="2" y2="-2.6" width="0.1524" layer="21"/>
                      <wire x1="2" y1="-2.6" x2="2" y2="2.6" width="0.1524" layer="21"/>
                      <wire x1="2" y1="2.6" x2="-2" y2="2.6" width="0.1524" layer="21"/>
                      <wire x1="-2" y1="2.6" x2="-2" y2="-2.6" width="0.1524" layer="21"/>
                      <circle x="-1.5" y="2.05" radius="0.25" width="0" layer="21"/>
                      <text x="-2" y="3.1" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="PICO2W_CASTELLATED_PRELIMINARY">
                      <smd name="1" x="-10.5" y="24.13" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="40" x="10.5" y="24.13" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="2" x="-10.5" y="21.59" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="39" x="10.5" y="21.59" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="3" x="-10.5" y="19.049999999999997" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="38" x="10.5" y="19.049999999999997" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="4" x="-10.5" y="16.509999999999998" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="37" x="10.5" y="16.509999999999998" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="5" x="-10.5" y="13.969999999999999" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="36" x="10.5" y="13.969999999999999" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="6" x="-10.5" y="11.43" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="35" x="10.5" y="11.43" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="7" x="-10.5" y="8.889999999999999" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="34" x="10.5" y="8.889999999999999" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="8" x="-10.5" y="6.349999999999998" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="33" x="10.5" y="6.349999999999998" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="9" x="-10.5" y="3.8099999999999987" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="32" x="10.5" y="3.8099999999999987" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="10" x="-10.5" y="1.2699999999999996" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="31" x="10.5" y="1.2699999999999996" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="11" x="-10.5" y="-1.2699999999999996" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="30" x="10.5" y="-1.2699999999999996" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="12" x="-10.5" y="-3.8100000000000023" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="29" x="10.5" y="-3.8100000000000023" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="13" x="-10.5" y="-6.350000000000001" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="28" x="10.5" y="-6.350000000000001" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="14" x="-10.5" y="-8.890000000000004" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="27" x="10.5" y="-8.890000000000004" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="15" x="-10.5" y="-11.430000000000003" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="26" x="10.5" y="-11.430000000000003" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="16" x="-10.5" y="-13.970000000000002" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="25" x="10.5" y="-13.970000000000002" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="17" x="-10.5" y="-16.51" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="24" x="10.5" y="-16.51" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="18" x="-10.5" y="-19.05" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="23" x="10.5" y="-19.05" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="19" x="-10.5" y="-21.59" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="22" x="10.5" y="-21.59" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="20" x="-10.5" y="-24.13" dx="2.2" dy="1.7" layer="1"/>
                      <smd name="21" x="10.5" y="-24.13" dx="2.2" dy="1.7" layer="1"/>
                      <wire x1="-10.5" y1="-25.5" x2="10.5" y2="-25.5" width="0.254" layer="21"/>
                      <wire x1="10.5" y1="-25.5" x2="10.5" y2="25.5" width="0.254" layer="21"/>
                      <wire x1="10.5" y1="25.5" x2="-10.5" y2="25.5" width="0.254" layer="21"/>
                      <wire x1="-10.5" y1="25.5" x2="-10.5" y2="-25.5" width="0.254" layer="21"/>
                      <wire x1="-10.5" y1="-25.5" x2="10.5" y2="-25.5" width="0.254" layer="39"/>
                      <wire x1="10.5" y1="-25.5" x2="10.5" y2="-15" width="0.254" layer="39"/>
                      <wire x1="10.5" y1="-15" x2="-10.5" y2="-15" width="0.254" layer="39"/>
                      <wire x1="-10.5" y1="-15" x2="-10.5" y2="-25.5" width="0.254" layer="39"/>
                      <text x="-9.5" y="26" size="1.27" layer="25">&gt;NAME</text>
                      <text x="-9.5" y="-23.5" size="1" layer="21">ANTENNA / COPPER KEEPOUT</text>
                        </package>
            <package name="PANEL4_WIRE_PADS">
                      <smd name="1" x="0" y="-3.81" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="2" x="0" y="-1.27" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="3" x="0" y="1.27" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="4" x="0" y="3.81" dx="2.2" dy="1.6" layer="1"/>
                      <wire x1="-1.5" y1="-5.3100000000000005" x2="1.5" y2="-5.3100000000000005" width="0.1524" layer="21"/>
                      <text x="-1.5" y="6.35" size="1.016" layer="25" rot="R90">&gt;NAME</text>
                      <hole x="4" y="-5" drill="3.2"/>
                      <hole x="4" y="5" drill="3.2"/>
                        </package>
            <package name="PANEL5_WIRE_PADS">
                      <smd name="1" x="0" y="-5.08" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="2" x="0" y="-2.54" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="3" x="0" y="0" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="4" x="0" y="2.54" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="5" x="0" y="5.08" dx="2.2" dy="1.6" layer="1"/>
                      <wire x1="-1.5" y1="-6.58" x2="1.5" y2="-6.58" width="0.1524" layer="21"/>
                      <text x="-1.5" y="7.619999999999999" size="1.016" layer="25" rot="R90">&gt;NAME</text>
                      <hole x="4" y="-6.5" drill="3.2"/>
                      <hole x="4" y="6.5" drill="3.2"/>
                        </package>
            <package name="PADBANK7">
                      <smd name="1" x="0" y="-7.62" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="2" x="0" y="-5.08" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="3" x="0" y="-2.54" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="4" x="0" y="0" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="5" x="0" y="2.54" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="6" x="0" y="5.079999999999999" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="7" x="0" y="7.62" dx="2.2" dy="1.6" layer="1"/>
                      <wire x1="-1.5" y1="-9.120000000000001" x2="1.5" y2="-9.120000000000001" width="0.1524" layer="21"/>
                      <text x="-1.5" y="10.16" size="1.016" layer="25" rot="R90">&gt;NAME</text>
                        </package>
            <package name="PADBANK8">
                      <smd name="1" x="0" y="-8.89" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="2" x="0" y="-6.3500000000000005" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="3" x="0" y="-3.8100000000000005" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="4" x="0" y="-1.2700000000000005" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="5" x="0" y="1.2699999999999996" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="6" x="0" y="3.8099999999999987" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="7" x="0" y="6.35" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="8" x="0" y="8.89" dx="2.2" dy="1.6" layer="1"/>
                      <wire x1="-1.5" y1="-10.39" x2="1.5" y2="-10.39" width="0.1524" layer="21"/>
                      <text x="-1.5" y="11.43" size="1.016" layer="25" rot="R90">&gt;NAME</text>
                        </package>
            <package name="PADBANK17">
                      <smd name="1" x="0" y="-20.32" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="2" x="0" y="-17.78" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="3" x="0" y="-15.24" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="4" x="0" y="-12.7" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="5" x="0" y="-10.16" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="6" x="0" y="-7.620000000000001" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="7" x="0" y="-5.08" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="8" x="0" y="-2.539999999999999" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="9" x="0" y="0" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="10" x="0" y="2.539999999999999" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="11" x="0" y="5.079999999999998" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="12" x="0" y="7.620000000000001" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="13" x="0" y="10.16" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="14" x="0" y="12.700000000000003" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="15" x="0" y="15.240000000000002" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="16" x="0" y="17.78" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="17" x="0" y="20.32" dx="2.2" dy="1.6" layer="1"/>
                      <wire x1="-1.5" y1="-21.82" x2="1.5" y2="-21.82" width="0.1524" layer="21"/>
                      <text x="-1.5" y="22.86" size="1.016" layer="25" rot="R90">&gt;NAME</text>
                        </package>
            <package name="PADBANK5">
                      <smd name="1" x="0" y="-5.08" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="2" x="0" y="-2.54" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="3" x="0" y="0" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="4" x="0" y="2.54" dx="2.2" dy="1.6" layer="1"/>
                      <smd name="5" x="0" y="5.08" dx="2.2" dy="1.6" layer="1"/>
                      <wire x1="-1.5" y1="-6.58" x2="1.5" y2="-6.58" width="0.1524" layer="21"/>
                      <text x="-1.5" y="7.619999999999999" size="1.016" layer="25" rot="R90">&gt;NAME</text>
                        </package>
          </packages>
          <symbols>
            <symbol name="RESISTOR">
                          <wire x1="-2.54" y1="-2.54" x2="2.54" y2="-2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="-2.54" x2="2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="2.54" x2="-2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="-2.54" y1="2.54" x2="-2.54" y2="-2.54" width="0.254" layer="94"/>
                          <text x="-1.27" y="-0.635" size="1.27" layer="94" align="center">R</text>
                          <text x="-2.54" y="5.08" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-2.54" y="-6.35" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="1" x="-7.62" y="0" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="2" x="7.62" y="0" visible="pin" length="middle" direction="pas" rot="R180"/>
                        </symbol>
            <symbol name="CAPACITOR">
                          <wire x1="-2.54" y1="-2.54" x2="2.54" y2="-2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="-2.54" x2="2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="2.54" x2="-2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="-2.54" y1="2.54" x2="-2.54" y2="-2.54" width="0.254" layer="94"/>
                          <text x="-1.27" y="-0.635" size="1.27" layer="94" align="center">C</text>
                          <text x="-2.54" y="5.08" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-2.54" y="-6.35" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="1" x="-7.62" y="0" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="2" x="7.62" y="0" visible="pin" length="middle" direction="pas" rot="R180"/>
                        </symbol>
            <symbol name="FUSE">
                          <wire x1="-2.54" y1="-2.54" x2="2.54" y2="-2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="-2.54" x2="2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="2.54" x2="-2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="-2.54" y1="2.54" x2="-2.54" y2="-2.54" width="0.254" layer="94"/>
                          <text x="-1.27" y="-0.635" size="1.27" layer="94" align="center">F</text>
                          <text x="-2.54" y="5.08" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-2.54" y="-6.35" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="1" x="-7.62" y="0" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="2" x="7.62" y="0" visible="pin" length="middle" direction="pas" rot="R180"/>
                        </symbol>
            <symbol name="FERRITE">
                          <wire x1="-2.54" y1="-2.54" x2="2.54" y2="-2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="-2.54" x2="2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="2.54" x2="-2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="-2.54" y1="2.54" x2="-2.54" y2="-2.54" width="0.254" layer="94"/>
                          <text x="-1.27" y="-0.635" size="1.27" layer="94" align="center">FB</text>
                          <text x="-2.54" y="5.08" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-2.54" y="-6.35" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="1" x="-7.62" y="0" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="2" x="7.62" y="0" visible="pin" length="middle" direction="pas" rot="R180"/>
                        </symbol>
            <symbol name="SWITCH">
                          <wire x1="-2.54" y1="-2.54" x2="2.54" y2="-2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="-2.54" x2="2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="2.54" x2="-2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="-2.54" y1="2.54" x2="-2.54" y2="-2.54" width="0.254" layer="94"/>
                          <text x="-1.27" y="-0.635" size="1.27" layer="94" align="center">SW</text>
                          <text x="-2.54" y="5.08" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-2.54" y="-6.35" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="1" x="-7.62" y="0" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="2" x="7.62" y="0" visible="pin" length="middle" direction="pas" rot="R180"/>
                        </symbol>
            <symbol name="DIODE">
                          <wire x1="-2.54" y1="-2.54" x2="2.54" y2="-2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="-2.54" x2="2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="2.54" x2="-2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="-2.54" y1="2.54" x2="-2.54" y2="-2.54" width="0.254" layer="94"/>
                          <text x="-1.27" y="-0.635" size="1.27" layer="94" align="center">D</text>
                          <text x="-2.54" y="5.08" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-2.54" y="-6.35" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="A" x="-7.62" y="0" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="K" x="7.62" y="0" visible="pin" length="middle" direction="pas" rot="R180"/>
                        </symbol>
            <symbol name="LED">
                          <wire x1="-2.54" y1="-2.54" x2="2.54" y2="-2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="-2.54" x2="2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="2.54" x2="-2.54" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="-2.54" y1="2.54" x2="-2.54" y2="-2.54" width="0.254" layer="94"/>
                          <text x="-1.27" y="-0.635" size="1.27" layer="94" align="center">LED</text>
                          <text x="-2.54" y="5.08" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-2.54" y="-6.35" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="A" x="-7.62" y="0" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="K" x="7.62" y="0" visible="pin" length="middle" direction="pas" rot="R180"/>
                        </symbol>
            <symbol name="PICO2W">
                          <wire x1="-17.78" y1="-42.418000000000006" x2="17.78" y2="-42.418000000000006" width="0.254" layer="94"/>
                          <wire x1="17.78" y1="-42.418000000000006" x2="17.78" y2="42.418000000000006" width="0.254" layer="94"/>
                          <wire x1="17.78" y1="42.418000000000006" x2="-17.78" y2="42.418000000000006" width="0.254" layer="94"/>
                          <wire x1="-17.78" y1="42.418000000000006" x2="-17.78" y2="-42.418000000000006" width="0.254" layer="94"/>
                          <text x="-17.78" y="44.958000000000006" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-17.78" y="-46.22800000000001" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="GP0" x="-22.86" y="38.608000000000004" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GP1" x="-22.86" y="34.544000000000004" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GND3" x="-22.86" y="30.480000000000004" visible="pin" length="middle" direction="pwr" rot="R0"/>
                          <pin name="GP2" x="-22.86" y="26.416000000000004" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GP3" x="-22.86" y="22.352000000000004" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GP4" x="-22.86" y="18.288000000000004" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GP5" x="-22.86" y="14.224000000000004" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GND8" x="-22.86" y="10.160000000000004" visible="pin" length="middle" direction="pwr" rot="R0"/>
                          <pin name="GP6" x="-22.86" y="6.096000000000004" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GP7" x="-22.86" y="2.0320000000000036" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GP8" x="-22.86" y="-2.0319999999999965" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GP9" x="-22.86" y="-6.0959999999999965" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GND13" x="-22.86" y="-10.159999999999997" visible="pin" length="middle" direction="pwr" rot="R0"/>
                          <pin name="GP10" x="-22.86" y="-14.223999999999997" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GP11" x="-22.86" y="-18.287999999999997" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GP12" x="-22.86" y="-22.351999999999997" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GP13" x="-22.86" y="-26.415999999999997" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GND18" x="-22.86" y="-30.47999999999999" visible="pin" length="middle" direction="pwr" rot="R0"/>
                          <pin name="GP14" x="-22.86" y="-34.544" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GP15" x="-22.86" y="-38.608000000000004" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="GP16" x="22.86" y="38.608000000000004" visible="pin" length="middle" direction="io" rot="R180"/>
                          <pin name="GP17" x="22.86" y="34.544000000000004" visible="pin" length="middle" direction="io" rot="R180"/>
                          <pin name="GND23" x="22.86" y="30.480000000000004" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="GP18" x="22.86" y="26.416000000000004" visible="pin" length="middle" direction="io" rot="R180"/>
                          <pin name="GP19" x="22.86" y="22.352000000000004" visible="pin" length="middle" direction="io" rot="R180"/>
                          <pin name="GP20" x="22.86" y="18.288000000000004" visible="pin" length="middle" direction="io" rot="R180"/>
                          <pin name="GP21" x="22.86" y="14.224000000000004" visible="pin" length="middle" direction="io" rot="R180"/>
                          <pin name="GND28" x="22.86" y="10.160000000000004" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="GP22" x="22.86" y="6.096000000000004" visible="pin" length="middle" direction="io" rot="R180"/>
                          <pin name="RUN" x="22.86" y="2.0320000000000036" visible="pin" length="middle" direction="in" rot="R180"/>
                          <pin name="GP26_ADC0" x="22.86" y="-2.0319999999999965" visible="pin" length="middle" direction="io" rot="R180"/>
                          <pin name="GP27_ADC1" x="22.86" y="-6.0959999999999965" visible="pin" length="middle" direction="io" rot="R180"/>
                          <pin name="AGND" x="22.86" y="-10.159999999999997" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="GP28_ADC2" x="22.86" y="-14.223999999999997" visible="pin" length="middle" direction="io" rot="R180"/>
                          <pin name="ADC_VREF" x="22.86" y="-18.287999999999997" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="3V3" x="22.86" y="-22.351999999999997" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="3V3_EN" x="22.86" y="-26.415999999999997" visible="pin" length="middle" direction="in" rot="R180"/>
                          <pin name="GND38" x="22.86" y="-30.47999999999999" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="VSYS" x="22.86" y="-34.544" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="VBUS" x="22.86" y="-38.608000000000004" visible="pin" length="middle" direction="pwr" rot="R180"/>
                        </symbol>
            <symbol name="ISOW1412">
                          <wire x1="-15.24" y1="-26.669999999999998" x2="15.24" y2="-26.669999999999998" width="0.254" layer="94"/>
                          <wire x1="15.24" y1="-26.669999999999998" x2="15.24" y2="26.669999999999998" width="0.254" layer="94"/>
                          <wire x1="15.24" y1="26.669999999999998" x2="-15.24" y2="26.669999999999998" width="0.254" layer="94"/>
                          <wire x1="-15.24" y1="26.669999999999998" x2="-15.24" y2="-26.669999999999998" width="0.254" layer="94"/>
                          <text x="-15.24" y="29.209999999999997" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-15.24" y="-30.479999999999997" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="VIO" x="-20.32" y="22.86" visible="pin" length="middle" direction="pwr" rot="R0"/>
                          <pin name="D" x="-20.32" y="17.78" visible="pin" length="middle" direction="in" rot="R0"/>
                          <pin name="DE" x="-20.32" y="12.7" visible="pin" length="middle" direction="in" rot="R0"/>
                          <pin name="R" x="-20.32" y="7.619999999999999" visible="pin" length="middle" direction="out" rot="R0"/>
                          <pin name="RE_N" x="-20.32" y="2.539999999999999" visible="pin" length="middle" direction="in" rot="R0"/>
                          <pin name="GNDIO" x="-20.32" y="-2.539999999999999" visible="pin" length="middle" direction="pwr" rot="R0"/>
                          <pin name="OUT" x="-20.32" y="-7.620000000000001" visible="pin" length="middle" direction="out" rot="R0"/>
                          <pin name="EN_FLT" x="-20.32" y="-12.700000000000003" visible="pin" length="middle" direction="io" rot="R0"/>
                          <pin name="VDD" x="-20.32" y="-17.78" visible="pin" length="middle" direction="pwr" rot="R0"/>
                          <pin name="GND1" x="-20.32" y="-22.86" visible="pin" length="middle" direction="pwr" rot="R0"/>
                          <pin name="A" x="20.32" y="22.86" visible="pin" length="middle" direction="in" rot="R180"/>
                          <pin name="B" x="20.32" y="17.78" visible="pin" length="middle" direction="in" rot="R180"/>
                          <pin name="Z" x="20.32" y="12.7" visible="pin" length="middle" direction="out" rot="R180"/>
                          <pin name="Y" x="20.32" y="7.619999999999999" visible="pin" length="middle" direction="out" rot="R180"/>
                          <pin name="VISOIN" x="20.32" y="2.539999999999999" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="GISOIN" x="20.32" y="-2.539999999999999" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="IN" x="20.32" y="-7.620000000000001" visible="pin" length="middle" direction="in" rot="R180"/>
                          <pin name="MODE" x="20.32" y="-12.700000000000003" visible="pin" length="middle" direction="in" rot="R180"/>
                          <pin name="VISOOUT" x="20.32" y="-17.78" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="GND2" x="20.32" y="-22.86" visible="pin" length="middle" direction="pwr" rot="R180"/>
                        </symbol>
            <symbol name="OPTO_HCPL0700">
                          <wire x1="-10.16" y1="-15.24" x2="10.16" y2="-15.24" width="0.254" layer="94"/>
                          <wire x1="10.16" y1="-15.24" x2="10.16" y2="15.24" width="0.254" layer="94"/>
                          <wire x1="10.16" y1="15.24" x2="-10.16" y2="15.24" width="0.254" layer="94"/>
                          <wire x1="-10.16" y1="15.24" x2="-10.16" y2="-15.24" width="0.254" layer="94"/>
                          <text x="-10.16" y="17.78" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-10.16" y="-19.05" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="NC1" x="-15.24" y="11.43" visible="pin" length="middle" direction="nc" rot="R0"/>
                          <pin name="A" x="-15.24" y="3.8099999999999996" visible="pin" length="middle" direction="in" rot="R0"/>
                          <pin name="K" x="-15.24" y="-3.8100000000000005" visible="pin" length="middle" direction="in" rot="R0"/>
                          <pin name="NC4" x="-15.24" y="-11.43" visible="pin" length="middle" direction="nc" rot="R0"/>
                          <pin name="VCC" x="15.24" y="11.43" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="VB" x="15.24" y="3.8099999999999996" visible="pin" length="middle" direction="in" rot="R180"/>
                          <pin name="VO" x="15.24" y="-3.8100000000000005" visible="pin" length="middle" direction="out" rot="R180"/>
                          <pin name="GND" x="15.24" y="-11.43" visible="pin" length="middle" direction="pwr" rot="R180"/>
                        </symbol>
            <symbol name="TVS_SM712">
                          <wire x1="-2.54" y1="-5.08" x2="2.54" y2="-5.08" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="-5.08" x2="2.54" y2="5.08" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="5.08" x2="-2.54" y2="5.08" width="0.254" layer="94"/>
                          <wire x1="-2.54" y1="5.08" x2="-2.54" y2="-5.08" width="0.254" layer="94"/>
                          <text x="-1.27" y="-0.635" size="1.27" layer="94" align="center">SM712</text>
                          <text x="-2.54" y="7.62" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-2.54" y="-8.89" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="IO1" x="-7.62" y="2.54" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="IO2" x="-7.62" y="-2.54" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="GND" x="7.62" y="0" visible="pin" length="middle" direction="pwr" rot="R180"/>
                        </symbol>
            <symbol name="CMC">
                          <wire x1="-2.54" y1="-5.08" x2="2.54" y2="-5.08" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="-5.08" x2="2.54" y2="5.08" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="5.08" x2="-2.54" y2="5.08" width="0.254" layer="94"/>
                          <wire x1="-2.54" y1="5.08" x2="-2.54" y2="-5.08" width="0.254" layer="94"/>
                          <text x="-1.27" y="-0.635" size="1.27" layer="94" align="center">CMC</text>
                          <text x="-2.54" y="7.62" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-2.54" y="-8.89" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="A1" x="-7.62" y="2.54" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="B1" x="-7.62" y="-2.54" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="A2" x="7.62" y="2.54" visible="pin" length="middle" direction="pas" rot="R180"/>
                          <pin name="B2" x="7.62" y="-2.54" visible="pin" length="middle" direction="pas" rot="R180"/>
                        </symbol>
            <symbol name="CONN4">
                          <wire x1="0" y1="-10.16" x2="7.62" y2="-10.16" width="0.254" layer="94"/>
                          <wire x1="7.62" y1="-10.16" x2="7.62" y2="10.16" width="0.254" layer="94"/>
                          <wire x1="7.62" y1="10.16" x2="0" y2="10.16" width="0.254" layer="94"/>
                          <wire x1="0" y1="10.16" x2="0" y2="-10.16" width="0.254" layer="94"/>
                          <text x="0" y="12.7" size="1.778" layer="95">&gt;NAME</text>
                          <text x="0" y="-13.97" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="P1" x="-5.08" y="7.62" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P2" x="-5.08" y="2.54" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P3" x="-5.08" y="-2.54" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P4" x="-5.08" y="-7.62" visible="pin" length="middle" direction="pas" rot="R0"/>
                        </symbol>
            <symbol name="CONN5">
                          <wire x1="0" y1="-12.7" x2="7.62" y2="-12.7" width="0.254" layer="94"/>
                          <wire x1="7.62" y1="-12.7" x2="7.62" y2="12.7" width="0.254" layer="94"/>
                          <wire x1="7.62" y1="12.7" x2="0" y2="12.7" width="0.254" layer="94"/>
                          <wire x1="0" y1="12.7" x2="0" y2="-12.7" width="0.254" layer="94"/>
                          <text x="0" y="15.239999999999998" size="1.778" layer="95">&gt;NAME</text>
                          <text x="0" y="-16.509999999999998" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="P1" x="-5.08" y="10.16" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P2" x="-5.08" y="5.08" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P3" x="-5.08" y="0" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P4" x="-5.08" y="-5.08" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P5" x="-5.08" y="-10.16" visible="pin" length="middle" direction="pas" rot="R0"/>
                        </symbol>
            <symbol name="CONN7">
                          <wire x1="0" y1="-17.78" x2="7.62" y2="-17.78" width="0.254" layer="94"/>
                          <wire x1="7.62" y1="-17.78" x2="7.62" y2="17.78" width="0.254" layer="94"/>
                          <wire x1="7.62" y1="17.78" x2="0" y2="17.78" width="0.254" layer="94"/>
                          <wire x1="0" y1="17.78" x2="0" y2="-17.78" width="0.254" layer="94"/>
                          <text x="0" y="20.32" size="1.778" layer="95">&gt;NAME</text>
                          <text x="0" y="-21.59" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="P1" x="-5.08" y="15.24" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P2" x="-5.08" y="10.16" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P3" x="-5.08" y="5.08" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P4" x="-5.08" y="0" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P5" x="-5.08" y="-5.08" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P6" x="-5.08" y="-10.159999999999998" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P7" x="-5.08" y="-15.24" visible="pin" length="middle" direction="pas" rot="R0"/>
                        </symbol>
            <symbol name="CONN8">
                          <wire x1="0" y1="-20.32" x2="7.62" y2="-20.32" width="0.254" layer="94"/>
                          <wire x1="7.62" y1="-20.32" x2="7.62" y2="20.32" width="0.254" layer="94"/>
                          <wire x1="7.62" y1="20.32" x2="0" y2="20.32" width="0.254" layer="94"/>
                          <wire x1="0" y1="20.32" x2="0" y2="-20.32" width="0.254" layer="94"/>
                          <text x="0" y="22.86" size="1.778" layer="95">&gt;NAME</text>
                          <text x="0" y="-24.13" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="P1" x="-5.08" y="17.78" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P2" x="-5.08" y="12.700000000000001" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P3" x="-5.08" y="7.620000000000001" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P4" x="-5.08" y="2.540000000000001" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P5" x="-5.08" y="-2.539999999999999" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P6" x="-5.08" y="-7.619999999999997" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P7" x="-5.08" y="-12.7" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P8" x="-5.08" y="-17.78" visible="pin" length="middle" direction="pas" rot="R0"/>
                        </symbol>
            <symbol name="CONN17">
                          <wire x1="0" y1="-43.18" x2="7.62" y2="-43.18" width="0.254" layer="94"/>
                          <wire x1="7.62" y1="-43.18" x2="7.62" y2="43.18" width="0.254" layer="94"/>
                          <wire x1="7.62" y1="43.18" x2="0" y2="43.18" width="0.254" layer="94"/>
                          <wire x1="0" y1="43.18" x2="0" y2="-43.18" width="0.254" layer="94"/>
                          <text x="0" y="45.72" size="1.778" layer="95">&gt;NAME</text>
                          <text x="0" y="-46.99" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="P1" x="-5.08" y="40.64" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P2" x="-5.08" y="35.56" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P3" x="-5.08" y="30.48" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P4" x="-5.08" y="25.4" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P5" x="-5.08" y="20.32" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P6" x="-5.08" y="15.240000000000002" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P7" x="-5.08" y="10.16" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P8" x="-5.08" y="5.079999999999998" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P9" x="-5.08" y="0" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P10" x="-5.08" y="-5.079999999999998" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P11" x="-5.08" y="-10.159999999999997" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P12" x="-5.08" y="-15.240000000000002" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P13" x="-5.08" y="-20.32" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P14" x="-5.08" y="-25.400000000000006" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P15" x="-5.08" y="-30.480000000000004" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P16" x="-5.08" y="-35.56" visible="pin" length="middle" direction="pas" rot="R0"/>
                          <pin name="P17" x="-5.08" y="-40.64" visible="pin" length="middle" direction="pas" rot="R0"/>
                        </symbol>
          </symbols>
          <devicesets>
            <deviceset name="RES0402" prefix="R">
                          <description>0402 resistor</description>
                          <gates>
                            <gate name="G$1" symbol="RESISTOR" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="R0402">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1"/>
                                <connect gate="G$1" pin="2" pad="2"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="RES0603" prefix="R">
                          <description>0603 resistor</description>
                          <gates>
                            <gate name="G$1" symbol="RESISTOR" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="R0603">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1"/>
                                <connect gate="G$1" pin="2" pad="2"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="CAP0402" prefix="C">
                          <description>0402 capacitor</description>
                          <gates>
                            <gate name="G$1" symbol="CAPACITOR" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="C0402">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1"/>
                                <connect gate="G$1" pin="2" pad="2"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="CAP0805" prefix="C">
                          <description>0805 capacitor</description>
                          <gates>
                            <gate name="G$1" symbol="CAPACITOR" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="C0805">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1"/>
                                <connect gate="G$1" pin="2" pad="2"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="PPTC1206" prefix="F">
                          <description>Littelfuse 1206L050YR</description>
                          <gates>
                            <gate name="G$1" symbol="FUSE" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="PPTC1206">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1"/>
                                <connect gate="G$1" pin="2" pad="2"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="FERRITE0402" prefix="FB">
                          <description>Murata BLM15EX331SN1D</description>
                          <gates>
                            <gate name="G$1" symbol="FERRITE" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="R0402">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1"/>
                                <connect gate="G$1" pin="2" pad="2"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="LED0603" prefix="D">
                          <description>0603 indicator LED</description>
                          <gates>
                            <gate name="G$1" symbol="LED" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="LED0603">
                              <connects>
                                <connect gate="G$1" pin="A" pad="1"/>
                                <connect gate="G$1" pin="K" pad="2"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="DIODE_SOD323" prefix="D">
                          <description>Vishay 1N4148WS-E3-08</description>
                          <gates>
                            <gate name="G$1" symbol="DIODE" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="SOD323">
                              <connects>
                                <connect gate="G$1" pin="A" pad="1"/>
                                <connect gate="G$1" pin="K" pad="2"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="SWITCH_SMD" prefix="SW">
                          <description>C&amp;K/Littelfuse PTS810SJM250SMTR LFS normally-open SMD reset switch</description>
                          <gates>
                            <gate name="G$1" symbol="SWITCH" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="PTS810_PRELIMINARY">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1 3"/>
                                <connect gate="G$1" pin="2" pad="2 4"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="SM712" prefix="D">
                          <description>Semtech SM712.TCT RS-485 TVS</description>
                          <gates>
                            <gate name="G$1" symbol="TVS_SM712" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="SOT23">
                              <connects>
                                <connect gate="G$1" pin="IO1" pad="1"/>
                                <connect gate="G$1" pin="IO2" pad="2"/>
                                <connect gate="G$1" pin="GND" pad="3"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="CMC_OPTION" prefix="L">
                          <description>TDK ACT45B-510-2P-TL003 two-line common-mode choke; normally DNP pending EMC and signal-integrity testing</description>
                          <gates>
                            <gate name="G$1" symbol="CMC" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="TDK_ACT45B_PRELIMINARY">
                              <connects>
                                <connect gate="G$1" pin="A1" pad="1"/>
                                <connect gate="G$1" pin="A2" pad="2"/>
                                <connect gate="G$1" pin="B1" pad="4"/>
                                <connect gate="G$1" pin="B2" pad="3"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="ISOW1412DFMR" prefix="U">
                          <description>TI reinforced isolated RS-485/RDM transceiver with integrated isolated DC/DC</description>
                          <gates>
                            <gate name="G$1" symbol="ISOW1412" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="DFM20_PRELIMINARY">
                              <connects>
                                <connect gate="G$1" pin="VIO" pad="1"/>
                                <connect gate="G$1" pin="D" pad="2"/>
                                <connect gate="G$1" pin="DE" pad="3"/>
                                <connect gate="G$1" pin="R" pad="4"/>
                                <connect gate="G$1" pin="RE_N" pad="5"/>
                                <connect gate="G$1" pin="GNDIO" pad="6"/>
                                <connect gate="G$1" pin="OUT" pad="7"/>
                                <connect gate="G$1" pin="EN_FLT" pad="8"/>
                                <connect gate="G$1" pin="VDD" pad="9"/>
                                <connect gate="G$1" pin="GND1" pad="10"/>
                                <connect gate="G$1" pin="GND2" pad="11"/>
                                <connect gate="G$1" pin="VISOOUT" pad="12"/>
                                <connect gate="G$1" pin="MODE" pad="13"/>
                                <connect gate="G$1" pin="IN" pad="14"/>
                                <connect gate="G$1" pin="GISOIN" pad="15"/>
                                <connect gate="G$1" pin="VISOIN" pad="16"/>
                                <connect gate="G$1" pin="Y" pad="17"/>
                                <connect gate="G$1" pin="Z" pad="18"/>
                                <connect gate="G$1" pin="B" pad="19"/>
                                <connect gate="G$1" pin="A" pad="20"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="PICO2W" prefix="U">
                          <description>Raspberry Pi Pico 2 W castellated module</description>
                          <gates>
                            <gate name="G$1" symbol="PICO2W" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="PICO2W_CASTELLATED_PRELIMINARY">
                              <connects>
                                <connect gate="G$1" pin="GP0" pad="1"/>
                                <connect gate="G$1" pin="GP1" pad="2"/>
                                <connect gate="G$1" pin="GND3" pad="3"/>
                                <connect gate="G$1" pin="GP2" pad="4"/>
                                <connect gate="G$1" pin="GP3" pad="5"/>
                                <connect gate="G$1" pin="GP4" pad="6"/>
                                <connect gate="G$1" pin="GP5" pad="7"/>
                                <connect gate="G$1" pin="GND8" pad="8"/>
                                <connect gate="G$1" pin="GP6" pad="9"/>
                                <connect gate="G$1" pin="GP7" pad="10"/>
                                <connect gate="G$1" pin="GP8" pad="11"/>
                                <connect gate="G$1" pin="GP9" pad="12"/>
                                <connect gate="G$1" pin="GND13" pad="13"/>
                                <connect gate="G$1" pin="GP10" pad="14"/>
                                <connect gate="G$1" pin="GP11" pad="15"/>
                                <connect gate="G$1" pin="GP12" pad="16"/>
                                <connect gate="G$1" pin="GP13" pad="17"/>
                                <connect gate="G$1" pin="GND18" pad="18"/>
                                <connect gate="G$1" pin="GP14" pad="19"/>
                                <connect gate="G$1" pin="GP15" pad="20"/>
                                <connect gate="G$1" pin="GP16" pad="21"/>
                                <connect gate="G$1" pin="GP17" pad="22"/>
                                <connect gate="G$1" pin="GND23" pad="23"/>
                                <connect gate="G$1" pin="GP18" pad="24"/>
                                <connect gate="G$1" pin="GP19" pad="25"/>
                                <connect gate="G$1" pin="GP20" pad="26"/>
                                <connect gate="G$1" pin="GP21" pad="27"/>
                                <connect gate="G$1" pin="GND28" pad="28"/>
                                <connect gate="G$1" pin="GP22" pad="29"/>
                                <connect gate="G$1" pin="RUN" pad="30"/>
                                <connect gate="G$1" pin="GP26_ADC0" pad="31"/>
                                <connect gate="G$1" pin="GP27_ADC1" pad="32"/>
                                <connect gate="G$1" pin="AGND" pad="33"/>
                                <connect gate="G$1" pin="GP28_ADC2" pad="34"/>
                                <connect gate="G$1" pin="ADC_VREF" pad="35"/>
                                <connect gate="G$1" pin="3V3" pad="36"/>
                                <connect gate="G$1" pin="3V3_EN" pad="37"/>
                                <connect gate="G$1" pin="GND38" pad="38"/>
                                <connect gate="G$1" pin="VSYS" pad="39"/>
                                <connect gate="G$1" pin="VBUS" pad="40"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="HCPL_0700_500E" prefix="U">
                          <description>Broadcom HCPL-0700-500E SOIC-8 optocoupler</description>
                          <gates>
                            <gate name="G$1" symbol="OPTO_HCPL0700" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="SOIC8_HCPL0700_PRELIMINARY">
                              <connects>
                                <connect gate="G$1" pin="NC1" pad="1"/>
                                <connect gate="G$1" pin="A" pad="2"/>
                                <connect gate="G$1" pin="K" pad="3"/>
                                <connect gate="G$1" pin="NC4" pad="4"/>
                                <connect gate="G$1" pin="GND" pad="5"/>
                                <connect gate="G$1" pin="VO" pad="6"/>
                                <connect gate="G$1" pin="VB" pad="7"/>
                                <connect gate="G$1" pin="VCC" pad="8"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="PANEL_DMX4" prefix="J">
                          <description>Panel XLR wiring pads plus strain relief</description>
                          <gates>
                            <gate name="G$1" symbol="CONN4" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="PANEL4_WIRE_PADS">
                              <connects>
                                <connect gate="G$1" pin="P1" pad="1"/>
                                <connect gate="G$1" pin="P2" pad="2"/>
                                <connect gate="G$1" pin="P3" pad="3"/>
                                <connect gate="G$1" pin="P4" pad="4"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="PANEL_MIDI5" prefix="J">
                          <description>Panel DIN-5 wiring pads plus strain relief</description>
                          <gates>
                            <gate name="G$1" symbol="CONN5" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="PANEL5_WIRE_PADS">
                              <connects>
                                <connect gate="G$1" pin="P1" pad="1"/>
                                <connect gate="G$1" pin="P2" pad="2"/>
                                <connect gate="G$1" pin="P3" pad="3"/>
                                <connect gate="G$1" pin="P4" pad="4"/>
                                <connect gate="G$1" pin="P5" pad="5"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="PADBANK7" prefix="J">
                          <description>Diagnostic SMD pad bank</description>
                          <gates>
                            <gate name="G$1" symbol="CONN7" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="PADBANK7">
                              <connects>
                                <connect gate="G$1" pin="P1" pad="1"/>
                                <connect gate="G$1" pin="P2" pad="2"/>
                                <connect gate="G$1" pin="P3" pad="3"/>
                                <connect gate="G$1" pin="P4" pad="4"/>
                                <connect gate="G$1" pin="P5" pad="5"/>
                                <connect gate="G$1" pin="P6" pad="6"/>
                                <connect gate="G$1" pin="P7" pad="7"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="PADBANK8" prefix="J">
                          <description>Power and isolated-side diagnostic SMD pad bank</description>
                          <gates>
                            <gate name="G$1" symbol="CONN8" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="PADBANK8">
                              <connects>
                                <connect gate="G$1" pin="P1" pad="1"/>
                                <connect gate="G$1" pin="P2" pad="2"/>
                                <connect gate="G$1" pin="P3" pad="3"/>
                                <connect gate="G$1" pin="P4" pad="4"/>
                                <connect gate="G$1" pin="P5" pad="5"/>
                                <connect gate="G$1" pin="P6" pad="6"/>
                                <connect gate="G$1" pin="P7" pad="7"/>
                                <connect gate="G$1" pin="P8" pad="8"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="PADBANK17" prefix="J">
                          <description>Free GPIO SMD pad bank</description>
                          <gates>
                            <gate name="G$1" symbol="CONN17" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="PADBANK17">
                              <connects>
                                <connect gate="G$1" pin="P1" pad="1"/>
                                <connect gate="G$1" pin="P2" pad="2"/>
                                <connect gate="G$1" pin="P3" pad="3"/>
                                <connect gate="G$1" pin="P4" pad="4"/>
                                <connect gate="G$1" pin="P5" pad="5"/>
                                <connect gate="G$1" pin="P6" pad="6"/>
                                <connect gate="G$1" pin="P7" pad="7"/>
                                <connect gate="G$1" pin="P8" pad="8"/>
                                <connect gate="G$1" pin="P9" pad="9"/>
                                <connect gate="G$1" pin="P10" pad="10"/>
                                <connect gate="G$1" pin="P11" pad="11"/>
                                <connect gate="G$1" pin="P12" pad="12"/>
                                <connect gate="G$1" pin="P13" pad="13"/>
                                <connect gate="G$1" pin="P14" pad="14"/>
                                <connect gate="G$1" pin="P15" pad="15"/>
                                <connect gate="G$1" pin="P16" pad="16"/>
                                <connect gate="G$1" pin="P17" pad="17"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="PADBANK5" prefix="J">
                          <description>Analog SMD pad bank</description>
                          <gates>
                            <gate name="G$1" symbol="CONN5" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="PADBANK5">
                              <connects>
                                <connect gate="G$1" pin="P1" pad="1"/>
                                <connect gate="G$1" pin="P2" pad="2"/>
                                <connect gate="G$1" pin="P3" pad="3"/>
                                <connect gate="G$1" pin="P4" pad="4"/>
                                <connect gate="G$1" pin="P5" pad="5"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
          </devicesets>
        </library>
      </libraries>
      <attributes/>
      <variantdefs/>
      <classes>
        <class number="0" name="default" width="0" drill="0"/>
      </classes>
      <parts>
        <part name="U1" library="WiFiPicoDMX_RevA_embedded" deviceset="PICO2W" device="" value="Raspberry Pi Pico 2 W"/>
        <part name="F1" library="WiFiPicoDMX_RevA_embedded" deviceset="PPTC1206" device="" value="1206L050YR 0.5A HOLD"/>
        <part name="SW1" library="WiFiPicoDMX_RevA_embedded" deviceset="SWITCH_SMD" device="" value="PTS810SJM250SMTR LFS RESET (NO)"/>
        <part name="R8" library="WiFiPicoDMX_RevA_embedded" deviceset="RES0603" device="" value="1k"/>
        <part name="D3" library="WiFiPicoDMX_RevA_embedded" deviceset="LED0603" device="" value="PWR GREEN"/>
        <part name="R9" library="WiFiPicoDMX_RevA_embedded" deviceset="RES0603" device="" value="1k"/>
        <part name="D4" library="WiFiPicoDMX_RevA_embedded" deviceset="LED0603" device="" value="DMX ACTIVITY"/>
        <part name="J3" library="WiFiPicoDMX_RevA_embedded" deviceset="PADBANK17" device="" value="FREE GPIO PADS"/>
        <part name="J4" library="WiFiPicoDMX_RevA_embedded" deviceset="PADBANK5" device="" value="ANALOG PADS"/>
        <part name="J5" library="WiFiPicoDMX_RevA_embedded" deviceset="PADBANK7" device="" value="RESERVED SIGNAL TEST PADS"/>
        <part name="J6" library="WiFiPicoDMX_RevA_embedded" deviceset="PADBANK8" device="" value="POWER/DMX TEST PADS"/>
        <part name="U2" library="WiFiPicoDMX_RevA_embedded" deviceset="ISOW1412DFMR" device="" value="ISOW1412DFMR"/>
        <part name="R1" library="WiFiPicoDMX_RevA_embedded" deviceset="RES0402" device="" value="100k D PULLUP"/>
        <part name="R2" library="WiFiPicoDMX_RevA_embedded" deviceset="RES0402" device="" value="10k DIR PULLDOWN"/>
        <part name="R3" library="WiFiPicoDMX_RevA_embedded" deviceset="RES0402" device="" value="10k EN/FLT PULLUP"/>
        <part name="C1" library="WiFiPicoDMX_RevA_embedded" deviceset="CAP0402" device="" value="100n VIO"/>
        <part name="C2" library="WiFiPicoDMX_RevA_embedded" deviceset="CAP0402" device="" value="10n VDD &lt;=1mm"/>
        <part name="C3" library="WiFiPicoDMX_RevA_embedded" deviceset="CAP0805" device="" value="10u X7R VDD"/>
        <part name="FB1" library="WiFiPicoDMX_RevA_embedded" deviceset="FERRITE0402" device="" value="BLM15EX331SN1D"/>
        <part name="FB2" library="WiFiPicoDMX_RevA_embedded" deviceset="FERRITE0402" device="" value="BLM15EX331SN1D"/>
        <part name="C4" library="WiFiPicoDMX_RevA_embedded" deviceset="CAP0402" device="" value="10n VISOOUT &lt;=1mm"/>
        <part name="C5" library="WiFiPicoDMX_RevA_embedded" deviceset="CAP0805" device="" value="10u X7R VISOOUT"/>
        <part name="C6" library="WiFiPicoDMX_RevA_embedded" deviceset="CAP0402" device="" value="100n VISOIN"/>
        <part name="L1" library="WiFiPicoDMX_RevA_embedded" deviceset="CMC_OPTION" device="" value="ACT45B-510-2P-TL003 - DNP"/>
        <part name="R10" library="WiFiPicoDMX_RevA_embedded" deviceset="RES0603" device="" value="0R CMC BYPASS FIT"/>
        <part name="R11" library="WiFiPicoDMX_RevA_embedded" deviceset="RES0603" device="" value="0R CMC BYPASS FIT"/>
        <part name="D1" library="WiFiPicoDMX_RevA_embedded" deviceset="SM712" device="" value="SM712.TCT"/>
        <part name="J1" library="WiFiPicoDMX_RevA_embedded" deviceset="PANEL_DMX4" device="" value="PANEL XLR-5: COM,-,+,SHELL"/>
        <part name="J2" library="WiFiPicoDMX_RevA_embedded" deviceset="PANEL_MIDI5" device="" value="PANEL DIN-5 MIDI IN"/>
        <part name="R4" library="WiFiPicoDMX_RevA_embedded" deviceset="RES0603" device="" value="220R"/>
        <part name="R5" library="WiFiPicoDMX_RevA_embedded" deviceset="RES0603" device="" value="220R"/>
        <part name="D2" library="WiFiPicoDMX_RevA_embedded" deviceset="DIODE_SOD323" device="" value="1N4148WS-E3-08"/>
        <part name="U3" library="WiFiPicoDMX_RevA_embedded" deviceset="HCPL_0700_500E" device="" value="HCPL-0700-500E"/>
        <part name="R6" library="WiFiPicoDMX_RevA_embedded" deviceset="RES0603" device="" value="4.7k OUTPUT PULLUP"/>
        <part name="R7" library="WiFiPicoDMX_RevA_embedded" deviceset="RES0603" device="" value="47k BASE SPEEDUP"/>
        <part name="C7" library="WiFiPicoDMX_RevA_embedded" deviceset="CAP0402" device="" value="100n VCC"/>
      </parts>
      <sheets>
        <sheet>
                  <plain>
                    <text x="20.32" y="187.96" size="2.54" layer="91" ratio="15">WiFiPicoDMX Rev. A — Controller, power, controls and expansion</text>
                    <text x="20.32" y="15.24" size="1.778" layer="91" ratio="12">Power only through Pico Micro-USB. Do not feed VSYS/VBUS from the carrier.</text>
                    <text x="20.32" y="10.16" size="1.778" layer="91" ratio="12">Pico and all land patterns marked PRELIMINARY require manufacturer-footprint verification before PCB release.</text>
                    <text x="20.32" y="5.08" size="1.778" layer="91" ratio="12">TP6/BOOTSEL is not available on the 40 castellated pins: preserve physical BOOTSEL access; do not assume an electrical carrier connection.</text>
                  </plain>
                  <instances>
                    <instance part="U1" gate="G$1" x="76.2" y="101.6" rot="R0" smashed="no"/>
                    <instance part="F1" gate="G$1" x="137.16" y="172.72" rot="R0" smashed="no"/>
                    <instance part="SW1" gate="G$1" x="137.16" y="157.48" rot="R0" smashed="no"/>
                    <instance part="R8" gate="G$1" x="132.08" y="139.7" rot="R0" smashed="no"/>
                    <instance part="D3" gate="G$1" x="157.48" y="139.7" rot="R0" smashed="no"/>
                    <instance part="R9" gate="G$1" x="132.08" y="124.46" rot="R0" smashed="no"/>
                    <instance part="D4" gate="G$1" x="157.48" y="124.46" rot="R0" smashed="no"/>
                    <instance part="J3" gate="G$1" x="213.36" y="132.08" rot="R0" smashed="no"/>
                    <instance part="J4" gate="G$1" x="213.36" y="71.12" rot="R0" smashed="no"/>
                    <instance part="J5" gate="G$1" x="213.36" y="35.56" rot="R0" smashed="no"/>
                    <instance part="J6" gate="G$1" x="152.4" y="53.34" rot="R0" smashed="no"/>
                  </instances>
                  <busses/>
                  <nets>
                    <net name="ADC_VREF" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="ADC_VREF"/>
                                                    <wire x1="99.06" y1="83.312" x2="104.14" y2="83.312" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="83.312" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J4" gate="G$1" pin="P4"/>
                                                    <wire x1="208.28" y1="66.04" x2="203.2" y2="66.04" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="66.04" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="ADC0_GPIO26" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP26_ADC0"/>
                                                    <wire x1="99.06" y1="99.568" x2="104.14" y2="99.568" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="99.568" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J4" gate="G$1" pin="P1"/>
                                                    <wire x1="208.28" y1="81.28" x2="203.2" y2="81.28" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="81.28" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="ADC1_GPIO27" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP27_ADC1"/>
                                                    <wire x1="99.06" y1="95.50399999999999" x2="104.14" y2="95.50399999999999" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="95.50399999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J4" gate="G$1" pin="P2"/>
                                                    <wire x1="208.28" y1="76.2" x2="203.2" y2="76.2" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="76.2" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="ADC2_GPIO28" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP28_ADC2"/>
                                                    <wire x1="99.06" y1="87.376" x2="104.14" y2="87.376" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="87.376" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J4" gate="G$1" pin="P3"/>
                                                    <wire x1="208.28" y1="71.12" x2="203.2" y2="71.12" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="71.12" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="AGND" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="AGND"/>
                                                    <wire x1="99.06" y1="91.44" x2="104.14" y2="91.44" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="91.44" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J4" gate="G$1" pin="P5"/>
                                                    <wire x1="208.28" y1="60.96000000000001" x2="203.2" y2="60.96000000000001" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="60.96000000000001" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_ACTIVITY_GPIO7" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP7"/>
                                                    <wire x1="53.34" y1="103.632" x2="48.260000000000005" y2="103.632" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="103.632" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R9" gate="G$1" pin="1"/>
                                                    <wire x1="124.46000000000001" y1="124.46" x2="119.38000000000001" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="119.38000000000001" y="124.46" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P6"/>
                                                    <wire x1="208.28" y1="25.400000000000006" x2="203.2" y2="25.400000000000006" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="25.400000000000006" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_DATA_MINUS" class="0">
                                  <segment>
                                                    <pinref part="J6" gate="G$1" pin="P8"/>
                                                    <wire x1="147.32" y1="35.56" x2="142.23999999999998" y2="35.56" width="0.1524" layer="91"/>
                                                    <label x="142.23999999999998" y="35.56" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_DATA_PLUS" class="0">
                                  <segment>
                                                    <pinref part="J6" gate="G$1" pin="P7"/>
                                                    <wire x1="147.32" y1="40.64" x2="142.23999999999998" y2="40.64" width="0.1524" layer="91"/>
                                                    <label x="142.23999999999998" y="40.64" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_DIR_GPIO4" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP4"/>
                                                    <wire x1="53.34" y1="119.888" x2="48.260000000000005" y2="119.888" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="119.888" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P3"/>
                                                    <wire x1="208.28" y1="40.64" x2="203.2" y2="40.64" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="40.64" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_LED_ANODE" class="0">
                                  <segment>
                                                    <pinref part="R9" gate="G$1" pin="2"/>
                                                    <wire x1="139.70000000000002" y1="124.46" x2="144.78000000000003" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="144.78000000000003" y="124.46" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D4" gate="G$1" pin="A"/>
                                                    <wire x1="149.85999999999999" y1="124.46" x2="144.77999999999997" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="144.77999999999997" y="124.46" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_RX_GPIO6" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP6"/>
                                                    <wire x1="53.34" y1="107.696" x2="48.260000000000005" y2="107.696" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="107.696" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P5"/>
                                                    <wire x1="208.28" y1="30.480000000000004" x2="203.2" y2="30.480000000000004" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="30.480000000000004" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_TRIGGER_GPIO3" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP3"/>
                                                    <wire x1="53.34" y1="123.952" x2="48.260000000000005" y2="123.952" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="123.952" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P2"/>
                                                    <wire x1="208.28" y1="45.72" x2="203.2" y2="45.72" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="45.72" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_TX_GPIO2" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP2"/>
                                                    <wire x1="53.34" y1="128.016" x2="48.260000000000005" y2="128.016" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="128.016" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P1"/>
                                                    <wire x1="208.28" y1="50.800000000000004" x2="203.2" y2="50.800000000000004" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="50.800000000000004" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GND_DMX_ISO" class="0">
                                  <segment>
                                                    <pinref part="J6" gate="G$1" pin="P6"/>
                                                    <wire x1="147.32" y1="45.720000000000006" x2="142.23999999999998" y2="45.720000000000006" width="0.1524" layer="91"/>
                                                    <label x="142.23999999999998" y="45.720000000000006" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GND_LOGIC" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND3"/>
                                                    <wire x1="53.34" y1="132.07999999999998" x2="48.260000000000005" y2="132.07999999999998" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="132.07999999999998" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND8"/>
                                                    <wire x1="53.34" y1="111.75999999999999" x2="48.260000000000005" y2="111.75999999999999" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="111.75999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND13"/>
                                                    <wire x1="53.34" y1="91.44" x2="48.260000000000005" y2="91.44" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="91.44" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND18"/>
                                                    <wire x1="53.34" y1="71.12" x2="48.260000000000005" y2="71.12" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="71.12" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND23"/>
                                                    <wire x1="99.06" y1="132.07999999999998" x2="104.14" y2="132.07999999999998" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="132.07999999999998" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND28"/>
                                                    <wire x1="99.06" y1="111.75999999999999" x2="104.14" y2="111.75999999999999" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="111.75999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND38"/>
                                                    <wire x1="99.06" y1="71.12" x2="104.14" y2="71.12" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="71.12" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="SW1" gate="G$1" pin="2"/>
                                                    <wire x1="144.78" y1="157.48" x2="149.86" y2="157.48" width="0.1524" layer="91"/>
                                                    <label x="149.86" y="157.48" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D3" gate="G$1" pin="K"/>
                                                    <wire x1="165.1" y1="139.7" x2="170.18" y2="139.7" width="0.1524" layer="91"/>
                                                    <label x="170.18" y="139.7" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D4" gate="G$1" pin="K"/>
                                                    <wire x1="165.1" y1="124.46" x2="170.18" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="170.18" y="124.46" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J6" gate="G$1" pin="P2"/>
                                                    <wire x1="147.32" y1="66.04" x2="142.23999999999998" y2="66.04" width="0.1524" layer="91"/>
                                                    <label x="142.23999999999998" y="66.04" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO0_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP0"/>
                                                    <wire x1="53.34" y1="140.208" x2="48.260000000000005" y2="140.208" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="140.208" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P1"/>
                                                    <wire x1="208.28" y1="172.72000000000003" x2="203.2" y2="172.72000000000003" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="172.72000000000003" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO1_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP1"/>
                                                    <wire x1="53.34" y1="136.144" x2="48.260000000000005" y2="136.144" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="136.144" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P2"/>
                                                    <wire x1="208.28" y1="167.64000000000001" x2="203.2" y2="167.64000000000001" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="167.64000000000001" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO10_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP10"/>
                                                    <wire x1="53.34" y1="87.376" x2="48.260000000000005" y2="87.376" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="87.376" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P5"/>
                                                    <wire x1="208.28" y1="152.4" x2="203.2" y2="152.4" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="152.4" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO11_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP11"/>
                                                    <wire x1="53.34" y1="83.312" x2="48.260000000000005" y2="83.312" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="83.312" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P6"/>
                                                    <wire x1="208.28" y1="147.32000000000002" x2="203.2" y2="147.32000000000002" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="147.32000000000002" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO12_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP12"/>
                                                    <wire x1="53.34" y1="79.24799999999999" x2="48.260000000000005" y2="79.24799999999999" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="79.24799999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P7"/>
                                                    <wire x1="208.28" y1="142.24" x2="203.2" y2="142.24" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="142.24" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO13_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP13"/>
                                                    <wire x1="53.34" y1="75.184" x2="48.260000000000005" y2="75.184" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="75.184" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P8"/>
                                                    <wire x1="208.28" y1="137.16000000000003" x2="203.2" y2="137.16000000000003" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="137.16000000000003" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO14_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP14"/>
                                                    <wire x1="53.34" y1="67.056" x2="48.260000000000005" y2="67.056" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="67.056" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P9"/>
                                                    <wire x1="208.28" y1="132.08" x2="203.2" y2="132.08" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="132.08" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO15_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP15"/>
                                                    <wire x1="53.34" y1="62.99199999999999" x2="48.260000000000005" y2="62.99199999999999" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="62.99199999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P10"/>
                                                    <wire x1="208.28" y1="127.00000000000001" x2="203.2" y2="127.00000000000001" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="127.00000000000001" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO16_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP16"/>
                                                    <wire x1="99.06" y1="140.208" x2="104.14" y2="140.208" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="140.208" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P11"/>
                                                    <wire x1="208.28" y1="121.92000000000002" x2="203.2" y2="121.92000000000002" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="121.92000000000002" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO17_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP17"/>
                                                    <wire x1="99.06" y1="136.144" x2="104.14" y2="136.144" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="136.144" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P12"/>
                                                    <wire x1="208.28" y1="116.84" x2="203.2" y2="116.84" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="116.84" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO18_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP18"/>
                                                    <wire x1="99.06" y1="128.016" x2="104.14" y2="128.016" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="128.016" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P13"/>
                                                    <wire x1="208.28" y1="111.76000000000002" x2="203.2" y2="111.76000000000002" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="111.76000000000002" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO19_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP19"/>
                                                    <wire x1="99.06" y1="123.952" x2="104.14" y2="123.952" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="123.952" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P14"/>
                                                    <wire x1="208.28" y1="106.68" x2="203.2" y2="106.68" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="106.68" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO20_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP20"/>
                                                    <wire x1="99.06" y1="119.888" x2="104.14" y2="119.888" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="119.888" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P15"/>
                                                    <wire x1="208.28" y1="101.60000000000001" x2="203.2" y2="101.60000000000001" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="101.60000000000001" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO21_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP21"/>
                                                    <wire x1="99.06" y1="115.824" x2="104.14" y2="115.824" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="115.824" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P16"/>
                                                    <wire x1="208.28" y1="96.52000000000001" x2="203.2" y2="96.52000000000001" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="96.52000000000001" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO22_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP22"/>
                                                    <wire x1="99.06" y1="107.696" x2="104.14" y2="107.696" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="107.696" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P17"/>
                                                    <wire x1="208.28" y1="91.44000000000001" x2="203.2" y2="91.44000000000001" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="91.44000000000001" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO8_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP8"/>
                                                    <wire x1="53.34" y1="99.568" x2="48.260000000000005" y2="99.568" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="99.568" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P3"/>
                                                    <wire x1="208.28" y1="162.56" x2="203.2" y2="162.56" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="162.56" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO9_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP9"/>
                                                    <wire x1="53.34" y1="95.50399999999999" x2="48.260000000000005" y2="95.50399999999999" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="95.50399999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P4"/>
                                                    <wire x1="208.28" y1="157.48000000000002" x2="203.2" y2="157.48000000000002" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="157.48000000000002" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="ISOW_EN_FLT" class="0">
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P7"/>
                                                    <wire x1="208.28" y1="20.32" x2="203.2" y2="20.32" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="20.32" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_RX_GPIO5" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP5"/>
                                                    <wire x1="53.34" y1="115.824" x2="48.260000000000005" y2="115.824" width="0.1524" layer="91"/>
                                                    <label x="48.260000000000005" y="115.824" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P4"/>
                                                    <wire x1="208.28" y1="35.56" x2="203.2" y2="35.56" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="35.56" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="PICO_RUN_N" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="RUN"/>
                                                    <wire x1="99.06" y1="103.632" x2="104.14" y2="103.632" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="103.632" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="SW1" gate="G$1" pin="1"/>
                                                    <wire x1="129.54" y1="157.48" x2="124.46" y2="157.48" width="0.1524" layer="91"/>
                                                    <label x="124.46" y="157.48" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="PICO_SMPS_EN" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="3V3_EN"/>
                                                    <wire x1="99.06" y1="75.184" x2="104.14" y2="75.184" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="75.184" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="PICO_VSYS" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="VSYS"/>
                                                    <wire x1="99.06" y1="67.056" x2="104.14" y2="67.056" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="67.056" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="PWR_LED_ANODE" class="0">
                                  <segment>
                                                    <pinref part="R8" gate="G$1" pin="2"/>
                                                    <wire x1="139.70000000000002" y1="139.7" x2="144.78000000000003" y2="139.7" width="0.1524" layer="91"/>
                                                    <label x="144.78000000000003" y="139.7" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D3" gate="G$1" pin="A"/>
                                                    <wire x1="149.85999999999999" y1="139.7" x2="144.77999999999997" y2="139.7" width="0.1524" layer="91"/>
                                                    <label x="144.77999999999997" y="139.7" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="VBUS_5V_USB" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="VBUS"/>
                                                    <wire x1="99.06" y1="62.99199999999999" x2="104.14" y2="62.99199999999999" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="62.99199999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="F1" gate="G$1" pin="1"/>
                                                    <wire x1="129.54" y1="172.72" x2="124.46" y2="172.72" width="0.1524" layer="91"/>
                                                    <label x="124.46" y="172.72" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J6" gate="G$1" pin="P3"/>
                                                    <wire x1="147.32" y1="60.96000000000001" x2="142.23999999999998" y2="60.96000000000001" width="0.1524" layer="91"/>
                                                    <label x="142.23999999999998" y="60.96000000000001" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="VCC_3V3_LOGIC" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="3V3"/>
                                                    <wire x1="99.06" y1="79.24799999999999" x2="104.14" y2="79.24799999999999" width="0.1524" layer="91"/>
                                                    <label x="104.14" y="79.24799999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J6" gate="G$1" pin="P1"/>
                                                    <wire x1="147.32" y1="71.12" x2="142.23999999999998" y2="71.12" width="0.1524" layer="91"/>
                                                    <label x="142.23999999999998" y="71.12" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R8" gate="G$1" pin="1"/>
                                                    <wire x1="124.46000000000001" y1="139.7" x2="119.38000000000001" y2="139.7" width="0.1524" layer="91"/>
                                                    <label x="119.38000000000001" y="139.7" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="VCC_5V_DMX_ISO" class="0">
                                  <segment>
                                                    <pinref part="J6" gate="G$1" pin="P5"/>
                                                    <wire x1="147.32" y1="50.800000000000004" x2="142.23999999999998" y2="50.800000000000004" width="0.1524" layer="91"/>
                                                    <label x="142.23999999999998" y="50.800000000000004" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="VDD_5V_ISOW_FUSED" class="0">
                                  <segment>
                                                    <pinref part="F1" gate="G$1" pin="2"/>
                                                    <wire x1="144.78" y1="172.72" x2="149.86" y2="172.72" width="0.1524" layer="91"/>
                                                    <label x="149.86" y="172.72" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J6" gate="G$1" pin="P4"/>
                                                    <wire x1="147.32" y1="55.88" x2="142.23999999999998" y2="55.88" width="0.1524" layer="91"/>
                                                    <label x="142.23999999999998" y="55.88" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                  </nets>
                </sheet>
        <sheet>
                  <plain>
                    <text x="20.32" y="187.96" size="2.54" layer="91" ratio="15">WiFiPicoDMX Rev. A — Reinforced-isolated DMX/RDM output</text>
                    <text x="20.32" y="20.32" size="1.778" layer="91" ratio="12">Default: FIT R10/R11 (0R), DNP L1. L1 option is TDK ACT45B-510-2P-TL003; fit it only after EMC/signal-integrity testing.</text>
                    <text x="20.32" y="15.24" size="1.778" layer="91" ratio="12">No permanent 120R termination: terminate only at the far end of the DMX cable.</text>
                    <text x="20.32" y="10.16" size="1.778" layer="91" ratio="12">Keep GND_LOGIC and GND_DMX_ISO separate. Preserve TI isolation keep-outs and place bypass parts per TI layout.</text>
                    <text x="20.32" y="5.08" size="1.778" layer="91" ratio="12">J1 pad order: P1 DMX COM/XLR1, P2 DMX-/XLR2, P3 DMX+/XLR3, P4 shell. Panel connector is wired, not PCB-mounted.</text>
                  </plain>
                  <instances>
                    <instance part="U2" gate="G$1" x="111.76" y="101.6" rot="R0" smashed="no"/>
                    <instance part="R1" gate="G$1" x="50.8" y="157.48" rot="R0" smashed="no"/>
                    <instance part="R2" gate="G$1" x="50.8" y="142.24" rot="R0" smashed="no"/>
                    <instance part="R3" gate="G$1" x="50.8" y="127" rot="R0" smashed="no"/>
                    <instance part="C1" gate="G$1" x="50.8" y="111.76" rot="R0" smashed="no"/>
                    <instance part="C2" gate="G$1" x="50.8" y="96.52" rot="R0" smashed="no"/>
                    <instance part="C3" gate="G$1" x="50.8" y="81.28" rot="R0" smashed="no"/>
                    <instance part="FB1" gate="G$1" x="172.72" y="149.86" rot="R0" smashed="no"/>
                    <instance part="FB2" gate="G$1" x="172.72" y="134.62" rot="R0" smashed="no"/>
                    <instance part="C4" gate="G$1" x="210.82" y="149.86" rot="R0" smashed="no"/>
                    <instance part="C5" gate="G$1" x="210.82" y="134.62" rot="R0" smashed="no"/>
                    <instance part="C6" gate="G$1" x="210.82" y="119.38" rot="R0" smashed="no"/>
                    <instance part="L1" gate="G$1" x="172.72" y="91.44" rot="R0" smashed="no"/>
                    <instance part="R10" gate="G$1" x="172.72" y="76.2" rot="R0" smashed="no"/>
                    <instance part="R11" gate="G$1" x="172.72" y="60.96" rot="R0" smashed="no"/>
                    <instance part="D1" gate="G$1" x="210.82" y="91.44" rot="R0" smashed="no"/>
                    <instance part="J1" gate="G$1" x="254" y="91.44" rot="R0" smashed="no"/>
                  </instances>
                  <busses/>
                  <nets>
                    <net name="DMX_DATA_MINUS" class="0">
                                  <segment>
                                                    <pinref part="L1" gate="G$1" pin="B2"/>
                                                    <wire x1="180.34" y1="88.89999999999999" x2="185.42000000000002" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="185.42000000000002" y="88.89999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R11" gate="G$1" pin="2"/>
                                                    <wire x1="180.34" y1="60.96" x2="185.42000000000002" y2="60.96" width="0.1524" layer="91"/>
                                                    <label x="185.42000000000002" y="60.96" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D1" gate="G$1" pin="IO2"/>
                                                    <wire x1="203.2" y1="88.89999999999999" x2="198.11999999999998" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="198.11999999999998" y="88.89999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J1" gate="G$1" pin="P2"/>
                                                    <wire x1="248.92" y1="93.98" x2="243.83999999999997" y2="93.98" width="0.1524" layer="91"/>
                                                    <label x="243.83999999999997" y="93.98" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_DATA_PLUS" class="0">
                                  <segment>
                                                    <pinref part="L1" gate="G$1" pin="A2"/>
                                                    <wire x1="180.34" y1="93.98" x2="185.42000000000002" y2="93.98" width="0.1524" layer="91"/>
                                                    <label x="185.42000000000002" y="93.98" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R10" gate="G$1" pin="2"/>
                                                    <wire x1="180.34" y1="76.2" x2="185.42000000000002" y2="76.2" width="0.1524" layer="91"/>
                                                    <label x="185.42000000000002" y="76.2" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D1" gate="G$1" pin="IO1"/>
                                                    <wire x1="203.2" y1="93.98" x2="198.11999999999998" y2="93.98" width="0.1524" layer="91"/>
                                                    <label x="198.11999999999998" y="93.98" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J1" gate="G$1" pin="P3"/>
                                                    <wire x1="248.92" y1="88.89999999999999" x2="243.83999999999997" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="243.83999999999997" y="88.89999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_DIR_GPIO4" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="DE"/>
                                                    <wire x1="91.44" y1="114.3" x2="86.36" y2="114.3" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="114.3" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="RE_N"/>
                                                    <wire x1="91.44" y1="104.13999999999999" x2="86.36" y2="104.13999999999999" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="104.13999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R2" gate="G$1" pin="1"/>
                                                    <wire x1="43.18" y1="142.24" x2="38.1" y2="142.24" width="0.1524" layer="91"/>
                                                    <label x="38.1" y="142.24" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_RX_GPIO6" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="R"/>
                                                    <wire x1="91.44" y1="109.22" x2="86.36" y2="109.22" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="109.22" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_TRX_MINUS" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="Z"/>
                                                    <wire x1="132.08" y1="114.3" x2="137.16000000000003" y2="114.3" width="0.1524" layer="91"/>
                                                    <label x="137.16000000000003" y="114.3" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="B"/>
                                                    <wire x1="132.08" y1="119.38" x2="137.16000000000003" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="137.16000000000003" y="119.38" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="L1" gate="G$1" pin="B1"/>
                                                    <wire x1="165.1" y1="88.89999999999999" x2="160.01999999999998" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="160.01999999999998" y="88.89999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R11" gate="G$1" pin="1"/>
                                                    <wire x1="165.1" y1="60.96" x2="160.01999999999998" y2="60.96" width="0.1524" layer="91"/>
                                                    <label x="160.01999999999998" y="60.96" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_TRX_PLUS" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="Y"/>
                                                    <wire x1="132.08" y1="109.22" x2="137.16000000000003" y2="109.22" width="0.1524" layer="91"/>
                                                    <label x="137.16000000000003" y="109.22" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="A"/>
                                                    <wire x1="132.08" y1="124.46" x2="137.16000000000003" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="137.16000000000003" y="124.46" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="L1" gate="G$1" pin="A1"/>
                                                    <wire x1="165.1" y1="93.98" x2="160.01999999999998" y2="93.98" width="0.1524" layer="91"/>
                                                    <label x="160.01999999999998" y="93.98" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R10" gate="G$1" pin="1"/>
                                                    <wire x1="165.1" y1="76.2" x2="160.01999999999998" y2="76.2" width="0.1524" layer="91"/>
                                                    <label x="160.01999999999998" y="76.2" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="DMX_TX_GPIO2" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="D"/>
                                                    <wire x1="91.44" y1="119.38" x2="86.36" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="119.38" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R1" gate="G$1" pin="2"/>
                                                    <wire x1="58.419999999999995" y1="157.48" x2="63.49999999999999" y2="157.48" width="0.1524" layer="91"/>
                                                    <label x="63.49999999999999" y="157.48" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GND_DMX_CONVERTER" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="GND2"/>
                                                    <wire x1="132.08" y1="78.74" x2="137.16000000000003" y2="78.74" width="0.1524" layer="91"/>
                                                    <label x="137.16000000000003" y="78.74" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="FB2" gate="G$1" pin="1"/>
                                                    <wire x1="165.1" y1="134.62" x2="160.01999999999998" y2="134.62" width="0.1524" layer="91"/>
                                                    <label x="160.01999999999998" y="134.62" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C4" gate="G$1" pin="2"/>
                                                    <wire x1="218.44" y1="149.86" x2="223.52" y2="149.86" width="0.1524" layer="91"/>
                                                    <label x="223.52" y="149.86" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C5" gate="G$1" pin="2"/>
                                                    <wire x1="218.44" y1="134.62" x2="223.52" y2="134.62" width="0.1524" layer="91"/>
                                                    <label x="223.52" y="134.62" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GND_DMX_ISO" class="0">
                                  <segment>
                                                    <pinref part="FB2" gate="G$1" pin="2"/>
                                                    <wire x1="180.34" y1="134.62" x2="185.42000000000002" y2="134.62" width="0.1524" layer="91"/>
                                                    <label x="185.42000000000002" y="134.62" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="GISOIN"/>
                                                    <wire x1="132.08" y1="99.06" x2="137.16000000000003" y2="99.06" width="0.1524" layer="91"/>
                                                    <label x="137.16000000000003" y="99.06" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C6" gate="G$1" pin="2"/>
                                                    <wire x1="218.44" y1="119.38" x2="223.52" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="223.52" y="119.38" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D1" gate="G$1" pin="GND"/>
                                                    <wire x1="218.44" y1="91.44" x2="223.52" y2="91.44" width="0.1524" layer="91"/>
                                                    <label x="223.52" y="91.44" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J1" gate="G$1" pin="P1"/>
                                                    <wire x1="248.92" y1="99.06" x2="243.83999999999997" y2="99.06" width="0.1524" layer="91"/>
                                                    <label x="243.83999999999997" y="99.06" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GND_LOGIC" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="GNDIO"/>
                                                    <wire x1="91.44" y1="99.06" x2="86.36" y2="99.06" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="99.06" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="GND1"/>
                                                    <wire x1="91.44" y1="78.74" x2="86.36" y2="78.74" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="78.74" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R2" gate="G$1" pin="2"/>
                                                    <wire x1="58.419999999999995" y1="142.24" x2="63.49999999999999" y2="142.24" width="0.1524" layer="91"/>
                                                    <label x="63.49999999999999" y="142.24" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C1" gate="G$1" pin="2"/>
                                                    <wire x1="58.419999999999995" y1="111.76" x2="63.49999999999999" y2="111.76" width="0.1524" layer="91"/>
                                                    <label x="63.49999999999999" y="111.76" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C2" gate="G$1" pin="2"/>
                                                    <wire x1="58.419999999999995" y1="96.52" x2="63.49999999999999" y2="96.52" width="0.1524" layer="91"/>
                                                    <label x="63.49999999999999" y="96.52" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C3" gate="G$1" pin="2"/>
                                                    <wire x1="58.419999999999995" y1="81.28" x2="63.49999999999999" y2="81.28" width="0.1524" layer="91"/>
                                                    <label x="63.49999999999999" y="81.28" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="ISOW_EN_FLT" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="EN_FLT"/>
                                                    <wire x1="91.44" y1="88.89999999999999" x2="86.36" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="88.89999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R3" gate="G$1" pin="2"/>
                                                    <wire x1="58.419999999999995" y1="127" x2="63.49999999999999" y2="127" width="0.1524" layer="91"/>
                                                    <label x="63.49999999999999" y="127" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="NC_U2_PIN14_IN" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="IN"/>
                                                    <wire x1="132.08" y1="93.97999999999999" x2="137.16000000000003" y2="93.97999999999999" width="0.1524" layer="91"/>
                                                    <label x="137.16000000000003" y="93.97999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="NC_U2_PIN7_OUT" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="OUT"/>
                                                    <wire x1="91.44" y1="93.97999999999999" x2="86.36" y2="93.97999999999999" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="93.97999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="VCC_3V3_LOGIC" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="VIO"/>
                                                    <wire x1="91.44" y1="124.46" x2="86.36" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="124.46" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R1" gate="G$1" pin="1"/>
                                                    <wire x1="43.18" y1="157.48" x2="38.1" y2="157.48" width="0.1524" layer="91"/>
                                                    <label x="38.1" y="157.48" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R3" gate="G$1" pin="1"/>
                                                    <wire x1="43.18" y1="127" x2="38.1" y2="127" width="0.1524" layer="91"/>
                                                    <label x="38.1" y="127" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C1" gate="G$1" pin="1"/>
                                                    <wire x1="43.18" y1="111.76" x2="38.1" y2="111.76" width="0.1524" layer="91"/>
                                                    <label x="38.1" y="111.76" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="VCC_5V_DMX_ISO" class="0">
                                  <segment>
                                                    <pinref part="FB1" gate="G$1" pin="2"/>
                                                    <wire x1="180.34" y1="149.86" x2="185.42000000000002" y2="149.86" width="0.1524" layer="91"/>
                                                    <label x="185.42000000000002" y="149.86" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="VISOIN"/>
                                                    <wire x1="132.08" y1="104.13999999999999" x2="137.16000000000003" y2="104.13999999999999" width="0.1524" layer="91"/>
                                                    <label x="137.16000000000003" y="104.13999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C6" gate="G$1" pin="1"/>
                                                    <wire x1="203.2" y1="119.38" x2="198.11999999999998" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="198.11999999999998" y="119.38" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="VDD_5V_ISOW_FUSED" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="VDD"/>
                                                    <wire x1="91.44" y1="83.82" x2="86.36" y2="83.82" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="83.82" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C2" gate="G$1" pin="1"/>
                                                    <wire x1="43.18" y1="96.52" x2="38.1" y2="96.52" width="0.1524" layer="91"/>
                                                    <label x="38.1" y="96.52" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C3" gate="G$1" pin="1"/>
                                                    <wire x1="43.18" y1="81.28" x2="38.1" y2="81.28" width="0.1524" layer="91"/>
                                                    <label x="38.1" y="81.28" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="VISO_5V_CONVERTER" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="VISOOUT"/>
                                                    <wire x1="132.08" y1="83.82" x2="137.16000000000003" y2="83.82" width="0.1524" layer="91"/>
                                                    <label x="137.16000000000003" y="83.82" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="MODE"/>
                                                    <wire x1="132.08" y1="88.89999999999999" x2="137.16000000000003" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="137.16000000000003" y="88.89999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="FB1" gate="G$1" pin="1"/>
                                                    <wire x1="165.1" y1="149.86" x2="160.01999999999998" y2="149.86" width="0.1524" layer="91"/>
                                                    <label x="160.01999999999998" y="149.86" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C4" gate="G$1" pin="1"/>
                                                    <wire x1="203.2" y1="149.86" x2="198.11999999999998" y2="149.86" width="0.1524" layer="91"/>
                                                    <label x="198.11999999999998" y="149.86" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C5" gate="G$1" pin="1"/>
                                                    <wire x1="203.2" y1="134.62" x2="198.11999999999998" y2="134.62" width="0.1524" layer="91"/>
                                                    <label x="198.11999999999998" y="134.62" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="XLR_SHELL" class="0">
                                  <segment>
                                                    <pinref part="J1" gate="G$1" pin="P4"/>
                                                    <wire x1="248.92" y1="83.82" x2="243.83999999999997" y2="83.82" width="0.1524" layer="91"/>
                                                    <label x="243.83999999999997" y="83.82" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                  </nets>
                </sheet>
        <sheet>
                  <plain>
                    <text x="20.32" y="187.96" size="2.54" layer="91" ratio="15">WiFiPicoDMX Rev. A — Isolated MIDI IN</text>
                    <text x="20.32" y="20.32" size="1.778" layer="91" ratio="12">J2 exposes all five panel DIN pins. Pins 1/3 are NC; pin 2 shield treatment remains configurable.</text>
                    <text x="20.32" y="15.24" size="1.778" layer="91" ratio="12">HCPL-0700 output side uses 5V VCC with a 3.3V output pull-up. Verify timing/CTR on the assembled prototype.</text>
                    <text x="20.32" y="10.16" size="1.778" layer="91" ratio="12">The DIN input current loop remains galvanically isolated from GND_LOGIC.</text>
                  </plain>
                  <instances>
                    <instance part="J2" gate="G$1" x="45.72" y="101.6" rot="R0" smashed="no"/>
                    <instance part="R4" gate="G$1" x="83.82" y="116.84" rot="R0" smashed="no"/>
                    <instance part="R5" gate="G$1" x="83.82" y="86.36" rot="R0" smashed="no"/>
                    <instance part="D2" gate="G$1" x="111.76" y="101.6" rot="R0" smashed="no"/>
                    <instance part="U3" gate="G$1" x="157.48" y="101.6" rot="R0" smashed="no"/>
                    <instance part="R6" gate="G$1" x="203.2" y="119.38" rot="R0" smashed="no"/>
                    <instance part="R7" gate="G$1" x="203.2" y="101.6" rot="R0" smashed="no"/>
                    <instance part="C7" gate="G$1" x="203.2" y="83.82" rot="R0" smashed="no"/>
                  </instances>
                  <busses/>
                  <nets>
                    <net name="GND_LOGIC" class="0">
                                  <segment>
                                                    <pinref part="U3" gate="G$1" pin="GND"/>
                                                    <wire x1="172.72" y1="90.16999999999999" x2="177.8" y2="90.16999999999999" width="0.1524" layer="91"/>
                                                    <label x="177.8" y="90.16999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R7" gate="G$1" pin="2"/>
                                                    <wire x1="210.82" y1="101.6" x2="215.9" y2="101.6" width="0.1524" layer="91"/>
                                                    <label x="215.9" y="101.6" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C7" gate="G$1" pin="2"/>
                                                    <wire x1="210.82" y1="83.82" x2="215.9" y2="83.82" width="0.1524" layer="91"/>
                                                    <label x="215.9" y="83.82" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_DIN_PIN1_SPARE" class="0">
                                  <segment>
                                                    <pinref part="J2" gate="G$1" pin="P1"/>
                                                    <wire x1="40.64" y1="111.75999999999999" x2="35.56" y2="111.75999999999999" width="0.1524" layer="91"/>
                                                    <label x="35.56" y="111.75999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_DIN_PIN2_SHIELD" class="0">
                                  <segment>
                                                    <pinref part="J2" gate="G$1" pin="P2"/>
                                                    <wire x1="40.64" y1="106.67999999999999" x2="35.56" y2="106.67999999999999" width="0.1524" layer="91"/>
                                                    <label x="35.56" y="106.67999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_DIN_PIN3_SPARE" class="0">
                                  <segment>
                                                    <pinref part="J2" gate="G$1" pin="P3"/>
                                                    <wire x1="40.64" y1="101.6" x2="35.56" y2="101.6" width="0.1524" layer="91"/>
                                                    <label x="35.56" y="101.6" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_DIN_PIN4" class="0">
                                  <segment>
                                                    <pinref part="J2" gate="G$1" pin="P4"/>
                                                    <wire x1="40.64" y1="96.52" x2="35.56" y2="96.52" width="0.1524" layer="91"/>
                                                    <label x="35.56" y="96.52" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R4" gate="G$1" pin="1"/>
                                                    <wire x1="76.19999999999999" y1="116.84" x2="71.11999999999999" y2="116.84" width="0.1524" layer="91"/>
                                                    <label x="71.11999999999999" y="116.84" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_DIN_PIN5" class="0">
                                  <segment>
                                                    <pinref part="R5" gate="G$1" pin="2"/>
                                                    <wire x1="91.44" y1="86.36" x2="96.52" y2="86.36" width="0.1524" layer="91"/>
                                                    <label x="96.52" y="86.36" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J2" gate="G$1" pin="P5"/>
                                                    <wire x1="40.64" y1="91.44" x2="35.56" y2="91.44" width="0.1524" layer="91"/>
                                                    <label x="35.56" y="91.44" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_OPTO_BASE" class="0">
                                  <segment>
                                                    <pinref part="U3" gate="G$1" pin="VB"/>
                                                    <wire x1="172.72" y1="105.41" x2="177.8" y2="105.41" width="0.1524" layer="91"/>
                                                    <label x="177.8" y="105.41" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R7" gate="G$1" pin="1"/>
                                                    <wire x1="195.57999999999998" y1="101.6" x2="190.49999999999997" y2="101.6" width="0.1524" layer="91"/>
                                                    <label x="190.49999999999997" y="101.6" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_OPTO_LED_ANODE" class="0">
                                  <segment>
                                                    <pinref part="R4" gate="G$1" pin="2"/>
                                                    <wire x1="91.44" y1="116.84" x2="96.52" y2="116.84" width="0.1524" layer="91"/>
                                                    <label x="96.52" y="116.84" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U3" gate="G$1" pin="A"/>
                                                    <wire x1="142.23999999999998" y1="105.41" x2="137.15999999999997" y2="105.41" width="0.1524" layer="91"/>
                                                    <label x="137.15999999999997" y="105.41" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D2" gate="G$1" pin="K"/>
                                                    <wire x1="119.38000000000001" y1="101.6" x2="124.46000000000001" y2="101.6" width="0.1524" layer="91"/>
                                                    <label x="124.46000000000001" y="101.6" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_OPTO_LED_CATHODE" class="0">
                                  <segment>
                                                    <pinref part="U3" gate="G$1" pin="K"/>
                                                    <wire x1="142.23999999999998" y1="97.78999999999999" x2="137.15999999999997" y2="97.78999999999999" width="0.1524" layer="91"/>
                                                    <label x="137.15999999999997" y="97.78999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D2" gate="G$1" pin="A"/>
                                                    <wire x1="104.14" y1="101.6" x2="99.06" y2="101.6" width="0.1524" layer="91"/>
                                                    <label x="99.06" y="101.6" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R5" gate="G$1" pin="1"/>
                                                    <wire x1="76.19999999999999" y1="86.36" x2="71.11999999999999" y2="86.36" width="0.1524" layer="91"/>
                                                    <label x="71.11999999999999" y="86.36" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_RX_GPIO5" class="0">
                                  <segment>
                                                    <pinref part="U3" gate="G$1" pin="VO"/>
                                                    <wire x1="172.72" y1="97.78999999999999" x2="177.8" y2="97.78999999999999" width="0.1524" layer="91"/>
                                                    <label x="177.8" y="97.78999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R6" gate="G$1" pin="2"/>
                                                    <wire x1="210.82" y1="119.38" x2="215.9" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="215.9" y="119.38" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="NC_U3_PIN1" class="0">
                                  <segment>
                                                    <pinref part="U3" gate="G$1" pin="NC1"/>
                                                    <wire x1="142.23999999999998" y1="113.03" x2="137.15999999999997" y2="113.03" width="0.1524" layer="91"/>
                                                    <label x="137.15999999999997" y="113.03" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="NC_U3_PIN4" class="0">
                                  <segment>
                                                    <pinref part="U3" gate="G$1" pin="NC4"/>
                                                    <wire x1="142.23999999999998" y1="90.16999999999999" x2="137.15999999999997" y2="90.16999999999999" width="0.1524" layer="91"/>
                                                    <label x="137.15999999999997" y="90.16999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="VBUS_5V_USB" class="0">
                                  <segment>
                                                    <pinref part="U3" gate="G$1" pin="VCC"/>
                                                    <wire x1="172.72" y1="113.03" x2="177.8" y2="113.03" width="0.1524" layer="91"/>
                                                    <label x="177.8" y="113.03" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C7" gate="G$1" pin="1"/>
                                                    <wire x1="195.57999999999998" y1="83.82" x2="190.49999999999997" y2="83.82" width="0.1524" layer="91"/>
                                                    <label x="190.49999999999997" y="83.82" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="VCC_3V3_LOGIC" class="0">
                                  <segment>
                                                    <pinref part="R6" gate="G$1" pin="1"/>
                                                    <wire x1="195.57999999999998" y1="119.38" x2="190.49999999999997" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="190.49999999999997" y="119.38" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                  </nets>
                </sheet>
      </sheets>
      <errors/>
    </schematic>
  </drawing>
</eagle>
