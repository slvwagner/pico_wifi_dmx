param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$DataDir,
    [Parameter(Mandatory = $true)][string]$ListenAddress,
    [Parameter(Mandatory = $true)][ValidateRange(1, 65535)][int]$Port
)

$ErrorActionPreference = "Stop"

function Convert-ToApachePath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path).Replace("\", "/")
}

$supportDir = Join-Path $InstallDir "support"
$configDir = Join-Path $InstallDir "config"
$logsDir = Join-Path (Split-Path -Parent $DataDir) "logs"
$tempDir = Join-Path (Split-Path -Parent $DataDir) "temp"

foreach ($directory in @($DataDir, $configDir, $logsDir, $tempDir)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

$tokens = @{
    "@APACHE_ROOT@" = Convert-ToApachePath (Join-Path $InstallDir "runtime\apache")
    "@PHP_ROOT@" = Convert-ToApachePath (Join-Path $InstallDir "runtime\php")
    "@APP_ROOT@" = Convert-ToApachePath (Join-Path $InstallDir "app")
    "@DATA_ROOT@" = Convert-ToApachePath $DataDir
    "@LOG_ROOT@" = Convert-ToApachePath $logsDir
    "@TEMP_ROOT@" = Convert-ToApachePath $tempDir
    "@LISTEN_ADDRESS@" = $ListenAddress
    "@PORT@" = [string]$Port
}

function Expand-Template {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    $content = Get-Content -LiteralPath $Source -Raw
    foreach ($token in $tokens.Keys) {
        $content = $content.Replace($token, $tokens[$token])
    }
    Set-Content -LiteralPath $Destination -Value $content -Encoding ASCII
}

Expand-Template `
    -Source (Join-Path $supportDir "httpd.conf.template") `
    -Destination (Join-Path $configDir "httpd.conf")
Expand-Template `
    -Source (Join-Path $supportDir "php.ini.template") `
    -Destination (Join-Path $InstallDir "runtime\php\php.ini")
