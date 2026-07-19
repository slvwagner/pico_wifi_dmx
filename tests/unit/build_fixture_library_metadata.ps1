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
Assert-Equal $metadataCatalog.fixtureCount 622 'Metadata sidecar fixture count is incorrect.'
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

Write-Host 'Fixture library metadata conversion test passed.'
