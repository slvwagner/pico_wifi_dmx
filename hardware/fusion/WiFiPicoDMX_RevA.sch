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
        <library name="WiFiPicoDMX_RevA_used">
          <description>Embedded copy of the WiFiPicoDMX Rev. A used-component library. The matching standalone library is hardware/fusion/WiFiPicoDMX_RevA_used.lbr. Verify every footprint before PCB manufacture.</description>
          <packages>
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
            <package name="PADBANK17">
            <smd name="1" x="0" y="-20.32" dx="2.2" dy="1.6" layer="1"/>
            <smd name="2" x="0" y="-17.78" dx="2.2" dy="1.6" layer="1"/>
            <smd name="3" x="0" y="-15.24" dx="2.2" dy="1.6" layer="1"/>
            <smd name="4" x="0" y="-12.7" dx="2.2" dy="1.6" layer="1"/>
            <smd name="5" x="0" y="-10.16" dx="2.2" dy="1.6" layer="1"/>
            <smd name="6" x="0" y="-7.62" dx="2.2" dy="1.6" layer="1"/>
            <smd name="7" x="0" y="-5.08" dx="2.2" dy="1.6" layer="1"/>
            <smd name="8" x="0" y="-2.54" dx="2.2" dy="1.6" layer="1"/>
            <smd name="9" x="0" y="0" dx="2.2" dy="1.6" layer="1"/>
            <smd name="10" x="0" y="2.54" dx="2.2" dy="1.6" layer="1"/>
            <smd name="11" x="0" y="5.08" dx="2.2" dy="1.6" layer="1"/>
            <smd name="12" x="0" y="7.62" dx="2.2" dy="1.6" layer="1"/>
            <smd name="13" x="0" y="10.16" dx="2.2" dy="1.6" layer="1"/>
            <smd name="14" x="0" y="12.7" dx="2.2" dy="1.6" layer="1"/>
            <smd name="15" x="0" y="15.24" dx="2.2" dy="1.6" layer="1"/>
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
            <package name="PICO_2_W_DEVELOPMENT_BOARD">
            <description>40-DIP Socket, 2.54 mm (0.10 in) pitch, 17.78 mm (0.70 in) horizontal pin pitch, 51.00 X 21.00 X 5.08 mm body
             &lt;p&gt;40-pin DIP Socket package with 2.54 mm (0.10 in) pitch, 17.78 mm (0.70 in) horizontal pin pitch with body size 51.00 X 21.00 X 5.08 mm&lt;/p&gt;</description>
            <pad name="1" x="-8.89" y="24.13" drill="1.0485" diameter="1.6485"/>
            <pad name="2" x="-8.89" y="21.59" drill="1.0485" diameter="1.6485"/>
            <pad name="3" x="-8.89" y="19.05" drill="1.0485" diameter="1.6485"/>
            <pad name="4" x="-8.89" y="16.51" drill="1.0485" diameter="1.6485"/>
            <pad name="5" x="-8.89" y="13.97" drill="1.0485" diameter="1.6485"/>
            <pad name="6" x="-8.89" y="11.43" drill="1.0485" diameter="1.6485"/>
            <pad name="7" x="-8.89" y="8.89" drill="1.0485" diameter="1.6485"/>
            <pad name="8" x="-8.89" y="6.35" drill="1.0485" diameter="1.6485"/>
            <pad name="9" x="-8.89" y="3.81" drill="1.0485" diameter="1.6485"/>
            <pad name="10" x="-8.89" y="1.27" drill="1.0485" diameter="1.6485"/>
            <pad name="11" x="-8.89" y="-1.27" drill="1.0485" diameter="1.6485"/>
            <pad name="12" x="-8.89" y="-3.81" drill="1.0485" diameter="1.6485"/>
            <pad name="13" x="-8.89" y="-6.35" drill="1.0485" diameter="1.6485"/>
            <pad name="14" x="-8.89" y="-8.89" drill="1.0485" diameter="1.6485"/>
            <pad name="15" x="-8.89" y="-11.43" drill="1.0485" diameter="1.6485"/>
            <pad name="16" x="-8.89" y="-13.97" drill="1.0485" diameter="1.6485"/>
            <pad name="17" x="-8.89" y="-16.51" drill="1.0485" diameter="1.6485"/>
            <pad name="18" x="-8.89" y="-19.05" drill="1.0485" diameter="1.6485"/>
            <pad name="19" x="-8.89" y="-21.59" drill="1.0485" diameter="1.6485"/>
            <pad name="20" x="-8.89" y="-24.13" drill="1.0485" diameter="1.6485"/>
            <pad name="21" x="8.89" y="-24.13" drill="1.0485" diameter="1.6485"/>
            <pad name="22" x="8.89" y="-21.59" drill="1.0485" diameter="1.6485"/>
            <pad name="23" x="8.89" y="-19.05" drill="1.0485" diameter="1.6485"/>
            <pad name="24" x="8.89" y="-16.51" drill="1.0485" diameter="1.6485"/>
            <pad name="25" x="8.89" y="-13.97" drill="1.0485" diameter="1.6485"/>
            <pad name="26" x="8.89" y="-11.43" drill="1.0485" diameter="1.6485"/>
            <pad name="27" x="8.89" y="-8.89" drill="1.0485" diameter="1.6485"/>
            <pad name="28" x="8.89" y="-6.35" drill="1.0485" diameter="1.6485"/>
            <pad name="29" x="8.89" y="-3.81" drill="1.0485" diameter="1.6485"/>
            <pad name="30" x="8.89" y="-1.27" drill="1.0485" diameter="1.6485"/>
            <pad name="31" x="8.89" y="1.27" drill="1.0485" diameter="1.6485"/>
            <pad name="32" x="8.89" y="3.81" drill="1.0485" diameter="1.6485"/>
            <pad name="33" x="8.89" y="6.35" drill="1.0485" diameter="1.6485"/>
            <pad name="34" x="8.89" y="8.89" drill="1.0485" diameter="1.6485"/>
            <pad name="35" x="8.89" y="11.43" drill="1.0485" diameter="1.6485"/>
            <pad name="36" x="8.89" y="13.97" drill="1.0485" diameter="1.6485"/>
            <pad name="37" x="8.89" y="16.51" drill="1.0485" diameter="1.6485"/>
            <pad name="38" x="8.89" y="19.05" drill="1.0485" diameter="1.6485"/>
            <pad name="39" x="8.89" y="21.59" drill="1.0485" diameter="1.6485"/>
            <pad name="40" x="8.89" y="24.13" drill="1.0485" diameter="1.6485"/>
            <circle x="-11.004" y="24.13" radius="0.25" width="0" layer="21"/>
            <wire x1="-10.5" y1="25.2083" x2="-10.5" y2="25.5" width="0.12" layer="21"/>
            <wire x1="-10.5" y1="25.5" x2="10.5" y2="25.5" width="0.12" layer="21"/>
            <wire x1="10.5" y1="25.5" x2="10.5" y2="25.2083" width="0.12" layer="21"/>
            <wire x1="-10.5" y1="-25.2083" x2="-10.5" y2="-25.5" width="0.12" layer="21"/>
            <wire x1="-10.5" y1="-25.5" x2="10.5" y2="-25.5" width="0.12" layer="21"/>
            <wire x1="10.5" y1="-25.5" x2="10.5" y2="-25.2083" width="0.12" layer="21"/>
            <wire x1="-10.5" y1="-25.5" x2="-10.5" y2="25.5" width="0.12" layer="51"/>
            <wire x1="-10.5" y1="25.5" x2="10.5" y2="25.5" width="0.12" layer="51"/>
            <wire x1="10.5" y1="25.5" x2="10.5" y2="-25.5" width="0.12" layer="51"/>
            <wire x1="10.5" y1="-25.5" x2="-10.5" y2="-25.5" width="0.12" layer="51"/>
            <text x="0" y="26.135" size="1.27" layer="25" align="bottom-center">&gt;NAME</text>
            <text x="0" y="-26.135" size="1.27" layer="27" align="top-center">&gt;VALUE</text>
                        </package>
            <package name="PTS810_J_LEAD">
            <description>C&amp;K/Littelfuse PTS810 J-lead SMT tactile switch, 4.20 X 3.20 X 2.50 mm body. Pad numbering follows the manufacturer drawing.</description>
            <smd name="1" x="-2.0954" y="1.075" dx="1.1629" dy="0.7666" layer="1"/>
            <smd name="2" x="-2.0954" y="-1.075" dx="1.1629" dy="0.7666" layer="1"/>
            <smd name="3" x="2.0954" y="-1.075" dx="1.1629" dy="0.7666" layer="1"/>
            <smd name="4" x="2.0954" y="1.075" dx="1.1629" dy="0.7666" layer="1"/>
            <wire x1="-2.1" y1="1.7723" x2="2.1" y2="1.7723" width="0.12" layer="21"/>
            <wire x1="2.1" y1="-1.7723" x2="-2.1" y2="-1.7723" width="0.12" layer="21"/>
            <wire x1="-2.1" y1="-1.65" x2="-2.1" y2="1.65" width="0.12" layer="51"/>
            <wire x1="-2.1" y1="1.65" x2="2.1" y2="1.65" width="0.12" layer="51"/>
            <wire x1="2.1" y1="1.65" x2="2.1" y2="-1.65" width="0.12" layer="51"/>
            <wire x1="2.1" y1="-1.65" x2="-2.1" y2="-1.65" width="0.12" layer="51"/>
            <circle x="-3.1808" y="1.075" radius="0.25" width="0" layer="21"/>
            <text x="0" y="2.4073" size="1.27" layer="25" align="bottom-center">&gt;NAME</text>
            <text x="0" y="-2.4073" size="1.27" layer="27" align="top-center">&gt;VALUE</text>
                        </package>
            <package name="PPTC1206_1206L050YR">
            <description>Littelfuse 1206L050YR resettable PPTC. Manufacturer recommended pad layout: two 1.80 X 1.80 mm pads with a 1.00 mm gap.</description>
            <smd name="1" x="-1.4" y="0" dx="1.8" dy="1.8" layer="1"/>
            <smd name="2" x="1.4" y="0" dx="1.8" dy="1.8" layer="1"/>
            <wire x1="-1.7" y1="1" x2="1.7" y2="1" width="0.12" layer="21"/>
            <wire x1="1.7" y1="-1" x2="-1.7" y2="-1" width="0.12" layer="21"/>
            <wire x1="-1.7" y1="-0.9" x2="-1.7" y2="0.9" width="0.12" layer="51"/>
            <wire x1="-1.7" y1="0.9" x2="1.7" y2="0.9" width="0.12" layer="51"/>
            <wire x1="1.7" y1="0.9" x2="1.7" y2="-0.9" width="0.12" layer="51"/>
            <wire x1="1.7" y1="-0.9" x2="-1.7" y2="-0.9" width="0.12" layer="51"/>
            <text x="0" y="2.2" size="1.27" layer="25" align="bottom-center">&gt;NAME</text>
            <text x="0" y="-2.2" size="1.27" layer="27" align="top-center">&gt;VALUE</text>
                        </package>
            <package name="RESC1005X40">
            <description>Chip, 1.05 X 0.54 X 0.40 mm body
            &lt;p&gt;Chip package with body size 1.05 X 0.54 X 0.40 mm&lt;/p&gt;</description>
            <wire x1="0.55" y1="0.636" x2="-0.55" y2="0.636" width="0.127" layer="21"/>
            <wire x1="0.55" y1="-0.636" x2="-0.55" y2="-0.636" width="0.127" layer="21"/>
            <wire x1="0.55" y1="-0.3" x2="-0.55" y2="-0.3" width="0.12" layer="51"/>
            <wire x1="-0.55" y1="-0.3" x2="-0.55" y2="0.3" width="0.12" layer="51"/>
            <wire x1="-0.55" y1="0.3" x2="0.55" y2="0.3" width="0.12" layer="51"/>
            <wire x1="0.55" y1="0.3" x2="0.55" y2="-0.3" width="0.12" layer="51"/>
            <smd name="1" x="-0.5075" y="0" dx="0.5351" dy="0.644" layer="1"/>
            <smd name="2" x="0.5075" y="0" dx="0.5351" dy="0.644" layer="1"/>
            <text x="0" y="2.54" size="1.27" layer="25" align="top-center">&gt;NAME</text>
            <text x="0" y="-2.54" size="1.27" layer="27" align="bottom-center">&gt;VALUE</text>
                        </package>
            <package name="RESC1608X60">
            <description>Chip, 1.60 X 0.82 X 0.60 mm body
            &lt;p&gt;Chip package with body size 1.60 X 0.82 X 0.60 mm&lt;/p&gt;</description>
            <wire x1="0.85" y1="0.8009" x2="-0.85" y2="0.8009" width="0.127" layer="21"/>
            <wire x1="0.85" y1="-0.8009" x2="-0.85" y2="-0.8009" width="0.127" layer="21"/>
            <wire x1="0.85" y1="-0.475" x2="-0.85" y2="-0.475" width="0.12" layer="51"/>
            <wire x1="-0.85" y1="-0.475" x2="-0.85" y2="0.475" width="0.12" layer="51"/>
            <wire x1="-0.85" y1="0.475" x2="0.85" y2="0.475" width="0.12" layer="51"/>
            <wire x1="0.85" y1="0.475" x2="0.85" y2="-0.475" width="0.12" layer="51"/>
            <smd name="1" x="-0.8152" y="0" dx="0.7987" dy="0.9739" layer="1"/>
            <smd name="2" x="0.8152" y="0" dx="0.7987" dy="0.9739" layer="1"/>
            <text x="0" y="2.54" size="1.27" layer="25" align="top-center">&gt;NAME</text>
            <text x="0" y="-2.54" size="1.27" layer="27" align="bottom-center">&gt;VALUE</text>
                        </package>
            <package name="CAPC1005X60">
            <description>Chip, 1.00 X 0.50 X 0.60 mm body
            &lt;p&gt;Chip package with body size 1.00 X 0.50 X 0.60 mm&lt;/p&gt;</description>
            <wire x1="0.55" y1="0.6286" x2="-0.55" y2="0.6286" width="0.127" layer="21"/>
            <wire x1="0.55" y1="-0.6286" x2="-0.55" y2="-0.6286" width="0.127" layer="21"/>
            <wire x1="0.55" y1="-0.3" x2="-0.55" y2="-0.3" width="0.12" layer="51"/>
            <wire x1="-0.55" y1="-0.3" x2="-0.55" y2="0.3" width="0.12" layer="51"/>
            <wire x1="-0.55" y1="0.3" x2="0.55" y2="0.3" width="0.12" layer="51"/>
            <wire x1="0.55" y1="0.3" x2="0.55" y2="-0.3" width="0.12" layer="51"/>
            <smd name="1" x="-0.4846" y="0" dx="0.56" dy="0.6291" layer="1"/>
            <smd name="2" x="0.4846" y="0" dx="0.56" dy="0.6291" layer="1"/>
            <text x="0" y="2.54" size="1.27" layer="25" align="top-center">&gt;NAME</text>
            <text x="0" y="-2.54" size="1.27" layer="27" align="bottom-center">&gt;VALUE</text>
                        </package>
            <package name="CAPC1608X85">
            <description>Chip, 1.60 X 0.80 X 0.85 mm body
            &lt;p&gt;Chip package with body size 1.60 X 0.80 X 0.85 mm&lt;/p&gt;</description>
            <wire x1="0.875" y1="0.7991" x2="-0.875" y2="0.7991" width="0.127" layer="21"/>
            <wire x1="0.875" y1="-0.7991" x2="-0.875" y2="-0.7991" width="0.127" layer="21"/>
            <wire x1="0.875" y1="-0.475" x2="-0.875" y2="-0.475" width="0.12" layer="51"/>
            <wire x1="-0.875" y1="-0.475" x2="-0.875" y2="0.475" width="0.12" layer="51"/>
            <wire x1="-0.875" y1="0.475" x2="0.875" y2="0.475" width="0.12" layer="51"/>
            <wire x1="0.875" y1="0.475" x2="0.875" y2="-0.475" width="0.12" layer="51"/>
            <smd name="1" x="-0.7746" y="0" dx="0.9209" dy="0.9702" layer="1"/>
            <smd name="2" x="0.7746" y="0" dx="0.9209" dy="0.9702" layer="1"/>
            <text x="0" y="2.54" size="1.27" layer="25" align="top-center">&gt;NAME</text>
            <text x="0" y="-2.54" size="1.27" layer="27" align="bottom-center">&gt;VALUE</text>
                        </package>
            <package name="CAPC2012X110">
            <description>Chip, 2.00 X 1.25 X 1.10 mm body
            &lt;p&gt;Chip package with body size 2.00 X 1.25 X 1.10 mm&lt;/p&gt;</description>
            <wire x1="1.1" y1="1.0467" x2="-1.1" y2="1.0467" width="0.127" layer="21"/>
            <wire x1="1.1" y1="-1.0467" x2="-1.1" y2="-1.0467" width="0.127" layer="21"/>
            <wire x1="1.1" y1="-0.725" x2="-1.1" y2="-0.725" width="0.12" layer="51"/>
            <wire x1="-1.1" y1="-0.725" x2="-1.1" y2="0.725" width="0.12" layer="51"/>
            <wire x1="-1.1" y1="0.725" x2="1.1" y2="0.725" width="0.12" layer="51"/>
            <wire x1="1.1" y1="0.725" x2="1.1" y2="-0.725" width="0.12" layer="51"/>
            <smd name="1" x="-0.8754" y="0" dx="1.1646" dy="1.4653" layer="1"/>
            <smd name="2" x="0.8754" y="0" dx="1.1646" dy="1.4653" layer="1"/>
            <text x="0" y="2.54" size="1.27" layer="25" align="top-center">&gt;NAME</text>
            <text x="0" y="-2.54" size="1.27" layer="27" align="bottom-center">&gt;VALUE</text>
                        </package>
            <package name="INDC1006X60N">
            <description>Chip, 1.00 X 0.60 X 0.60 mm body
            &lt;p&gt;Chip package with body size 1.00 X 0.60 X 0.60 mm&lt;/p&gt;</description>
            <wire x1="0.55" y1="0.6786" x2="-0.55" y2="0.6786" width="0.12" layer="21"/>
            <wire x1="0.55" y1="-0.6786" x2="-0.55" y2="-0.6786" width="0.12" layer="21"/>
            <wire x1="0.55" y1="-0.35" x2="-0.55" y2="-0.35" width="0.12" layer="51"/>
            <wire x1="-0.55" y1="-0.35" x2="-0.55" y2="0.35" width="0.12" layer="51"/>
            <wire x1="-0.55" y1="0.35" x2="0.55" y2="0.35" width="0.12" layer="51"/>
            <wire x1="0.55" y1="0.35" x2="0.55" y2="-0.35" width="0.12" layer="51"/>
            <smd name="1" x="-0.4846" y="0" dx="0.56" dy="0.7291" layer="1"/>
            <smd name="2" x="0.4846" y="0" dx="0.56" dy="0.7291" layer="1"/>
            <text x="0" y="2.54" size="1.27" layer="25" align="top-center">&gt;NAME</text>
            <text x="0" y="-2.54" size="1.27" layer="27" align="bottom-center">&gt;VALUE</text>
                        </package>
            <package name="LEDC1608X55N_FLAT-B">
            <description>Chip LED package with body size 1.60 X 0.80 X 0.55 mm</description>
            <smd name="C" x="-0.75" y="0" dx="0.6118" dy="0.9118" layer="1"/>
            <smd name="A" x="0.75" y="0" dx="0.6118" dy="0.9118" layer="1"/>
            <wire x1="-1.3099" y1="0.7699" x2="0.8" y2="0.7699" width="0.2" layer="21"/>
            <wire x1="-1.3099" y1="0.7699" x2="-1.3099" y2="-0.7699" width="0.2" layer="21"/>
            <wire x1="-1.3099" y1="-0.7699" x2="0.8" y2="-0.7699" width="0.2" layer="21"/>
            <wire x1="-0.8" y1="-0.4" x2="-0.8" y2="0.4" width="0.1" layer="51"/>
            <wire x1="-0.8" y1="0.4" x2="0.8" y2="0.4" width="0.1" layer="51"/>
            <wire x1="0.8" y1="0.4" x2="0.8" y2="-0.4" width="0.1" layer="51"/>
            <wire x1="0.8" y1="-0.4" x2="-0.8" y2="-0.4" width="0.1" layer="51"/>
            <text x="0" y="2.54" size="1.27" layer="25" align="top-center">&gt;NAME</text>
            <text x="0" y="-2.54" size="1.27" layer="27" align="bottom-center">&gt;VALUE</text>
            <polygon width="0.1524" layer="39" pour="solid">
            <vertex x="-1.4238" y="-0.9238"/>
            <vertex x="1.2238" y="-0.9238"/>
            <vertex x="1.2238" y="0.9238"/>
            <vertex x="-1.4238" y="0.9238"/>
            </polygon>
                        </package>
            <package name="DFM0020A_TI">
            <description>Texas Instruments DFM0020A SOIC-20 land pattern: 1.27 mm pitch, 9.70 mm row-centre spacing, 2.10 X 0.60 mm pads.</description>
            <smd name="1" x="-4.85" y="5.715" dx="2.1" dy="0.6" layer="1"/>
            <smd name="20" x="4.85" y="5.715" dx="2.1" dy="0.6" layer="1"/>
            <smd name="2" x="-4.85" y="4.445" dx="2.1" dy="0.6" layer="1"/>
            <smd name="19" x="4.85" y="4.445" dx="2.1" dy="0.6" layer="1"/>
            <smd name="3" x="-4.85" y="3.175" dx="2.1" dy="0.6" layer="1"/>
            <smd name="18" x="4.85" y="3.175" dx="2.1" dy="0.6" layer="1"/>
            <smd name="4" x="-4.85" y="1.905" dx="2.1" dy="0.6" layer="1"/>
            <smd name="17" x="4.85" y="1.905" dx="2.1" dy="0.6" layer="1"/>
            <smd name="5" x="-4.85" y="0.635" dx="2.1" dy="0.6" layer="1"/>
            <smd name="16" x="4.85" y="0.635" dx="2.1" dy="0.6" layer="1"/>
            <smd name="6" x="-4.85" y="-0.635" dx="2.1" dy="0.6" layer="1"/>
            <smd name="15" x="4.85" y="-0.635" dx="2.1" dy="0.6" layer="1"/>
            <smd name="7" x="-4.85" y="-1.905" dx="2.1" dy="0.6" layer="1"/>
            <smd name="14" x="4.85" y="-1.905" dx="2.1" dy="0.6" layer="1"/>
            <smd name="8" x="-4.85" y="-3.175" dx="2.1" dy="0.6" layer="1"/>
            <smd name="13" x="4.85" y="-3.175" dx="2.1" dy="0.6" layer="1"/>
            <smd name="9" x="-4.85" y="-4.445" dx="2.1" dy="0.6" layer="1"/>
            <smd name="12" x="4.85" y="-4.445" dx="2.1" dy="0.6" layer="1"/>
            <smd name="10" x="-4.85" y="-5.715" dx="2.1" dy="0.6" layer="1"/>
            <smd name="11" x="4.85" y="-5.715" dx="2.1" dy="0.6" layer="1"/>
            <wire x1="-3.93" y1="-6.5" x2="3.93" y2="-6.5" width="0.1524" layer="21"/>
            <wire x1="3.93" y1="-6.5" x2="3.93" y2="6.5" width="0.1524" layer="21"/>
            <wire x1="3.93" y1="6.5" x2="-3.93" y2="6.5" width="0.1524" layer="21"/>
            <wire x1="-3.93" y1="6.5" x2="-3.93" y2="-6.5" width="0.1524" layer="21"/>
            <circle x="-3.23" y="5.5" radius="0.35" width="0" layer="21"/>
            <text x="-5.2" y="7.1" size="1.016" layer="25">&gt;NAME</text>
                        </package>
            <package name="SOT23_">
            <description>3-SOT23, 0.95 mm pitch, 2.40 mm span, 2.90 X 1.30 X 1.10 mm body
             &lt;p&gt;3-pin SOT23 package with 0.95 mm pitch, 2.40 mm span with body size 2.90 X 1.30 X 1.10 mm&lt;/p&gt;</description>
            <smd name="1" x="-1.0247" y="0.95" dx="1.1821" dy="0.6122" layer="1"/>
            <smd name="2" x="-1.0247" y="-0.95" dx="1.1821" dy="0.6122" layer="1"/>
            <smd name="3" x="1.0247" y="0" dx="1.1821" dy="0.6122" layer="1"/>
            <circle x="-1.204" y="1.7601" radius="0.25" width="0" layer="21"/>
            <wire x1="-0.7" y1="1.5701" x2="0.7" y2="1.5701" width="0.12" layer="21"/>
            <wire x1="0.7" y1="1.5701" x2="0.7" y2="0.5601" width="0.12" layer="21"/>
            <wire x1="-0.7" y1="-1.5701" x2="0.7" y2="-1.5701" width="0.12" layer="21"/>
            <wire x1="0.7" y1="-1.5701" x2="0.7" y2="-0.5601" width="0.12" layer="21"/>
            <wire x1="-0.7" y1="-1.5" x2="-0.7" y2="1.5" width="0.12" layer="51"/>
            <wire x1="-0.7" y1="1.5" x2="0.7" y2="1.5" width="0.12" layer="51"/>
            <wire x1="0.7" y1="1.5" x2="0.7" y2="-1.5" width="0.12" layer="51"/>
            <wire x1="0.7" y1="-1.5" x2="-0.7" y2="-1.5" width="0.12" layer="51"/>
            <text x="0" y="2.6451" size="1.27" layer="25" align="bottom-center">&gt;NAME</text>
            <text x="0" y="-2.2051" size="1.27" layer="27" align="top-center">&gt;VALUE</text>
                        </package>
            <package name="HCPL0700_SO8">
            <description>Broadcom HCPL-0700 SO-8 manufacturer land pattern: 1.27 mm pitch, 7.49 mm row-centre spacing, 1.90 X 0.64 mm pads.</description>
            <smd name="1" x="-3.745" y="1.905" dx="1.9" dy="0.64" layer="1"/>
            <smd name="2" x="-3.745" y="0.635" dx="1.9" dy="0.64" layer="1"/>
            <smd name="3" x="-3.745" y="-0.635" dx="1.9" dy="0.64" layer="1"/>
            <smd name="4" x="-3.745" y="-1.905" dx="1.9" dy="0.64" layer="1"/>
            <smd name="5" x="3.745" y="-1.905" dx="1.9" dy="0.64" layer="1"/>
            <smd name="6" x="3.745" y="-0.635" dx="1.9" dy="0.64" layer="1"/>
            <smd name="7" x="3.745" y="0.635" dx="1.9" dy="0.64" layer="1"/>
            <smd name="8" x="3.745" y="1.905" dx="1.9" dy="0.64" layer="1"/>
            <circle x="-2.7079" y="2.7112" radius="0.25" width="0" layer="21"/>
            <wire x1="-2" y1="2.4612" x2="-2" y2="2.55" width="0.12" layer="21"/>
            <wire x1="-2" y1="2.55" x2="2" y2="2.55" width="0.12" layer="21"/>
            <wire x1="2" y1="2.55" x2="2" y2="2.4612" width="0.12" layer="21"/>
            <wire x1="-2" y1="-2.4612" x2="-2" y2="-2.55" width="0.12" layer="21"/>
            <wire x1="-2" y1="-2.55" x2="2" y2="-2.55" width="0.12" layer="21"/>
            <wire x1="2" y1="-2.55" x2="2" y2="-2.4612" width="0.12" layer="21"/>
            <wire x1="-2" y1="-2.55" x2="-2" y2="2.55" width="0.12" layer="51"/>
            <wire x1="-2" y1="2.55" x2="2" y2="2.55" width="0.12" layer="51"/>
            <wire x1="2" y1="2.55" x2="2" y2="-2.55" width="0.12" layer="51"/>
            <wire x1="2" y1="-2.55" x2="-2" y2="-2.55" width="0.12" layer="51"/>
            <text x="0" y="3.5962" size="1.27" layer="25" align="bottom-center">&gt;NAME</text>
            <text x="0" y="-3.185" size="1.27" layer="27" align="top-center">&gt;VALUE</text>
                        </package>
            <package name="SOD323_VISHAY">
            <description>Vishay SOD-323 manufacturer footprint for 1N4148WS-E3-08: 1.60 mm pad-centre spacing and 0.80 X 0.80 mm pads.</description>
            <smd name="C" x="-0.8" y="0" dx="0.8" dy="0.8" layer="1"/>
            <smd name="A" x="0.8" y="0" dx="0.8" dy="0.8" layer="1"/>
            <text x="0" y="1.385" size="1.27" layer="25" align="bottom-center">&gt;NAME</text>
            <text x="0" y="-1.385" size="1.27" layer="27" align="top-center">&gt;VALUE</text>
            <wire x1="-0.508" y1="0.762" x2="0.762" y2="0.762" width="0.127" layer="21"/>
            <wire x1="0.762" y1="0.762" x2="0.762" y2="-0.762" width="0.127" layer="21"/>
            <wire x1="0.762" y1="-0.762" x2="-0.508" y2="-0.762" width="0.127" layer="21"/>
            <wire x1="-0.508" y1="-0.762" x2="-0.762" y2="-0.762" width="0.127" layer="21"/>
            <wire x1="-0.762" y1="-0.762" x2="-0.762" y2="0.762" width="0.127" layer="21"/>
            <wire x1="-0.762" y1="0.762" x2="-0.508" y2="0.762" width="0.127" layer="21"/>
            <wire x1="-0.508" y1="0.762" x2="-0.508" y2="-0.762" width="0.127" layer="21"/>
                        </package>
            <package name="ACT45B_4P5X3P2">
            <description>TDK ACT45B-510-2P-TL003, 4.5 X 3.2 mm four-terminal common-mode choke. Verify against the current TDK layout recommendation before PCB release.</description>
            <smd name="1" x="-2.2" y="1.1" dx="1.2" dy="1" layer="1"/>
            <smd name="2" x="2.2" y="1.1" dx="1.2" dy="1" layer="1"/>
            <smd name="4" x="-2.2" y="-1.1" dx="1.2" dy="1" layer="1"/>
            <smd name="3" x="2.2" y="-1.1" dx="1.2" dy="1" layer="1"/>
            <wire x1="-1.6" y1="-1.8" x2="1.6" y2="-1.8" width="0.12" layer="21"/>
            <wire x1="1.6" y1="-1.8" x2="1.6" y2="1.8" width="0.12" layer="21"/>
            <wire x1="1.6" y1="1.8" x2="-1.6" y2="1.8" width="0.12" layer="21"/>
            <wire x1="-1.6" y1="1.8" x2="-1.6" y2="-1.8" width="0.12" layer="21"/>
            <circle x="-1.3" y="1.35" radius="0.2" width="0" layer="21"/>
            <text x="0" y="2.4" size="1.27" layer="25" align="bottom-center">&gt;NAME</text>
            <text x="0" y="-2.4" size="1.27" layer="27" align="top-center">&gt;VALUE</text>
                        </package>
            <package name="B4B-XH-A">
            <pad name="1" x="0" y="0" drill="1.05" shape="long" rot="R90"/>
            <pad name="2" x="2.5" y="0" drill="1.05" shape="long" rot="R90"/>
            <pad name="3" x="5" y="0" drill="1.05" shape="long" rot="R90"/>
            <pad name="4" x="7.5" y="0" drill="1.05" shape="long" rot="R90"/>
            <wire x1="-2.45" y1="3.45" x2="9.902" y2="3.45" width="0.1524" layer="21"/>
            <wire x1="-2.45" y1="-2.3" x2="9.902" y2="-2.3" width="0.1524" layer="21"/>
            <wire x1="-2.45" y1="3.45" x2="-2.45" y2="-2.3" width="0.1524" layer="21"/>
            <wire x1="9.902" y1="3.45" x2="9.902" y2="-2.3" width="0.1524" layer="21"/>
            <text x="3.81" y="5.08" size="1.27" layer="25" align="top-center">&gt;NAME</text>
            <text x="3.81" y="-3.81" size="1.27" layer="27" align="bottom-center">&gt;VALUE</text>
            <circle x="-1.27" y="-3.81" radius="0.92446875" width="0" layer="21"/>
                        </package>
            <package name="B5B-XH-A">
            <pad name="1" x="-5" y="0" drill="1.05" shape="long" rot="R90"/>
            <pad name="2" x="-2.5" y="0" drill="1.05" shape="long" rot="R90"/>
            <pad name="3" x="0" y="0" drill="1.05" shape="long" rot="R90"/>
            <pad name="4" x="2.5" y="0" drill="1.05" shape="long" rot="R90"/>
            <wire x1="-7.25" y1="3.45" x2="7.25" y2="3.45" width="0.1524" layer="21"/>
            <wire x1="-7.25" y1="-2.3" x2="7.25" y2="-2.3" width="0.1524" layer="21"/>
            <wire x1="-7.25" y1="3.45" x2="-7.25" y2="-2.3" width="0.1524" layer="21"/>
            <wire x1="7.25" y1="3.45" x2="7.25" y2="-2.3" width="0.1524" layer="21"/>
            <text x="-0.27" y="4.58" size="1.27" layer="25" align="center">&gt;NAME</text>
            <text x="-0.27" y="-3.81" size="1.27" layer="27" align="bottom-center">&gt;VALUE</text>
            <pad name="5" x="5" y="0" drill="1.05" shape="long" rot="R90"/>
            <circle x="-5.900775" y="-3.456771875" radius="0.7670125" width="0" layer="21"/>
                        </package>
          </packages>
          <packages3d>
            <package3d name="RESC1005X40" urn="urn:adsk.eagle:package:16378568/8" type="model">
            <description>Chip, 1.05 X 0.54 X 0.40 mm body
            &lt;p&gt;Chip package with body size 1.05 X 0.54 X 0.40 mm&lt;/p&gt;</description>
            <packageinstances>
            <packageinstance name="RESC1005X40"/>
            </packageinstances>
            </package3d>
            <package3d name="RESC1608X60" urn="urn:adsk.eagle:package:16378565/8" type="model">
            <description>Chip, 1.60 X 0.82 X 0.60 mm body
            &lt;p&gt;Chip package with body size 1.60 X 0.82 X 0.60 mm&lt;/p&gt;</description>
            <packageinstances>
            <packageinstance name="RESC1608X60"/>
            </packageinstances>
            </package3d>
            <package3d name="CAPC1005X60" urn="urn:adsk.eagle:package:16290895/7" type="model">
            <description>Chip, 1.00 X 0.50 X 0.60 mm body
            &lt;p&gt;Chip package with body size 1.00 X 0.50 X 0.60 mm&lt;/p&gt;</description>
            <packageinstances>
            <packageinstance name="CAPC1005X60"/>
            </packageinstances>
            </package3d>
            <package3d name="CAPC1608X85" urn="urn:adsk.eagle:package:16290898/7" type="model">
            <description>Chip, 1.60 X 0.80 X 0.85 mm body
            &lt;p&gt;Chip package with body size 1.60 X 0.80 X 0.85 mm&lt;/p&gt;</description>
            <packageinstances>
            <packageinstance name="CAPC1608X85"/>
            </packageinstances>
            </package3d>
            <package3d name="CAPC2012X110" urn="urn:adsk.eagle:package:16290897/7" type="model">
            <description>Chip, 2.00 X 1.25 X 1.10 mm body
            &lt;p&gt;Chip package with body size 2.00 X 1.25 X 1.10 mm&lt;/p&gt;</description>
            <packageinstances>
            <packageinstance name="CAPC2012X110"/>
            </packageinstances>
            </package3d>
            <package3d name="INDC1006X60N" urn="urn:adsk.eagle:package:16378468/4" type="model">
            <description>Chip, 1.00 X 0.60 X 0.60 mm body
            &lt;p&gt;Chip package with body size 1.00 X 0.60 X 0.60 mm&lt;/p&gt;</description>
            <packageinstances>
            <packageinstance name="INDC1006X60N"/>
            </packageinstances>
            </package3d>
            <package3d name="LEDC1608X55N_FLAT-B" urn="urn:adsk.eagle:package:24294782/6" type="model">
            <description>Chip LED package with body size 1.60 X 0.80 X 0.55 mm</description>
            <packageinstances>
            <packageinstance name="LEDC1608X55N_FLAT-B"/>
            </packageinstances>
            </package3d>
            <package3d name="SOT23" urn="" wip_urn="urn:adsk.wipprod:fs.file:vf.4AAFcqkXTp2xL-Mh3nvH5A?version=1" locally_modified="yes" type="model">
            <description>3-SOT23, 0.95 mm pitch, 2.40 mm span, 2.90 X 1.30 X 1.10 mm body
             &lt;p&gt;3-pin SOT23 package with 0.95 mm pitch, 2.40 mm span with body size 2.90 X 1.30 X 1.10 mm&lt;/p&gt;</description>
            <packageinstances>
            <packageinstance name="SOT23_"/>
            </packageinstances>
            <metadata pins="3" pitch="0.95" bodyLength="2.9" bodyWidth="1.3" height="1.1" ipcFamily="SOT23" ipcName="SOT95P240X110-3N" mountingType="SMD"/>
            </package3d>
            <package3d name="B4B-XH-A" urn="urn:adsk.eagle:package:24957647/4" locally_modified="yes" type="model">
            <packageinstances>
            <packageinstance name="B4B-XH-A"/>
            </packageinstances>
            </package3d>
          </packages3d>
          <symbols>
            <symbol name="RESISTOR">
                          <description>IEC‑style: Resistor</description>
                          <wire x1="-2.54" y1="-0.889" x2="2.54" y2="-0.889" width="0.1524" layer="94"/>
                          <wire x1="2.54" y1="0.889" x2="-2.54" y2="0.889" width="0.1524" layer="94"/>
                          <wire x1="2.54" y1="-0.889" x2="2.54" y2="0.889" width="0.1524" layer="94"/>
                          <wire x1="-2.54" y1="-0.889" x2="-2.54" y2="0.889" width="0.1524" layer="94"/>
                          <pin name="1" x="-5.08" y="0" visible="off" length="short" direction="pas" swaplevel="1"/>
                          <pin name="2" x="5.08" y="0" visible="off" length="short" direction="pas" swaplevel="1" rot="R180"/>
                          <text x="0" y="-5.08" size="1.778" layer="95" align="top-center">&gt;SPICEMODEL</text>
                          <text x="0" y="-7.62" size="1.778" layer="95" align="top-center">&gt;SPICEEXTRA</text>
                          <text x="0" y="2.54" size="1.778" layer="95" align="bottom-center">&gt;NAME</text>
                          <text x="0" y="-2.54" size="1.778" layer="96" align="top-center">&gt;VALUE</text>
                        </symbol>
            <symbol name="CAPACITOR">
                          <description>General capacitor (IEC‑style)</description>
                          <wire x1="-2.54" y1="0" x2="-0.254" y2="0" width="0.1524" layer="94"/>
                          <wire x1="2.54" y1="0" x2="0.254" y2="0" width="0.1524" layer="94"/>
                          <wire x1="-0.254" y1="2.032" x2="-0.254" y2="0" width="0.1524" layer="94"/>
                          <wire x1="-0.254" y1="0" x2="-0.254" y2="-2.032" width="0.1524" layer="94"/>
                          <wire x1="0.254" y1="2.032" x2="0.254" y2="0" width="0.1524" layer="94"/>
                          <wire x1="0.254" y1="0" x2="0.254" y2="-2.032" width="0.1524" layer="94"/>
                          <pin name="1" x="-2.54" y="0" visible="off" length="point" direction="pas" swaplevel="1"/>
                          <pin name="2" x="2.54" y="0" visible="off" length="point" direction="pas" swaplevel="1" rot="R180"/>
                          <text x="0" y="2.54" size="1.778" layer="95" align="bottom-center">&gt;NAME</text>
                          <text x="0" y="-5.08" size="1.778" layer="97" align="top-center">&gt;SPICEMODEL</text>
                          <text x="0" y="-2.54" size="1.778" layer="96" align="top-center">&gt;VALUE</text>
                          <text x="0" y="-7.62" size="1.778" layer="97" align="top-center">&gt;SPICEEXTRA</text>
                        </symbol>
            <symbol name="FUSE">
                          <description>IEEE/ANSI Symbol</description>
                          <wire x1="-2.54" y1="-0.762" x2="2.54" y2="-0.762" width="0.1524" layer="94"/>
                          <wire x1="2.54" y1="0.762" x2="-2.54" y2="0.762" width="0.1524" layer="94"/>
                          <wire x1="2.54" y1="-0.762" x2="2.54" y2="0.762" width="0.1524" layer="94"/>
                          <wire x1="-2.54" y1="0.762" x2="-2.54" y2="-0.762" width="0.1524" layer="94"/>
                          <wire x1="-2.54" y1="0" x2="2.54" y2="0" width="0.1524" layer="94"/>
                          <pin name="2" x="5.08" y="0" visible="off" length="short" direction="pas" swaplevel="1" rot="R180"/>
                          <pin name="1" x="-5.08" y="0" visible="off" length="short" direction="pas" swaplevel="1"/>
                          <text x="0" y="2.54" size="1.778" layer="95" align="center">&gt;NAME</text>
                          <text x="0" y="-2.54" size="1.778" layer="96" align="center">&gt;VALUE</text>
                        </symbol>
            <symbol name="FERRITE">
                          <description>Inductor</description>
                          <pin name="1" x="-5.08" y="0" visible="off" length="point" direction="pas" swaplevel="1"/>
                          <pin name="2" x="5.08" y="0" visible="off" length="point" direction="pas" swaplevel="1" rot="R180"/>
                          <text x="0" y="2.54" size="1.778" layer="95" align="center">&gt;NAME</text>
                          <text x="0" y="-5.08" size="1.778" layer="97" align="center">&gt;SPICEMODEL</text>
                          <text x="0" y="-2.54" size="1.778" layer="96" align="center">&gt;VALUE</text>
                          <text x="0" y="-7.62" size="1.778" layer="97" align="center">&gt;SPICEEXTRA</text>
                          <wire x1="-3.81" y1="0" x2="-1.27" y2="0" width="0.1524" layer="94" curve="-180"/>
                          <wire x1="-1.27" y1="0" x2="1.27" y2="0" width="0.1524" layer="94" curve="-180"/>
                          <wire x1="1.27" y1="0" x2="3.81" y2="0" width="0.1524" layer="94" curve="-180"/>
                          <wire x1="-5.08" y1="0" x2="-3.81" y2="0" width="0.1524" layer="94"/>
                          <wire x1="3.81" y1="0" x2="5.08" y2="0" width="0.1524" layer="94"/>
                        </symbol>
            <symbol name="SWITCH">
                          <pin name="P$1" x="-7.62" y="2.54" length="point" rot="R180"/>
                          <pin name="P$2" x="7.62" y="2.54" length="point"/>
                          <pin name="P$3" x="-7.62" y="-2.54" length="point" rot="R180"/>
                          <pin name="P$4" x="7.62" y="-2.54" length="point"/>
                          <wire x1="-7.62" y1="2.54" x2="0" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="0" y1="2.54" x2="7.62" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="-7.62" y1="-2.54" x2="0" y2="-2.54" width="0.254" layer="94"/>
                          <wire x1="0" y1="-2.54" x2="7.62" y2="-2.54" width="0.254" layer="94"/>
                          <wire x1="0" y1="-2.54" x2="0" y2="-1.041059375" width="0.254" layer="94"/>
                          <wire x1="0" y1="-1.041059375" x2="-1.27859375" y2="0.237534375" width="0.254" layer="94"/>
                          <wire x1="0" y1="2.54" x2="0" y2="0.5298875" width="0.254" layer="94"/>
                          <circle x="0" y="0.5298875" radius="0.228825" width="0.254" layer="94"/>
                        </symbol>
            <symbol name="DIODE">
                          <pin name="A" x="-10.16" y="0" length="point"/>
                          <pin name="K" x="6.35" y="0" length="point" rot="R180"/>
                          <wire x1="-3.81" y1="2.54" x2="-3.81" y2="0" width="0.254" layer="94"/>
                          <wire x1="-3.81" y1="0" x2="-3.81" y2="-2.54" width="0.254" layer="94"/>
                          <wire x1="-3.81" y1="-2.54" x2="-1.27" y2="0" width="0.254" layer="94"/>
                          <wire x1="-1.27" y1="0" x2="-3.81" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="-1.27" y1="2.54" x2="-1.27" y2="0" width="0.254" layer="94"/>
                          <wire x1="-1.27" y1="0" x2="-1.27" y2="-2.54" width="0.254" layer="94"/>
                          <wire x1="-1.27" y1="0" x2="6.35" y2="0" width="0.254" layer="94"/>
                          <wire x1="-1.27" y1="0" x2="-3.81" y2="0" width="0.254" layer="94"/>
                          <wire x1="-3.81" y1="0" x2="-10.16" y2="0" width="0.254" layer="94"/>
                        </symbol>
            <symbol name="LED">
                          <description>LED Symbol</description>
                          <pin name="K" x="2.54" y="0" visible="off" length="point" direction="pas" rot="R180"/>
                          <pin name="A" x="-2.54" y="0" visible="off" length="point" direction="pas"/>
                          <wire x1="-1.27" y1="-1.27" x2="1.27" y2="0" width="0.1524" layer="94"/>
                          <wire x1="1.27" y1="0" x2="-1.27" y2="1.27" width="0.1524" layer="94"/>
                          <wire x1="-1.27" y1="1.27" x2="-1.27" y2="0" width="0.1524" layer="94"/>
                          <wire x1="-1.27" y1="0" x2="-1.27" y2="-1.27" width="0.1524" layer="94"/>
                          <wire x1="1.397" y1="1.27" x2="1.397" y2="-1.27" width="0.1524" layer="94"/>
                          <wire x1="2.54" y1="0" x2="1.27" y2="0" width="0.1524" layer="94"/>
                          <wire x1="-1.27" y1="0" x2="-2.54" y2="0" width="0.1524" layer="94"/>
                          <wire x1="1.143" y1="1.397" x2="1.143" y2="1.905" width="0.1524" layer="94"/>
                          <wire x1="1.143" y1="1.905" x2="0.635" y2="1.905" width="0.1524" layer="94"/>
                          <wire x1="1.143" y1="1.905" x2="0.4697125" y2="1.22660625" width="0.1524" layer="94"/>
                          <wire x1="0.381" y1="1.778" x2="0.381" y2="2.286" width="0.1524" layer="94"/>
                          <wire x1="0.381" y1="2.286" x2="-0.127" y2="2.286" width="0.1524" layer="94"/>
                          <wire x1="0.381" y1="2.286" x2="-0.2922875" y2="1.60760625" width="0.1524" layer="94"/>
                          <text x="0" y="2.54" size="1.778" layer="95" align="bottom-center">&gt;NAME</text>
                          <text x="0" y="-2.54" size="1.778" layer="96" align="center">&gt;VALUE</text>
                        </symbol>
            <symbol name="PICO2W">
                          <wire x1="-33.02" y1="27.94" x2="-33.02" y2="-25.4" width="0.254" layer="94"/>
                          <wire x1="-33.02" y1="-25.4" x2="35.56" y2="-25.4" width="0.254" layer="94"/>
                          <wire x1="-33.02" y1="27.94" x2="35.56" y2="27.94" width="0.254" layer="94"/>
                          <wire x1="35.56" y1="27.94" x2="35.56" y2="-25.4" width="0.254" layer="94"/>
                          <text x="-33.02" y="28.194" size="1.778" layer="95">Pico 2 W Development Board</text>
                          <text x="-33.02" y="-27.94" size="1.778" layer="96">RP2350A</text>
                          <pin name="GP0" x="-38.1" y="25.4" length="middle"/>
                          <pin name="GP1" x="-38.1" y="22.86" length="middle"/>
                          <pin name="GND3" x="-38.1" y="20.32" length="middle" direction="sup"/>
                          <pin name="GP2" x="-38.1" y="17.78" length="middle"/>
                          <pin name="GP3" x="-38.1" y="15.24" length="middle"/>
                          <pin name="GP4" x="-38.1" y="12.7" length="middle"/>
                          <pin name="GP5" x="-38.1" y="10.16" length="middle"/>
                          <pin name="GND8" x="-38.1" y="7.62" length="middle" direction="sup"/>
                          <pin name="GP6" x="-38.1" y="5.08" length="middle"/>
                          <pin name="GP7" x="-38.1" y="2.54" length="middle"/>
                          <pin name="GP8" x="-38.1" y="0" length="middle"/>
                          <pin name="GP9" x="-38.1" y="-2.54" length="middle"/>
                          <pin name="GND13" x="-38.1" y="-5.08" length="middle" direction="sup"/>
                          <pin name="GP10" x="-38.1" y="-7.62" length="middle"/>
                          <pin name="GP11" x="-38.1" y="-10.16" length="middle"/>
                          <pin name="GP12" x="-38.1" y="-12.7" length="middle"/>
                          <pin name="GP13" x="-38.1" y="-15.24" length="middle"/>
                          <pin name="GND18" x="-38.1" y="-17.78" length="middle" direction="sup"/>
                          <pin name="GP14" x="-38.1" y="-20.32" length="middle"/>
                          <pin name="GP15" x="-38.1" y="-22.86" length="middle"/>
                          <pin name="GP16" x="40.64" y="-22.86" length="middle" rot="R180"/>
                          <pin name="GP17" x="40.64" y="-20.32" length="middle" rot="R180"/>
                          <pin name="GND23" x="40.64" y="-17.78" length="middle" direction="sup" rot="R180"/>
                          <pin name="GP18" x="40.64" y="-15.24" length="middle" rot="R180"/>
                          <pin name="GP19" x="40.64" y="-12.7" length="middle" rot="R180"/>
                          <pin name="GP20" x="40.64" y="-10.16" length="middle" rot="R180"/>
                          <pin name="GP21" x="40.64" y="-7.62" length="middle" rot="R180"/>
                          <pin name="GND28" x="40.64" y="-5.08" length="middle" direction="sup" rot="R180"/>
                          <pin name="GP22" x="40.64" y="-2.54" length="middle" rot="R180"/>
                          <pin name="RUN" x="40.64" y="0" length="middle" rot="R180"/>
                          <pin name="GP26_ADC0" x="40.64" y="2.54" length="middle" rot="R180"/>
                          <pin name="GP27_ADC1" x="40.64" y="5.08" length="middle" rot="R180"/>
                          <pin name="AGND" x="40.64" y="7.62" length="middle" direction="sup" rot="R180"/>
                          <pin name="GP28_ADC2" x="40.64" y="10.16" length="middle" rot="R180"/>
                          <pin name="ADC_VREF" x="40.64" y="12.7" length="middle" direction="sup" rot="R180"/>
                          <pin name="3V3" x="40.64" y="15.24" length="middle" direction="sup" rot="R180"/>
                          <pin name="3V3_EN" x="40.64" y="17.78" length="middle" rot="R180"/>
                          <pin name="GND38" x="40.64" y="20.32" length="middle" direction="sup" rot="R180"/>
                          <pin name="VSYS" x="40.64" y="22.86" length="middle" direction="pwr" rot="R180"/>
                          <pin name="VBUS" x="40.64" y="25.4" length="middle" direction="pwr" rot="R180"/>
                        </symbol>
            <symbol name="ISOW1412">
                          <wire x1="-15.24" y1="-26.67" x2="15.24" y2="-26.67" width="0.254" layer="94"/>
                          <wire x1="15.24" y1="-26.67" x2="15.24" y2="26.67" width="0.254" layer="94"/>
                          <wire x1="15.24" y1="26.67" x2="-15.24" y2="26.67" width="0.254" layer="94"/>
                          <wire x1="-15.24" y1="26.67" x2="-15.24" y2="-26.67" width="0.254" layer="94"/>
                          <text x="-15.24" y="29.21" size="1.778" layer="95">&gt;NAME</text>
                          <text x="-15.24" y="-30.48" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="VIO" x="-20.32" y="22.86" visible="pin" length="middle" direction="pwr"/>
                          <pin name="D" x="-20.32" y="17.78" visible="pin" length="middle" direction="in"/>
                          <pin name="DE" x="-20.32" y="12.7" visible="pin" length="middle" direction="in"/>
                          <pin name="R" x="-20.32" y="7.62" visible="pin" length="middle" direction="out"/>
                          <pin name="RE_N" x="-20.32" y="2.54" visible="pin" length="middle" direction="in"/>
                          <pin name="GNDIO" x="-20.32" y="-2.54" visible="pin" length="middle" direction="pwr"/>
                          <pin name="EN_FLT" x="-20.32" y="-12.7" visible="pin" length="middle"/>
                          <pin name="VDD" x="-20.32" y="-17.78" visible="pin" length="middle" direction="pwr"/>
                          <pin name="GND1" x="-20.32" y="-22.86" visible="pin" length="middle" direction="pwr"/>
                          <pin name="A" x="20.32" y="22.86" visible="pin" length="middle" direction="in" rot="R180"/>
                          <pin name="B" x="20.32" y="17.78" visible="pin" length="middle" direction="in" rot="R180"/>
                          <pin name="Z" x="20.32" y="12.7" visible="pin" length="middle" direction="out" rot="R180"/>
                          <pin name="Y" x="20.32" y="7.62" visible="pin" length="middle" direction="out" rot="R180"/>
                          <pin name="VISOIN" x="20.32" y="2.54" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="GISOIN" x="20.32" y="-2.54" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="MODE" x="20.32" y="-12.7" visible="pin" length="middle" direction="in" rot="R180"/>
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
                          <pin name="A" x="-15.24" y="3.81" visible="pin" length="middle" direction="in"/>
                          <pin name="K" x="-15.24" y="-3.81" visible="pin" length="middle" direction="in"/>
                          <pin name="VCC" x="15.24" y="11.43" visible="pin" length="middle" direction="pwr" rot="R180"/>
                          <pin name="VB" x="15.24" y="3.81" visible="pin" length="middle" direction="in" rot="R180"/>
                          <pin name="VO" x="15.24" y="-3.81" visible="pin" length="middle" direction="out" rot="R180"/>
                          <pin name="GND" x="15.24" y="-11.43" visible="pin" length="middle" direction="pwr" rot="R180"/>
                        </symbol>
            <symbol name="TVS_SM712">
                          <wire x1="-2.54" y1="-5.08" x2="2.54" y2="-5.08" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="-5.08" x2="2.54" y2="5.08" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="5.08" x2="-2.54" y2="5.08" width="0.254" layer="94"/>
                          <wire x1="-2.54" y1="5.08" x2="-2.54" y2="-5.08" width="0.254" layer="94"/>
                          <text x="0" y="6.223" size="1.27" layer="94" align="center">SM712</text>
                          <text x="0" y="8.128" size="1.778" layer="95" align="center">&gt;NAME</text>
                          <text x="0.254" y="-6.096" size="1.27" layer="96" align="center">&gt;VALUE</text>
                          <pin name="IO1" x="-7.62" y="2.54" visible="pin" length="middle" direction="pas"/>
                          <pin name="IO2" x="-7.62" y="-2.54" visible="pin" length="middle" direction="pas"/>
                          <pin name="GND" x="7.62" y="0" visible="pin" length="middle" direction="pwr" rot="R180"/>
                        </symbol>
            <symbol name="CMC">
                          <wire x1="-7.112" y1="-5.08" x2="2.54" y2="-5.08" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="-5.08" x2="2.54" y2="5.08" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="5.08" x2="-7.112" y2="5.08" width="0.254" layer="94"/>
                          <wire x1="-7.112" y1="5.08" x2="-7.112" y2="-5.08" width="0.254" layer="94"/>
                          <text x="-2.286" y="4.191" size="1.27" layer="94" align="center">CMC</text>
                          <text x="-2.54" y="7.62" size="1.778" layer="95" align="center">&gt;NAME</text>
                          <text x="-2.54" y="-6.35" size="1.27" layer="96" align="center">&gt;VALUE</text>
                          <pin name="A1" x="-13.716" y="2.54" visible="pin" length="middle" direction="pas"/>
                          <pin name="B1" x="-13.716" y="-2.54" visible="pin" length="middle" direction="pas"/>
                          <pin name="A2" x="9.144" y="2.54" visible="pin" length="middle" direction="pas" rot="R180"/>
                          <pin name="B2" x="9.144" y="-2.54" visible="pin" length="middle" direction="pas" rot="R180"/>
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
                          <pin name="P1" x="-5.08" y="17.78" visible="pin" length="middle" direction="pas"/>
                          <pin name="P2" x="-5.08" y="12.7" visible="pin" length="middle" direction="pas"/>
                          <pin name="P3" x="-5.08" y="7.62" visible="pin" length="middle" direction="pas"/>
                          <pin name="P4" x="-5.08" y="2.54" visible="pin" length="middle" direction="pas"/>
                          <pin name="P5" x="-5.08" y="-2.54" visible="pin" length="middle" direction="pas"/>
                          <pin name="P6" x="-5.08" y="-7.62" visible="pin" length="middle" direction="pas"/>
                          <pin name="P7" x="-5.08" y="-12.7" visible="pin" length="middle" direction="pas"/>
                          <pin name="P8" x="-5.08" y="-17.78" visible="pin" length="middle" direction="pas"/>
                        </symbol>
            <symbol name="CONN17">
                          <wire x1="0" y1="-43.18" x2="7.62" y2="-43.18" width="0.254" layer="94"/>
                          <wire x1="7.62" y1="-43.18" x2="7.62" y2="43.18" width="0.254" layer="94"/>
                          <wire x1="7.62" y1="43.18" x2="0" y2="43.18" width="0.254" layer="94"/>
                          <wire x1="0" y1="43.18" x2="0" y2="-43.18" width="0.254" layer="94"/>
                          <text x="0" y="45.72" size="1.778" layer="95">&gt;NAME</text>
                          <text x="0" y="-46.99" size="1.27" layer="96">&gt;VALUE</text>
                          <pin name="P1" x="-5.08" y="40.64" visible="pin" length="middle" direction="pas"/>
                          <pin name="P2" x="-5.08" y="35.56" visible="pin" length="middle" direction="pas"/>
                          <pin name="P3" x="-5.08" y="30.48" visible="pin" length="middle" direction="pas"/>
                          <pin name="P4" x="-5.08" y="25.4" visible="pin" length="middle" direction="pas"/>
                          <pin name="P5" x="-5.08" y="20.32" visible="pin" length="middle" direction="pas"/>
                          <pin name="P6" x="-5.08" y="15.24" visible="pin" length="middle" direction="pas"/>
                          <pin name="P7" x="-5.08" y="10.16" visible="pin" length="middle" direction="pas"/>
                          <pin name="P8" x="-5.08" y="5.08" visible="pin" length="middle" direction="pas"/>
                          <pin name="P9" x="-5.08" y="0" visible="pin" length="middle" direction="pas"/>
                          <pin name="P10" x="-5.08" y="-5.08" visible="pin" length="middle" direction="pas"/>
                          <pin name="P11" x="-5.08" y="-10.16" visible="pin" length="middle" direction="pas"/>
                          <pin name="P12" x="-5.08" y="-15.24" visible="pin" length="middle" direction="pas"/>
                          <pin name="P13" x="-5.08" y="-20.32" visible="pin" length="middle" direction="pas"/>
                          <pin name="P14" x="-5.08" y="-25.4" visible="pin" length="middle" direction="pas"/>
                          <pin name="P15" x="-5.08" y="-30.48" visible="pin" length="middle" direction="pas"/>
                          <pin name="P16" x="-5.08" y="-35.56" visible="pin" length="middle" direction="pas"/>
                          <pin name="P17" x="-5.08" y="-40.64" visible="pin" length="middle" direction="pas"/>
                        </symbol>
            <symbol name="A3">
                          <wire x1="0" y1="0" x2="52.499990625" y2="0" width="0.254" layer="94"/>
                          <wire x1="52.499990625" y1="0" x2="104.99998125" y2="0" width="0.254" layer="94"/>
                          <wire x1="104.99998125" y1="0" x2="157.499971875" y2="0" width="0.254" layer="94"/>
                          <wire x1="157.499971875" y1="0" x2="209.9999625" y2="0" width="0.254" layer="94"/>
                          <wire x1="209.9999625" y1="0" x2="262.499953125" y2="0" width="0.254" layer="94"/>
                          <wire x1="262.499953125" y1="0" x2="314.99994375" y2="0" width="0.254" layer="94"/>
                          <wire x1="314.99994375" y1="0" x2="367.499934375" y2="0" width="0.254" layer="94"/>
                          <wire x1="367.499934375" y1="0" x2="419.999921875" y2="0" width="0.254" layer="94"/>
                          <wire x1="0" y1="0" x2="0" y2="74.249978125" width="0.254" layer="94"/>
                          <wire x1="0" y1="74.249978125" x2="0" y2="148.49995625" width="0.254" layer="94"/>
                          <wire x1="0" y1="148.49995625" x2="0" y2="222.749934375" width="0.254" layer="94"/>
                          <wire x1="0" y1="222.749934375" x2="0" y2="296.9999125" width="0.254" layer="94"/>
                          <wire x1="0" y1="296.9999125" x2="52.499990625" y2="296.9999125" width="0.254" layer="94"/>
                          <wire x1="52.499990625" y1="296.9999125" x2="104.99998125" y2="296.9999125" width="0.254" layer="94"/>
                          <wire x1="104.99998125" y1="296.9999125" x2="157.499971875" y2="296.9999125" width="0.254" layer="94"/>
                          <wire x1="157.499971875" y1="296.9999125" x2="209.9999625" y2="296.9999125" width="0.254" layer="94"/>
                          <wire x1="209.9999625" y1="296.9999125" x2="262.499953125" y2="296.9999125" width="0.254" layer="94"/>
                          <wire x1="262.499953125" y1="296.9999125" x2="314.99994375" y2="296.9999125" width="0.254" layer="94"/>
                          <wire x1="314.99994375" y1="296.9999125" x2="367.499934375" y2="296.9999125" width="0.254" layer="94"/>
                          <wire x1="367.499934375" y1="296.9999125" x2="419.999921875" y2="296.9999125" width="0.254" layer="94"/>
                          <wire x1="419.999921875" y1="296.9999125" x2="419.999921875" y2="222.749934375" width="0.254" layer="94"/>
                          <wire x1="419.999921875" y1="222.749934375" x2="419.999921875" y2="148.49995625" width="0.254" layer="94"/>
                          <wire x1="419.999921875" y1="148.49995625" x2="419.999921875" y2="74.249978125" width="0.254" layer="94"/>
                          <wire x1="419.999921875" y1="74.249978125" x2="419.999921875" y2="0" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="2.54" x2="52.499990625" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="52.499990625" y1="2.54" x2="104.99998125" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="104.99998125" y1="2.54" x2="157.499971875" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="157.499971875" y1="2.54" x2="209.9999625" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="209.9999625" y1="2.54" x2="262.499953125" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="416.56" y1="2.54" x2="416.56" y2="10.16" width="0.254" layer="94"/>
                          <wire x1="416.56" y1="10.16" x2="416.56" y2="17.78" width="0.254" layer="94"/>
                          <wire x1="416.56" y1="17.78" x2="416.56" y2="25.4" width="0.254" layer="94"/>
                          <wire x1="416.56" y1="294.64" x2="367.499934375" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="367.499934375" y1="294.64" x2="314.99994375" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="314.99994375" y1="294.64" x2="262.499953125" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="262.499953125" y1="294.64" x2="209.9999625" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="209.9999625" y1="294.64" x2="157.499971875" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="157.499971875" y1="294.64" x2="104.99998125" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="104.99998125" y1="294.64" x2="52.499990625" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="52.499990625" y1="294.64" x2="2.54" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="294.64" x2="2.54" y2="222.749934375" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="222.749934375" x2="2.54" y2="148.49995625" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="148.49995625" x2="2.54" y2="74.249978125" width="0.254" layer="94"/>
                          <wire x1="2.54" y1="74.249978125" x2="2.54" y2="2.54" width="0.254" layer="94"/>
                          <text x="271.78" y="12.7" size="1.778" layer="94">Wilifeld 4</text>
                          <text x="271.78" y="17.78" size="3.81" layer="94">wagnius GmbH</text>
                          <text x="271.78" y="7.62" size="1.778" layer="94">5708 Birrwil</text>
                          <wire x1="416.56" y1="294.64" x2="416.56" y2="222.749934375" width="0.254" layer="94"/>
                          <wire x1="416.56" y1="222.749934375" x2="416.56" y2="148.49995625" width="0.254" layer="94"/>
                          <wire x1="416.56" y1="148.49995625" x2="416.56" y2="74.249978125" width="0.254" layer="94"/>
                          <wire x1="416.56" y1="74.249978125" x2="416.56" y2="25.4" width="0.254" layer="94"/>
                          <wire x1="314.99994375" y1="2.54" x2="367.499934375" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="367.499934375" y1="2.54" x2="378.46" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="378.46" y1="2.54" x2="416.56" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="314.96" y1="25.4" x2="314.96" y2="12.7" width="0.254" layer="94"/>
                          <wire x1="314.96" y1="12.7" x2="314.96" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="262.499953125" y1="2.54" x2="269.24" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="269.24" y1="2.54" x2="314.96" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="52.499990625" y1="296.9999125" x2="52.499990625" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="52.499990625" y1="2.54" x2="52.499990625" y2="0" width="0.254" layer="94"/>
                          <wire x1="0" y1="222.749934375" x2="2.54" y2="222.749934375" width="0.254" layer="94"/>
                          <wire x1="0" y1="148.49995625" x2="2.54" y2="148.49995625" width="0.254" layer="94"/>
                          <wire x1="0" y1="74.249978125" x2="2.54" y2="74.249978125" width="0.254" layer="94"/>
                          <wire x1="104.99998125" y1="2.54" x2="104.99998125" y2="0" width="0.254" layer="94"/>
                          <wire x1="157.499971875" y1="2.54" x2="157.499971875" y2="0" width="0.254" layer="94"/>
                          <wire x1="209.9999625" y1="2.54" x2="209.9999625" y2="0" width="0.254" layer="94"/>
                          <wire x1="262.499953125" y1="2.54" x2="262.499953125" y2="0" width="0.254" layer="94"/>
                          <wire x1="314.96" y1="2.54" x2="314.99994375" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="314.99994375" y1="2.54" x2="314.99994375" y2="0" width="0.254" layer="94"/>
                          <wire x1="367.499934375" y1="2.54" x2="367.499934375" y2="0" width="0.254" layer="94"/>
                          <wire x1="416.56" y1="74.249978125" x2="419.999921875" y2="74.249978125" width="0.254" layer="94"/>
                          <wire x1="416.56" y1="148.49995625" x2="419.999921875" y2="148.49995625" width="0.254" layer="94"/>
                          <wire x1="416.56" y1="222.749934375" x2="419.999921875" y2="222.749934375" width="0.254" layer="94"/>
                          <wire x1="367.499934375" y1="296.9999125" x2="367.499934375" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="314.99994375" y1="296.9999125" x2="314.99994375" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="262.499953125" y1="296.9999125" x2="262.499953125" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="209.9999625" y1="296.9999125" x2="209.9999625" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="157.499971875" y1="296.9999125" x2="157.499971875" y2="294.64" width="0.254" layer="94"/>
                          <wire x1="104.99998125" y1="296.9999125" x2="104.99998125" y2="294.64" width="0.254" layer="94"/>
                          <text x="416.56" y="261.62" size="1.27" layer="94">  A</text>
                          <text x="0" y="261.62" size="1.27" layer="94">  A</text>
                          <text x="0" y="182.88" size="1.27" layer="94">  B</text>
                          <text x="416.56" y="185.42" size="1.27" layer="94">  B</text>
                          <text x="416.56" y="111.76" size="1.27" layer="94">  C</text>
                          <text x="0" y="114.3" size="1.27" layer="94">  C</text>
                          <text x="0" y="38.1" size="1.27" layer="94">  D</text>
                          <text x="416.56" y="38.1" size="1.27" layer="94">  D</text>
                          <text x="25.4" y="0" size="1.27" layer="94">1</text>
                          <text x="27.94" y="294.64" size="1.27" layer="94">1</text>
                          <text x="78.74" y="294.64" size="1.27" layer="94">2</text>
                          <text x="78.74" y="0" size="1.27" layer="94">2</text>
                          <text x="132.08" y="0" size="1.27" layer="94">3</text>
                          <text x="132.08" y="294.64" size="1.27" layer="94">3</text>
                          <text x="185.42" y="294.64" size="1.27" layer="94">4</text>
                          <text x="185.42" y="0" size="1.27" layer="94">4</text>
                          <text x="236.22" y="0" size="1.27" layer="94">5</text>
                          <text x="236.22" y="294.64" size="1.27" layer="94">5</text>
                          <text x="289.56" y="294.64" size="1.27" layer="94">6</text>
                          <text x="289.56" y="0" size="1.27" layer="94">6</text>
                          <text x="342.9" y="294.64" size="1.27" layer="94">7</text>
                          <text x="340.36" y="0" size="1.27" layer="94">7</text>
                          <text x="393.7" y="0" size="1.27" layer="94">8</text>
                          <text x="396.24" y="294.64" size="1.27" layer="94">8</text>
                          <text x="317.5" y="22.86" size="1.27" layer="94">Title</text>
                          <text x="317.5" y="10.16" size="1.27" layer="94">Partname / No.</text>
                          <wire x1="314.96" y1="25.4" x2="378.46" y2="25.4" width="0.254" layer="94"/>
                          <text x="381" y="22.86" size="1.27" layer="94">Created by</text>
                          <text x="381" y="7.62" size="1.27" layer="94">Date</text>
                          <text x="381" y="15.24" size="1.27" layer="94">Approved by</text>
                          <wire x1="378.46" y1="25.4" x2="416.56" y2="25.4" width="0.254" layer="94"/>
                          <wire x1="314.96" y1="25.4" x2="269.24" y2="25.4" width="0.254" layer="94"/>
                          <wire x1="269.24" y1="25.4" x2="269.24" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="378.46" y1="25.4" x2="378.46" y2="17.78" width="0.254" layer="94"/>
                          <wire x1="378.46" y1="17.78" x2="378.46" y2="12.7" width="0.254" layer="94"/>
                          <wire x1="378.46" y1="12.7" x2="378.46" y2="10.16" width="0.254" layer="94"/>
                          <wire x1="378.46" y1="10.16" x2="378.46" y2="2.54" width="0.254" layer="94"/>
                          <wire x1="378.46" y1="17.78" x2="416.56" y2="17.78" width="0.254" layer="94"/>
                          <wire x1="416.56" y1="10.16" x2="378.46" y2="10.16" width="0.254" layer="94"/>
                          <wire x1="314.96" y1="12.7" x2="378.46" y2="12.7" width="0.254" layer="94"/>
                        </symbol>
          </symbols>
          <devicesets>
            <deviceset name="RES0402" prefix="R">
                          <description>0402 resistor using project-library land pattern</description>
                          <gates>
                            <gate name="G$1" symbol="RESISTOR" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="RESC1005X40">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1"/>
                                <connect gate="G$1" pin="2" pad="2"/>
                              </connects>
                              <package3dinstances>
                                <package3dinstance package3d_urn="urn:adsk.eagle:package:16378568/8"/>
                              </package3dinstances>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="RES0603" prefix="R">
                          <description>0603 resistor using project-library land pattern</description>
                          <gates>
                            <gate name="G$1" symbol="RESISTOR" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="RESC1608X60">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1"/>
                                <connect gate="G$1" pin="2" pad="2"/>
                              </connects>
                              <package3dinstances>
                                <package3dinstance package3d_urn="urn:adsk.eagle:package:16378565/8"/>
                              </package3dinstances>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="CAP0402" prefix="C">
                          <description>0402 capacitor using project-library land pattern</description>
                          <gates>
                            <gate name="G$1" symbol="CAPACITOR" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="CAPC1005X60">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1"/>
                                <connect gate="G$1" pin="2" pad="2"/>
                              </connects>
                              <package3dinstances>
                                <package3dinstance package3d_urn="urn:adsk.eagle:package:16290895/7"/>
                              </package3dinstances>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="CAP0603" prefix="C">
                          <description>0603 capacitor using project-library land pattern</description>
                          <gates>
                            <gate name="G$1" symbol="CAPACITOR" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="CAPC1608X85">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1"/>
                                <connect gate="G$1" pin="2" pad="2"/>
                              </connects>
                              <package3dinstances>
                                <package3dinstance package3d_urn="urn:adsk.eagle:package:16290898/7"/>
                              </package3dinstances>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="CAP0805" prefix="C">
                          <description>0805 capacitor using project-library land pattern</description>
                          <gates>
                            <gate name="G$1" symbol="CAPACITOR" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="CAPC2012X110">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1"/>
                                <connect gate="G$1" pin="2" pad="2"/>
                              </connects>
                              <package3dinstances>
                                <package3dinstance package3d_urn="urn:adsk.eagle:package:16290897/7"/>
                              </package3dinstances>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="PPTC1206" prefix="F">
                          <description>Littelfuse 1206L050YR using project-library land pattern</description>
                          <gates>
                            <gate name="G$1" symbol="FUSE" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="PPTC1206_1206L050YR">
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
                          <description>Murata BLM15EX331SN1D using project-library land pattern</description>
                          <gates>
                            <gate name="G$1" symbol="FERRITE" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="INDC1006X60N">
                              <connects>
                                <connect gate="G$1" pin="1" pad="1"/>
                                <connect gate="G$1" pin="2" pad="2"/>
                              </connects>
                              <package3dinstances>
                                <package3dinstance package3d_urn="urn:adsk.eagle:package:16378468/4"/>
                              </package3dinstances>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="LED0603" prefix="D">
                          <description>0603 indicator LED using project-library land pattern</description>
                          <gates>
                            <gate name="G$1" symbol="LED" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="LEDC1608X55N_FLAT-B">
                              <connects>
                                <connect gate="G$1" pin="A" pad="A"/>
                                <connect gate="G$1" pin="K" pad="C"/>
                              </connects>
                              <package3dinstances>
                                <package3dinstance package3d_urn="urn:adsk.eagle:package:24294782/6"/>
                              </package3dinstances>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="DIODE_SOD323" prefix="D">
                          <description>Vishay 1N4148WS-E3-08 using manufacturer-recommended project-library land pattern</description>
                          <gates>
                            <gate name="G$1" symbol="DIODE" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="SOD323_VISHAY">
                              <connects>
                                <connect gate="G$1" pin="A" pad="A"/>
                                <connect gate="G$1" pin="K" pad="C"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="SWITCH_SMD" prefix="SW">
                          <description>C&amp;K/Littelfuse PTS810SJM250SMTR LFS using project-library land pattern</description>
                          <gates>
                            <gate name="G$1" symbol="SWITCH" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="PTS810_J_LEAD">
                              <connects>
                                <connect gate="G$1" pin="P$1" pad="1"/>
                                <connect gate="G$1" pin="P$2" pad="2"/>
                                <connect gate="G$1" pin="P$3" pad="3"/>
                                <connect gate="G$1" pin="P$4" pad="4"/>
                              </connects>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="SM712" prefix="D">
                          <description>Semtech SM712.TCT RS-485 TVS using the user-supplied project-library SOT-23 package</description>
                          <gates>
                            <gate name="G$1" symbol="TVS_SM712" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="SOT23_">
                              <connects>
                                <connect gate="G$1" pin="IO1" pad="1"/>
                                <connect gate="G$1" pin="IO2" pad="2"/>
                                <connect gate="G$1" pin="GND" pad="3"/>
                              </connects>
                              <package3dinstances>
                                <package3dinstance package3d_urn="urn:adsk.wipprod:fs.file:vf.4AAFcqkXTp2xL-Mh3nvH5A?version=1"/>
                              </package3dinstances>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="CMC_OPTION" prefix="L">
                          <description>TDK ACT45B-510-2P-TL003 two-line common-mode choke using project-library land pattern; normally DNP pending EMC and signal-integrity testing</description>
                          <gates>
                            <gate name="G$1" symbol="CMC" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="ACT45B_4P5X3P2">
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
                            <device name="" package="DFM0020A_TI">
                              <connects>
                                <connect gate="G$1" pin="VIO" pad="1"/>
                                <connect gate="G$1" pin="D" pad="2"/>
                                <connect gate="G$1" pin="DE" pad="3"/>
                                <connect gate="G$1" pin="R" pad="4"/>
                                <connect gate="G$1" pin="RE_N" pad="5"/>
                                <connect gate="G$1" pin="GNDIO" pad="6"/>
                                <connect gate="G$1" pin="EN_FLT" pad="8"/>
                                <connect gate="G$1" pin="VDD" pad="9"/>
                                <connect gate="G$1" pin="GND1" pad="10"/>
                                <connect gate="G$1" pin="GND2" pad="11"/>
                                <connect gate="G$1" pin="VISOOUT" pad="12"/>
                                <connect gate="G$1" pin="MODE" pad="13"/>
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
                          <description>Raspberry Pi Pico 2 W development board using project-library through-hole header land pattern</description>
                          <gates>
                            <gate name="G$1" symbol="PICO2W" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="PICO_2_W_DEVELOPMENT_BOARD">
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
                          <description>Broadcom HCPL-0700-500E SOIC-8 optocoupler using project-library land pattern</description>
                          <gates>
                            <gate name="G$1" symbol="OPTO_HCPL0700" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="HCPL0700_SO8">
                              <connects>
                                <connect gate="G$1" pin="A" pad="2"/>
                                <connect gate="G$1" pin="K" pad="3"/>
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
            <deviceset name="FRAME_A3" prefix="FRAME">
                          <description>wagnius GmbH A3 schematic template from the maintained project library</description>
                          <gates>
                            <gate name="G$1" symbol="A3" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="">
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="PANEL_DMX4" prefix="J">
                          <description>JST XH B4B-XH-A board header for the panel XLR harness</description>
                          <gates>
                            <gate name="G$1" symbol="CONN4" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="B4B-XH-A">
                              <connects>
                                <connect gate="G$1" pin="P1" pad="1"/>
                                <connect gate="G$1" pin="P2" pad="2"/>
                                <connect gate="G$1" pin="P3" pad="3"/>
                                <connect gate="G$1" pin="P4" pad="4"/>
                              </connects>
                              <package3dinstances>
                                <package3dinstance package3d_urn="urn:adsk.eagle:package:24957647/4"/>
                              </package3dinstances>
                              <technologies>
                                <technology name=""/>
                              </technologies>
                            </device>
                          </devices>
                        </deviceset>
            <deviceset name="PANEL_MIDI5" prefix="J">
                          <description>JST XH B5B-XH-A board header for the panel DIN-5 harness</description>
                          <gates>
                            <gate name="G$1" symbol="CONN5" x="0" y="0"/>
                          </gates>
                          <devices>
                            <device name="" package="B5B-XH-A">
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
        <class number="0" name="default" width="0.25" drill="0.3">
          <clearance class="0" value="0.2"/>
        </class>
      </classes>
      <parts>
        <part name="FRAME1" library="WiFiPicoDMX_RevA_used" deviceset="FRAME_A3" device="" value=""/>
        <part name="FRAME2" library="WiFiPicoDMX_RevA_used" deviceset="FRAME_A3" device="" value=""/>
        <part name="FRAME3" library="WiFiPicoDMX_RevA_used" deviceset="FRAME_A3" device="" value=""/>
        <part name="U1" library="WiFiPicoDMX_RevA_used" deviceset="PICO2W" device="" value="Raspberry Pi Pico 2 W"/>
        <part name="F1" library="WiFiPicoDMX_RevA_used" deviceset="PPTC1206" device="" value="1206L050YR 0.5A HOLD"/>
        <part name="SW1" library="WiFiPicoDMX_RevA_used" deviceset="SWITCH_SMD" device="" value="PTS810SJM250SMTR LFS RESET (NO)"/>
        <part name="R8" library="WiFiPicoDMX_RevA_used" deviceset="RES0402" device="" value="1k 1% 0.063W 0402 Yageo RC0402FR-071KL"/>
        <part name="D3" library="WiFiPicoDMX_RevA_used" deviceset="LED0603" device="" value="PWR GREEN Lite-On LTST-C190KGKT"/>
        <part name="R9" library="WiFiPicoDMX_RevA_used" deviceset="RES0402" device="" value="1k 1% 0.063W 0402 Yageo RC0402FR-071KL"/>
        <part name="D4" library="WiFiPicoDMX_RevA_used" deviceset="LED0603" device="" value="DMX YELLOW Lite-On LTST-C190KSKT"/>
        <part name="J3" library="WiFiPicoDMX_RevA_used" deviceset="PADBANK17" device="" value="FREE GPIO PADS"/>
        <part name="J4" library="WiFiPicoDMX_RevA_used" deviceset="PADBANK5" device="" value="ANALOG PADS"/>
        <part name="J5" library="WiFiPicoDMX_RevA_used" deviceset="PADBANK7" device="" value="RESERVED SIGNAL TEST PADS"/>
        <part name="U2" library="WiFiPicoDMX_RevA_used" deviceset="ISOW1412DFMR" device="" value="ISOW1412DFMR"/>
        <part name="R1" library="WiFiPicoDMX_RevA_used" deviceset="RES0402" device="" value="100k 1% 0.063W 0402 Yageo RC0402FR-07100KL"/>
        <part name="R2" library="WiFiPicoDMX_RevA_used" deviceset="RES0402" device="" value="10k 1% 0.063W 0402 Yageo RC0402FR-0710KL"/>
        <part name="R3" library="WiFiPicoDMX_RevA_used" deviceset="RES0402" device="" value="10k 1% 0.063W 0402 Yageo RC0402FR-0710KL"/>
        <part name="C1" library="WiFiPicoDMX_RevA_used" deviceset="CAP0402" device="" value="100nF 16V 10% X7R 0402 CL05B104KO5NNNC VIO"/>
        <part name="C2" library="WiFiPicoDMX_RevA_used" deviceset="CAP0402" device="" value="10nF 50V 10% X7R 0402 0402B103K500CT VDD &lt;1mm"/>
        <part name="C3" library="WiFiPicoDMX_RevA_used" deviceset="CAP0805" device="" value="10uF 35V 10% X5R 0805 GRM21BR6YA106KE43L VDD"/>
        <part name="C8" library="WiFiPicoDMX_RevA_used" deviceset="CAP0603" device="" value="1uF 50V 10% X5R 0603 CL10A105KB8NNNC VDD 2-4mm"/>
        <part name="FB1" library="WiFiPicoDMX_RevA_used" deviceset="FERRITE0402" device="" value="BLM15EX331SN1D"/>
        <part name="FB2" library="WiFiPicoDMX_RevA_used" deviceset="FERRITE0402" device="" value="BLM15EX331SN1D"/>
        <part name="C4" library="WiFiPicoDMX_RevA_used" deviceset="CAP0402" device="" value="10nF 50V 10% X7R 0402 0402B103K500CT VISOOUT &lt;1mm"/>
        <part name="C5" library="WiFiPicoDMX_RevA_used" deviceset="CAP0805" device="" value="10uF 35V 10% X5R 0805 GRM21BR6YA106KE43L VISOOUT"/>
        <part name="C6" library="WiFiPicoDMX_RevA_used" deviceset="CAP0402" device="" value="100nF 16V 10% X7R 0402 CL05B104KO5NNNC VISOIN"/>
        <part name="C9" library="WiFiPicoDMX_RevA_used" deviceset="CAP0603" device="" value="1uF 50V 10% X5R 0603 CL10A105KB8NNNC VISOOUT 2-4mm"/>
        <part name="L1" library="WiFiPicoDMX_RevA_used" deviceset="CMC_OPTION" device="" value="ACT45B-510-2P-TL003 - DNP"/>
        <part name="R10" library="WiFiPicoDMX_RevA_used" deviceset="RES0402" device="" value="0R 5% 0.063W 0402 Yageo RC0402JR-070RL CMC BYPASS FIT"/>
        <part name="R11" library="WiFiPicoDMX_RevA_used" deviceset="RES0402" device="" value="0R 5% 0.063W 0402 Yageo RC0402JR-070RL CMC BYPASS FIT"/>
        <part name="D1" library="WiFiPicoDMX_RevA_used" deviceset="SM712" device="" value="SM712.TCT"/>
        <part name="J1" library="WiFiPicoDMX_RevA_used" deviceset="PANEL_DMX4" device="" value="JST XH B4B-XH-A DMX: COM,-,+,SHELL"/>
        <part name="J2" library="WiFiPicoDMX_RevA_used" deviceset="PANEL_MIDI5" device="" value="JST XH B5B-XH-A MIDI: 1,2,3,4,5"/>
        <part name="R4" library="WiFiPicoDMX_RevA_used" deviceset="RES0402" device="" value="220R 1% 0.063W 0402 Yageo RC0402FR-07220RL"/>
        <part name="R5" library="WiFiPicoDMX_RevA_used" deviceset="RES0402" device="" value="220R 1% 0.063W 0402 Yageo RC0402FR-07220RL"/>
        <part name="D2" library="WiFiPicoDMX_RevA_used" deviceset="DIODE_SOD323" device="" value="1N4148WS-E3-08"/>
        <part name="U3" library="WiFiPicoDMX_RevA_used" deviceset="HCPL_0700_500E" device="" value="HCPL-0700-500E"/>
        <part name="R6" library="WiFiPicoDMX_RevA_used" deviceset="RES0402" device="" value="4.7k 1% 0.063W 0402 Yageo RC0402FR-074K7L"/>
        <part name="R7" library="WiFiPicoDMX_RevA_used" deviceset="RES0402" device="" value="47k 1% 0.063W 0402 Yageo RC0402FR-0747KL"/>
        <part name="C7" library="WiFiPicoDMX_RevA_used" deviceset="CAP0402" device="" value="100nF 16V 10% X7R 0402 CL05B104KO5NNNC MIDI VCC"/>
      </parts>
      <sheets>
        <sheet>
                  <plain>
                    <text x="20.32" y="187.96" size="2.54" layer="91" ratio="15">WiFiPicoDMX Rev. A — Controller, power, controls and expansion</text>
                    <text x="20.32" y="15.24" size="1.778" layer="91" ratio="12">Power only through Pico Micro-USB. Do not feed VSYS/VBUS from the carrier.</text>
                    <text x="20.32" y="10.16" size="1.778" layer="91" ratio="12">Verify every project-library and generated land pattern against the selected manufacturer part before PCB release.</text>
                    <text x="20.32" y="5.08" size="1.778" layer="91" ratio="12">Use the Pico 2 W development board's onboard BOOTSEL button below the USB connector; preserve finger/tool access in the PCB and enclosure.</text>
                  </plain>
                  <instances>
                    <instance part="FRAME1" gate="G$1" x="0" y="0" rot="R0" smashed="no"/>
                    <instance part="U1" gate="G$1" x="76.2" y="101.6" rot="R0" smashed="no"/>
                    <instance part="F1" gate="G$1" x="137.16" y="172.72" rot="R0" smashed="no"/>
                    <instance part="SW1" gate="G$1" x="137.16" y="157.48" rot="R0" smashed="no"/>
                    <instance part="R8" gate="G$1" x="132.08" y="139.7" rot="R0" smashed="no"/>
                    <instance part="D3" gate="G$1" x="208.28" y="139.7" rot="R0" smashed="no"/>
                    <instance part="R9" gate="G$1" x="182.88" y="124.46" rot="R0" smashed="no"/>
                    <instance part="D4" gate="G$1" x="254" y="124.46" rot="R0" smashed="no"/>
                    <instance part="J3" gate="G$1" x="320.04" y="134.62" rot="R0" smashed="no"/>
                    <instance part="J4" gate="G$1" x="213.36" y="71.12" rot="R0" smashed="no"/>
                    <instance part="J5" gate="G$1" x="213.36" y="33.02" rot="R0" smashed="no"/>
                  </instances>
                  <busses/>
                  <nets>
                    <net name="ADC_VREF" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="ADC_VREF"/>
                                                    <wire x1="116.84" y1="114.3" x2="121.92" y2="114.3" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="114.3" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J4" gate="G$1" pin="P4"/>
                                                    <wire x1="208.28" y1="66.04" x2="203.2" y2="66.04" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="66.04" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="ADC0_GPIO26" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP26_ADC0"/>
                                                    <wire x1="116.84" y1="104.14" x2="121.92" y2="104.14" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="104.14" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J4" gate="G$1" pin="P1"/>
                                                    <wire x1="208.28" y1="81.28" x2="203.2" y2="81.28" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="81.28" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="ADC1_GPIO27" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP27_ADC1"/>
                                                    <wire x1="116.84" y1="106.67999999999999" x2="121.92" y2="106.67999999999999" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="106.67999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J4" gate="G$1" pin="P2"/>
                                                    <wire x1="208.28" y1="76.2" x2="203.2" y2="76.2" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="76.2" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="ADC2_GPIO28" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP28_ADC2"/>
                                                    <wire x1="116.84" y1="111.75999999999999" x2="121.92" y2="111.75999999999999" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="111.75999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J4" gate="G$1" pin="P3"/>
                                                    <wire x1="208.28" y1="71.12" x2="203.2" y2="71.12" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="71.12" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="AGND" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="AGND"/>
                                                    <wire x1="116.84" y1="109.22" x2="121.92" y2="109.22" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="109.22" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J4" gate="G$1" pin="P5"/>
                                                    <wire x1="208.28" y1="60.96000000000001" x2="203.2" y2="60.96000000000001" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="60.96000000000001" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="DMX_ACTIVITY_GPIO7" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP7"/>
                                                    <wire x1="38.1" y1="104.14" x2="33.02" y2="104.14" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="104.14" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R9" gate="G$1" pin="1"/>
                                                    <wire x1="177.79999999999998" y1="124.46" x2="172.71999999999997" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="172.71999999999997" y="124.46" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P6"/>
                                                    <wire x1="208.28" y1="22.860000000000007" x2="203.2" y2="22.860000000000007" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="22.860000000000007" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="DMX_DIR_GPIO4" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP4"/>
                                                    <wire x1="38.1" y1="114.3" x2="33.02" y2="114.3" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="114.3" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P3"/>
                                                    <wire x1="208.28" y1="38.1" x2="203.2" y2="38.1" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="38.1" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="DMX_LED_ANODE" class="0">
                                  <segment>
                                                    <pinref part="R9" gate="G$1" pin="2"/>
                                                    <wire x1="187.96" y1="124.46" x2="193.04000000000002" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="193.04000000000002" y="124.46" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D4" gate="G$1" pin="A"/>
                                                    <wire x1="251.46" y1="124.46" x2="246.38" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="246.38" y="124.46" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="DMX_RX_GPIO6" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP6"/>
                                                    <wire x1="38.1" y1="106.67999999999999" x2="33.02" y2="106.67999999999999" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="106.67999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P5"/>
                                                    <wire x1="208.28" y1="27.940000000000005" x2="203.2" y2="27.940000000000005" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="27.940000000000005" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="DMX_TRIGGER_GPIO3" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP3"/>
                                                    <wire x1="38.1" y1="116.83999999999999" x2="33.02" y2="116.83999999999999" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="116.83999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P2"/>
                                                    <wire x1="208.28" y1="43.18000000000001" x2="203.2" y2="43.18000000000001" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="43.18000000000001" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="DMX_TX_GPIO2" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP2"/>
                                                    <wire x1="38.1" y1="119.38" x2="33.02" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="119.38" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P1"/>
                                                    <wire x1="208.28" y1="48.260000000000005" x2="203.2" y2="48.260000000000005" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="48.260000000000005" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GND_LOGIC" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND3"/>
                                                    <wire x1="38.1" y1="121.91999999999999" x2="33.02" y2="121.91999999999999" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="121.91999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND8"/>
                                                    <wire x1="38.1" y1="109.22" x2="33.02" y2="109.22" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="109.22" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND13"/>
                                                    <wire x1="38.1" y1="96.52" x2="33.02" y2="96.52" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="96.52" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND18"/>
                                                    <wire x1="38.1" y1="83.82" x2="33.02" y2="83.82" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="83.82" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND23"/>
                                                    <wire x1="116.84" y1="83.82" x2="121.92" y2="83.82" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="83.82" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND28"/>
                                                    <wire x1="116.84" y1="96.52" x2="121.92" y2="96.52" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="96.52" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GND38"/>
                                                    <wire x1="116.84" y1="121.91999999999999" x2="121.92" y2="121.91999999999999" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="121.91999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="SW1" gate="G$1" pin="P$3"/>
                                                    <wire x1="129.54" y1="154.94" x2="124.46" y2="154.94" width="0.1524" layer="91"/>
                                                    <label x="124.46" y="154.94" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="SW1" gate="G$1" pin="P$4"/>
                                                    <wire x1="144.78" y1="154.94" x2="149.86" y2="154.94" width="0.1524" layer="91"/>
                                                    <label x="149.86" y="154.94" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D3" gate="G$1" pin="K"/>
                                                    <wire x1="210.82" y1="139.7" x2="215.9" y2="139.7" width="0.1524" layer="91"/>
                                                    <label x="215.9" y="139.7" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D4" gate="G$1" pin="K"/>
                                                    <wire x1="256.54" y1="124.46" x2="261.62" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="261.62" y="124.46" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GPIO0_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP0"/>
                                                    <wire x1="38.1" y1="127" x2="33.02" y2="127" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="127" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P1"/>
                                                    <wire x1="314.96000000000004" y1="175.26" x2="309.88000000000005" y2="175.26" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="175.26" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO1_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP1"/>
                                                    <wire x1="38.1" y1="124.46" x2="33.02" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="124.46" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P2"/>
                                                    <wire x1="314.96000000000004" y1="170.18" x2="309.88000000000005" y2="170.18" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="170.18" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO10_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP10"/>
                                                    <wire x1="38.1" y1="93.97999999999999" x2="33.02" y2="93.97999999999999" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="93.97999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P5"/>
                                                    <wire x1="314.96000000000004" y1="154.94" x2="309.88000000000005" y2="154.94" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="154.94" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO11_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP11"/>
                                                    <wire x1="38.1" y1="91.44" x2="33.02" y2="91.44" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="91.44" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P6"/>
                                                    <wire x1="314.96000000000004" y1="149.86" x2="309.88000000000005" y2="149.86" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="149.86" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO12_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP12"/>
                                                    <wire x1="38.1" y1="88.89999999999999" x2="33.02" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="88.89999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P7"/>
                                                    <wire x1="314.96000000000004" y1="144.78" x2="309.88000000000005" y2="144.78" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="144.78" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO13_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP13"/>
                                                    <wire x1="38.1" y1="86.36" x2="33.02" y2="86.36" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="86.36" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P8"/>
                                                    <wire x1="314.96000000000004" y1="139.70000000000002" x2="309.88000000000005" y2="139.70000000000002" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="139.70000000000002" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO14_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP14"/>
                                                    <wire x1="38.1" y1="81.28" x2="33.02" y2="81.28" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="81.28" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P9"/>
                                                    <wire x1="314.96000000000004" y1="134.62" x2="309.88000000000005" y2="134.62" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="134.62" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO15_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP15"/>
                                                    <wire x1="38.1" y1="78.74" x2="33.02" y2="78.74" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="78.74" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P10"/>
                                                    <wire x1="314.96000000000004" y1="129.54" x2="309.88000000000005" y2="129.54" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="129.54" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO16_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP16"/>
                                                    <wire x1="116.84" y1="78.74" x2="121.92" y2="78.74" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="78.74" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P11"/>
                                                    <wire x1="314.96000000000004" y1="124.46000000000001" x2="309.88000000000005" y2="124.46000000000001" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="124.46000000000001" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO17_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP17"/>
                                                    <wire x1="116.84" y1="81.28" x2="121.92" y2="81.28" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="81.28" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P12"/>
                                                    <wire x1="314.96000000000004" y1="119.38000000000001" x2="309.88000000000005" y2="119.38000000000001" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="119.38000000000001" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO18_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP18"/>
                                                    <wire x1="116.84" y1="86.36" x2="121.92" y2="86.36" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="86.36" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P13"/>
                                                    <wire x1="314.96000000000004" y1="114.30000000000001" x2="309.88000000000005" y2="114.30000000000001" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="114.30000000000001" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO19_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP19"/>
                                                    <wire x1="116.84" y1="88.89999999999999" x2="121.92" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="88.89999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P14"/>
                                                    <wire x1="314.96000000000004" y1="109.22" x2="309.88000000000005" y2="109.22" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="109.22" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO20_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP20"/>
                                                    <wire x1="116.84" y1="91.44" x2="121.92" y2="91.44" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="91.44" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P15"/>
                                                    <wire x1="314.96000000000004" y1="104.14" x2="309.88000000000005" y2="104.14" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="104.14" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO21_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP21"/>
                                                    <wire x1="116.84" y1="93.97999999999999" x2="121.92" y2="93.97999999999999" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="93.97999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P16"/>
                                                    <wire x1="314.96000000000004" y1="99.06" x2="309.88000000000005" y2="99.06" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="99.06" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO22_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP22"/>
                                                    <wire x1="116.84" y1="99.05999999999999" x2="121.92" y2="99.05999999999999" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="99.05999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P17"/>
                                                    <wire x1="314.96000000000004" y1="93.98" x2="309.88000000000005" y2="93.98" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="93.98" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO8_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP8"/>
                                                    <wire x1="38.1" y1="101.6" x2="33.02" y2="101.6" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="101.6" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P3"/>
                                                    <wire x1="314.96000000000004" y1="165.1" x2="309.88000000000005" y2="165.1" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="165.1" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GPIO9_EXP" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP9"/>
                                                    <wire x1="38.1" y1="99.05999999999999" x2="33.02" y2="99.05999999999999" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="99.05999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J3" gate="G$1" pin="P4"/>
                                                    <wire x1="314.96000000000004" y1="160.02" x2="309.88000000000005" y2="160.02" width="0.1524" layer="91"/>
                                                    <label x="309.88000000000005" y="160.02" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="ISOW_EN_FLT" class="0">
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P7"/>
                                                    <wire x1="208.28" y1="17.78" x2="203.2" y2="17.78" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="17.78" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_RX_GPIO5" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="GP5"/>
                                                    <wire x1="38.1" y1="111.75999999999999" x2="33.02" y2="111.75999999999999" width="0.1524" layer="91"/>
                                                    <label x="33.02" y="111.75999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J5" gate="G$1" pin="P4"/>
                                                    <wire x1="208.28" y1="33.02" x2="203.2" y2="33.02" width="0.1524" layer="91"/>
                                                    <label x="203.2" y="33.02" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="PICO_RUN_N" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="RUN"/>
                                                    <wire x1="116.84" y1="101.6" x2="121.92" y2="101.6" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="101.6" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="SW1" gate="G$1" pin="P$1"/>
                                                    <wire x1="129.54" y1="160.01999999999998" x2="124.46" y2="160.01999999999998" width="0.1524" layer="91"/>
                                                    <label x="124.46" y="160.01999999999998" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="SW1" gate="G$1" pin="P$2"/>
                                                    <wire x1="144.78" y1="160.01999999999998" x2="149.86" y2="160.01999999999998" width="0.1524" layer="91"/>
                                                    <label x="149.86" y="160.01999999999998" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="PICO_SMPS_EN" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="3V3_EN"/>
                                                    <wire x1="116.84" y1="119.38" x2="121.92" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="119.38" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="PICO_VSYS" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="VSYS"/>
                                                    <wire x1="116.84" y1="124.46" x2="121.92" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="124.46" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="PWR_LED_ANODE" class="0">
                                  <segment>
                                                    <pinref part="R8" gate="G$1" pin="2"/>
                                                    <wire x1="137.16000000000003" y1="139.7" x2="142.24000000000004" y2="139.7" width="0.1524" layer="91"/>
                                                    <label x="142.24000000000004" y="139.7" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D3" gate="G$1" pin="A"/>
                                                    <wire x1="205.74" y1="139.7" x2="200.66" y2="139.7" width="0.1524" layer="91"/>
                                                    <label x="200.66" y="139.7" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="VBUS_5V_USB" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="VBUS"/>
                                                    <wire x1="116.84" y1="127" x2="121.92" y2="127" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="127" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="F1" gate="G$1" pin="1"/>
                                                    <wire x1="132.07999999999998" y1="172.72" x2="126.99999999999999" y2="172.72" width="0.1524" layer="91"/>
                                                    <label x="126.99999999999999" y="172.72" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="VCC_3V3_LOGIC" class="0">
                                  <segment>
                                                    <pinref part="U1" gate="G$1" pin="3V3"/>
                                                    <wire x1="116.84" y1="116.83999999999999" x2="121.92" y2="116.83999999999999" width="0.1524" layer="91"/>
                                                    <label x="121.92" y="116.83999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R8" gate="G$1" pin="1"/>
                                                    <wire x1="127.00000000000001" y1="139.7" x2="121.92000000000002" y2="139.7" width="0.1524" layer="91"/>
                                                    <label x="121.92000000000002" y="139.7" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="VDD_5V_ISOW_FUSED" class="0">
                                  <segment>
                                                    <pinref part="F1" gate="G$1" pin="2"/>
                                                    <wire x1="142.24" y1="172.72" x2="147.32000000000002" y2="172.72" width="0.1524" layer="91"/>
                                                    <label x="147.32000000000002" y="172.72" size="1.27" layer="95" xref="yes"/>
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
                    <instance part="FRAME2" gate="G$1" x="0" y="0" rot="R0" smashed="no"/>
                    <instance part="U2" gate="G$1" x="111.76" y="101.6" rot="R0" smashed="no"/>
                    <instance part="R1" gate="G$1" x="50.8" y="157.48" rot="R0" smashed="no"/>
                    <instance part="R2" gate="G$1" x="50.8" y="142.24" rot="R0" smashed="no"/>
                    <instance part="R3" gate="G$1" x="50.8" y="127" rot="R0" smashed="no"/>
                    <instance part="C1" gate="G$1" x="50.8" y="111.76" rot="R0" smashed="no"/>
                    <instance part="C2" gate="G$1" x="50.8" y="96.52" rot="R0" smashed="no"/>
                    <instance part="C3" gate="G$1" x="50.8" y="81.28" rot="R0" smashed="no"/>
                    <instance part="C8" gate="G$1" x="50.8" y="66.04" rot="R0" smashed="no"/>
                    <instance part="FB1" gate="G$1" x="172.72" y="149.86" rot="R0" smashed="no"/>
                    <instance part="FB2" gate="G$1" x="172.72" y="134.62" rot="R0" smashed="no"/>
                    <instance part="C4" gate="G$1" x="264.16" y="149.86" rot="R0" smashed="no"/>
                    <instance part="C5" gate="G$1" x="264.16" y="134.62" rot="R0" smashed="no"/>
                    <instance part="C6" gate="G$1" x="264.16" y="119.38" rot="R0" smashed="no"/>
                    <instance part="C9" gate="G$1" x="264.16" y="104.14" rot="R0" smashed="no"/>
                    <instance part="L1" gate="G$1" x="223.52" y="91.44" rot="R0" smashed="no"/>
                    <instance part="R10" gate="G$1" x="172.72" y="76.2" rot="R0" smashed="no"/>
                    <instance part="R11" gate="G$1" x="172.72" y="60.96" rot="R0" smashed="no"/>
                    <instance part="D1" gate="G$1" x="314.96" y="91.44" rot="R0" smashed="no"/>
                    <instance part="J1" gate="G$1" x="381" y="91.44" rot="R0" smashed="no"/>
                  </instances>
                  <busses/>
                  <nets>
                    <net name="DMX_DATA_MINUS" class="0">
                                  <segment>
                                                    <pinref part="L1" gate="G$1" pin="B2"/>
                                                    <wire x1="232.66400000000002" y1="88.89999999999999" x2="237.74400000000003" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="237.74400000000003" y="88.89999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R11" gate="G$1" pin="2"/>
                                                    <wire x1="177.8" y1="60.96" x2="182.88000000000002" y2="60.96" width="0.1524" layer="91"/>
                                                    <label x="182.88000000000002" y="60.96" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D1" gate="G$1" pin="IO2"/>
                                                    <wire x1="307.34" y1="88.89999999999999" x2="302.26" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="302.26" y="88.89999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J1" gate="G$1" pin="P2"/>
                                                    <wire x1="375.92" y1="93.98" x2="370.84000000000003" y2="93.98" width="0.1524" layer="91"/>
                                                    <label x="370.84000000000003" y="93.98" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="DMX_DATA_PLUS" class="0">
                                  <segment>
                                                    <pinref part="L1" gate="G$1" pin="A2"/>
                                                    <wire x1="232.66400000000002" y1="93.98" x2="237.74400000000003" y2="93.98" width="0.1524" layer="91"/>
                                                    <label x="237.74400000000003" y="93.98" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R10" gate="G$1" pin="2"/>
                                                    <wire x1="177.8" y1="76.2" x2="182.88000000000002" y2="76.2" width="0.1524" layer="91"/>
                                                    <label x="182.88000000000002" y="76.2" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D1" gate="G$1" pin="IO1"/>
                                                    <wire x1="307.34" y1="93.98" x2="302.26" y2="93.98" width="0.1524" layer="91"/>
                                                    <label x="302.26" y="93.98" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J1" gate="G$1" pin="P3"/>
                                                    <wire x1="375.92" y1="88.89999999999999" x2="370.84000000000003" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="370.84000000000003" y="88.89999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="DMX_DIR_GPIO4" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="DE"/>
                                                    <wire x1="91.44" y1="114.3" x2="86.36" y2="114.3" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="114.3" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="RE_N"/>
                                                    <wire x1="91.44" y1="104.14" x2="86.36" y2="104.14" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="104.14" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R2" gate="G$1" pin="1"/>
                                                    <wire x1="45.72" y1="142.24" x2="40.64" y2="142.24" width="0.1524" layer="91"/>
                                                    <label x="40.64" y="142.24" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="DMX_RX_GPIO6" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="R"/>
                                                    <wire x1="91.44" y1="109.22" x2="86.36" y2="109.22" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="109.22" size="1.27" layer="95" xref="yes" rot="R180"/>
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
                                                    <wire x1="209.804" y1="88.89999999999999" x2="204.724" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="204.724" y="88.89999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R11" gate="G$1" pin="1"/>
                                                    <wire x1="167.64" y1="60.96" x2="162.55999999999997" y2="60.96" width="0.1524" layer="91"/>
                                                    <label x="162.55999999999997" y="60.96" size="1.27" layer="95" xref="yes" rot="R180"/>
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
                                                    <wire x1="209.804" y1="93.98" x2="204.724" y2="93.98" width="0.1524" layer="91"/>
                                                    <label x="204.724" y="93.98" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R10" gate="G$1" pin="1"/>
                                                    <wire x1="167.64" y1="76.2" x2="162.55999999999997" y2="76.2" width="0.1524" layer="91"/>
                                                    <label x="162.55999999999997" y="76.2" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="DMX_TX_GPIO2" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="D"/>
                                                    <wire x1="91.44" y1="119.38" x2="86.36" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="119.38" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R1" gate="G$1" pin="2"/>
                                                    <wire x1="55.879999999999995" y1="157.48" x2="60.959999999999994" y2="157.48" width="0.1524" layer="91"/>
                                                    <label x="60.959999999999994" y="157.48" size="1.27" layer="95" xref="yes"/>
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
                                                    <wire x1="167.64" y1="134.62" x2="162.55999999999997" y2="134.62" width="0.1524" layer="91"/>
                                                    <label x="162.55999999999997" y="134.62" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C4" gate="G$1" pin="2"/>
                                                    <wire x1="266.70000000000005" y1="149.86" x2="271.78000000000003" y2="149.86" width="0.1524" layer="91"/>
                                                    <label x="271.78000000000003" y="149.86" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C5" gate="G$1" pin="2"/>
                                                    <wire x1="266.70000000000005" y1="134.62" x2="271.78000000000003" y2="134.62" width="0.1524" layer="91"/>
                                                    <label x="271.78000000000003" y="134.62" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C9" gate="G$1" pin="2"/>
                                                    <wire x1="266.70000000000005" y1="104.14" x2="271.78000000000003" y2="104.14" width="0.1524" layer="91"/>
                                                    <label x="271.78000000000003" y="104.14" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="GND_DMX_ISO" class="0">
                                  <segment>
                                                    <pinref part="FB2" gate="G$1" pin="2"/>
                                                    <wire x1="177.8" y1="134.62" x2="182.88000000000002" y2="134.62" width="0.1524" layer="91"/>
                                                    <label x="182.88000000000002" y="134.62" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="GISOIN"/>
                                                    <wire x1="132.08" y1="99.05999999999999" x2="137.16000000000003" y2="99.05999999999999" width="0.1524" layer="91"/>
                                                    <label x="137.16000000000003" y="99.05999999999999" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C6" gate="G$1" pin="2"/>
                                                    <wire x1="266.70000000000005" y1="119.38" x2="271.78000000000003" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="271.78000000000003" y="119.38" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D1" gate="G$1" pin="GND"/>
                                                    <wire x1="322.58" y1="91.44" x2="327.65999999999997" y2="91.44" width="0.1524" layer="91"/>
                                                    <label x="327.65999999999997" y="91.44" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J1" gate="G$1" pin="P1"/>
                                                    <wire x1="375.92" y1="99.06" x2="370.84000000000003" y2="99.06" width="0.1524" layer="91"/>
                                                    <label x="370.84000000000003" y="99.06" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="GND_LOGIC" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="GNDIO"/>
                                                    <wire x1="91.44" y1="99.05999999999999" x2="86.36" y2="99.05999999999999" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="99.05999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="GND1"/>
                                                    <wire x1="91.44" y1="78.74" x2="86.36" y2="78.74" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="78.74" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R2" gate="G$1" pin="2"/>
                                                    <wire x1="55.879999999999995" y1="142.24" x2="60.959999999999994" y2="142.24" width="0.1524" layer="91"/>
                                                    <label x="60.959999999999994" y="142.24" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C1" gate="G$1" pin="2"/>
                                                    <wire x1="53.339999999999996" y1="111.76" x2="58.419999999999995" y2="111.76" width="0.1524" layer="91"/>
                                                    <label x="58.419999999999995" y="111.76" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C2" gate="G$1" pin="2"/>
                                                    <wire x1="53.339999999999996" y1="96.52" x2="58.419999999999995" y2="96.52" width="0.1524" layer="91"/>
                                                    <label x="58.419999999999995" y="96.52" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C3" gate="G$1" pin="2"/>
                                                    <wire x1="53.339999999999996" y1="81.28" x2="58.419999999999995" y2="81.28" width="0.1524" layer="91"/>
                                                    <label x="58.419999999999995" y="81.28" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C8" gate="G$1" pin="2"/>
                                                    <wire x1="53.339999999999996" y1="66.04" x2="58.419999999999995" y2="66.04" width="0.1524" layer="91"/>
                                                    <label x="58.419999999999995" y="66.04" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="ISOW_EN_FLT" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="EN_FLT"/>
                                                    <wire x1="91.44" y1="88.89999999999999" x2="86.36" y2="88.89999999999999" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="88.89999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R3" gate="G$1" pin="2"/>
                                                    <wire x1="55.879999999999995" y1="127" x2="60.959999999999994" y2="127" width="0.1524" layer="91"/>
                                                    <label x="60.959999999999994" y="127" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="VCC_3V3_LOGIC" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="VIO"/>
                                                    <wire x1="91.44" y1="124.46" x2="86.36" y2="124.46" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="124.46" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R1" gate="G$1" pin="1"/>
                                                    <wire x1="45.72" y1="157.48" x2="40.64" y2="157.48" width="0.1524" layer="91"/>
                                                    <label x="40.64" y="157.48" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R3" gate="G$1" pin="1"/>
                                                    <wire x1="45.72" y1="127" x2="40.64" y2="127" width="0.1524" layer="91"/>
                                                    <label x="40.64" y="127" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C1" gate="G$1" pin="1"/>
                                                    <wire x1="48.26" y1="111.76" x2="43.18" y2="111.76" width="0.1524" layer="91"/>
                                                    <label x="43.18" y="111.76" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="VCC_5V_DMX_ISO" class="0">
                                  <segment>
                                                    <pinref part="FB1" gate="G$1" pin="2"/>
                                                    <wire x1="177.8" y1="149.86" x2="182.88000000000002" y2="149.86" width="0.1524" layer="91"/>
                                                    <label x="182.88000000000002" y="149.86" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="VISOIN"/>
                                                    <wire x1="132.08" y1="104.14" x2="137.16000000000003" y2="104.14" width="0.1524" layer="91"/>
                                                    <label x="137.16000000000003" y="104.14" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C6" gate="G$1" pin="1"/>
                                                    <wire x1="261.62" y1="119.38" x2="256.54" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="256.54" y="119.38" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="VDD_5V_ISOW_FUSED" class="0">
                                  <segment>
                                                    <pinref part="U2" gate="G$1" pin="VDD"/>
                                                    <wire x1="91.44" y1="83.82" x2="86.36" y2="83.82" width="0.1524" layer="91"/>
                                                    <label x="86.36" y="83.82" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C2" gate="G$1" pin="1"/>
                                                    <wire x1="48.26" y1="96.52" x2="43.18" y2="96.52" width="0.1524" layer="91"/>
                                                    <label x="43.18" y="96.52" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C3" gate="G$1" pin="1"/>
                                                    <wire x1="48.26" y1="81.28" x2="43.18" y2="81.28" width="0.1524" layer="91"/>
                                                    <label x="43.18" y="81.28" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C8" gate="G$1" pin="1"/>
                                                    <wire x1="48.26" y1="66.04" x2="43.18" y2="66.04" width="0.1524" layer="91"/>
                                                    <label x="43.18" y="66.04" size="1.27" layer="95" xref="yes" rot="R180"/>
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
                                                    <wire x1="167.64" y1="149.86" x2="162.55999999999997" y2="149.86" width="0.1524" layer="91"/>
                                                    <label x="162.55999999999997" y="149.86" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C4" gate="G$1" pin="1"/>
                                                    <wire x1="261.62" y1="149.86" x2="256.54" y2="149.86" width="0.1524" layer="91"/>
                                                    <label x="256.54" y="149.86" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C5" gate="G$1" pin="1"/>
                                                    <wire x1="261.62" y1="134.62" x2="256.54" y2="134.62" width="0.1524" layer="91"/>
                                                    <label x="256.54" y="134.62" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C9" gate="G$1" pin="1"/>
                                                    <wire x1="261.62" y1="104.14" x2="256.54" y2="104.14" width="0.1524" layer="91"/>
                                                    <label x="256.54" y="104.14" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="XLR_SHELL" class="0">
                                  <segment>
                                                    <pinref part="J1" gate="G$1" pin="P4"/>
                                                    <wire x1="375.92" y1="83.82" x2="370.84000000000003" y2="83.82" width="0.1524" layer="91"/>
                                                    <label x="370.84000000000003" y="83.82" size="1.27" layer="95" xref="yes" rot="R180"/>
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
                    <instance part="FRAME3" gate="G$1" x="0" y="0" rot="R0" smashed="no"/>
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
                                                    <wire x1="208.28" y1="101.6" x2="213.36" y2="101.6" width="0.1524" layer="91"/>
                                                    <label x="213.36" y="101.6" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="C7" gate="G$1" pin="2"/>
                                                    <wire x1="205.73999999999998" y1="83.82" x2="210.82" y2="83.82" width="0.1524" layer="91"/>
                                                    <label x="210.82" y="83.82" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_DIN_PIN1_SPARE" class="0">
                                  <segment>
                                                    <pinref part="J2" gate="G$1" pin="P1"/>
                                                    <wire x1="40.64" y1="111.75999999999999" x2="35.56" y2="111.75999999999999" width="0.1524" layer="91"/>
                                                    <label x="35.56" y="111.75999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_DIN_PIN2_SHIELD" class="0">
                                  <segment>
                                                    <pinref part="J2" gate="G$1" pin="P2"/>
                                                    <wire x1="40.64" y1="106.67999999999999" x2="35.56" y2="106.67999999999999" width="0.1524" layer="91"/>
                                                    <label x="35.56" y="106.67999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_DIN_PIN3_SPARE" class="0">
                                  <segment>
                                                    <pinref part="J2" gate="G$1" pin="P3"/>
                                                    <wire x1="40.64" y1="101.6" x2="35.56" y2="101.6" width="0.1524" layer="91"/>
                                                    <label x="35.56" y="101.6" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_DIN_PIN4" class="0">
                                  <segment>
                                                    <pinref part="J2" gate="G$1" pin="P4"/>
                                                    <wire x1="40.64" y1="96.52" x2="35.56" y2="96.52" width="0.1524" layer="91"/>
                                                    <label x="35.56" y="96.52" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R4" gate="G$1" pin="1"/>
                                                    <wire x1="78.74" y1="116.84" x2="73.66" y2="116.84" width="0.1524" layer="91"/>
                                                    <label x="73.66" y="116.84" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_DIN_PIN5" class="0">
                                  <segment>
                                                    <pinref part="R5" gate="G$1" pin="2"/>
                                                    <wire x1="88.89999999999999" y1="86.36" x2="93.97999999999999" y2="86.36" width="0.1524" layer="91"/>
                                                    <label x="93.97999999999999" y="86.36" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="J2" gate="G$1" pin="P5"/>
                                                    <wire x1="40.64" y1="91.44" x2="35.56" y2="91.44" width="0.1524" layer="91"/>
                                                    <label x="35.56" y="91.44" size="1.27" layer="95" xref="yes" rot="R180"/>
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
                                                    <wire x1="198.11999999999998" y1="101.6" x2="193.03999999999996" y2="101.6" width="0.1524" layer="91"/>
                                                    <label x="193.03999999999996" y="101.6" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_OPTO_LED_ANODE" class="0">
                                  <segment>
                                                    <pinref part="R4" gate="G$1" pin="2"/>
                                                    <wire x1="88.89999999999999" y1="116.84" x2="93.97999999999999" y2="116.84" width="0.1524" layer="91"/>
                                                    <label x="93.97999999999999" y="116.84" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="U3" gate="G$1" pin="A"/>
                                                    <wire x1="142.23999999999998" y1="105.41" x2="137.15999999999997" y2="105.41" width="0.1524" layer="91"/>
                                                    <label x="137.15999999999997" y="105.41" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D2" gate="G$1" pin="K"/>
                                                    <wire x1="118.11" y1="101.6" x2="123.19" y2="101.6" width="0.1524" layer="91"/>
                                                    <label x="123.19" y="101.6" size="1.27" layer="95" xref="yes"/>
                                                  </segment>
                                </net>
                    <net name="MIDI_OPTO_LED_CATHODE" class="0">
                                  <segment>
                                                    <pinref part="U3" gate="G$1" pin="K"/>
                                                    <wire x1="142.23999999999998" y1="97.78999999999999" x2="137.15999999999997" y2="97.78999999999999" width="0.1524" layer="91"/>
                                                    <label x="137.15999999999997" y="97.78999999999999" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="D2" gate="G$1" pin="A"/>
                                                    <wire x1="101.60000000000001" y1="101.6" x2="96.52000000000001" y2="101.6" width="0.1524" layer="91"/>
                                                    <label x="96.52000000000001" y="101.6" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                  <segment>
                                                    <pinref part="R5" gate="G$1" pin="1"/>
                                                    <wire x1="78.74" y1="86.36" x2="73.66" y2="86.36" width="0.1524" layer="91"/>
                                                    <label x="73.66" y="86.36" size="1.27" layer="95" xref="yes" rot="R180"/>
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
                                                    <wire x1="208.28" y1="119.38" x2="213.36" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="213.36" y="119.38" size="1.27" layer="95" xref="yes"/>
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
                                                    <wire x1="200.66" y1="83.82" x2="195.57999999999998" y2="83.82" width="0.1524" layer="91"/>
                                                    <label x="195.57999999999998" y="83.82" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                    <net name="VCC_3V3_LOGIC" class="0">
                                  <segment>
                                                    <pinref part="R6" gate="G$1" pin="1"/>
                                                    <wire x1="198.11999999999998" y1="119.38" x2="193.03999999999996" y2="119.38" width="0.1524" layer="91"/>
                                                    <label x="193.03999999999996" y="119.38" size="1.27" layer="95" xref="yes" rot="R180"/>
                                                  </segment>
                                </net>
                  </nets>
                </sheet>
      </sheets>
      <errors/>
    </schematic>
  </drawing>
</eagle>
