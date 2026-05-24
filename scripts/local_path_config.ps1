function Get-LocalPathConfig {
    param(
        [string]$RepoRoot
    )

    $config = @{
        xamppHtdocs = "E:\Software\xampp\htdocs"
        appFolder = "dmx"
        baseUrl = "http://localhost/dmx/"
        chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    }

    $configPath = Join-Path $RepoRoot "config\local-paths.json"
    if (-not (Test-Path -LiteralPath $configPath)) {
        return $config
    }

    try {
        $local = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        foreach ($key in @("xamppHtdocs", "appFolder", "baseUrl", "chromePath")) {
            if ($local.PSObject.Properties.Name -contains $key) {
                $value = [string]$local.$key
                if ($value.Trim()) {
                    $config[$key] = [Environment]::ExpandEnvironmentVariables($value)
                }
            }
        }
    } catch {
        throw "Could not read local path config '$configPath': $($_.Exception.Message)"
    }

    return $config
}
