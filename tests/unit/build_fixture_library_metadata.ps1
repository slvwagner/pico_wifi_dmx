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

& (Join-Path $repoRoot 'scripts/build_fixture_library.ps1') -OutputPath $outputPath -MetadataOutputPath $metadataOutputPath -CapabilitiesOutputPath $capabilitiesOutputPath
$library = Get-Content -LiteralPath $outputPath -Raw | ConvertFrom-Json
$metadataCatalog = Get-Content -LiteralPath $metadataOutputPath -Raw | ConvertFrom-Json
$capabilitiesCatalog = Get-Content -LiteralPath $capabilitiesOutputPath -Raw | ConvertFrom-Json
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
