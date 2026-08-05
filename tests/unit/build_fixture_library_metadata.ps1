$ErrorActionPreference = 'Stop'

function Assert-Equal {
    param($Actual, $Expected, [string]$Message)
    if ($Actual -ne $Expected) {
        throw "$Message Expected '$Expected', got '$Actual'."
    }
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$outputPath = Join-Path ([IO.Path]::GetTempPath()) 'pico-dmx-fixture-library-metadata-test.json'
$metadataOutputPath = Join-Path ([IO.Path]::GetTempPath()) ('pico-dmx-fixture-metadata-test-' + [Guid]::NewGuid().ToString('N') + '.json')
$capabilitiesOutputPath = Join-Path ([IO.Path]::GetTempPath()) ('pico-dmx-fixture-capabilities-test-' + [Guid]::NewGuid().ToString('N') + '.json')
$resourcesOutputPath = Join-Path ([IO.Path]::GetTempPath()) ('pico-dmx-fixture-resources-test-' + [Guid]::NewGuid().ToString('N') + '.json')

& (Join-Path $repoRoot 'scripts/build_fixture_library.ps1') -OutputPath $outputPath -MetadataOutputPath $metadataOutputPath -CapabilitiesOutputPath $capabilitiesOutputPath -ResourcesOutputPath $resourcesOutputPath
$library = Get-Content -LiteralPath $outputPath -Raw | ConvertFrom-Json
$metadataCatalog = Get-Content -LiteralPath $metadataOutputPath -Raw | ConvertFrom-Json
$capabilitiesCatalog = Get-Content -LiteralPath $capabilitiesOutputPath -Raw | ConvertFrom-Json
$resourcesCatalog = Get-Content -LiteralPath $resourcesOutputPath -Raw | ConvertFrom-Json
$fixture = $library.fixtures | Where-Object key -eq 'fun-generation/picospot-20-led' | Select-Object -First 1
$metadataFixture = $metadataCatalog.fixtures | Where-Object key -eq 'fun-generation/picospot-20-led' | Select-Object -First 1

if (-not $fixture) { throw 'Converted PicoSpot 20 LED fixture was not found.' }
Assert-Equal $metadataCatalog.fixtureCount 623 'Metadata sidecar fixture count is incorrect.'
if ($capabilitiesCatalog.fixtureCount -lt 600) { throw "Capability sidecar fixture count is unexpectedly low: $($capabilitiesCatalog.fixtureCount)." }
Assert-Equal $metadataFixture.metadata.source 'ofl' 'Metadata sidecar is missing the PicoSpot metadata.'
Assert-Equal $fixture.metadata.source 'ofl' 'Metadata source is incorrect.'
Assert-Equal $fixture.metadata.sourceUrl 'https://open-fixture-library.org/fun-generation/picospot-20-led' 'OFL source URL is incorrect.'
Assert-Equal ($fixture.metadata.authors -join ', ') 'LordVonAdel, Moritz Weirauch' 'Authors are incorrect.'
Assert-Equal $fixture.metadata.createDate '2019-08-21' 'Creation date is incorrect.'
Assert-Equal $fixture.metadata.lastModifyDate '2024-05-07' 'Modification date is incorrect.'
Assert-Equal $fixture.metadata.links.manual[0] 'https://images.static-thomann.de/pics/atg/atgdata/document/manual/372642_c_372642_r3_en_online.pdf' 'Manual link is incorrect.'
Assert-Equal $fixture.metadata.physical.dimensionsMm.width 162 'Fixture width is incorrect.'
Assert-Equal $fixture.metadata.physical.dimensionsMm.height 242 'Fixture height is incorrect.'
Assert-Equal $fixture.metadata.physical.dimensionsMm.depth 174 'Fixture depth is incorrect.'
Assert-Equal $fixture.metadata.physical.weightKg 3 'Fixture weight is incorrect.'
Assert-Equal $fixture.metadata.physical.powerW 35 'Fixture power is incorrect.'
Assert-Equal $fixture.metadata.physical.dmxConnector '3-pin' 'DMX connector is incorrect.'
Assert-Equal $fixture.metadata.physical.lightSource '12W white CREE LED' 'Light source is incorrect.'
Assert-Equal $fixture.metadata.physical.beamAngleDegrees.min 13 'Minimum beam angle is incorrect.'
Assert-Equal $fixture.metadata.physical.beamAngleDegrees.max 13 'Maximum beam angle is incorrect.'

$hyK25 = $library.fixtures | Where-Object key -eq 'clay-paky/hy-b-eye-k25' | Select-Object -First 1
if (-not $hyK25) { throw 'Curated Claypaky Hy B-Eye K25 fixture was not included in the library build.' }
Assert-Equal @($hyK25.modes).Count 6 'Hy B-Eye K25 mode count is incorrect.'
Assert-Equal (($hyK25.modes | ForEach-Object { "$($_.name):$($_.channels)" }) -join ', ') 'Standard:21, Standard + Frequency:22, Shape:35, Shape + Frequency:36, Pixel Engine RGB:111, Pixel Engine RGBW:148' 'Hy B-Eye K25 modes are incorrect.'
Assert-Equal $hyK25.metadata.authors[0] 'Claypaky' 'Hy B-Eye K25 manufacturer metadata is incorrect.'
Assert-Equal $hyK25.metadata.physical.dimensionsMm.width 329 'Hy B-Eye K25 width metadata is incorrect.'
Assert-Equal $hyK25.metadata.physical.dimensionsMm.height 590 'Hy B-Eye K25 height metadata is incorrect.'
Assert-Equal $hyK25.metadata.physical.dimensionsMm.depth 387 'Hy B-Eye K25 depth metadata is incorrect.'
Assert-Equal $hyK25.metadata.physical.weightKg 27.5 'Hy B-Eye K25 weight metadata is incorrect.'
Assert-Equal $hyK25.metadata.physical.powerVa 1250 'Hy B-Eye K25 power-consumption metadata is incorrect.'
Assert-Equal $hyK25.metadata.physical.beamAngleDegrees.min 4 'Hy B-Eye K25 minimum beam angle is incorrect.'
Assert-Equal $hyK25.metadata.physical.beamAngleDegrees.max 60 'Hy B-Eye K25 maximum beam angle is incorrect.'

function Get-ProfileChannels($profile) {
    $channels = [System.Collections.Generic.List[int]]::new()
    foreach ($control in @($profile.controls)) {
        foreach ($property in @('channel', 'fine', 'pan', 'panFine', 'tilt', 'tiltFine')) {
            $value = $control.PSObject.Properties[$property].Value
            if ($null -ne $value) { $channels.Add([int]$value) }
        }
        if ($null -ne $control.emitters -and @($control.emitters).Count) {
            foreach ($emitter in @($control.emitters)) { $channels.Add([int]$emitter.channel) }
        } else {
            foreach ($property in @('a', 'b', 'c', 'w', 'amber', 'k')) {
                $value = $control.PSObject.Properties[$property].Value
                if ($null -ne $value) { $channels.Add([int]$value) }
            }
        }
    }
    return @($channels)
}

foreach ($mode in @($hyK25.modes)) {
    $mappedChannels = @(Get-ProfileChannels $mode.profile)
    Assert-Equal $mappedChannels.Count $mode.channels "Hy B-Eye K25 '$($mode.name)' does not map every DMX channel."
    Assert-Equal @($mappedChannels | Sort-Object -Unique).Count $mode.channels "Hy B-Eye K25 '$($mode.name)' maps a DMX channel more than once."
    Assert-Equal ($mappedChannels | Measure-Object -Maximum).Maximum $mode.channels "Hy B-Eye K25 '$($mode.name)' highest mapped channel is incorrect."
}

$hyStandard = $hyK25.modes | Where-Object name -eq 'Standard' | Select-Object -First 1
$hyShapeFrequency = $hyK25.modes | Where-Object name -eq 'Shape + Frequency' | Select-Object -First 1
$hyPixelRgbw = $hyK25.modes | Where-Object name -eq 'Pixel Engine RGBW' | Select-Object -First 1
Assert-Equal ($hyStandard.profile.controls | Where-Object label -eq 'Dimmer').type 'slider16' 'Hy B-Eye K25 Dimmer is not a 16-bit control.'
Assert-Equal ($hyStandard.profile.controls | Where-Object label -eq 'Pan / Tilt').tiltFine 17 'Hy B-Eye K25 Pan/Tilt mapping is incorrect.'
$hyFunction = $hyStandard.profile.controls | Where-Object label -eq 'Function' | Select-Object -First 1
Assert-Equal ($hyFunction.options | Where-Object name -eq 'Pixel Map Enabled' | Select-Object -First 1).value 104 'Hy B-Eye K25 Pixel Map Enabled range is incorrect.'
Assert-Equal ($hyFunction.options | Where-Object name -eq 'Base Frequency 43700 Hz' | Select-Object -First 1).value 173 'Hy B-Eye K25 base-frequency options are missing.'
Assert-Equal ($hyShapeFrequency.profile.controls | Where-Object label -eq 'Frequency Fine Adjustment').channel 36 'Hy B-Eye K25 Shape + Frequency mapping is incorrect.'
Assert-Equal @($hyPixelRgbw.profile.controls).Count 37 'Hy B-Eye K25 RGBW pixel control count is incorrect.'
Assert-Equal ($hyPixelRgbw.profile.controls | Where-Object label -eq 'LED 37').w 148 'Hy B-Eye K25 final RGBW pixel mapping is incorrect.'

$inno = $library.fixtures | Where-Object key -eq 'american-dj/inno-pocket-spot' | Select-Object -First 1
$innoMode = $inno.modes | Where-Object name -eq '11-channel' | Select-Object -First 1
$innoShutter = $innoMode.profile.controls | Where-Object label -eq 'Shutter/Strobe' | Select-Object -First 1
Assert-Equal $innoShutter.type 'wheel' 'Segmented shutter capabilities were not converted to an option control.'
Assert-Equal @($innoShutter.options).Count 10 'Shutter capability option count is incorrect.'
Assert-Equal $innoShutter.options[0].kind 'ShutterStrobe' 'Shutter option capability type is missing.'
Assert-Equal ($innoShutter.options[0].range -join '-') '0-7' 'Shutter option DMX range is incorrect.'
Assert-Equal $innoShutter.options[2].shutterEffect 'Strobe' 'Shutter effect metadata is missing.'
Assert-Equal $innoShutter.options[2].speedStart '0.3Hz' 'Shutter speed start is missing.'
Assert-Equal @($innoShutter.capabilities).Count 10 'Normalized shutter capabilities are missing.'

$picoMode = $fixture.modes | Where-Object name -eq '11-channel' | Select-Object -First 1
$program = $picoMode.profile.controls | Where-Object label -eq 'Program' | Select-Object -First 1
$programSpeed = $picoMode.profile.controls | Where-Object label -eq 'Program Speed' | Select-Object -First 1
Assert-Equal $program.type 'wheel' 'Segmented program capabilities were not converted to an option control.'
Assert-Equal @($program.options).Count 22 'Program capability option count is incorrect.'
Assert-Equal $programSpeed.type 'slider8' 'Continuous program speed should remain a slider.'
Assert-Equal $programSpeed.capabilities[0].type 'EffectSpeed' 'Continuous capability type is missing from the slider.'
Assert-Equal $programSpeed.capabilities[0].speedStart 'slow' 'Continuous capability speed start is missing.'
Assert-Equal $programSpeed.capabilities[0].speedEnd 'fast' 'Continuous capability speed end is missing.'

$hexFixture = $library.fixtures | Where-Object key -eq 'american-dj/18p-hex-ip' | Select-Object -First 1
$hexMode = $hexFixture.modes | Where-Object name -eq '13-channel' | Select-Object -First 1
$hexColor = $hexMode.profile.controls | Where-Object type -eq 'rgbwa' | Select-Object -First 1
Assert-Equal (@($hexColor.emitters | ForEach-Object key) -join ',') 'a,b,c,w,amber,uv' 'RGBWA+UV emitters were not combined into one advanced color control.'
Assert-Equal ($hexColor.emitters | Where-Object key -eq 'uv' | Select-Object -First 1).channel 6 'The UV emitter channel is incorrect.'
Assert-Equal @($hexMode.profile.controls | Where-Object label -eq 'UV').Count 0 'The UV emitter was also emitted as a separate slider.'

$fogFixture = $library.fixtures | Where-Object key -eq 'american-dj/fog-fury-jett-pro' | Select-Object -First 1
$fogSplitColor = @($fogFixture.modes.profile.controls.options | Where-Object { @($_.colors).Count -gt 1 }) | Select-Object -First 1
if (-not $fogSplitColor) { throw 'A split-color OFL option was not retained.' }
Assert-Equal $fogSplitColor.color $fogSplitColor.colors[0] 'The legacy wheel color does not match the first split color.'
Assert-Equal @($fogSplitColor.colors).Count 2 'The split-color wheel option did not retain both colors.'

$picoColorWheel = $picoMode.profile.controls | Where-Object label -eq 'Color Wheel' | Select-Object -First 1
$picoSplitColors = @($picoColorWheel.options | Where-Object { $_.slotNumberStart -and $_.slotNumberEnd })
Assert-Equal $picoSplitColors.Count 8 'PicoSpot wheel transitions were not converted to split-color options.'
Assert-Equal ($picoSplitColors[0].colors -join ',') '#ffffff,#ff0000' 'The PicoSpot white/red split colors are incorrect.'
Assert-Equal ($picoSplitColors[-1].colors -join ',') '#ff00ff,#ffffff' 'The PicoSpot purple/white wraparound split colors are incorrect.'

$skyPanel = $library.fixtures | Where-Object key -eq 'arri/skypanel-s30c' | Select-Object -First 1
$lee187 = @($skyPanel.modes.profile.controls.options | Where-Object { $_.filter.system -eq 'LEE' -and $_.filter.code -eq '187' }) | Select-Object -First 1
if (-not $lee187) { throw 'The stored LEE 187 filter reference was not converted.' }
Assert-Equal $lee187.color '#f5e4d7' 'The OFL LEE 187 preview color was not retained.'
Assert-Equal $lee187.colors[0] '#f5e4d7' 'The LEE filter color list is incorrect.'
Assert-Equal $lee187.filter.reference 'Lee 187' 'The original LEE filter reference was not retained.'

$preserveSourcePath = Join-Path ([IO.Path]::GetTempPath()) ('pico-dmx-fixture-preserve-source-' + [Guid]::NewGuid().ToString('N') + '.json')
$preserveOutputPath = Join-Path ([IO.Path]::GetTempPath()) ('pico-dmx-fixture-preserve-output-' + [Guid]::NewGuid().ToString('N') + '.json')
$userGoboImage = 'data:image/png;base64,dXNlci1kcmF3bi1nb2Jv'
$preserveSource = [ordered]@{
    schemaVersion = 1
    fixtureCount = 1
    fixtures = @([ordered]@{
        key = 'fun-generation/picospot-20-led'
        name = 'PicoSpot 20 LED'
        modes = @([ordered]@{
            name = '11-channel'
            profile = [ordered]@{
                controls = @([ordered]@{
                    id = 999999
                    type = 'wheel'
                    label = 'Gobo Wheel'
                    channel = 7
                    options = @(
                        [ordered]@{ name = 'User renamed gobo'; value = 24; range = @(16, 31); image = $userGoboImage },
                        [ordered]@{ name = 'Invalid external image'; value = 39; range = @(32, 46); image = 'https://example.invalid/gobo.png' }
                    )
                })
            }
        })
    })
}
[IO.File]::WriteAllText($preserveSourcePath, ($preserveSource | ConvertTo-Json -Depth 20) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
& (Join-Path $repoRoot 'scripts/build_fixture_library.ps1') -OutputPath $preserveOutputPath -PreserveWheelImagesFromPath $preserveSourcePath
$preservedLibrary = Get-Content -LiteralPath $preserveOutputPath -Raw | ConvertFrom-Json
$preservedFixture = $preservedLibrary.fixtures | Where-Object key -eq 'fun-generation/picospot-20-led' | Select-Object -First 1
$preservedElevenChannelGobo = ($preservedFixture.modes | Where-Object name -eq '11-channel').profile.controls | Where-Object label -eq 'Gobo Wheel' | Select-Object -First 1
$preservedNineChannelGobo = ($preservedFixture.modes | Where-Object name -eq '9-channel').profile.controls | Where-Object label -eq 'Gobo Wheel' | Select-Object -First 1
$preservedGoboTwo = $preservedElevenChannelGobo.options | Where-Object { ($_.range -join '-') -eq '16-31' } | Select-Object -First 1
$invalidGoboThree = $preservedElevenChannelGobo.options | Where-Object { ($_.range -join '-') -eq '32-46' } | Select-Object -First 1
Assert-Equal $preservedGoboTwo.name 'Gobo 2' 'Wheel-image preservation replaced current OFL option information.'
Assert-Equal $preservedGoboTwo.image $userGoboImage 'The user-added PicoSpot gobo image was not preserved.'
if ($preservedGoboTwo.resourceKey) { throw 'The preserved user gobo image retained an OFL resource key that would remove it during export.' }
if ($invalidGoboThree.image) { throw 'An unsafe external wheel image was preserved.' }
Assert-Equal @($preservedElevenChannelGobo.options | Where-Object { $_.image }).Count 1 'The preserved user gobo image leaked into shake or rotation options.'
if (($preservedNineChannelGobo.options | Where-Object { $_.image }).Count) { throw 'A user gobo image leaked into another fixture mode.' }

$encore = $library.fixtures | Where-Object key -eq 'american-dj/encore-lp12z-ip' | Select-Object -First 1
$encoreMode = $encore.modes | Where-Object name -eq '9-channel' | Select-Object -First 1
$encoreDimmer = $encoreMode.profile.controls | Where-Object label -eq 'Dimmer' | Select-Object -First 1
Assert-Equal $encoreDimmer.type 'slider16' 'A scalar channel with a fine alias was not converted to a 16-bit slider.'
Assert-Equal $encoreDimmer.channel 6 'The 16-bit dimmer coarse channel is incorrect.'
Assert-Equal $encoreDimmer.fine 7 'The 16-bit dimmer fine channel is incorrect.'
Assert-Equal @($encoreMode.profile.controls | Where-Object label -eq 'Dimmer fine').Count 0 'The fine channel was also emitted as a separate control.'

$warp = $library.fixtures | Where-Object key -eq 'adb/warp-m' | Select-Object -First 1
$warpMode = $warp.modes | Where-Object name -eq '12-30' | Select-Object -First 1
$warpPanTilt = $warpMode.profile.controls | Where-Object type -eq 'panTilt16' | Select-Object -First 1
$warpShutterRotation = $warpMode.profile.controls | Where-Object label -eq 'Shutter A Rotation' | Select-Object -First 1
Assert-Equal $warpPanTilt.defaultValue.pan 32767 'The OFL 16-bit Pan default was not imported.'
Assert-Equal $warpPanTilt.defaultValue.tilt 32767 'The OFL 16-bit Tilt default was not imported.'
Assert-Equal $warpShutterRotation.defaultValue 32767 'The OFL scalar 16-bit default was not imported.'
$picoShutter = $picoMode.profile.controls | Where-Object label -eq 'Shutter / Strobe' | Select-Object -First 1
Assert-Equal $picoShutter.defaultValue 0 'The OFL option-control default was not imported.'

$autoSpot = $library.fixtures | Where-Object key -eq 'american-dj/auto-spot-150' | Select-Object -First 1
$autoSpotPanTilt = $autoSpot.modes[0].profile.controls | Where-Object { $_.type -like 'panTilt*' } | Select-Object -First 1
Assert-Equal $autoSpotPanTilt.defaultValue.pan 128 'The OFL percentage default was not converted to an 8-bit Pan value.'

$illusion = $library.fixtures | Where-Object key -eq 'american-dj/illusion-dotz-4-4' | Select-Object -First 1
$illusionMode = $illusion.modes | Where-Object name -eq 'Extended 59-channel' | Select-Object -First 1
$illusionMatrix = $illusionMode.profile.controls | Where-Object type -eq 'matrixRgb' | Select-Object -First 1
Assert-Equal $illusionMode.channels 59 'The OFL matrix insertion did not expand to the full mode channel count.'
Assert-Equal $illusionMatrix.channel 5 'The compatible OFL RGB matrix start channel is incorrect.'
Assert-Equal $illusionMatrix.width 4 'The compatible OFL RGB matrix width is incorrect.'
Assert-Equal $illusionMatrix.height 4 'The compatible OFL RGB matrix height is incorrect.'
Assert-Equal @($illusionMode.profile.controls | Where-Object { $_.label -match '^(Red|Green|Blue) \(' }).Count 0 'Matrix pixel channels were also emitted as separate controls.'

$arri = $library.fixtures | Where-Object key -eq 'arri/l5-c' | Select-Object -First 1
$arriMode = $arri.modes | Where-Object name -eq 'P06: CCT & RGBW 16bit' | Select-Object -First 1
$arriDimmer = $arriMode.profile.controls | Where-Object label -eq 'Dimmer' | Select-Object -First 1
Assert-Equal $arriDimmer.type 'slider16' 'The OFL highlight fixture did not retain its 16-bit dimmer.'
Assert-Equal $arriDimmer.highlightValue 65535 'The OFL 8-bit highlight value was not scaled to the imported 16-bit control.'

$intimidator = $library.fixtures | Where-Object key -eq 'chauvet-dj/intimidator-spot-160' | Select-Object -First 1
$intimidatorMode = $intimidator.modes | Where-Object name -eq '11-channel' | Select-Object -First 1
$intimidatorGobo = $intimidatorMode.profile.controls | Where-Object label -eq 'Gobo Wheel' | Select-Object -First 1
$intimidatorGoboOne = $intimidatorGobo.options | Where-Object slotNumber -eq 2 | Select-Object -First 1
Assert-Equal $intimidatorGoboOne.resourceKey 'gobos/10-circles' 'The OFL gobo resource key was not retained by the wheel option.'
if ($intimidatorGoboOne.image) { throw 'The deduplicated OFL gobo image was unexpectedly embedded in the fixture catalog.' }
$resourceFixturePatch = $resourcesCatalog.fixtures | Where-Object key -eq 'chauvet-dj/intimidator-spot-160' | Select-Object -First 1
$resourceControlPatch = $resourceFixturePatch.controls | Where-Object label -eq 'Gobo Wheel' | Select-Object -First 1
Assert-Equal ($resourceControlPatch.options | Where-Object slotNumber -eq 2 | Select-Object -First 1).resourceKey 'gobos/10-circles' 'The resource sidecar cannot enrich an older fixture catalog.'
$goboImage = [string]$resourcesCatalog.resources.'gobos/10-circles'.image
if ($goboImage -notmatch '^data:image/svg\+xml[^,]*;base64,') { throw 'The embedded OFL SVG gobo was not converted to an inline resource image.' }
$goboSvg = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($goboImage -split ',', 2)[1]))
if ($goboSvg -notmatch '<svg') { throw 'The converted OFL gobo image does not contain SVG data.' }

$capabilitySidecarFixture = $capabilitiesCatalog.fixtures | Where-Object key -eq 'american-dj/inno-pocket-spot' | Select-Object -First 1
$capabilitySidecarShutter = $capabilitySidecarFixture.controls | Where-Object label -eq 'Shutter/Strobe' | Select-Object -First 1
Assert-Equal $capabilitySidecarShutter.type 'wheel' 'Capability sidecar does not include the segmented shutter upgrade.'
Assert-Equal @($capabilitySidecarShutter.capabilities).Count 10 'Capability sidecar lost shutter ranges.'

$mergeOutputPath = Join-Path ([IO.Path]::GetTempPath()) 'pico-dmx-fixture-library-metadata-merge-test.json'
$existingLibrary = [ordered]@{
    schemaVersion = 1
    source = 'Curated test library'
    generatedAt = '2026-01-01T00:00:00Z'
    fixtureCount = 2
    fixtures = @(
        [ordered]@{
            key = 'fun-generation/picospot-20-led'
            manufacturerName = 'Fun Generation'
            name = 'PicoSpot 20 LED'
            categories = @('Moving Head')
            modes = @([ordered]@{
                name = 'Curated mode'
                channels = 1
                profile = [ordered]@{
                    name = 'PicoSpot 20 LED'
                    mode = 'Curated mode'
                    channels = 1
                    controls = @([ordered]@{ id = 9001; type = 'slider8'; label = 'Curated Dimmer'; channel = 1; defaultValue = 123 })
                }
                warnings = @('Keep this warning')
            })
        },
        [ordered]@{
            key = 'custom/keep-me'
            manufacturerName = 'Custom'
            name = 'Keep Me'
            categories = @('Custom')
            modes = @()
        }
    )
}
[IO.File]::WriteAllText($mergeOutputPath, ($existingLibrary | ConvertTo-Json -Depth 20) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
& (Join-Path $repoRoot 'scripts/build_fixture_library.ps1') -OutputPath $mergeOutputPath -MetadataOnly
$mergedLibrary = Get-Content -LiteralPath $mergeOutputPath -Raw | ConvertFrom-Json
$mergedFixture = $mergedLibrary.fixtures | Where-Object key -eq 'fun-generation/picospot-20-led' | Select-Object -First 1
$customFixture = $mergedLibrary.fixtures | Where-Object key -eq 'custom/keep-me' | Select-Object -First 1
Assert-Equal $mergedLibrary.fixtureCount 2 'Metadata-only merge changed the fixture count.'
Assert-Equal $mergedLibrary.source 'Curated test library' 'Metadata-only merge changed the catalog source.'
Assert-Equal $mergedFixture.modes[0].name 'Curated mode' 'Metadata-only merge replaced a curated mode.'
Assert-Equal $mergedFixture.modes[0].profile.controls[0].id 9001 'Metadata-only merge changed a curated control ID.'
Assert-Equal $mergedFixture.modes[0].profile.controls[0].defaultValue 123 'Metadata-only merge removed a curated default value.'
Assert-Equal $mergedFixture.modes[0].warnings[0] 'Keep this warning' 'Metadata-only merge removed a curated warning.'
Assert-Equal $mergedFixture.metadata.source 'ofl' 'Metadata-only merge did not add OFL metadata.'
Assert-Equal $customFixture.name 'Keep Me' 'Metadata-only merge removed the custom fixture.'

$capabilityMergeOutputPath = Join-Path ([IO.Path]::GetTempPath()) 'pico-dmx-fixture-library-capability-merge-test.json'
$capabilityMergeLibrary = [ordered]@{
    schemaVersion = 1
    source = 'Curated capability test library'
    generatedAt = '2026-01-01T00:00:00Z'
    fixtureCount = 2
    fixtures = @(
        [ordered]@{
            key = 'american-dj/inno-pocket-spot'
            manufacturerName = 'American DJ'
            name = 'Inno Pocket Spot'
            categories = @('Moving Head')
            modes = @([ordered]@{
                name = '11-channel'
                channels = 11
                profile = [ordered]@{
                    name = 'Inno Pocket Spot'
                    mode = '11-channel'
                    channels = 11
                    controls = @([ordered]@{ id = 9101; type = 'slider8'; label = 'Shutter/Strobe'; channel = 7; default = 255; blackout = 0 })
                }
                warnings = @('Keep capability warning')
            })
        },
        [ordered]@{ key = 'custom/capability-keep'; manufacturerName = 'Custom'; name = 'Capability Keep'; categories = @('Custom'); modes = @() }
    )
}
[IO.File]::WriteAllText($capabilityMergeOutputPath, ($capabilityMergeLibrary | ConvertTo-Json -Depth 20) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
& (Join-Path $repoRoot 'scripts/build_fixture_library.ps1') -OutputPath $capabilityMergeOutputPath -CapabilitiesOnly
$capabilityMergedLibrary = Get-Content -LiteralPath $capabilityMergeOutputPath -Raw | ConvertFrom-Json
$capabilityMergedMode = ($capabilityMergedLibrary.fixtures | Where-Object key -eq 'american-dj/inno-pocket-spot').modes[0]
$capabilityMergedControl = $capabilityMergedMode.profile.controls[0]
Assert-Equal $capabilityMergedLibrary.fixtureCount 2 'Capabilities-only merge changed the fixture count.'
Assert-Equal $capabilityMergedLibrary.source 'Curated capability test library' 'Capabilities-only merge changed the catalog source.'
Assert-Equal $capabilityMergedControl.id 9101 'Capabilities-only merge changed a curated control ID.'
Assert-Equal $capabilityMergedControl.default 255 'Capabilities-only merge removed a curated default.'
Assert-Equal $capabilityMergedControl.blackout 0 'Capabilities-only merge removed a curated blackout value.'
Assert-Equal $capabilityMergedControl.type 'wheel' 'Capabilities-only merge did not upgrade the segmented control.'
Assert-Equal @($capabilityMergedControl.capabilities).Count 10 'Capabilities-only merge lost normalized ranges.'
Assert-Equal @($capabilityMergedControl.options).Count 10 'Capabilities-only merge lost generated options.'
Assert-Equal $capabilityMergedMode.warnings[0] 'Keep capability warning' 'Capabilities-only merge removed a warning.'
Assert-Equal ($capabilityMergedLibrary.fixtures | Where-Object key -eq 'custom/capability-keep').name 'Capability Keep' 'Capabilities-only merge removed a custom fixture.'

$customOnlyOutputPath = Join-Path ([IO.Path]::GetTempPath()) 'pico-dmx-fixture-library-custom-only-test.json'
$customOnlyLibrary = [ordered]@{
    schemaVersion = 1
    source = 'Curated custom-only test library'
    generatedAt = '2026-01-01T00:00:00Z'
    fixtureCount = 1
    fixtures = @([ordered]@{ key = 'custom/keep-first'; manufacturerName = 'Custom'; name = 'Keep First'; categories = @('Other'); modes = @() })
}
[IO.File]::WriteAllText($customOnlyOutputPath, ($customOnlyLibrary | ConvertTo-Json -Depth 20) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
& (Join-Path $repoRoot 'scripts/build_fixture_library.ps1') -OutputPath $customOnlyOutputPath -CustomOnly
$customOnlyMergedLibrary = Get-Content -LiteralPath $customOnlyOutputPath -Raw | ConvertFrom-Json
Assert-Equal $customOnlyMergedLibrary.fixtureCount 2 'Custom-only merge fixture count is incorrect.'
Assert-Equal $customOnlyMergedLibrary.fixtures[0].key 'custom/keep-first' 'Custom-only merge reordered an existing curated fixture.'
Assert-Equal ($customOnlyMergedLibrary.fixtures | Where-Object key -eq 'clay-paky/hy-b-eye-k25').name 'Hy B-Eye K25' 'Custom-only merge did not add the Hy B-Eye K25 fixture.'

Write-Host 'Fixture library metadata conversion test passed.'
