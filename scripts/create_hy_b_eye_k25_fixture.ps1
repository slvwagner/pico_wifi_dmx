param(
    [string]$OutputPath = "tools/fixture-library/custom/clay-paky-hy-b-eye-k25.json"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$outFile = if ([IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $repoRoot $OutputPath }
$capabilityFile = Join-Path $repoRoot "web/assets/fixture-capabilities.json"

function Copy-JsonValue($value) {
    return ($value | ConvertTo-Json -Depth 40 | ConvertFrom-Json)
}

$capabilityCatalog = Get-Content -LiteralPath $capabilityFile -Raw | ConvertFrom-Json
$referenceFixture = $capabilityCatalog.fixtures | Where-Object key -eq "clay-paky/a-leda-b-eye-k20" | Select-Object -First 1
if (-not $referenceFixture) { throw "The A.leda B-EYE K20 capability reference is missing from $capabilityFile" }

function Get-ReferenceControl([string]$label) {
    $control = $referenceFixture.controls | Where-Object label -eq $label | Select-Object -First 1
    if (-not $control) { throw "Reference control '$label' is missing from the A.leda B-EYE K20 capability data." }
    return $control
}

function New-Control([int]$id, [string]$type, [string]$label, [hashtable]$properties) {
    $control = [ordered]@{ id = $id; type = $type; label = $label }
    foreach ($key in $properties.Keys) { $control[$key] = $properties[$key] }
    return $control
}

function New-ReferenceWheel([int]$id, [string]$label, [int]$channel, [string]$referenceLabel = $label) {
    $reference = Get-ReferenceControl $referenceLabel
    return New-Control $id "wheel" $label @{
        channel = $channel
        options = @(Copy-JsonValue @($reference.options))
        capabilities = @(Copy-JsonValue @($reference.capabilities))
        defaultValue = 0
        blackoutValue = 0
    }
}

function New-Range([string]$name, [int]$start, [int]$end, [string]$kind, [hashtable]$details = @{}) {
    $range = [ordered]@{
        name = $name
        value = [int][Math]::Round(($start + $end) / 2, [MidpointRounding]::AwayFromZero)
        range = @($start, $end)
        kind = $kind
    }
    foreach ($key in $details.Keys) { $range[$key] = $details[$key] }
    return $range
}

function New-RangeCapability([int]$start, [int]$end, [string]$type, [hashtable]$details = @{}) {
    $capability = [ordered]@{ dmxRange = @($start, $end); type = $type }
    foreach ($key in $details.Keys) { $capability[$key] = $details[$key] }
    return $capability
}

function New-FunctionControl([int]$id) {
    $definitions = @(
        @("Unused", 0, 11, "NoFunction"),
        @("Pan / Tilt Fast (default)", 12, 24, "Maintenance"),
        @("Pan / Tilt Normal", 25, 37, "Maintenance"),
        @("Dimmer Curve 1", 38, 42, "Maintenance"),
        @("Dimmer Curve 2", 43, 47, "Maintenance"),
        @("Dimmer Curve 3 (default)", 48, 52, "Maintenance"),
        @("Dimmer Curve 4", 53, 57, "Maintenance"),
        @("RGBW Gamma 1.0", 58, 62, "Maintenance"),
        @("RGBW Gamma 1.5 (default)", 63, 67, "Maintenance"),
        @("RGBW Gamma 2.0", 68, 72, "Maintenance"),
        @("Halogen Simulation Off (default)", 73, 77, "Maintenance"),
        @("Halogen Simulation 750 W", 78, 82, "Maintenance"),
        @("Halogen Simulation 1000 W", 83, 87, "Maintenance"),
        @("Halogen Simulation 1200 W", 88, 92, "Maintenance"),
        @("Halogen Simulation 2000 W", 93, 97, "Maintenance"),
        @("Halogen Simulation 2500 W", 98, 102, "Maintenance"),
        @("Pixel Map Enabled", 103, 105, "Maintenance"),
        @("Unused", 106, 163, "NoFunction"),
        @("Base Frequency 1000 Hz", 164, 164, "Maintenance"),
        @("Base Frequency 1500 Hz (default)", 165, 165, "Maintenance"),
        @("Base Frequency 2400 Hz", 166, 166, "Maintenance"),
        @("Base Frequency 3700 Hz", 167, 167, "Maintenance"),
        @("Base Frequency 5600 Hz", 168, 168, "Maintenance"),
        @("Base Frequency 9400 Hz", 169, 169, "Maintenance"),
        @("Base Frequency 15100 Hz", 170, 170, "Maintenance"),
        @("Base Frequency 21400 Hz", 171, 171, "Maintenance"),
        @("Base Frequency 31000 Hz", 172, 172, "Maintenance"),
        @("Base Frequency 43700 Hz", 173, 173, "Maintenance"),
        @("Display On / Off", 174, 176, "Maintenance"),
        @("Emulate K20 Off", 177, 178, "Maintenance"),
        @("Emulate K20 On", 179, 180, "Maintenance"),
        @("Standard Mode", 181, 182, "Maintenance"),
        @("Silent Mode", 183, 184, "Maintenance"),
        @("Theatre Mode", 185, 186, "Maintenance"),
        @("Unused", 187, 231, "NoFunction"),
        @("Skip Warm Up", 232, 239, "Maintenance"),
        @("Unused", 240, 250, "NoFunction"),
        @("Reset to Default", 251, 255, "Maintenance")
    )
    $options = @()
    $capabilities = @()
    foreach ($definition in $definitions) {
        $details = if ($definition[3] -eq "Maintenance") { @{ comment = $definition[0] } } else { @{} }
        $options += New-Range $definition[0] $definition[1] $definition[2] $definition[3] $details
        $capabilities += New-RangeCapability $definition[1] $definition[2] $definition[3] $details
    }
    return New-Control $id "wheel" "Function" @{ channel = 18; options = $options; capabilities = $capabilities }
}

function New-ResetControl([int]$id) {
    $definitions = @(
        @("Unused", 0, 25, "NoFunction"),
        @("Effects Reset (hold 5 s)", 26, 76, "Maintenance"),
        @("Pan / Tilt Reset (hold 5 s)", 77, 127, "Maintenance"),
        @("Complete Reset (hold 5 s)", 128, 255, "Maintenance")
    )
    $options = @()
    $capabilities = @()
    foreach ($definition in $definitions) {
        $details = if ($definition[3] -eq "Maintenance") { @{ comment = $definition[0] } } else { @{} }
        $options += New-Range $definition[0] $definition[1] $definition[2] $definition[3] $details
        $capabilities += New-RangeCapability $definition[1] $definition[2] $definition[3] $details
    }
    return New-Control $id "wheel" "Reset" @{ channel = 19; options = $options; capabilities = $capabilities; defaultValue = 0; blackoutValue = 0 }
}

function New-StrobeControl([int]$id, [string]$label, [int]$channel) {
    $definitions = @(
        @("Light Off", 0, 3, "Closed"),
        @("Strobe 1–25 Hz", 4, 103, "Strobe"),
        @("Light On", 104, 107, "Open"),
        @("Pulse 0.5–25 Hz", 108, 207, "Pulse"),
        @("Light On", 208, 212, "Open"),
        @("Random Strobe Low", 213, 225, "Strobe"),
        @("Random Strobe Medium", 226, 238, "Strobe"),
        @("Random Strobe High", 239, 251, "Strobe"),
        @("Light On", 252, 255, "Open")
    )
    $options = @()
    $capabilities = @()
    foreach ($definition in $definitions) {
        $details = @{ shutterEffect = $definition[3] }
        $options += New-Range $definition[0] $definition[1] $definition[2] "ShutterStrobe" $details
        $capabilities += New-RangeCapability $definition[1] $definition[2] "ShutterStrobe" $details
    }
    return New-Control $id "wheel" $label @{ channel = $channel; options = $options; capabilities = $capabilities; defaultValue = 255; blackoutValue = 0 }
}

function New-ZoomRotationControl([int]$id) {
    $definitions = @(
        @("Index 0–60°", 0, 127, "Rotation"),
        @("CCW Fast to Slow", 128, 190, "Rotation"),
        @("Stop", 191, 192, "Rotation"),
        @("CW Slow to Fast", 193, 255, "Rotation")
    )
    $options = @()
    $capabilities = @()
    foreach ($definition in $definitions) {
        $details = @{ comment = $definition[0] }
        $options += New-Range $definition[0] $definition[1] $definition[2] $definition[3] $details
        $capabilities += New-RangeCapability $definition[1] $definition[2] $definition[3] $details
    }
    return New-Control $id "wheel" "Zoom Rotation" @{ channel = 21; options = $options; capabilities = $capabilities }
}

function New-ShapeFadeControl([int]$id) {
    $definitions = @(
        @("Snap", 0, 15),
        @("Smooth Gamma 0.5–2.0", 16, 245),
        @("Smooth Automatic Gamma", 246, 255)
    )
    $options = @()
    $capabilities = @()
    foreach ($definition in $definitions) {
        $options += New-Range $definition[0] $definition[1] $definition[2] "Effect" @{ effectName = $definition[0] }
        $capabilities += New-RangeCapability $definition[1] $definition[2] "Effect" @{ effectName = $definition[0] }
    }
    return New-Control $id "wheel" "Shape Fade" @{ channel = 24; options = $options; capabilities = $capabilities; defaultValue = 0; blackoutValue = 0 }
}

function New-BaseControls([switch]$Shape, [switch]$Frequency) {
    $controls = [System.Collections.Generic.List[object]]::new()
    $id = 1
    $controls.Add((New-Control $id "slider16" "Red" @{ channel = 1; fine = 2; defaultValue = 0; blackoutValue = 0; capabilities = @((New-RangeCapability 0 255 "ColorIntensity" @{ color = "Red" })) })); $id++
    $controls.Add((New-Control $id "slider16" "Green" @{ channel = 3; fine = 4; defaultValue = 0; blackoutValue = 0; capabilities = @((New-RangeCapability 0 255 "ColorIntensity" @{ color = "Green" })) })); $id++
    $controls.Add((New-Control $id "slider16" "Blue" @{ channel = 5; fine = 6; defaultValue = 0; blackoutValue = 0; capabilities = @((New-RangeCapability 0 255 "ColorIntensity" @{ color = "Blue" })) })); $id++
    $controls.Add((New-Control $id "slider16" "White" @{ channel = 7; fine = 8; defaultValue = 0; blackoutValue = 0; capabilities = @((New-RangeCapability 0 255 "ColorIntensity" @{ color = "White" })) })); $id++
    $controls.Add((New-ReferenceWheel $id "Linear CTO" 9)); $id++
    $controls.Add((New-ReferenceWheel $id "Macro Colour" 10 "Color Presets")); $id++
    $controls.Add((New-StrobeControl $id "Strobe" 11)); $id++
    $controls.Add((New-Control $id "slider16" "Dimmer" @{ channel = 12; fine = 13; defaultValue = 0; blackoutValue = 0; capabilities = @((New-RangeCapability 0 255 "Intensity")) })); $id++
    $controls.Add((New-Control $id "panTilt16" "Pan / Tilt" @{
        pan = 14; panFine = 15; tilt = 16; tiltFine = 17
        capabilities = @(
            (New-RangeCapability 0 255 "Pan" @{ angleStart = "0deg"; angleEnd = "540deg" }),
            (New-RangeCapability 0 255 "Tilt" @{ angleStart = "0deg"; angleEnd = "210deg" })
        )
    })); $id++
    $controls.Add((New-FunctionControl $id)); $id++
    $controls.Add((New-ResetControl $id)); $id++
    $controls.Add((New-Control $id "slider8" "Zoom" @{ channel = 20; defaultValue = 0; blackoutValue = 0; capabilities = @((New-RangeCapability 0 255 "Zoom" @{ angleStart = "narrow"; angleEnd = "wide" })) })); $id++
    $controls.Add((New-ZoomRotationControl $id)); $id++

    if ($Shape) {
        $controls.Add((New-ReferenceWheel $id "Shape Selection" 22)); $id++
        $controls.Add((New-Control $id "slider8" "Shape Speed" @{ channel = 23; defaultValue = 0; blackoutValue = 0; capabilities = @((New-RangeCapability 0 255 "EffectSpeed" @{ speedStart = "slow"; speedEnd = "fast" })) })); $id++
        $controls.Add((New-ShapeFadeControl $id)); $id++
        $controls.Add((New-Control $id "rgbw" "Shape Colour" @{ a = 25; b = 26; c = 27; w = 28; defaultValue = @{ a = 0; b = 0; c = 0; w = 0 }; blackoutValue = @{ a = 0; b = 0; c = 0; w = 0 } })); $id++
        $controls.Add((New-Control $id "slider8" "Shape Dimmer" @{ channel = 29; defaultValue = 0; blackoutValue = 0 })); $id++
        $controls.Add((New-Control $id "slider8" "Background Dimmer" @{ channel = 30; defaultValue = 0; blackoutValue = 0 })); $id++
        $controls.Add((New-ReferenceWheel $id "Shape Transition" 31)); $id++
        $controls.Add((New-Control $id "slider8" "Shape Offset" @{ channel = 32; defaultValue = 0; blackoutValue = 0 })); $id++
        $controls.Add((New-StrobeControl $id "Foreground Strobe" 33)); $id++
        $controls.Add((New-StrobeControl $id "Background Strobe" 34)); $id++
        $controls.Add((New-ReferenceWheel $id "Background Select" 35)); $id++
    }

    if ($Frequency) {
        $channel = if ($Shape) { 36 } else { 22 }
        $controls.Add((New-Control $id "slider8" "Frequency Fine Adjustment" @{
            channel = $channel
            defaultValue = 128
            blackoutValue = 128
            capabilities = @((New-RangeCapability 0 255 "EffectParameter" @{ comment = "Fine adjustment around the base frequency selected on Function" }))
        }))
    }
    return @($controls)
}

function New-PixelControls([switch]$White) {
    $controls = [System.Collections.Generic.List[object]]::new()
    $channelsPerPixel = if ($White) { 4 } else { 3 }
    for ($pixel = 1; $pixel -le 37; $pixel++) {
        $start = (($pixel - 1) * $channelsPerPixel) + 1
        $properties = @{
            a = $start
            b = $start + 1
            c = $start + 2
            defaultValue = @{ a = 0; b = 0; c = 0 }
            blackoutValue = @{ a = 0; b = 0; c = 0 }
        }
        $type = "rgb"
        if ($White) {
            $type = "rgbw"
            $properties.w = $start + 3
            $properties.defaultValue.w = 0
            $properties.blackoutValue.w = 0
        }
        $controls.Add((New-Control $pixel $type "LED $pixel" $properties))
    }
    return @($controls)
}

function New-Mode([string]$name, [int]$channels, $controls) {
    return [ordered]@{
        name = $name
        shortName = ""
        channels = $channels
        profile = [ordered]@{
            name = "Hy B-Eye K25"
            mode = $name
            channels = $channels
            controls = @($controls)
            library = [ordered]@{ source = "manufacturer-manual"; manufacturer = "Clay Paky" }
        }
        warnings = @()
    }
}

$fixture = [ordered]@{
    key = "clay-paky/hy-b-eye-k25"
    manufacturerKey = "clay-paky"
    manufacturerName = "Clay Paky"
    name = "Hy B-Eye K25"
    categories = @("Moving Head", "Color Changer")
    metadata = [ordered]@{
        source = "manufacturer-manual"
        authors = @("Claypaky")
        links = [ordered]@{
            manual = @("https://service.claypaky.it/servlet/checkDocumentsFile?Id=2784")
            productPage = @("https://www.claypaky.it/products/hy-b-eye-k25/")
        }
        physical = [ordered]@{
            dimensionsMm = [ordered]@{ width = 329; height = 590; depth = 387 }
            weightKg = 27.5
            powerVa = 1250
            dmxConnector = "Locking 3-pin and 5-pin XLR; RJ45"
            lightSource = "37 × 40 W Osram OSTAR Stage II RGBW LEDs (6000 K, 16,100 lm)"
            beamAngleDegrees = [ordered]@{ min = 4; max = 60 }
        }
    }
    modes = @(
        (New-Mode "Standard" 21 @(New-BaseControls)),
        (New-Mode "Standard + Frequency" 22 @(New-BaseControls -Frequency)),
        (New-Mode "Shape" 35 @(New-BaseControls -Shape)),
        (New-Mode "Shape + Frequency" 36 @(New-BaseControls -Shape -Frequency)),
        (New-Mode "Pixel Engine RGB" 111 @(New-PixelControls)),
        (New-Mode "Pixel Engine RGBW" 148 @(New-PixelControls -White))
    )
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outFile) | Out-Null
[IO.File]::WriteAllText($outFile, ($fixture | ConvertTo-Json -Depth 40 -Compress) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
Write-Host "Wrote Claypaky Hy B-Eye K25 fixture to $outFile"
