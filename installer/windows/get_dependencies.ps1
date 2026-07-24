param(
    [string]$Destination = ""
)

$ErrorActionPreference = "Stop"

if (-not $Destination) {
    $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $Destination = Join-Path $repoRoot "build\windows-installer\downloads"
}
New-Item -ItemType Directory -Path $Destination -Force | Out-Null

$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot "dependencies.json") -Raw |
    ConvertFrom-Json

foreach ($name in @("apache", "php", "vcRedist")) {
    $dependency = $manifest.$name
    $target = Join-Path $Destination $dependency.file
    $valid = $false
    if (Test-Path -LiteralPath $target) {
        $actual = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
        $valid = $actual -eq ([string]$dependency.sha256).ToLowerInvariant()
    }
    if (-not $valid) {
        Write-Host "Downloading $name $($dependency.version)..."
        & curl.exe `
            --fail `
            --location `
            --proto "=https" `
            --proto-redir "=https" `
            --output $target `
            $dependency.url
        if ($LASTEXITCODE -ne 0) {
            throw "Download failed for $($dependency.url) with curl exit code $LASTEXITCODE."
        }
    }

    $actual = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    $expected = ([string]$dependency.sha256).ToLowerInvariant()
    if ($actual -ne $expected) {
        throw "SHA-256 verification failed for $target. Expected $expected but received $actual."
    }
    Write-Host "Verified $target"
}

Write-Host ""
Write-Host "Dependencies ready:"
Write-Host "  Apache:  $(Join-Path $Destination $manifest.apache.file)"
Write-Host "  PHP:     $(Join-Path $Destination $manifest.php.file)"
Write-Host "  VC++:    $(Join-Path $Destination $manifest.vcRedist.file)"
