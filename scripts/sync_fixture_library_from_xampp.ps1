param(
    [string]$XamppHtdocs = "",
    [string]$AppFolder = "",
    [string]$SourcePath = "",
    [string]$OutputPath = "web/assets/fixture-library.json",
    [switch]$AcceptAllChanges,
    [switch]$KeepExistingChanges,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "local_path_config.ps1")
$localPaths = Get-LocalPathConfig -RepoRoot $repoRoot
if (-not $XamppHtdocs) { $XamppHtdocs = $localPaths.xamppHtdocs }
if (-not $AppFolder) { $AppFolder = $localPaths.appFolder }

if (-not $SourcePath) {
    $SourcePath = Join-Path (Join-Path (Join-Path $XamppHtdocs $AppFolder) "data") "fixture_library.json"
}
if (-not [System.IO.Path]::IsPathRooted($SourcePath)) {
    $SourcePath = Join-Path $repoRoot $SourcePath
}
if (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath = Join-Path $repoRoot $OutputPath
}

if (-not (Test-Path -LiteralPath $SourcePath)) {
    throw "XAMPP fixture library not found: $SourcePath"
}

if ($AcceptAllChanges -and $KeepExistingChanges) {
    throw "Use only one of -AcceptAllChanges or -KeepExistingChanges."
}

function Read-FixtureLibrary {
    param(
        [string]$Path,
        [string]$Label
    )

    $raw = Get-Content -LiteralPath $Path -Raw
    try {
        return $raw | ConvertFrom-Json -Depth 100
    } catch {
        throw "$Label fixture library is not valid JSON: $Path. $($_.Exception.Message)"
    }
}

function Test-FixtureLibrary {
    param(
        [object]$Library,
        [string]$Label
    )

    if ($null -eq $Library.schemaVersion) {
        throw "$Label fixture library is missing schemaVersion."
    }
    if (-not ($Library.fixtures -is [System.Collections.IEnumerable]) -or $Library.fixtures -is [string]) {
        throw "$Label fixture library must contain a fixtures array."
    }

    $fixtures = @($Library.fixtures)
    if ($fixtures.Count -lt 1) {
        throw "$Label fixture library fixtures array is empty."
    }
    if ($null -eq $Library.fixtureCount) {
        throw "$Label fixture library is missing fixtureCount."
    }
    if ([int]$Library.fixtureCount -ne $fixtures.Count) {
        throw "$Label fixture library fixtureCount ($($Library.fixtureCount)) does not match fixtures array count ($($fixtures.Count))."
    }

    $keys = @{}
    foreach ($fixture in $fixtures) {
        if (-not $fixture.key) {
            throw "$Label fixture library contains a fixture without key."
        }
        $key = [string]$fixture.key
        if ($keys.ContainsKey($key)) {
            throw "$Label fixture library contains duplicate fixture key: $key"
        }
        $keys[$key] = $true
        if (-not ($fixture.modes -is [System.Collections.IEnumerable]) -or $fixture.modes -is [string]) {
            throw "$Label fixture '$key' must contain a modes array."
        }
    }

    return $fixtures
}

function ConvertTo-CanonicalJson {
    param([object]$Value)
    return ($Value | ConvertTo-Json -Depth 100 -Compress)
}

function Get-FixtureSummary {
    param([object]$Fixture)

    $modeCount = @($Fixture.modes).Count
    $controlCount = 0
    foreach ($mode in @($Fixture.modes)) {
        $controlCount += @($mode.profile.controls).Count
    }
    $manufacturerPrefix = ""
    if ($Fixture.manufacturerName) {
        $manufacturerPrefix = [string]$Fixture.manufacturerName + " "
    }
    $name = ($manufacturerPrefix + [string]$Fixture.name).Trim()
    return "$name ($($Fixture.key)) - $modeCount mode(s), $controlCount control(s)"
}

function Get-FixtureDifferenceSummary {
    param(
        [object]$CurrentFixture,
        [object]$SourceFixture
    )

    $changes = @()
    foreach ($field in @("manufacturerName", "name", "categories")) {
        $currentValue = ConvertTo-CanonicalJson $CurrentFixture.$field
        $sourceValue = ConvertTo-CanonicalJson $SourceFixture.$field
        if ($currentValue -ne $sourceValue) {
            $changes += $field
        }
    }
    $currentModes = @($CurrentFixture.modes)
    $sourceModes = @($SourceFixture.modes)
    if ($currentModes.Count -ne $sourceModes.Count) {
        $changes += "mode count $($currentModes.Count) -> $($sourceModes.Count)"
    }

    $currentModeNames = @{}
    foreach ($mode in $currentModes) { $currentModeNames[[string]$mode.name] = $mode }
    foreach ($mode in $sourceModes) {
        $modeName = [string]$mode.name
        if (-not $currentModeNames.ContainsKey($modeName)) {
            $changes += "added mode '$modeName'"
            continue
        }
        $currentMode = $currentModeNames[$modeName]
        if ((ConvertTo-CanonicalJson $currentMode) -ne (ConvertTo-CanonicalJson $mode)) {
            $changes += "changed mode '$modeName'"
        }
    }
    foreach ($mode in $currentModes) {
        $modeName = [string]$mode.name
        if (-not ($sourceModes | Where-Object { [string]$_.name -eq $modeName })) {
            $changes += "removed mode '$modeName'"
        }
    }

    if (-not $changes.Count) {
        return "JSON ordering or metadata changed."
    }
    return ($changes | Select-Object -First 8) -join "; "
}

function Confirm-FixtureChange {
    param(
        [string]$Prompt,
        [ref]$DecisionMode
    )

    if ($AcceptAllChanges -or $DecisionMode.Value -eq "accept-all") {
        return $true
    }
    if ($KeepExistingChanges -or $DecisionMode.Value -eq "skip-all") {
        return $false
    }
    if ($DryRun) {
        return $false
    }
    if (-not [Environment]::UserInteractive) {
        throw "Fixture differences require user input. Re-run interactively, or use -AcceptAllChanges / -KeepExistingChanges."
    }

    while ($true) {
        $answer = Read-Host "$Prompt [y] take XAMPP / [n] keep bundled / [a] take all / [s] skip all / [q] abort"
        $normalizedAnswer = ($answer -as [string]).Trim().ToLowerInvariant()
        if (-not $normalizedAnswer) {
            throw "Fixture differences require a decision. Re-run interactively, or use -AcceptAllChanges / -KeepExistingChanges / -DryRun."
        }
        switch ($normalizedAnswer) {
            "y" { return $true }
            "yes" { return $true }
            "n" { return $false }
            "no" { return $false }
            "a" { $DecisionMode.Value = "accept-all"; return $true }
            "all" { $DecisionMode.Value = "accept-all"; return $true }
            "s" { $DecisionMode.Value = "skip-all"; return $false }
            "skip" { $DecisionMode.Value = "skip-all"; return $false }
            "q" { throw "Fixture library sync aborted by user." }
            "quit" { throw "Fixture library sync aborted by user." }
            default { Write-Host "Please answer y, n, a, s, or q." }
        }
    }
}

$library = Read-FixtureLibrary -Path $SourcePath -Label "XAMPP"
$fixtures = Test-FixtureLibrary -Library $library -Label "XAMPP"
$currentLibrary = $null
$currentFixtures = @()
if (Test-Path -LiteralPath $OutputPath) {
    $currentLibrary = Read-FixtureLibrary -Path $OutputPath -Label "Bundled"
    $currentFixtures = Test-FixtureLibrary -Library $currentLibrary -Label "Bundled"
}

$currentByKey = @{}
foreach ($fixture in $currentFixtures) {
    $currentByKey[[string]$fixture.key] = $fixture
}
$sourceByKey = @{}
foreach ($fixture in $fixtures) {
    $sourceByKey[[string]$fixture.key] = $fixture
}

$decisionMode = ""
$selectedFixtures = New-Object System.Collections.Generic.List[object]
$acceptedChanges = 0
$skippedChanges = 0
$unchangedFixtures = 0

foreach ($fixture in $fixtures) {
    $key = [string]$fixture.key
    if (-not $currentByKey.ContainsKey($key)) {
        Write-Host ""
        Write-Host "New fixture in XAMPP:"
        Write-Host "  $(Get-FixtureSummary $fixture)"
        if (Confirm-FixtureChange -Prompt "Add this fixture to the bundled library?" -DecisionMode ([ref]$decisionMode)) {
            $selectedFixtures.Add($fixture)
            $acceptedChanges++
        } else {
            $skippedChanges++
        }
        continue
    }

    $currentFixture = $currentByKey[$key]
    if ((ConvertTo-CanonicalJson $currentFixture) -eq (ConvertTo-CanonicalJson $fixture)) {
        $selectedFixtures.Add($currentFixture)
        $unchangedFixtures++
        continue
    }

    Write-Host ""
    Write-Host "Changed fixture:"
    Write-Host "  $(Get-FixtureSummary $fixture)"
    Write-Host "  Difference: $(Get-FixtureDifferenceSummary -CurrentFixture $currentFixture -SourceFixture $fixture)"
    if (Confirm-FixtureChange -Prompt "Take the XAMPP version for this fixture?" -DecisionMode ([ref]$decisionMode)) {
        $selectedFixtures.Add($fixture)
        $acceptedChanges++
    } else {
        $selectedFixtures.Add($currentFixture)
        $skippedChanges++
    }
}

foreach ($fixture in $currentFixtures) {
    $key = [string]$fixture.key
    if ($sourceByKey.ContainsKey($key)) {
        continue
    }
    Write-Host ""
    Write-Host "Fixture exists only in bundled library:"
    Write-Host "  $(Get-FixtureSummary $fixture)"
    if (Confirm-FixtureChange -Prompt "Remove it from the bundled library to match XAMPP?" -DecisionMode ([ref]$decisionMode)) {
        $acceptedChanges++
    } else {
        $selectedFixtures.Add($fixture)
        $skippedChanges++
    }
}

$normalizedSource = "Imported fixture library"
if ($library.source) {
    $normalizedSource = [string]$library.source
}
$normalizedGeneratedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
if ($library.generatedAt) {
    $normalizedGeneratedAt = [string]$library.generatedAt
}
$selectedFixtureArray = $selectedFixtures.ToArray()

$normalized = [PSCustomObject]@{
    schemaVersion = [int]$library.schemaVersion
    source = $normalizedSource
    generatedAt = $normalizedGeneratedAt
    fixtureCount = $selectedFixtureArray.Count
    fixtures = $selectedFixtureArray
}

$outputDir = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

if (-not $DryRun) {
    $normalized | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputPath -Encoding utf8
}

Write-Host ""
$resultVerb = "Synced"
if ($DryRun) {
    $resultVerb = "Checked"
}
Write-Host "$resultVerb fixture library:"
Write-Host "  From: $SourcePath"
Write-Host "  To:   $OutputPath"
Write-Host "  Fixtures: $($selectedFixtures.Count)"
Write-Host "  Unchanged: $unchangedFixtures"
Write-Host "  Accepted changes: $acceptedChanges"
Write-Host "  Skipped changes: $skippedChanges"
