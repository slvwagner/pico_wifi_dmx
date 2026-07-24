param(
    [ValidateRange(1, 65535)][int]$Port = 8090
)

$url = "http://localhost:$Port/"
$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            break
        }
    } catch {
        Start-Sleep -Milliseconds 500
    }
}

$edge = Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"
if (Test-Path -LiteralPath $edge) {
    Start-Process -FilePath $edge -ArgumentList @("--app=$url", "--start-maximized")
} else {
    Start-Process $url
}
