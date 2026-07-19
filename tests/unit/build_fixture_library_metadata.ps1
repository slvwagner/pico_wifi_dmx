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

& (Join-Path $repoRoot 'scripts/build_fixture_library.ps1') -OutputPath $outputPath -MetadataOutputPath $metadataOutputPath
$library = Get-Content -LiteralPath $outputPath -Raw | ConvertFrom-Json
$metadataCatalog = Get-Content -LiteralPath $metadataOutputPath -Raw | ConvertFrom-Json
$fixture = $library.fixtures | Where-Object key -eq 'fun-generation/picospot-20-led' | Select-Object -First 1
$metadataFixture = $metadataCatalog.fixtures | Where-Object key -eq 'fun-generation/picospot-20-led' | Select-Object -First 1

if (-not $fixture) { throw 'Converted PicoSpot 20 LED fixture was not found.' }
Assert-Equal $metadataCatalog.fixtureCount 622 'Metadata sidecar fixture count is incorrect.'
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

Write-Host 'Fixture library metadata conversion test passed.'
