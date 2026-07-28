<#
.SYNOPSIS
Creates a development branch and synchronizes the project's application version.

.DESCRIPTION
With -Commit, first records the new current development version in the source
branch README, then creates and commits the complete new development branch.

.EXAMPLE
.\scripts\start_version_branch.ps1 -Version 0.9.14 -DryRun

.EXAMPLE
.\scripts\start_version_branch.ps1 -Version 0.9.14 -Commit
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,

    [string]$FromBranch = "main",
    [switch]$Commit,
    [switch]$DryRun,
    [switch]$AllowDirty
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if ($DryRun -and $Commit) {
    throw "Use either -DryRun or -Commit, not both."
}
if ($AllowDirty -and $Commit) {
    throw "-Commit cannot be combined with -AllowDirty because unrelated changes must never be staged."
}

function Invoke-Git {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $output = & git @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed:`n$($output -join [Environment]::NewLine)"
    }
    return @($output)
}

function Read-Text {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [IO.File]::ReadAllText((Join-Path $repoRoot $Path))
}

function Write-Text {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $utf8NoBom = [Text.UTF8Encoding]::new($false)
    [IO.File]::WriteAllText((Join-Path $repoRoot $Path), $Content, $utf8NoBom)
}

function Replace-Required {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$OldValue,
        [Parameter(Mandatory = $true)][string]$NewValue
    )

    $content = Read-Text $Path
    if (-not $content.Contains($OldValue)) {
        throw "Expected '$OldValue' in $Path. Refusing a partial version update."
    }
    Write-Text $Path ($content.Replace($OldValue, $NewValue))
}

function Replace-RegexRequired {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Pattern,
        [Parameter(Mandatory = $true)][string]$Replacement
    )

    $content = Read-Text $Path
    if (-not [regex]::IsMatch($content, $Pattern)) {
        throw "Expected pattern '$Pattern' in $Path. Refusing a partial version update."
    }
    Write-Text $Path ([regex]::Replace($content, $Pattern, $Replacement))
}

$gitRoot = (Invoke-Git -Arguments @("rev-parse", "--show-toplevel") | Select-Object -First 1).Trim()
if ([IO.Path]::GetFullPath($gitRoot) -ne [IO.Path]::GetFullPath($repoRoot)) {
    throw "Run this script from the pico_wifi_dmx repository. Resolved Git root: $gitRoot"
}

$currentVersion = (Read-Text "VERSION").Trim()
if ($currentVersion -notmatch '^\d+\.\d+\.\d+$') {
    throw "VERSION contains '$currentVersion', which is not MAJOR.MINOR.PATCH."
}
if ([version]$Version -le [version]$currentVersion) {
    throw "New version $Version must be greater than current version $currentVersion."
}

$currentBranch = (Invoke-Git -Arguments @("branch", "--show-current") | Select-Object -First 1).Trim()
if ($currentBranch -ne $FromBranch) {
    throw "Current branch is '$currentBranch'. Check out '$FromBranch' or pass -FromBranch '$currentBranch' intentionally."
}

$existingBranch = & git show-ref --verify --quiet "refs/heads/$Version"
if ($LASTEXITCODE -eq 0) {
    throw "Local branch '$Version' already exists."
}

$dirty = @(Invoke-Git -Arguments @("status", "--porcelain"))
if ($dirty.Count -and -not $AllowDirty) {
    throw "Working tree is not clean. Commit or stash changes before starting $Version."
}

$requiredVersionFiles = @(
    "CMakeLists.txt",
    "VERSION",
    "docs/manual-data/room_plane_setup.json",
    "tests/ui/page-link-rules.spec.js",
    "web/assets/dmx-common.js"
)
$htmlFiles = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot "web") -Filter "*.html" -File -Recurse |
    ForEach-Object { [IO.Path]::GetRelativePath($repoRoot, $_.FullName) })
$replaceFiles = @($requiredVersionFiles + $htmlFiles | Sort-Object -Unique)

foreach ($path in $replaceFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $path))) {
        throw "Required version file is missing: $path"
    }
    if (-not (Read-Text $path).Contains($currentVersion)) {
        throw "Expected current version $currentVersion in $path. Refusing a partial version update."
    }
}

$changelog = Read-Text "CHANGELOG.md"
$oldHeading = "## $currentVersion"
if (-not $changelog.Contains($oldHeading)) {
    throw "CHANGELOG.md does not contain the current $currentVersion section."
}
if ($changelog.Contains("## $Version")) {
    throw "CHANGELOG.md already contains a $Version section."
}

$readmeReplacements = @(
    @{
        Pattern = '(?m)^- \*\*Current development version:\*\* (?:`[^`]+`|Not started)\r?$'
        Replacement = "- **Current development version:** ``$Version``"
    },
    @{
        Pattern = '(?m)(Development takes place on a branch named for the next version, such as `)[^`]+(`)'
        Replacement = "`${1}$Version`${2}"
    },
    @{
        Pattern = '(?m)(An asset suffix such as `\?v=)[0-9]+\.[0-9]+\.[0-9]+(-[0-9]+`)'
        Replacement = "`${1}$Version`${2}"
    },
    @{
        Pattern = '(?m)(browser-cache revision within application version `)[0-9]+\.[0-9]+\.[0-9]+(`;)'
        Replacement = "`${1}$Version`${2}"
    },
    @{
        Pattern = '(?m)("appVersion": ")[0-9]+\.[0-9]+\.[0-9]+(")'
        Replacement = "`${1}$Version`${2}"
    }
)
$currentDevelopmentPattern = $readmeReplacements[0].Pattern
$currentDevelopmentReplacement = $readmeReplacements[0].Replacement
$readme = Read-Text "README.md"
foreach ($replacement in $readmeReplacements) {
    if (-not [regex]::IsMatch($readme, $replacement.Pattern)) {
        throw "README.md is missing an expected version pattern: $($replacement.Pattern)"
    }
}

$plannedFiles = @($replaceFiles + @("README.md", "CHANGELOG.md") | Sort-Object -Unique)
Write-Host "Current version: $currentVersion"
Write-Host "New version:     $Version"
Write-Host "Source branch:   $FromBranch"
Write-Host "New branch:      $Version"
Write-Host "Files to update: $($plannedFiles.Count)"
$plannedFiles | ForEach-Object { Write-Host "  $_" }

if ($DryRun) {
    Write-Host "Dry run complete. No branch or files were changed."
    exit 0
}

if ($Commit) {
    Replace-RegexRequired `
        -Path "README.md" `
        -Pattern $currentDevelopmentPattern `
        -Replacement $currentDevelopmentReplacement
    Invoke-Git -Arguments @("add", "--", "README.md") | Write-Host
    Invoke-Git -Arguments @("commit", "-m", "Point development to $Version") | Write-Host
    Write-Host "Updated $FromBranch to identify $Version as the current development version."
}

Invoke-Git -Arguments @("checkout", "-b", $Version, $FromBranch) | Write-Host

foreach ($path in $replaceFiles) {
    Replace-Required -Path $path -OldValue $currentVersion -NewValue $Version
}

foreach ($replacement in $readmeReplacements) {
    Replace-RegexRequired -Path "README.md" -Pattern $replacement.Pattern -Replacement $replacement.Replacement
}

$changelog = Read-Text "CHANGELOG.md"
$newline = if ($changelog.Contains("`r`n")) { "`r`n" } else { "`n" }
$newSection = "## $Version - Unreleased${newline}${newline}Changed:${newline}${newline}- Started the $Version development branch.${newline}${newline}"
$changelog = $changelog.Replace($oldHeading, $newSection + $oldHeading)
Write-Text "CHANGELOG.md" $changelog

foreach ($path in $replaceFiles) {
    if ((Read-Text $path).Contains($currentVersion)) {
        throw "Stale current version $currentVersion remains in $path."
    }
    if (-not (Read-Text $path).Contains($Version)) {
        throw "New version $Version is missing from $path."
    }
}

$status = @(Invoke-Git -Arguments @("status", "--short"))
if (-not $status.Count) {
    throw "Version update produced no tracked changes."
}

if ($Commit) {
    $commitFiles = @($replaceFiles + @("CHANGELOG.md", "README.md") | Sort-Object -Unique)
    Invoke-Git -Arguments (@("add", "--") + $commitFiles) | Write-Host
    Invoke-Git -Arguments @("commit", "-m", "Start $Version development") | Write-Host
    Write-Host "Created and committed branch $Version."
} else {
    Write-Host "Created branch $Version and updated version files. Review the changes, then commit them."
    Write-Host "The source branch README is unchanged unless the script is run with -Commit."
}

Write-Host "The script does not push branches or deploy to XAMPP."
