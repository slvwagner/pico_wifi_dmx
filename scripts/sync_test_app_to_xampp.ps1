param(
    [string]$XamppHtdocs = "",
    [string]$AppFolder = "dmx-test",
    [string]$BaseUrl = "http://localhost/dmx-test/",
    [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "local_path_config.ps1")
$localPaths = Get-LocalPathConfig -RepoRoot $repoRoot
if (-not $XamppHtdocs) { $XamppHtdocs = $localPaths.xamppHtdocs }

& (Join-Path $PSScriptRoot "update_xampp_server.ps1") `
    -XamppHtdocs $XamppHtdocs `
    -AppFolder $AppFolder `
    -BaseUrl $BaseUrl `
    -SkipVerify:$SkipVerify
