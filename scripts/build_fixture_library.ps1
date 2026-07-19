param(
    [string]$ZipPath = "tools/fixture-library/ofl_export_ofl.zip",
    [string]$OutputPath = "web/assets/fixture-library.json",
    [string]$MetadataOutputPath = "",
    [string]$CapabilitiesOutputPath = "",
    [switch]$MetadataOnly,
    [switch]$CapabilitiesOnly,
    [switch]$SidecarsOnly,
    [ValidateRange(0, 64)][int]$ThrottleLimit = 0
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$zipFile = if ([System.IO.Path]::IsPathRooted($ZipPath)) { $ZipPath } else { Join-Path $repoRoot $ZipPath }
$outFile = if ([System.IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $repoRoot $OutputPath }
$metadataOutFile = if (-not $MetadataOutputPath) { "" } elseif ([System.IO.Path]::IsPathRooted($MetadataOutputPath)) { $MetadataOutputPath } else { Join-Path $repoRoot $MetadataOutputPath }
$capabilitiesOutFile = if (-not $CapabilitiesOutputPath) { "" } elseif ([System.IO.Path]::IsPathRooted($CapabilitiesOutputPath)) { $CapabilitiesOutputPath } else { Join-Path $repoRoot $CapabilitiesOutputPath }
$effectiveThrottleLimit = if ($ThrottleLimit -gt 0) { $ThrottleLimit } else { [Math]::Max(2, [Math]::Min([Environment]::ProcessorCount, 16)) }
if ($SidecarsOnly -and ($MetadataOnly -or $CapabilitiesOnly)) { throw "SidecarsOnly cannot be combined with MetadataOnly or CapabilitiesOnly." }
if ($SidecarsOnly -and -not $metadataOutFile -and -not $capabilitiesOutFile) { throw "SidecarsOnly requires MetadataOutputPath or CapabilitiesOutputPath." }

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

function New-NormalizedCapabilities($channel) {
    $normalized = [System.Collections.Generic.List[object]]::new()
    foreach ($cap in Get-Capabilities $channel) {
        $item = [ordered]@{}
        foreach ($name in @(
            "type", "dmxRange", "comment", "effectName", "shutterEffect", "color", "colors",
            "speedStart", "speedEnd", "shakeSpeedStart", "shakeSpeedEnd",
            "durationStart", "durationEnd", "angleStart", "angleEnd",
            "distanceStart", "distanceEnd", "percentStart", "percentEnd",
            "slotNumber", "slotNumberStart", "slotNumberEnd"
        )) {
            $value = Get-Prop $cap $name
            if ($null -eq $value) { continue }
            if ($value -is [string] -and -not $value) { continue }
            $item[$name] = $value
        }
        if ($item.Count) { $normalized.Add($item) }
    }
    return @($normalized)
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

function Get-DmxValueByteResolution($channel) {
    $declared = [string](Get-Prop $channel "dmxValueResolution")
    if ($declared -match '^(\d+)bit$') { return [Math]::Max(1, [int]$Matches[1] / 8) }
    return 1 + @((Get-Prop $channel "fineChannelAliases") | Where-Object { $_ }).Count
}

function Convert-DmxValue($channel, $value, [int]$targetBytes) {
    if ($null -eq $value) { return $null }
    $targetBytes = [Math]::Max(1, [Math]::Min($targetBytes, 4))
    $targetMax = [Math]::Pow(256, $targetBytes) - 1
    if ($value -is [string] -and $value.Trim() -match '^(-?\d+(?:\.\d+)?)%$') {
        return [int][Math]::Round(([double]$Matches[1] / 100) * $targetMax, [MidpointRounding]::AwayFromZero)
    }
    $sourceBytes = Get-DmxValueByteResolution $channel
    $sourceMax = [Math]::Pow(256, $sourceBytes) - 1
    $numeric = [double]$value
    $scaled = if ($sourceMax -eq $targetMax) { $numeric } else { ($numeric / $sourceMax) * $targetMax }
    return [int][Math]::Round([Math]::Max(0, [Math]::Min($targetMax, $scaled)), [MidpointRounding]::AwayFromZero)
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
        foreach ($detailProp in @("comment","effectName","shutterEffect","durationStart","durationEnd","angleStart","angleEnd","distanceStart","distanceEnd","percentStart","percentEnd")) {
            $detail = Get-Prop $cap $detailProp
            if ($null -ne $detail -and (-not ($detail -is [string]) -or $detail)) { $option[$detailProp] = $detail }
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
            $props = @{
                pan = $channelMap[$name]; panFine = $channelMap[$panFine[0]];
                tilt = $channelMap[$tiltName]; tiltFine = $channelMap[$tiltFine[0]]
            }
            $panDefault = Convert-DmxValue $channel (Get-Prop $channel "defaultValue") 2
            $tiltDefault = Convert-DmxValue $available[$tiltName] (Get-Prop $available[$tiltName] "defaultValue") 2
            if ($null -ne $panDefault -or $null -ne $tiltDefault) {
                $props["defaultValue"] = @{
                    pan = if ($null -ne $panDefault) { $panDefault } else { 0 }
                    tilt = if ($null -ne $tiltDefault) { $tiltDefault } else { 0 }
                }
            }
            $controls.Add((New-Control $nextId "panTilt16" "Pan/Tilt" $props))
            $used[$panFine[0]] = $true; $used[$tiltFine[0]] = $true
        } else {
            $props = @{
                pan = $channelMap[$name]; tilt = $channelMap[$tiltName]
            }
            $panDefault = Convert-DmxValue $channel (Get-Prop $channel "defaultValue") 1
            $tiltDefault = Convert-DmxValue $available[$tiltName] (Get-Prop $available[$tiltName] "defaultValue") 1
            if ($null -ne $panDefault -or $null -ne $tiltDefault) {
                $props["defaultValue"] = @{
                    pan = if ($null -ne $panDefault) { $panDefault } else { 0 }
                    tilt = if ($null -ne $tiltDefault) { $tiltDefault } else { 0 }
                }
            }
            $controls.Add((New-Control $nextId "panTilt8" "Pan/Tilt" $props))
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
        $colorDefaults = [ordered]@{}
        foreach ($component in @(@("red", "a"), @("green", "b"), @("blue", "c"), @("white", "w"), @("amber", "amber"))) {
            if (-not $colors.ContainsKey($component[0])) { continue }
            $colorChannel = $available[$colors[$component[0]]]
            $componentDefault = Convert-DmxValue $colorChannel (Get-Prop $colorChannel "defaultValue") 1
            if ($null -ne $componentDefault) { $colorDefaults[$component[1]] = $componentDefault }
        }
        if ($colorDefaults.Count) { $props["defaultValue"] = $colorDefaults }
        $controls.Add((New-Control $nextId $type "Color" $props))
        $nextId++
        foreach ($key in @("red","green","blue","white","amber")) { if ($colors.ContainsKey($key)) { $used[$colors[$key]] = $true } }
    }

    foreach ($name in $channelNames) {
        if ($used[$name]) { continue }
        $channel = $available[$name]
        $capType = Get-CapType $channel
        $capabilities = @(New-NormalizedCapabilities $channel)
        $label = $name -replace '\s+', ' '
        $segmentedCapabilities = $capabilities.Count -gt 1 -and @($capabilities | Where-Object { @($_.dmxRange).Count -gt 0 }).Count -eq $capabilities.Count
        $isOptionControl = $capType -eq "WheelSlot" -or $segmentedCapabilities -or $label -match '(?i)\b(wheel|gobo|macro|preset)\b'
        $fineAlias = @((Get-Prop $channel "fineChannelAliases") | Where-Object { $_ -and $channelMap.ContainsKey($_) -and -not $used[$_] } | Select-Object -First 1)
        if ($fineAlias.Count -and -not $isOptionControl) {
            $props = @{
                channel = $channelMap[$name]
                fine = $channelMap[$fineAlias[0]]
                capabilities = $capabilities
            }
            $defaultValue = Convert-DmxValue $channel (Get-Prop $channel "defaultValue") 2
            if ($null -ne $defaultValue) { $props["defaultValue"] = $defaultValue }
            $controls.Add((New-Control $nextId "slider16" $label $props))
            $used[$fineAlias[0]] = $true
        } elseif ($isOptionControl) {
            $props = @{
                channel = $channelMap[$name]
                options = @(New-WheelOptions $fixture $channel $label)
                capabilities = $capabilities
            }
            $defaultValue = Convert-DmxValue $channel (Get-Prop $channel "defaultValue") 1
            if ($null -ne $defaultValue) { $props["defaultValue"] = $defaultValue }
            $controls.Add((New-Control $nextId "wheel" $label $props))
        } else {
            $props = @{ channel = $channelMap[$name]; capabilities = $capabilities }
            $defaultValue = Convert-DmxValue $channel (Get-Prop $channel "defaultValue") 1
            if ($null -ne $defaultValue) { $props["defaultValue"] = $defaultValue }
            $controls.Add((New-Control $nextId "slider8" $label $props))
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

function Convert-FixtureDocument([string]$entryName, [string]$text, $manufacturers) {
    try { $fixture = $text | ConvertFrom-Json } catch { return $null }
    $parts = $entryName -split '/'
    if ($parts.Count -lt 2) { return $null }
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
    if (-not $modes.Count) { return $null }
    return [ordered]@{
        key = "$manufacturerKey/$fixtureKey"
        manufacturerKey = $manufacturerKey
        manufacturerName = $manufacturerName
        name = [string](Get-Prop $fixture "name")
        categories = @(Get-Prop $fixture "categories")
        metadata = New-FixtureMetadata $fixture
        modes = @($modes)
    }
}

if (-not (Test-Path -LiteralPath $zipFile)) { throw "Fixture library zip not found: $zipFile" }

$extractRoot = ""
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

    $extractRoot = Join-Path ([IO.Path]::GetTempPath()) ("pico-dmx-fixture-build-" + [Guid]::NewGuid().ToString("N"))
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zipFile, $extractRoot)
    $jsonFiles = @(Get-ChildItem -LiteralPath $extractRoot -Recurse -File -Filter "*.json" | Where-Object { $_.Name -ne "manufacturers.json" } | Sort-Object FullName)
    $functionNames = @(
        "Get-Prop", "Get-Capabilities", "Get-CapType", "Get-CapColor", "New-NormalizedCapabilities",
        "New-FixtureMetadata", "Flatten-PixelKeys", "Get-PixelKeys", "Expand-ModeChannels", "Channel-Map",
        "Get-DmxValueByteResolution", "Convert-DmxValue",
        "New-Control", "Get-WheelSlot", "Get-WheelSlotLabel", "Get-WheelSlotColor", "New-WheelOptionName",
        "New-WheelOptions", "Convert-Mode", "Convert-FixtureDocument"
    )
    $functionSource = ($functionNames | ForEach-Object { "function $_ {`n$((Get-Command $_ -CommandType Function).Definition)`n}" }) -join "`n"
    if ($PSVersionTable.PSVersion.Major -ge 7 -and $effectiveThrottleLimit -gt 1) {
        $convertedFixtures = @($jsonFiles | ForEach-Object -Parallel {
            if (-not (Get-Command Convert-FixtureDocument -ErrorAction SilentlyContinue)) {
                Invoke-Expression $using:functionSource
            }
            $relative = [IO.Path]::GetRelativePath($using:extractRoot, $_.FullName).Replace('\', '/')
            Convert-FixtureDocument $relative ([IO.File]::ReadAllText($_.FullName)) $using:manufacturers
        } -ThrottleLimit $effectiveThrottleLimit)
    } else {
        $convertedFixtures = @($jsonFiles | ForEach-Object {
            $relative = [IO.Path]::GetRelativePath($extractRoot, $_.FullName).Replace('\', '/')
            Convert-FixtureDocument $relative ([IO.File]::ReadAllText($_.FullName)) $manufacturers
        })
    }
    $fixtures = @($convertedFixtures | Where-Object { $null -ne $_ } | Sort-Object {
        if ($_ -is [System.Collections.IDictionary]) { [string]$_['key'] } else { [string]$_.key }
    })

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
    $capabilityFixtures = @($fixtures | ForEach-Object {
        $controlPatchesByLabel = [ordered]@{}
        foreach ($convertedMode in @($_.modes)) {
            foreach ($convertedControl in @($convertedMode.profile.controls)) {
                $capabilityValues = @($convertedControl.capabilities | Where-Object { $null -ne $_ })
                if (-not $capabilityValues.Count) { continue }
                $labelText = [string]$convertedControl.label
                $isCapabilityDrivenWheel = $convertedControl.type -eq "wheel" -and $capabilityValues.Count -gt 1 -and $labelText -notmatch '(?i)\b(wheel|gobo|macro|preset)\b'
                $isCapabilitySlider = $convertedControl.type -eq "slider8"
                if (-not $isCapabilityDrivenWheel -and -not $isCapabilitySlider) { continue }
                $labelKey = ([string]$convertedControl.label).Trim().ToLowerInvariant()
                if (-not $labelKey) { continue }
                $patch = [ordered]@{
                    type = $convertedControl.type
                    label = $convertedControl.label
                    capabilities = $capabilityValues
                }
                if ($convertedControl.type -eq "wheel") { $patch["options"] = @($convertedControl.options) }
                if (-not $controlPatchesByLabel.Contains($labelKey) -or $convertedControl.type -eq "wheel") {
                    $controlPatchesByLabel[$labelKey] = $patch
                }
            }
        }
        if ($controlPatchesByLabel.Count) { [ordered]@{ key = $_.key; controls = @($controlPatchesByLabel.Values) } }
    })
    if ($capabilitiesOutFile) {
        $capabilitiesPayload = [ordered]@{
            schemaVersion = 1
            source = "Open Fixture Library capabilities"
            generatedAt = (Get-Date).ToUniversalTime().ToString("s") + "Z"
            fixtureCount = $capabilityFixtures.Count
            fixtures = $capabilityFixtures
        }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $capabilitiesOutFile) | Out-Null
        $capabilitiesPayload | ConvertTo-Json -Depth 40 -Compress | Set-Content -LiteralPath $capabilitiesOutFile -Encoding UTF8
        Write-Host "Wrote capabilities for $($capabilityFixtures.Count) fixtures to $capabilitiesOutFile"
    }
    if ($MetadataOnly -or $CapabilitiesOnly) {
        if (-not (Test-Path -LiteralPath $outFile)) {
            throw "Enrichment-only merge requires an existing fixture library: $outFile"
        }
        $existingLibrary = Get-Content -LiteralPath $outFile -Raw | ConvertFrom-Json
        if ($null -eq $existingLibrary -or -not ($existingLibrary.PSObject.Properties.Name -contains "fixtures")) {
            throw "Existing fixture library is invalid: $outFile"
        }
        $updatedCount = 0
        if ($MetadataOnly) {
            $metadataByKey = @{}
            foreach ($convertedFixture in $fixtures) { $metadataByKey[[string]$convertedFixture.key] = $convertedFixture.metadata }
            foreach ($existingFixture in @($existingLibrary.fixtures)) {
                $key = [string]$existingFixture.key
                if (-not $metadataByKey.ContainsKey($key)) { continue }
                $existingFixture | Add-Member -NotePropertyName metadata -NotePropertyValue $metadataByKey[$key] -Force
                $updatedCount++
            }
        }
        $capabilityControlCount = 0
        if ($CapabilitiesOnly) {
            $capabilityByKey = @{}
            foreach ($capabilityFixture in $capabilityFixtures) { $capabilityByKey[[string]$capabilityFixture.key] = $capabilityFixture }
            foreach ($existingFixture in @($existingLibrary.fixtures)) {
                $fixturePatch = $capabilityByKey[[string]$existingFixture.key]
                if ($null -eq $fixturePatch) { continue }
                foreach ($existingMode in @($existingFixture.modes)) {
                    foreach ($controlPatch in @($fixturePatch.controls)) {
                        $existingControl = @($existingMode.profile.controls | Where-Object { [string]$_.label -eq [string]$controlPatch.label } | Select-Object -First 1)
                        if (-not $existingControl.Count) { continue }
                        $targetControl = $existingControl[0]
                        $targetControl | Add-Member -NotePropertyName capabilities -NotePropertyValue @($controlPatch.capabilities) -Force
                        if ([string]$targetControl.type -eq "slider8" -and [string]$controlPatch.type -eq "wheel") {
                            $targetControl.type = "wheel"
                            $targetControl | Add-Member -NotePropertyName options -NotePropertyValue @($controlPatch.options) -Force
                        }
                        $capabilityControlCount++
                    }
                }
            }
        }
        $existingLibrary.fixtureCount = @($existingLibrary.fixtures).Count
        $existingLibrary.generatedAt = (Get-Date).ToUniversalTime().ToString("s") + "Z"
        $payload = $existingLibrary
    }
    if (-not $SidecarsOnly) {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outFile) | Out-Null
        $payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $outFile -Encoding UTF8
    }
    if ($MetadataOnly) {
        Write-Host "Added metadata to $updatedCount of $(@($payload.fixtures).Count) existing fixtures in $outFile"
    }
    if ($CapabilitiesOnly) {
        Write-Host "Added capabilities to $capabilityControlCount existing controls in $outFile"
    }
    if ($SidecarsOnly) {
        Write-Host "Sidecar build complete; fixture library output was not changed."
    } elseif (-not $MetadataOnly -and -not $CapabilitiesOnly) {
        Write-Host "Wrote $($fixtures.Count) fixtures to $outFile"
    }
}
finally {
    $zip.Dispose()
    if ($extractRoot) {
        $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
        $resolvedExtractRoot = [IO.Path]::GetFullPath($extractRoot)
        if ($resolvedExtractRoot.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolvedExtractRoot).StartsWith("pico-dmx-fixture-build-")) {
            Remove-Item -LiteralPath $resolvedExtractRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}
