param(
    [Parameter(Mandatory = $true)]
    [ValidateRange(1024, 65535)]
    [int]$Port
)

$ErrorActionPreference = "Stop"
$listener = [System.Net.Sockets.TcpListener]::new(
    [System.Net.IPAddress]::Any,
    $Port
)

try {
    $listener.Start()
} catch {
    Write-Error "TCP port $Port is unavailable: $($_.Exception.Message)"
    exit 1
} finally {
    $listener.Stop()
}
