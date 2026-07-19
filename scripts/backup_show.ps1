[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://192.168.0.12/dmx-test/',
    [string]$OutputRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) 'show-backups'),
    [switch]$AllowProtectedEnvironment
)

$ErrorActionPreference = 'Stop'

function ConvertTo-Hashtable {
    param([Parameter(ValueFromPipeline)]$Value)
    process {
        if ($null -eq $Value) { return $null }
        return $Value | ConvertTo-Json -Depth 100 | ConvertFrom-Json -AsHashtable
    }
}

function Get-JsonEndpoint {
    param([string]$RelativePath)
    $uri = [Uri]::new($script:BaseUri, $RelativePath)
    Write-Verbose "GET $uri"
    $response = Invoke-RestMethod -Uri $uri -Method Get -Headers @{ 'Cache-Control' = 'no-cache' }
    return ConvertTo-Hashtable $response
}

function Write-JsonFile {
    param([string]$Path, $Value)
    $json = $Value | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

function Get-TextValue {
    param($Value)
    if ($null -eq $Value) { return '' }
    return ([string]$Value).Trim().ToLowerInvariant()
}

function Get-Slug {
    param([string]$Value, [string]$Fallback = 'show')
    $normalized = if ($null -eq $Value) { '' } else { $Value.Normalize([Text.NormalizationForm]::FormD) }
    $builder = [Text.StringBuilder]::new()
    foreach ($character in $normalized.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($character) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$builder.Append($character)
        }
    }
    $slug = $builder.ToString().ToLowerInvariant() -replace '[^a-z0-9]+', '-'
    $slug = $slug.Trim('-')
    if ($slug) { return $slug }
    return $Fallback
}

function Test-ProfileMatchesFixture {
    param([hashtable]$Profile, [hashtable]$Fixture)
    $manufacturer = if ($Fixture.manufacturerName) { [string]$Fixture.manufacturerName + ' ' } else { '' }
    $fullName = Get-TextValue ($manufacturer + [string]$Fixture.name)
    $fixtureName = Get-TextValue $Fixture.name
    $profileName = Get-TextValue $Profile.name
    if ($profileName -and ($profileName -eq $fullName -or $profileName -eq $fixtureName)) { return $true }
    foreach ($mode in @($Fixture.modes)) {
        if ((Get-TextValue $mode.profile.name) -eq $profileName) { return $true }
    }
    return $false
}

function Test-ModeMatchesProfile {
    param([hashtable]$Mode, [hashtable]$Profile)
    $profileMode = Get-TextValue $Profile.mode
    return (Get-TextValue $Mode.name) -eq $profileMode -or (Get-TextValue $Mode.profile.mode) -eq $profileMode
}

function Copy-JsonValue {
    param($Value)
    return ConvertTo-Hashtable $Value
}

function New-LibraryProfile {
    param([hashtable]$Profile)
    $controls = @()
    foreach ($sourceControl in @($Profile.controls)) {
        $control = Copy-JsonValue $sourceControl
        if ($control.type -in @('panTilt16', 'panTilt8')) {
            $control.panReverse = $false
            $control.tiltReverse = $false
            $control.panTiltSwap = $false
        }
        $controls += $control
    }
    $channels = [Math]::Min(512, [Math]::Max(1, [int]($Profile.channels ?? 1)))
    return [ordered]@{
        name = if ($Profile.name) { $Profile.name } else { 'Fixture' }
        mode = if ($Profile.mode) { $Profile.mode } else { 'mode' }
        channels = $channels
        controls = $controls
    }
}

function Select-ShowFixtureLibrary {
    param([hashtable]$Library, [hashtable]$FixtureSetup, [string]$AppVersion, [string]$GeneratedAt)
    $patchedProfileIds = @{}
    foreach ($fixture in @($FixtureSetup.fixtures)) { $patchedProfileIds[[string]$fixture.profileId] = $true }
    $selected = [ordered]@{}

    foreach ($profile in @($FixtureSetup.profiles)) {
        if (-not $patchedProfileIds.Contains([string]$profile.id)) { continue }
        $sourceFixture = @($Library.fixtures | Where-Object { Test-ProfileMatchesFixture $_ $profile })[0]
        $sourceMode = if ($sourceFixture) { @($sourceFixture.modes | Where-Object { Test-ModeMatchesProfile $_ $profile })[0] } else { $null }
        $key = if ($sourceFixture.key) { [string]$sourceFixture.key } else { 'show/' + (Get-Slug ([string]$profile.name) 'fixture') }

        if (-not $selected.Contains($key)) {
            if ($sourceFixture) {
                $copy = Copy-JsonValue $sourceFixture
                $copy.modes = @()
            } else {
                $copy = [ordered]@{
                    key = $key
                    manufacturerName = 'Show'
                    name = if ($profile.name) { $profile.name } else { 'Fixture' }
                    categories = @('Show')
                    modes = @()
                }
            }
            $selected[$key] = $copy
        }

        $selectedFixture = $selected[$key]
        $alreadyIncluded = @($selectedFixture.modes | Where-Object { Test-ModeMatchesProfile $_ $profile }).Count -gt 0
        if (-not $alreadyIncluded) {
            $mode = if ($sourceMode) {
                Copy-JsonValue $sourceMode
            } else {
                [ordered]@{
                    name = if ($profile.mode) { $profile.mode } else { 'mode' }
                    channels = [int]($profile.channels ?? 1)
                    profile = New-LibraryProfile $profile
                    warnings = @()
                }
            }
            $selectedFixture.modes = @($selectedFixture.modes) + @($mode)
        }
    }

    $fixtures = @($selected.Values)
    return [ordered]@{
        appVersion = $AppVersion
        schemaVersion = [int]($Library.schemaVersion ?? 1)
        type = 'pico_wifi_dmx_show_fixture_library'
        source = 'Fixture definitions used by this Pico WiFi DMX show'
        generatedAt = $GeneratedAt
        fixtureCount = $fixtures.Count
        fixtures = $fixtures
    }
}

$BaseUri = [Uri]$BaseUrl
if ($BaseUri.Scheme -notin @('http', 'https')) { throw 'BaseUrl must use http or https.' }
$path = $BaseUri.AbsolutePath.TrimEnd('/')
if ($path -eq '/dmx' -and -not $AllowProtectedEnvironment) {
    throw 'The protected /dmx/ environment requires -AllowProtectedEnvironment. This script only performs HTTP GET requests and never writes server data.'
}
if (-not $BaseUri.AbsoluteUri.EndsWith('/')) { $BaseUri = [Uri]($BaseUri.AbsoluteUri + '/') }

$responses = [ordered]@{
    fixture = Get-JsonEndpoint 'fixture_setup.php'
    liveValues = Get-JsonEndpoint 'fixture_setup.php?livevalues'
    groups = Get-JsonEndpoint 'group_setup.php'
    scenes = Get-JsonEndpoint 'scene_setup.php'
    palettes = Get-JsonEndpoint 'palette_setup.php'
    chaser = Get-JsonEndpoint 'chaser_setup.php'
    motion = Get-JsonEndpoint 'motion_setup.php'
    gpio = Get-JsonEndpoint 'gpio_setup.php'
    roomPlane = Get-JsonEndpoint 'room_plane_setup.php'
    fixtureLibrary = Get-JsonEndpoint 'fixture_library.php'
    uiState = Get-JsonEndpoint 'ui_state.php'
}

if (-not $responses.fixture.ok -or -not $responses.fixture.exists -or -not $responses.fixture.setup) {
    throw "No saved fixture setup was found at $BaseUri"
}

$fixtureSetup = Copy-JsonValue $responses.fixture.setup
$showName = ([string]($fixtureSetup.showName ?? 'Untitled Show')).Trim()
if (-not $showName) { $showName = 'Untitled Show' }
$showName = $showName.Substring(0, [Math]::Min(80, $showName.Length))
$showSlug = Get-Slug $showName 'untitled-show'

$library = if ($responses.fixtureLibrary.ok -and $responses.fixtureLibrary.exists -and $responses.fixtureLibrary.library) {
    Copy-JsonValue $responses.fixtureLibrary.library
} else {
    $fallback = Get-JsonEndpoint 'assets/fixture-library.json'
    Copy-JsonValue $fallback
}
if (-not $library.fixtures) { throw 'The fixture library is missing its fixtures array.' }
if (-not $library.fixtureCount) { $library.fixtureCount = @($library.fixtures).Count }

$commonScript = Invoke-RestMethod -Uri ([Uri]::new($BaseUri, 'assets/dmx-common.js')) -Method Get
$appVersionMatch = [regex]::Match([string]$commonScript, "const\s+APP_VERSION\s*=\s*['`"]([^'`"]+)['`"]")
$appVersion = if ($appVersionMatch.Success) { $appVersionMatch.Groups[1].Value } else { [string]($fixtureSetup.appVersion ?? 'unknown') }
$now = [DateTime]::UtcNow.ToString('o')
$showLibrary = Select-ShowFixtureLibrary $library $fixtureSetup $appVersion $now

$defaultRoomPlane = [ordered]@{
    baseUrl = [string]($fixtureSetup.baseUrl ?? '')
    points = @(@{ id = 'A'; x = 0; y = 0; z = 0 }, @{ id = 'B'; x = 5; y = 0; z = 0 }, @{ id = 'C'; x = 0; y = 3; z = 0 })
    target = @{ x = 2.5; y = 1.5; z = 0 }
    fixtures = @(); planes = @(); planeCols = 3; planeRows = 3; activePlaneId = $null
    view = @{ auto = $true; centerX = 0; centerY = 0; zoom = 1 }
}

$showBackup = [ordered]@{
    appVersion = $appVersion
    schemaVersion = 2
    type = 'pico_wifi_dmx_full_setup'
    showName = $showName
    project = [ordered]@{ id = 'pico_wifi_dmx'; name = 'Pico WiFi DMX'; version = $appVersion }
    setupFormatVersion = 3
    minimumAppVersion = $appVersion
    exportedAt = $now
    fixture = $fixtureSetup
    liveValues = if ($responses.liveValues.exists -and $responses.liveValues.values) { $responses.liveValues.values } else { @{} }
    groups = $responses.groups
    scenes = $responses.scenes
    palettes = $responses.palettes
    chaser = if ($responses.chaser.exists -and $responses.chaser.chaser) { $responses.chaser.chaser } else { @{} }
    motion = if ($responses.motion.exists -and $responses.motion.motion) { $responses.motion.motion } else { @{} }
    gpio = $responses.gpio
    roomPlane = if ($responses.roomPlane.exists -and $responses.roomPlane.setup) { $responses.roomPlane.setup } else { $defaultRoomPlane }
    fixtureLibrary = $showLibrary
    uiState = if ($responses.uiState.exists -and $responses.uiState.state) { $responses.uiState.state } else { @{} }
}

$stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$backupDirectory = Join-Path ([IO.Path]::GetFullPath($OutputRoot)) "$stamp-$showSlug"
$responseDirectory = Join-Path $backupDirectory 'endpoint-responses'
[void](New-Item -ItemType Directory -Path $responseDirectory -Force)

$showFileName = "pico_dmx_${showSlug}_show.json"
$libraryFileName = 'pico_dmx_fixture_library.json'
Write-JsonFile (Join-Path $backupDirectory $showFileName) $showBackup
Write-JsonFile (Join-Path $backupDirectory $libraryFileName) $library
foreach ($entry in $responses.GetEnumerator()) {
    Write-JsonFile (Join-Path $responseDirectory ($entry.Key + '.json')) $entry.Value
}

$readme = @"
# Show Backup - $showName

Created at `$now` from `$($BaseUri.AbsoluteUri)` using read-only HTTP GET requests.

- Import `$showFileName` with **Controller > Show > Import Show**.
- Import `$libraryFileName` with **Controller > Show > Import Library**.
- `endpoint-responses/` contains the API responses used to build the portable files. These are diagnostic snapshots, not files to copy directly into XAMPP.
- `backup-manifest.json` contains SHA-256 hashes for integrity checks.
"@
[IO.File]::WriteAllText((Join-Path $backupDirectory 'README.md'), $readme.Trim() + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

$manifestFiles = Get-ChildItem -LiteralPath $backupDirectory -File -Recurse | Sort-Object FullName | ForEach-Object {
    [ordered]@{
        name = [IO.Path]::GetRelativePath($backupDirectory, $_.FullName).Replace('\', '/')
        sizeBytes = $_.Length
        sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}
$manifest = [ordered]@{
    createdAt = $now
    sourceBaseUrl = $BaseUri.AbsoluteUri
    readOnlySource = $true
    appVersion = $appVersion
    showName = $showName
    showFile = $showFileName
    fixtureLibraryFile = $libraryFileName
    usedFixtureDefinitions = $showLibrary.fixtureCount
    completeFixtureDefinitions = @($library.fixtures).Count
    files = @($manifestFiles)
}
Write-JsonFile (Join-Path $backupDirectory 'backup-manifest.json') $manifest

Write-Host "Show backup created: $backupDirectory"
Write-Host "  Show: $showFileName"
Write-Host "  Library: $libraryFileName"
Write-Host "  Used fixture definitions: $($showLibrary.fixtureCount)"
Write-Host "  Complete library fixtures: $(@($library.fixtures).Count)"
