<#
.SYNOPSIS
Publishes an already prepared and committed WiFiPicoDMX release to GitHub.

.DESCRIPTION
Validates a clean, synchronized main branch, the release manifest, every
artifact checksum, and GitHub authentication before creating an annotated tag
and public GitHub Release. Re-running after an interrupted upload is safe: an
existing matching tag is reused and only missing assets are uploaded.

.EXAMPLE
.\scripts\publish_github_release.ps1 -Version 1.1.1 -AllowUnsignedWindowsInstaller

.EXAMPLE
.\scripts\publish_github_release.ps1 -Version 1.1.1 -AllowUnsignedWindowsInstaller -WhatIf
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [string]$Version = '',
    [switch]$AllowUnsignedWindowsInstaller
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

function Invoke-CheckedNative {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    $output = & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
    return $output
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Resolve-ReleaseFile {
    param(
        [Parameter(Mandatory = $true)][string]$ReleaseDirectory,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $candidate = Join-Path $ReleaseDirectory $RelativePath
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        throw "Required release asset is missing: $candidate"
    }
    return (Resolve-Path -LiteralPath $candidate).Path
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is required to publish a release.'
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI (gh) is required to publish a release.'
}

if (-not $Version) {
    $Version = (Get-Content -LiteralPath (Join-Path $repoRoot 'VERSION') -Raw).Trim()
}
if ($Version -notmatch '^\d+\.\d+\.\d+([-.][A-Za-z0-9.]+)?$') {
    throw "Version '$Version' is not a supported release version."
}

$branch = (Invoke-CheckedNative 'Read current branch' { git branch --show-current } | Select-Object -First 1).Trim()
if ($branch -ne 'main') {
    throw "GitHub releases must be published from main; current branch is '$branch'."
}

$dirty = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) {
    throw 'Could not inspect the working tree.'
}
if ($dirty.Count) {
    throw 'The working tree must be clean before publishing a GitHub release.'
}

Invoke-CheckedNative 'GitHub authentication check' { gh auth status } | Out-Null
Invoke-CheckedNative 'Fetch main and release tags' { git fetch origin main --tags } | Out-Null

$head = (Invoke-CheckedNative 'Read HEAD' { git rev-parse HEAD } | Select-Object -First 1).Trim()
$originMain = (Invoke-CheckedNative 'Read origin/main' { git rev-parse origin/main } | Select-Object -First 1).Trim()
if ($head -ne $originMain) {
    throw "Local main ($head) is not synchronized with origin/main ($originMain)."
}

$releaseDir = Join-Path $repoRoot "release\v$Version"
$manifestPath = Resolve-ReleaseFile -ReleaseDirectory $releaseDir -RelativePath 'release-manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ([string]$manifest.version -ne $Version) {
    throw "Release manifest version '$($manifest.version)' does not match '$Version'."
}
if ([string]$manifest.branch -ne 'main') {
    throw "Release manifest branch must be 'main', not '$($manifest.branch)'."
}
if (-not [bool]$manifest.docsGenerated) {
    throw 'Release manifest says documentation was not generated.'
}
if (-not $manifest.windowsInstaller -or -not $manifest.debianInstaller) {
    throw 'Release manifest must contain both Windows and Debian installers.'
}
if (-not [bool]$manifest.windowsInstaller.signed -and -not $AllowUnsignedWindowsInstaller) {
    throw 'The Windows installer is unsigned. Review it and pass -AllowUnsignedWindowsInstaller explicitly to publish it.'
}
if (-not $manifest.commit) {
    throw 'Release manifest does not identify its source commit.'
}
& git merge-base --is-ancestor ([string]$manifest.commit) $head
if ($LASTEXITCODE -ne 0) {
    throw "Manifest commit '$($manifest.commit)' is not an ancestor of HEAD '$head'."
}

$verifiedAssets = [System.Collections.Generic.List[object]]::new()
function Add-VerifiedAsset {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$ExpectedHash,
        [switch]$IncludeChecksum
    )

    if ($ExpectedHash -notmatch '^[a-fA-F0-9]{64}$') {
        throw "Invalid SHA-256 in release manifest for '$RelativePath'."
    }
    $path = Resolve-ReleaseFile -ReleaseDirectory $releaseDir -RelativePath $RelativePath
    $actualHash = Get-Sha256 $path
    if ($actualHash -ne $ExpectedHash.ToLowerInvariant()) {
        throw "SHA-256 mismatch for '$RelativePath'. Expected $ExpectedHash, got $actualHash."
    }
    $verifiedAssets.Add([pscustomobject]@{ Path = $path; Name = [IO.Path]::GetFileName($path); Sha256 = $actualHash })

    if ($IncludeChecksum) {
        $checksumPath = Resolve-ReleaseFile -ReleaseDirectory $releaseDir -RelativePath "$RelativePath.sha256"
        $checksumText = (Get-Content -LiteralPath $checksumPath -Raw).Trim()
        $expectedLine = "$actualHash  $([IO.Path]::GetFileName($path))"
        if ($checksumText -ne $expectedLine) {
            throw "Checksum file '$RelativePath.sha256' does not match its artifact."
        }
        $verifiedAssets.Add([pscustomobject]@{
            Path = $checksumPath
            Name = [IO.Path]::GetFileName($checksumPath)
            Sha256 = Get-Sha256 $checksumPath
        })
    }
}

Add-VerifiedAsset -RelativePath ([string]$manifest.windowsInstaller.file) -ExpectedHash ([string]$manifest.windowsInstaller.sha256) -IncludeChecksum
Add-VerifiedAsset -RelativePath ([string]$manifest.debianInstaller.file) -ExpectedHash ([string]$manifest.debianInstaller.sha256) -IncludeChecksum
Add-VerifiedAsset -RelativePath ([string]$manifest.firmware.file) -ExpectedHash ([string]$manifest.firmware.sha256) -IncludeChecksum
Add-VerifiedAsset -RelativePath ([string]$manifest.wifiFirmware.file) -ExpectedHash ([string]$manifest.wifiFirmware.sha256) -IncludeChecksum
Add-VerifiedAsset -RelativePath ([string]$manifest.wifiFirmwareTbyb.file) -ExpectedHash ([string]$manifest.wifiFirmwareTbyb.sha256) -IncludeChecksum

foreach ($manualName in @('user-manual.html', 'user-manual.pdf', 'user-manual-navigation.pdf')) {
    $manualEntry = $manifest.docs.$manualName
    if (-not $manualEntry) {
        throw "Release manifest is missing documentation metadata for '$manualName'."
    }
    Add-VerifiedAsset -RelativePath "docs\$manualName" -ExpectedHash ([string]$manualEntry.sha256)
}
$verifiedAssets.Add([pscustomobject]@{
    Path = $manifestPath
    Name = [IO.Path]::GetFileName($manifestPath)
    Sha256 = Get-Sha256 $manifestPath
})

$tag = "v$Version"
$tagExists = $false
& git show-ref --verify --quiet "refs/tags/$tag"
if ($LASTEXITCODE -eq 0) {
    $tagExists = $true
    $tagCommit = (Invoke-CheckedNative "Resolve tag $tag" { git rev-list -n 1 $tag } | Select-Object -First 1).Trim()
    if ($tagCommit -ne $head) {
        throw "Existing tag '$tag' points to $tagCommit instead of HEAD $head."
    }
}

$remoteTagOutput = & git ls-remote --tags origin "refs/tags/$tag" "refs/tags/$tag^{}"
if ($LASTEXITCODE -ne 0) {
    throw "Could not inspect remote tag '$tag'."
}
$remoteTagExists = [bool]$remoteTagOutput

$existingReleaseJson = & gh release view $tag --json url,assets,isDraft,isPrerelease 2>$null
$releaseExists = $LASTEXITCODE -eq 0
$existingRelease = if ($releaseExists) { $existingReleaseJson | ConvertFrom-Json } else { $null }

Write-Host "Release v$Version validated:"
Write-Host "  Commit: $head"
Write-Host "  Assets: $($verifiedAssets.Count)"
Write-Host "  Existing tag: $tagExists (remote: $remoteTagExists)"
Write-Host "  Existing GitHub Release: $releaseExists"

if (-not $PSCmdlet.ShouldProcess("GitHub release $tag", 'Create/push its tag and publish all verified assets')) {
    return
}

if (-not $tagExists) {
    Invoke-CheckedNative "Create annotated tag $tag" { git tag -a $tag -m "WiFiPicoDMX $Version" } | Out-Null
    $tagExists = $true
}
if (-not $remoteTagExists) {
    Invoke-CheckedNative "Push tag $tag" { git push origin $tag } | Out-Null
}

if (-not $releaseExists) {
    $assetPaths = @($verifiedAssets | ForEach-Object Path)
    $releaseUrl = Invoke-CheckedNative "Create GitHub Release $tag" {
        gh release create $tag --title "WiFiPicoDMX $Version" --generate-notes --latest @assetPaths
    } | Select-Object -Last 1
    Write-Host "Published $releaseUrl"
    return
}

$existingByName = @{}
foreach ($asset in $existingRelease.assets) {
    $existingByName[[string]$asset.name] = $asset
}
$missingPaths = [System.Collections.Generic.List[string]]::new()
foreach ($asset in $verifiedAssets) {
    if (-not $existingByName.ContainsKey($asset.Name)) {
        $missingPaths.Add($asset.Path)
        continue
    }
    $remoteAsset = $existingByName[$asset.Name]
    if ($remoteAsset.digest -and [string]$remoteAsset.digest -ne "sha256:$($asset.Sha256)") {
        throw "Existing GitHub asset '$($asset.Name)' has a different SHA-256. Refusing to overwrite it."
    }
}
if ($missingPaths.Count) {
    Invoke-CheckedNative "Upload missing assets for $tag" { gh release upload $tag @missingPaths } | Out-Null
}
Invoke-CheckedNative "Mark $tag as the latest public release" {
    gh release edit $tag --draft=false --prerelease=false --latest
} | Out-Null
Write-Host "GitHub Release is complete: $($existingRelease.url)"
