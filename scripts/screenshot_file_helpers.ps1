$ErrorActionPreference = "Stop"

function Get-PicoDmxTempPath {
    param([string]$Name)

    $root = $env:TEMP
    if (-not $root) { $root = $env:TMPDIR }
    if (-not $root) { $root = [IO.Path]::GetTempPath() }
    return Join-Path $root $Name
}

function Get-FreeTcpPort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    try {
        $listener.Start()
        return $listener.LocalEndpoint.Port
    }
    finally {
        $listener.Stop()
    }
}

function Start-PicoDmxProcess {
    param(
        [string]$FilePath,
        [string[]]$ArgumentList = @(),
        [string]$WorkingDirectory = ""
    )

    $params = @{
        FilePath = $FilePath
        ArgumentList = $ArgumentList
        PassThru = $true
    }
    if ($WorkingDirectory) { $params.WorkingDirectory = $WorkingDirectory }
    if ($IsWindows) { $params.WindowStyle = "Hidden" }
    return Start-Process @params
}

function Test-PngPixelsEqual {
    param(
        [string]$Path,
        [byte[]]$Bytes,
        [int]$MaxDifferingPixels = 64
    )

    if (-not (Test-Path -LiteralPath $Path)) { return $false }

    try {
        Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
        Add-Type -AssemblyName System.Drawing.Common -ErrorAction SilentlyContinue
        Add-Type -AssemblyName System.Runtime.InteropServices -ErrorAction SilentlyContinue
        $existingSource = [System.Drawing.Bitmap]::new((Resolve-Path -LiteralPath $Path).Path)
        $stream = [System.IO.MemoryStream]::new($Bytes, $false)
        $candidateSource = [System.Drawing.Bitmap]::new($stream)
        try {
            if ($existingSource.Width -ne $candidateSource.Width -or $existingSource.Height -ne $candidateSource.Height) {
                return $false
            }

            $rect = [System.Drawing.Rectangle]::new(0, 0, $existingSource.Width, $existingSource.Height)
            $format = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
            $existing = $existingSource.Clone($rect, $format)
            $candidate = $candidateSource.Clone($rect, $format)
            try {
                $existingData = $existing.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $format)
                $candidateData = $candidate.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $format)
                try {
                    if ($existingData.Stride -ne $candidateData.Stride) { return $false }
                    $length = [Math]::Abs($existingData.Stride) * $existing.Height
                    $existingBytes = New-Object byte[] $length
                    $candidateBytes = New-Object byte[] $length
                    [System.Runtime.InteropServices.Marshal]::Copy($existingData.Scan0, $existingBytes, 0, $length)
                    [System.Runtime.InteropServices.Marshal]::Copy($candidateData.Scan0, $candidateBytes, 0, $length)
                    $differentPixels = 0
                    $stride = [Math]::Abs($existingData.Stride)
                    for ($y = 0; $y -lt $existing.Height; $y++) {
                        $rowOffset = $y * $stride
                        for ($x = 0; $x -lt $existing.Width; $x++) {
                            $offset = $rowOffset + ($x * 4)
                            if (
                                $existingBytes[$offset] -ne $candidateBytes[$offset] -or
                                $existingBytes[$offset + 1] -ne $candidateBytes[$offset + 1] -or
                                $existingBytes[$offset + 2] -ne $candidateBytes[$offset + 2] -or
                                $existingBytes[$offset + 3] -ne $candidateBytes[$offset + 3]
                            ) {
                                $differentPixels++
                                if ($differentPixels -gt $MaxDifferingPixels) {
                                    return $false
                                }
                            }
                        }
                    }
                }
                finally {
                    if ($existingData) { $existing.UnlockBits($existingData) }
                    if ($candidateData) { $candidate.UnlockBits($candidateData) }
                }
            }
            finally {
                $existing.Dispose()
                $candidate.Dispose()
            }
            return $true
        }
        finally {
            $candidateSource.Dispose()
            $stream.Dispose()
            $existingSource.Dispose()
        }
    }
    catch {
        return $false
    }
}

function Write-PngIfChanged {
    param(
        [string]$Path,
        [byte[]]$Bytes
    )

    if (Test-Path -LiteralPath $Path) {
        $existingBytes = [IO.File]::ReadAllBytes($Path)
        if ($existingBytes.Length -eq $Bytes.Length) {
            $sameBytes = $true
            for ($i = 0; $i -lt $Bytes.Length; $i++) {
                if ($existingBytes[$i] -ne $Bytes[$i]) {
                    $sameBytes = $false
                    break
                }
            }
            if ($sameBytes) {
                Write-Host "Unchanged $Path"
                return
            }
        }
    }

    if (Test-PngPixelsEqual -Path $Path -Bytes $Bytes) {
        Write-Host "Unchanged $Path"
        return
    }

    [IO.File]::WriteAllBytes($Path, $Bytes)
    Write-Host "Captured $Path"
}
