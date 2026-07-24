param(
    [Parameter(Mandatory = $true)]
    [ValidateRange(1024, 65535)]
    [int]$Port,

    [Parameter(Mandatory = $true)]
    [string]$InfoPath,

    [int]$ExpectedProcessId = 0,

    [switch]$Stop
)

$ErrorActionPreference = "Stop"
$ownServiceName = "PicoDmxController"

function Get-PortOwner {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Sort-Object OwningProcess |
        Select-Object -First 1
}

$connection = Get-PortOwner
if (-not $connection) {
    Remove-Item -LiteralPath $InfoPath -Force -ErrorAction SilentlyContinue
    exit 0
}

$ownerProcessId = [int]$connection.OwningProcess
$process = Get-Process -Id $ownerProcessId -ErrorAction SilentlyContinue
$processName = if ($process) { $process.ProcessName } else { "Unknown process" }
$service = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue |
    Where-Object { [int]$_.ProcessId -eq $ownerProcessId } |
    Select-Object -First 1
$serviceName = if ($service) { [string]$service.Name } else { "" }

$safeProcessName = $processName.Replace("`r", " ").Replace("`n", " ")
$safeServiceName = $serviceName.Replace("`r", " ").Replace("`n", " ")
@"
[Owner]
ProcessId=$ownerProcessId
ProcessName=$safeProcessName
ServiceName=$safeServiceName
"@ | Set-Content -LiteralPath $InfoPath -Encoding Unicode

if (-not $Stop) {
    exit 10
}

if ($ExpectedProcessId -le 0 -or $ownerProcessId -ne $ExpectedProcessId) {
    Write-Error "The owner of TCP port $Port changed before it could be stopped."
    exit 3
}

if ($serviceName) {
    if ($serviceName -ne $ownServiceName) {
        Write-Error "TCP port $Port belongs to Windows service '$serviceName', which this installer will not stop."
        exit 4
    }
    Stop-Service -Name $ownServiceName -Force -ErrorAction Stop
} else {
    if ($ownerProcessId -le 4 -or $processName -in @("System", "Registry", "Idle")) {
        Write-Error "TCP port $Port belongs to protected process '$processName'."
        exit 5
    }
    Stop-Process -Id $ownerProcessId -Force -ErrorAction Stop
}

for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 100
    if (-not (Get-PortOwner)) {
        exit 0
    }
}

Write-Error "TCP port $Port is still in use after stopping '$processName'."
exit 6
