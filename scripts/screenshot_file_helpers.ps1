$ErrorActionPreference = "Stop"

function Test-PngPixelsEqual {
    param(
        [string]$Path,
        [byte[]]$Bytes
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
                    for ($i = 0; $i -lt $length; $i++) {
                        if ($existingBytes[$i] -ne $candidateBytes[$i]) { return $false }
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

    if (Test-PngPixelsEqual -Path $Path -Bytes $Bytes) {
        Write-Host "Unchanged $Path"
        return
    }

    [IO.File]::WriteAllBytes($Path, $Bytes)
    Write-Host "Captured $Path"
}
