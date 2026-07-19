param(
    [string]$ZipPath = "tools/fixture-library/ofl_export_ofl.zip",
    [string]$OutputPath = "web/assets/fixture-library.json",
    [string]$MetadataOutputPath = "",
    [switch]$MetadataOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$zipFile = if ([System.IO.Path]::IsPathRooted($ZipPath)) { $ZipPath } else { Join-Path $repoRoot $ZipPath }
$outFile = if ([System.IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $repoRoot $OutputPath }
$metadataOutFile = if (-not $MetadataOutputPath) { "" } elseif ([System.IO.Path]::IsPathRooted($MetadataOutputPath)) { $MetadataOutputPath } else { Join-Path $repoRoot $MetadataOutputPath }

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-Prop($obj, [string]$name) {
    if ($null -eq $obj) { return $null }
    return $obj.PSObject.Properties[$name].Value
}

function Get-Capabilities($channel) {
    if ($null -eq $channel) { return @() }
    $caps = Get-Prop $channel "capabilities"
    if ($caps) { return @($caps) }
    $cap = Get-Prop $channel "capability"
    if ($cap) { return @($cap) }
    return @()
}

function Get-CapType($channel) {
    $cap = @(Get-Capabilities $channel | Select-Object -First 1)
    if ($cap.Count) { return [string](Get-Prop $cap[0] "type") }
    return ""
}

function Get-CapColor($channel) {
    $cap = @(Get-Capabilities $channel | Select-Object -First 1)
    if ($cap.Count) { return [string](Get-Prop $cap[0] "color") }
    return ""
}

function New-FixtureMetadata($fixture) {
    $meta = Get-Prop $fixture "meta"
    $links = Get-Prop $fixture "links"
    $physical = Get-Prop $fixture "physical"
    $dimensions = @(Get-Prop $physical "dimensions")
    $bulb = Get-Prop $physical "bulb"
    $lens = Get-Prop $physical "lens"
    $degrees = @(Get-Prop $lens "degreesMinMax")

    $normalizedLinks = [ordered]@{}
    foreach ($name in @("manual", "productPage", "video")) {
        $values = @((Get-Prop $links $name) | Where-Object { $_ })
        if ($values.Count) { $normalizedLinks[$name] = $values }
    }

    $normalizedPhysical = [ordered]@{}
    if ($dimensions.Count -ge 3) {
        $normalizedPhysical["dimensionsMm"] = [ordered]@{
            width = $dimensions[0]
            height = $dimensions[1]
            depth = $dimensions[2]
        }
    }
    $weight = Get-Prop $physical "weight"
    if ($null -ne $weight) { $normalizedPhysical["weightKg"] = $weight }
    $power = Get-Prop $physical "power"
    if ($null -ne $power) { $normalizedPhysical["powerW"] = $power }
    $dmxConnector = [string](Get-Prop $physical "DMXconnector")
    if ($dmxConnector) { $normalizedPhysical["dmxConnector"] = $dmxConnector }
    $lightSource = [string](Get-Prop $bulb "type")
    if ($lightSource) { $normalizedPhysical["lightSource"] = $lightSource }
    if ($degrees.Count -ge 2) {
        $normalizedPhysical["beamAngleDegrees"] = [ordered]@{
            min = $degrees[0]
            max = $degrees[1]
        }
    }

    $metadata = [ordered]@{ source = "ofl" }
    $sourceUrl = [string](Get-Prop $fixture "oflURL")
    if ($sourceUrl) { $metadata["sourceUrl"] = $sourceUrl }
    $authors = @((Get-Prop $meta "authors") | Where-Object { $_ })
    if ($authors.Count) { $metadata["authors"] = $authors }
    $createDate = [string](Get-Prop $meta "createDate")
    if ($createDate) { $metadata["createDate"] = $createDate }
    $lastModifyDate = [string](Get-Prop $meta "lastModifyDate")
    if ($lastModifyDate) { $metadata["lastModifyDate"] = $lastModifyDate }
    if ($normalizedLinks.Count) { $metadata["links"] = $normalizedLinks }
    if ($normalizedPhysical.Count) { $metadata["physical"] = $normalizedPhysical }
    return $metadata
}

function Flatten-PixelKeys($value, [System.Collections.Generic.List[string]]$out) {
    if ($null -eq $value) { return }
    if ($value -is [string]) { $out.Add($value); return }
    if ($value -is [System.Collections.IEnumerable]) {
        foreach ($item in $value) { Flatten-PixelKeys $item $out }
    }
}

function Get-PixelKeys($fixture) {
    $list = [System.Collections.Generic.List[string]]::new()
    $matrix = Get-Prop $fixture "matrix"
    Flatten-PixelKeys (Get-Prop $matrix "pixelKeys") $list
    return @($list)
}

function Expand-ModeChannels($fixture, $mode) {
    $expanded = [System.Collections.Generic.List[object]]::new()
    $channels = @(Get-Prop $mode "channels")
    $pixelKeys = Get-PixelKeys $fixture
    foreach ($channel in $channels) {
        if ($channel -is [string] -or $null -eq $channel) {
            $expanded.Add($channel)
            continue
        }
        $insert = [string](Get-Prop $channel "insert")
        if ($insert -eq "matrixChannels") {
            $templates = @(Get-Prop $channel "templateChannels")
            if ($templates.Count -and $pixelKeys.Count) {
                foreach ($pixelKey in $pixelKeys) {
                    foreach ($template in $templates) {
                        $expanded.Add(([string]$template).Replace('$pixelKey', $pixelKey))
                    }
                }
            }
        }
    }
    return @($expanded)
}

function Channel-Map($channels) {
    $map = @{}
    for ($i = 0; $i -lt $channels.Count; $i++) {
        $name = $channels[$i]
        if ($name -is [string] -and -not $map.ContainsKey($name)) { $map[$name] = $i + 1 }
    }
    return $map
}

function New-Control($id, $type, $label, $props = @{}) {
    $obj = [ordered]@{ id = $id; type = $type; label = $label }
    foreach ($key in $props.Keys) { $obj[$key] = $props[$key] }
    return $obj
}

function Get-WheelSlot($fixture, [string]$wheelName, [int]$slotNumber) {
    if (-not $wheelName -or $slotNumber -lt 1) { return $null }
    $wheels = Get-Prop $fixture "wheels"
    $wheel = Get-Prop $wheels $wheelName
    $slots = @(Get-Prop $wheel "slots")
    if (-not $slots.Count) { return $null }
    $index = ($slotNumber - 1) % $slots.Count
    if ($index -lt 0) { $index += $slots.Count }
    return $slots[$index]
}

function Get-WheelSlotLabel($fixture, [string]$wheelName, [int]$slotNumber) {
    $slot = Get-WheelSlot $fixture $wheelName $slotNumber
    $name = [string](Get-Prop $slot "name")
    if ($name) { return $name }
    $type = [string](Get-Prop $slot "type")
    if ($type -eq "Open") { return "Open" }
    if ($type) { return "$type $slotNumber" }
    return "Slot $slotNumber"
}

function Get-WheelSlotColor($fixture, [string]$wheelName, [int]$slotNumber) {
    $slot = Get-WheelSlot $fixture $wheelName $slotNumber
    $colors = @(Get-Prop $slot "colors")
    if ($colors.Count) { return [string]$colors[0] }
    return ""
}

function New-WheelOptionName($fixture, [string]$wheelName, $cap, [string]$capType) {
    $comment = [string](Get-Prop $cap "comment")
    if ($comment) { return $comment }
    $effectName = [string](Get-Prop $cap "effectName")
    if ($effectName) { return $effectName }
    $shutterEffect = [string](Get-Prop $cap "shutterEffect")
    if ($shutterEffect) { return $shutterEffect }

    $slotNumber = [int](Get-Prop $cap "slotNumber")
    $slotStart = [int](Get-Prop $cap "slotNumberStart")
    $slotEnd = [int](Get-Prop $cap "slotNumberEnd")
    if ($capType -eq "WheelSlot" -and $slotNumber) {
        return Get-WheelSlotLabel $fixture $wheelName $slotNumber
    }
    if ($capType -eq "WheelSlot" -and $slotStart -and $slotEnd) {
        return (Get-WheelSlotLabel $fixture $wheelName $slotStart) + " / " + (Get-WheelSlotLabel $fixture $wheelName $slotEnd)
    }
    if ($capType -eq "WheelShake" -and $slotNumber) {
        return (Get-WheelSlotLabel $fixture $wheelName $slotNumber) + " shake"
    }
    if ($capType -eq "WheelSlotRotation" -and $slotNumber) {
        return (Get-WheelSlotLabel $fixture $wheelName $slotNumber) + " rotation"
    }
    if ($capType -eq "WheelRotation") {
        $start = [string](Get-Prop $cap "speedStart")
        $end = [string](Get-Prop $cap "speedEnd")
        if ($start -or $end) {
            if ($start -and $end) { return "Rotation $start to $end" }
            if ($start) { return "Rotation $start" }
            return "Rotation $end"
        }
        return "Wheel rotation"
    }

    $name = [string](Get-Prop $cap "name")
    if ($name) { return $name }
    if ($capType) { return $capType }
    return ""
}

function New-WheelOptions($fixture, $channel, [string]$wheelName) {
    $options = [System.Collections.Generic.List[object]]::new()
    $seen = @{}
    foreach ($cap in Get-Capabilities $channel) {
        $range = @(Get-Prop $cap "dmxRange")
        if (-not $range.Count) { continue }
        $start = [int]$range[0]
        $end = if ($range.Count -gt 1) { [int]$range[1] } else { $start }
        $value = [int][Math]::Round(($start + $end) / 2, [System.MidpointRounding]::AwayFromZero)
        if ($seen.ContainsKey($value)) { continue }
        $seen[$value] = $true
        $capType = [string](Get-Prop $cap "type")
        $name = New-WheelOptionName $fixture $wheelName $cap $capType
        if (-not $name) { $name = "Value $value" }
        $option = [ordered]@{
            name = $name
            value = $value
            range = @($start, $end)
            kind = $capType
        }
        $slotNumber = [int](Get-Prop $cap "slotNumber")
        $slotStart = [int](Get-Prop $cap "slotNumberStart")
        $slotEnd = [int](Get-Prop $cap "slotNumberEnd")
        if ($slotNumber) { $option["slotNumber"] = $slotNumber }
        if ($slotStart) { $option["slotNumberStart"] = $slotStart }
        if ($slotEnd) { $option["slotNumberEnd"] = $slotEnd }
        $color = ""
        $colors = @(Get-Prop $cap "colors")
        if ($colors.Count) { $color = [string]$colors[0] }
        if (-not $color -and $slotNumber) { $color = Get-WheelSlotColor $fixture $wheelName $slotNumber }
        if ($color) { $option["color"] = $color }
        foreach ($speedProp in @("speedStart","speedEnd","shakeSpeedStart","shakeSpeedEnd")) {
            $speed = [string](Get-Prop $cap $speedProp)
            if ($speed) { $option[$speedProp] = $speed }
        }
        $options.Add($option)
    }
    if (-not $options.Count) { $options.Add([ordered]@{ name = "Open"; value = 0 }) }
    return @($options)
}

function Convert-Mode($fixture, $manufacturerName, $mode, $available) {
    $channels = @(Expand-ModeChannels $fixture $mode)
    $channelMap = Channel-Map $channels
    $used = @{}
    $controls = [System.Collections.Generic.List[object]]::new()
    $warnings = [System.Collections.Generic.List[string]]::new()
    $nextId = 1

    $channelNames = @($channels | Where-Object { $_ -is [string] })

    foreach ($name in $channelNames) {
        if ($used[$name]) { continue }
        $channel = $available[$name]
        if ((Get-CapType $channel) -ne "Pan") { continue }
        $tiltName = $channelNames | Where-Object { -not $used[$_] -and (Get-CapType $available[$_]) -eq "Tilt" } | Select-Object -First 1
        if (-not $tiltName) { continue }
        $panFine = @((Get-Prop $channel "fineChannelAliases") | Where-Object { $_ -and $channelMap.ContainsKey($_) } | Select-Object -First 1)
        $tiltFine = @((Get-Prop $available[$tiltName] "fineChannelAliases") | Where-Object { $_ -and $channelMap.ContainsKey($_) } | Select-Object -First 1)
        if ($panFine.Count -and $tiltFine.Count) {
            $controls.Add((New-Control $nextId "panTilt16" "Pan/Tilt" @{
                pan = $channelMap[$name]; panFine = $channelMap[$panFine[0]];
                tilt = $channelMap[$tiltName]; tiltFine = $channelMap[$tiltFine[0]]
            }))
            $used[$panFine[0]] = $true; $used[$tiltFine[0]] = $true
        } else {
            $controls.Add((New-Control $nextId "panTilt8" "Pan/Tilt" @{
                pan = $channelMap[$name]; tilt = $channelMap[$tiltName]
            }))
        }
        $nextId++
        $used[$name] = $true; $used[$tiltName] = $true
    }

    $colors = @{}
    foreach ($name in $channelNames) {
        if ($used[$name]) { continue }
        $channel = $available[$name]
        if ((Get-CapType $channel) -eq "ColorIntensity") {
            $color = (Get-CapColor $channel).ToLowerInvariant()
            if ($color) { $colors[$color] = $name }
        }
    }
    if ($colors.ContainsKey("red") -and $colors.ContainsKey("green") -and $colors.ContainsKey("blue")) {
        $props = @{
            a = $channelMap[$colors["red"]]
            b = $channelMap[$colors["green"]]
            c = $channelMap[$colors["blue"]]
        }
        $type = "rgb"
        if ($colors.ContainsKey("white")) { $type = "rgbw"; $props["w"] = $channelMap[$colors["white"]] }
        if ($colors.ContainsKey("white") -and $colors.ContainsKey("amber")) { $type = "rgbwa"; $props["amber"] = $channelMap[$colors["amber"]] }
        $controls.Add((New-Control $nextId $type "Color" $props))
        $nextId++
        foreach ($key in @("red","green","blue","white","amber")) { if ($colors.ContainsKey($key)) { $used[$colors[$key]] = $true } }
    }

    foreach ($name in $channelNames) {
        if ($used[$name]) { continue }
        $channel = $available[$name]
        $capType = Get-CapType $channel
        $label = $name -replace '\s+', ' '
        if ($capType -eq "WheelSlot" -or $label -match '(?i)\b(wheel|gobo|macro|preset)\b') {
            $controls.Add((New-Control $nextId "wheel" $label @{
                channel = $channelMap[$name]
                options = @(New-WheelOptions $fixture $channel $label)
            }))
        } else {
            $controls.Add((New-Control $nextId "slider8" $label @{ channel = $channelMap[$name] }))
        }
        $nextId++
        $used[$name] = $true
    }

    if (-not $controls.Count) { $warnings.Add("No supported controls were found for this mode.") }
    return [ordered]@{
        name = [string](Get-Prop $mode "name")
        shortName = [string](Get-Prop $mode "shortName")
        channels = $channels.Count
        profile = [ordered]@{
            name = ([string](Get-Prop $fixture "name"))
            mode = [string](Get-Prop $mode "name")
            channels = $channels.Count
            controls = @($controls)
            library = [ordered]@{ source = "ofl"; manufacturer = $manufacturerName }
        }
        warnings = @($warnings)
    }
}

if (-not (Test-Path -LiteralPath $zipFile)) { throw "Fixture library zip not found: $zipFile" }

$zip = [System.IO.Compression.ZipFile]::OpenRead($zipFile)
try {
    $manufacturers = @{}
    $manEntry = $zip.GetEntry("manufacturers.json")
    if ($manEntry) {
        $reader = [System.IO.StreamReader]::new($manEntry.Open())
        $manJson = $reader.ReadToEnd() | ConvertFrom-Json
        $reader.Close()
        foreach ($prop in $manJson.PSObject.Properties) {
            $manufacturers[$prop.Name] = [string](Get-Prop $prop.Value "name")
        }
    }

    $fixtures = [System.Collections.Generic.List[object]]::new()
    foreach ($entry in ($zip.Entries | Where-Object { $_.FullName -like "*.json" -and $_.FullName -ne "manufacturers.json" } | Sort-Object FullName)) {
        $reader = [System.IO.StreamReader]::new($entry.Open())
        $text = $reader.ReadToEnd()
        $reader.Close()
        try { $fixture = $text | ConvertFrom-Json } catch { continue }
        $parts = $entry.FullName -split '/'
        if ($parts.Count -lt 2) { continue }
        $manufacturerKey = $parts[0]
        $fixtureKey = [System.IO.Path]::GetFileNameWithoutExtension($parts[-1])
        $manufacturerName = if ($manufacturers.ContainsKey($manufacturerKey)) { $manufacturers[$manufacturerKey] } else { $manufacturerKey }
        $available = @{}
        $availableChannels = Get-Prop $fixture "availableChannels"
        if ($availableChannels) {
            foreach ($prop in $availableChannels.PSObject.Properties) { $available[$prop.Name] = $prop.Value }
        }
        $modes = [System.Collections.Generic.List[object]]::new()
        foreach ($mode in @(Get-Prop $fixture "modes")) {
            $modes.Add((Convert-Mode $fixture $manufacturerName $mode $available))
        }
        if ($modes.Count) {
            $fixtures.Add([ordered]@{
                key = "$manufacturerKey/$fixtureKey"
                manufacturerKey = $manufacturerKey
                manufacturerName = $manufacturerName
                name = [string](Get-Prop $fixture "name")
                categories = @(Get-Prop $fixture "categories")
                metadata = New-FixtureMetadata $fixture
                modes = @($modes)
            })
        }
    }

    $payload = [ordered]@{
        schemaVersion = 1
        source = "Open Fixture Library export"
        generatedAt = (Get-Date).ToUniversalTime().ToString("s") + "Z"
        fixtureCount = $fixtures.Count
        fixtures = @($fixtures)
    }
    if ($metadataOutFile) {
        $metadataPayload = [ordered]@{
            schemaVersion = 1
            source = "Open Fixture Library metadata"
            generatedAt = (Get-Date).ToUniversalTime().ToString("s") + "Z"
            fixtureCount = $fixtures.Count
            fixtures = @($fixtures | ForEach-Object {
                [ordered]@{ key = $_.key; metadata = $_.metadata }
            })
        }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $metadataOutFile) | Out-Null
        $metadataPayload | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $metadataOutFile -Encoding UTF8
        Write-Host "Wrote metadata for $($fixtures.Count) fixtures to $metadataOutFile"
    }
    if ($MetadataOnly) {
        if (-not (Test-Path -LiteralPath $outFile)) {
            throw "Metadata-only merge requires an existing fixture library: $outFile"
        }
        $existingLibrary = Get-Content -LiteralPath $outFile -Raw | ConvertFrom-Json
        if ($null -eq $existingLibrary -or -not ($existingLibrary.PSObject.Properties.Name -contains "fixtures")) {
            throw "Existing fixture library is invalid: $outFile"
        }
        $metadataByKey = @{}
        foreach ($convertedFixture in $fixtures) {
            $metadataByKey[[string]$convertedFixture.key] = $convertedFixture.metadata
        }
        $updatedCount = 0
        foreach ($existingFixture in @($existingLibrary.fixtures)) {
            $key = [string]$existingFixture.key
            if (-not $metadataByKey.ContainsKey($key)) { continue }
            $existingFixture | Add-Member -NotePropertyName metadata -NotePropertyValue $metadataByKey[$key] -Force
            $updatedCount++
        }
        $existingLibrary.fixtureCount = @($existingLibrary.fixtures).Count
        $existingLibrary.generatedAt = (Get-Date).ToUniversalTime().ToString("s") + "Z"
        $payload = $existingLibrary
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outFile) | Out-Null
    $payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $outFile -Encoding UTF8
    if ($MetadataOnly) {
        Write-Host "Added metadata to $updatedCount of $(@($payload.fixtures).Count) existing fixtures in $outFile"
    } else {
        Write-Host "Wrote $($fixtures.Count) fixtures to $outFile"
    }
}
finally {
    $zip.Dispose()
}
