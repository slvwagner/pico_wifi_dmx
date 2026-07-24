param(
    [string]$ApacheArchive = "",
    [string]$PhpArchive = "",
    [string]$VcRedistPath = "",
    [string]$MakensisPath = "",
    [string]$OutputDir = "",
    [string]$SignToolPath = "",
    [string]$SigningCertificateThumbprint = "",
    [string]$TimestampUrl = "http://timestamp.digicert.com",
    [switch]$PrepareOnly
)

$ErrorActionPreference = "Stop"

$installerDir = $PSScriptRoot
$repoRoot = Split-Path -Parent (Split-Path -Parent $installerDir)
$version = (Get-Content -LiteralPath (Join-Path $repoRoot "VERSION") -Raw).Trim()
$buildRoot = Join-Path $repoRoot "build\windows-installer"
$stageDir = Join-Path $buildRoot "stage"
$extractDir = Join-Path $buildRoot "extract"
$shellProject = Join-Path $installerDir "shell\PicoDmxShell.csproj"
$shellPublishDir = Join-Path $buildRoot "shell-publish"
if (-not $OutputDir) {
    $OutputDir = Join-Path $repoRoot "release\v$version"
}
$dependencyManifest = Get-Content -LiteralPath (Join-Path $installerDir "dependencies.json") -Raw |
    ConvertFrom-Json
$downloadDir = Join-Path $buildRoot "downloads"
if (-not $ApacheArchive) {
    $ApacheArchive = Join-Path $downloadDir $dependencyManifest.apache.file
}
if (-not $PhpArchive) {
    $PhpArchive = Join-Path $downloadDir $dependencyManifest.php.file
}
if (-not $VcRedistPath) {
    $defaultVcRedist = Join-Path $downloadDir $dependencyManifest.vcRedist.file
    if (Test-Path -LiteralPath $defaultVcRedist) {
        $VcRedistPath = $defaultVcRedist
    }
}

function Assert-File {
    param([Parameter(Mandatory = $true)][string]$Path, [string]$Label)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label not found: $Path"
    }
    return (Resolve-Path -LiteralPath $Path).Path
}

function Reset-BuildDirectory {
    param([Parameter(Mandatory = $true)][string]$Path)
    $resolvedBuildRoot = [System.IO.Path]::GetFullPath($buildRoot)
    $resolvedPath = [System.IO.Path]::GetFullPath($Path)
    if (-not $resolvedPath.StartsWith($resolvedBuildRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to reset a directory outside $resolvedBuildRoot"
    }
    if (Test-Path -LiteralPath $resolvedPath) {
        Remove-Item -LiteralPath $resolvedPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $resolvedPath -Force | Out-Null
}

$ApacheArchive = Assert-File $ApacheArchive "Apache archive"
$PhpArchive = Assert-File $PhpArchive "PHP archive"
if ($VcRedistPath) {
    $VcRedistPath = Assert-File $VcRedistPath "Visual C++ Redistributable"
}

Reset-BuildDirectory $stageDir
Reset-BuildDirectory $extractDir
Reset-BuildDirectory $shellPublishDir

& dotnet restore $shellProject -r win-x64 --locked-mode
if ($LASTEXITCODE -ne 0) {
    throw "The locked Windows shell package restore failed with exit code $LASTEXITCODE."
}
& dotnet publish $shellProject `
    -c Release `
    -r win-x64 `
    --self-contained true `
    --no-restore `
    -o $shellPublishDir
if ($LASTEXITCODE -ne 0) {
    throw "The Windows application shell publish failed with exit code $LASTEXITCODE."
}

$apacheExtract = Join-Path $extractDir "apache"
$phpExtract = Join-Path $extractDir "php"
New-Item -ItemType Directory -Path $apacheExtract, $phpExtract -Force | Out-Null
Expand-Archive -LiteralPath $ApacheArchive -DestinationPath $apacheExtract -Force
Expand-Archive -LiteralPath $PhpArchive -DestinationPath $phpExtract -Force

$httpd = Get-ChildItem -LiteralPath $apacheExtract -Filter "httpd.exe" -Recurse -File | Select-Object -First 1
if (-not $httpd -or $httpd.Directory.Name -ne "bin") {
    throw "The Apache archive does not contain an expected bin\httpd.exe."
}
$apacheRoot = Split-Path -Parent $httpd.Directory.FullName
$phpDll = Get-ChildItem -LiteralPath $phpExtract -Filter "php8apache2_4.dll" -Recurse -File | Select-Object -First 1
if (-not $phpDll) {
    throw "The PHP archive is not an x64 Thread Safe Apache build (php8apache2_4.dll is missing)."
}
$phpRoot = $phpDll.Directory.FullName

$stageApp = Join-Path $stageDir "app"
$stageRuntime = Join-Path $stageDir "runtime"
$stageSupport = Join-Path $stageDir "support"
$stageShell = Join-Path $stageDir "shell"
New-Item -ItemType Directory -Path $stageApp, $stageRuntime, $stageSupport, $stageShell -Force | Out-Null

Copy-Item -LiteralPath $apacheRoot -Destination (Join-Path $stageRuntime "apache") -Recurse -Force
Copy-Item -LiteralPath $phpRoot -Destination (Join-Path $stageRuntime "php") -Recurse -Force

foreach ($unneeded in @(
    (Join-Path $stageRuntime "apache\htdocs"),
    (Join-Path $stageRuntime "apache\manual")
)) {
    if (Test-Path -LiteralPath $unneeded) {
        Remove-Item -LiteralPath $unneeded -Recurse -Force
    }
}

$webDir = Join-Path $repoRoot "web"
Copy-Item -LiteralPath (Join-Path $webDir "dmx_fixture_controller.html") -Destination (Join-Path $stageApp "index.html")
foreach ($page in @(
    "dmx_show.html",
    "dmx_midi_emulator.html",
    "dmx_chaser.html",
    "dmx_motion.html",
    "dmx_gpio.html",
    "dmx_room_plane.html",
    "dmx_monitor.html"
)) {
    Copy-Item -LiteralPath (Join-Path $webDir $page) -Destination (Join-Path $stageApp $page)
}
Copy-Item -LiteralPath (Join-Path $webDir "assets") -Destination (Join-Path $stageApp "assets") -Recurse

$testDir = Join-Path $stageApp "test"
New-Item -ItemType Directory -Path $testDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $webDir "dmx_benchmark.html") -Destination (Join-Path $testDir "index.html")

Get-ChildItem -LiteralPath (Join-Path $repoRoot "api") -Filter "*.php" -File |
    Copy-Item -Destination $stageApp

Copy-Item -LiteralPath (Join-Path $repoRoot "docs\user-manual.html") -Destination (Join-Path $stageApp "user-manual.html")
Copy-Item -LiteralPath (Join-Path $repoRoot "docs\user-manual.pdf") -Destination (Join-Path $stageApp "user-manual.pdf")
if (Test-Path -LiteralPath (Join-Path $repoRoot "docs\screenshots")) {
    Copy-Item -LiteralPath (Join-Path $repoRoot "docs\screenshots") -Destination (Join-Path $stageApp "screenshots") -Recurse
}

Copy-Item -LiteralPath (Join-Path $installerDir "runtime\httpd.conf.template") -Destination $stageSupport
Copy-Item -LiteralPath (Join-Path $installerDir "runtime\php.ini.template") -Destination $stageSupport
Copy-Item -LiteralPath (Join-Path $installerDir "scripts\configure_install.ps1") -Destination $stageSupport
Copy-Item -LiteralPath (Join-Path $installerDir "scripts\open_controller.ps1") -Destination $stageSupport
Copy-Item -LiteralPath (Join-Path $installerDir "scripts\test_port.ps1") -Destination $stageSupport
Copy-Item -LiteralPath (Join-Path $installerDir "scripts\port_owner.ps1") -Destination $stageSupport
Copy-Item -LiteralPath (Join-Path $shellPublishDir "WiFiPicoDMX.exe") -Destination $stageShell

$shellLicenseDir = Join-Path $stageShell "licenses"
New-Item -ItemType Directory -Path $shellLicenseDir -Force | Out-Null
$dotnetRoot = Split-Path -Parent (Get-Command dotnet).Source
Copy-Item -LiteralPath (Join-Path $dotnetRoot "LICENSE.txt") `
    -Destination (Join-Path $shellLicenseDir "dotnet-LICENSE.txt")
Copy-Item -LiteralPath (Join-Path $dotnetRoot "ThirdPartyNotices.txt") `
    -Destination (Join-Path $shellLicenseDir "dotnet-ThirdPartyNotices.txt")
$webViewPackageRoot = Join-Path $env:USERPROFILE ".nuget\packages\microsoft.web.webview2\1.0.4078.44"
Copy-Item -LiteralPath (Join-Path $webViewPackageRoot "LICENSE.txt") `
    -Destination (Join-Path $shellLicenseDir "webview2-LICENSE.txt")
Copy-Item -LiteralPath (Join-Path $webViewPackageRoot "NOTICE.txt") `
    -Destination (Join-Path $shellLicenseDir "webview2-NOTICE.txt")
if ($VcRedistPath) {
    Copy-Item -LiteralPath $VcRedistPath -Destination (Join-Path $stageSupport "vc_redist.x64.exe")
}
Copy-Item -LiteralPath (Join-Path $repoRoot "LICENSE") -Destination $stageDir
Copy-Item -LiteralPath (Join-Path $repoRoot "VERSION") -Destination $stageDir

Write-Host "Prepared Windows installer staging tree at $stageDir"
if ($PrepareOnly) {
    return
}

if (-not $MakensisPath) {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "NSIS\makensis.exe"),
        (Join-Path $env:ProgramFiles "NSIS\makensis.exe")
    )
    $MakensisPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
$MakensisPath = Assert-File $MakensisPath "NSIS compiler"

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$outputFile = Join-Path ([System.IO.Path]::GetFullPath($OutputDir)) "wifi-pico-dmx-$version-windows-x64.exe"
$nsiScript = Join-Path $installerDir "pico-dmx-controller.nsi"

& $MakensisPath `
    "/WX" `
    "/DSTAGE_DIR=$stageDir" `
    "/DPRODUCT_VERSION=$version" `
    "/DOUTPUT_FILE=$outputFile" `
    $nsiScript
if ($LASTEXITCODE -ne 0) {
    throw "NSIS compilation failed with exit code $LASTEXITCODE."
}

$hash = (Get-FileHash -LiteralPath $outputFile -Algorithm SHA256).Hash.ToLowerInvariant()
if ($SigningCertificateThumbprint) {
    if (-not $SignToolPath) {
        $kitsRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
        $SignToolPath = Get-ChildItem -LiteralPath $kitsRoot -Filter "signtool.exe" -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
            Sort-Object FullName -Descending |
            Select-Object -ExpandProperty FullName -First 1
    }
    $SignToolPath = Assert-File $SignToolPath "Windows SignTool"
    & $SignToolPath sign `
        /sha1 $SigningCertificateThumbprint `
        /fd SHA256 `
        /tr $TimestampUrl `
        /td SHA256 `
        $outputFile
    if ($LASTEXITCODE -ne 0) {
        throw "Authenticode signing failed with exit code $LASTEXITCODE."
    }
    & $SignToolPath verify /pa $outputFile
    if ($LASTEXITCODE -ne 0) {
        throw "Authenticode signature verification failed with exit code $LASTEXITCODE."
    }
    $hash = (Get-FileHash -LiteralPath $outputFile -Algorithm SHA256).Hash.ToLowerInvariant()
} else {
    Write-Warning "The installer is unsigned. Supply -SigningCertificateThumbprint for a customer release."
}
"$hash  $(Split-Path -Leaf $outputFile)" | Set-Content -LiteralPath "$outputFile.sha256" -Encoding ASCII
Write-Host "Built $outputFile"
Write-Host "SHA-256 $hash"
