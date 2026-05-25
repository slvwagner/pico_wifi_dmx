param(
    [string]$MarkdownPath = "docs/user-manual.md",
    [string]$HtmlPath = "docs/user-manual.html",
    [string]$PdfPath = "docs/user-manual.pdf",
    [string]$ChromePath = "",
    [int]$Port = 9230
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "local_path_config.ps1")
$localPaths = Get-LocalPathConfig -RepoRoot $repoRoot
if (-not $ChromePath) { $ChromePath = $localPaths.chromePath }

$mdFull = Join-Path $repoRoot $MarkdownPath
$htmlFull = Join-Path $repoRoot $HtmlPath
$pdfFull = Join-Path $repoRoot $PdfPath

if (-not (Test-Path -LiteralPath $mdFull)) {
    throw "Markdown file not found: $mdFull"
}

function Escape-Html {
    param([string]$Text)
    return [System.Net.WebUtility]::HtmlEncode($Text)
}

function Convert-InlineMarkdown {
    param([string]$Text)
    $html = Escape-Html $Text
    $html = [regex]::Replace($html, '!\[([^\]]*)\]\(([^)]+)\)', {
        param($m)
        $alt = $m.Groups[1].Value
        $src = $m.Groups[2].Value
        "<img src=`"$src`" alt=`"$alt`">"
    })
    $html = [regex]::Replace($html, '\[([^\]]+)\]\(([^)]+)\)', {
        param($m)
        $label = $m.Groups[1].Value
        $href = $m.Groups[2].Value
        "<a href=`"$href`">$label</a>"
    })
    $html = [regex]::Replace($html, '\*\*([^*]+)\*\*', '<strong>$1</strong>')
    $html = [regex]::Replace($html, '`([^`]+)`', '<code>$1</code>')
    return $html
}

function Normalize-PdfMetadata {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $encoding = [System.Text.Encoding]::GetEncoding(28591)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $text = $encoding.GetString($bytes)
    $fixedDate = "D:20000101000000+00'00'"
    $normalized = [regex]::Replace($text, '/CreationDate \(D:\d{14}\+00''00''\)', "/CreationDate ($fixedDate)")
    $normalized = [regex]::Replace($normalized, '/ModDate \(D:\d{14}\+00''00''\)', "/ModDate ($fixedDate)")
    if ($normalized -ne $text) {
        [System.IO.File]::WriteAllBytes($Path, $encoding.GetBytes($normalized))
    }
}

function Wait-FileStable {
    param([string]$Path, [int]$TimeoutSeconds = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastLength = -1
    $stableCount = 0
    while ((Get-Date) -lt $deadline) {
        if (Test-Path -LiteralPath $Path) {
            try {
                $item = Get-Item -LiteralPath $Path
                $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
                $stream.Close()
                if ($item.Length -eq $lastLength) {
                    $stableCount++
                    if ($stableCount -ge 2) { return }
                } else {
                    $lastLength = $item.Length
                    $stableCount = 0
                }
            } catch {
                $stableCount = 0
            }
        }
        Start-Sleep -Milliseconds 200
    }
    throw "Timed out waiting for PDF to finish writing: $Path"
}

function New-HeadingId {
    param([string]$Text)
    $slug = $Text.ToLowerInvariant()
    $slug = [regex]::Replace($slug, '`([^`]+)`', '$1')
    $slug = [regex]::Replace($slug, '\*\*([^*]+)\*\*', '$1')
    $slug = [regex]::Replace($slug, '[^a-z0-9]+', '-').Trim('-')
    if ([string]::IsNullOrWhiteSpace($slug)) { $slug = "section" }
    $base = $slug
    $i = 2
    while ($script:headingIds.ContainsKey($slug)) {
        $slug = "$base-$i"
        $i++
    }
    $script:headingIds[$slug] = $true
    return $slug
}

$lines = Get-Content -LiteralPath $mdFull
$body = [System.Collections.Generic.List[string]]::new()
$headingIds = @{}
$inCode = $false
$inUl = $false
$inOl = $false
$inTable = $false
$codeLines = [System.Collections.Generic.List[string]]::new()
$tableLines = [System.Collections.Generic.List[string]]::new()

function Close-Lists {
    if ($script:inUl) { $script:body.Add("</ul>"); $script:inUl = $false }
    if ($script:inOl) { $script:body.Add("</ol>"); $script:inOl = $false }
}

function Flush-Table {
    if (-not $script:inTable) { return }
    $script:body.Add("<table>")
    $headerDone = $false
    foreach ($row in $script:tableLines) {
        if ($row -match '^\s*\|?\s*-+') { continue }
        $cells = $row.Trim().Trim('|').Split('|') | ForEach-Object { Convert-InlineMarkdown $_.Trim() }
        if (-not $headerDone) {
            $script:body.Add("<thead><tr>" + (($cells | ForEach-Object { "<th>$_</th>" }) -join "") + "</tr></thead><tbody>")
            $headerDone = $true
        } else {
            $script:body.Add("<tr>" + (($cells | ForEach-Object { "<td>$_</td>" }) -join "") + "</tr>")
        }
    }
    if ($headerDone) { $script:body.Add("</tbody>") }
    $script:body.Add("</table>")
    $script:tableLines.Clear()
    $script:inTable = $false
}

foreach ($line in $lines) {
    if ($line -match '^```') {
        Flush-Table
        Close-Lists
        if ($inCode) {
            $body.Add("<pre><code>" + (Escape-Html (($codeLines -join "`n"))) + "</code></pre>")
            $codeLines.Clear()
            $inCode = $false
        } else {
            $inCode = $true
        }
        continue
    }

    if ($inCode) {
        $codeLines.Add($line)
        continue
    }

    if ($line -match '^\s*\|.*\|\s*$') {
        Close-Lists
        $inTable = $true
        $tableLines.Add($line)
        continue
    } else {
        Flush-Table
    }

    if ([string]::IsNullOrWhiteSpace($line)) {
        Close-Lists
        continue
    }

    if ($line -match '^(#{1,6})\s+(.+)$') {
        Close-Lists
        $level = $matches[1].Length
        $id = New-HeadingId $matches[2]
        $text = Convert-InlineMarkdown $matches[2]
        $body.Add("<h$level id=`"$id`">$text</h$level>")
        continue
    }

    if ($line -match '^\s*-\s+(.+)$') {
        if (-not $inUl) {
            Close-Lists
            $body.Add("<ul>")
            $inUl = $true
        }
        $body.Add("<li>" + (Convert-InlineMarkdown $matches[1]) + "</li>")
        continue
    }

    if ($line -match '^\s*\d+\.\s+(.+)$') {
        if (-not $inOl) {
            Close-Lists
            $body.Add("<ol>")
            $inOl = $true
        }
        $body.Add("<li>" + (Convert-InlineMarkdown $matches[1]) + "</li>")
        continue
    }

    Close-Lists
    $body.Add("<p>" + (Convert-InlineMarkdown $line) + "</p>")
}

Flush-Table
Close-Lists

$html = @"
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Pico WiFi DMX User Manual</title>
<style>
:root {
  color-scheme: dark;
  --bg: #0d1115;
  --paper: #111820;
  --panel: #161f28;
  --line: #31404d;
  --text: #edf3f7;
  --muted: #a7b8c6;
  --accent: #37c4a4;
  --warn: #ffbc6b;
}
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body {
  margin: 0;
  min-height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: "Segoe UI", system-ui, sans-serif;
  line-height: 1.5;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
body { padding: 28px; }
main {
  max-width: 980px;
  margin: 0 auto;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 34px 42px;
}
h1, h2, h3 {
  break-after: avoid;
  color: #ffffff;
  line-height: 1.2;
}
h1 {
  margin: 0 0 14px;
  font-size: 32px;
  border-bottom: 2px solid var(--accent);
  padding-bottom: 14px;
}
h2 {
  margin-top: 34px;
  font-size: 24px;
  color: var(--accent);
  border-top: 1px solid var(--line);
  padding-top: 24px;
}
h3 { margin-top: 24px; font-size: 18px; color: #dff8f2; }
p, li, td, th { font-size: 14px; }
p { margin: 11px 0; }
a { color: var(--accent); }
ul, ol { margin: 10px 0 16px 24px; padding: 0; }
li { margin: 5px 0; }
code {
  background: #0a0d10;
  border: 1px solid #25313b;
  border-radius: 4px;
  padding: 1px 5px;
  color: #dff8f2;
}
pre {
  background: #0a0d10;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
pre code {
  border: 0;
  padding: 0;
  background: transparent;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0 20px;
  break-inside: avoid;
}
th, td {
  border: 1px solid var(--line);
  padding: 9px 10px;
  vertical-align: top;
}
th {
  background: #20303b;
  color: #ffffff;
  text-align: left;
}
td { background: #101820; }
img {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  margin: 16px 0 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  break-inside: avoid;
}
strong { color: #ffffff; }
</style>
</head>
<body>
<main>
$($body -join "`n")
</main>
</body>
</html>
"@

Set-Content -LiteralPath $htmlFull -Value $html -Encoding UTF8

$chrome = $ChromePath
if (-not (Test-Path -LiteralPath $chrome)) {
    throw "Chrome not found: $chrome"
}

$tempRoot = $env:TEMP
if (-not $tempRoot) { $tempRoot = $env:TMPDIR }
if (-not $tempRoot) { $tempRoot = [IO.Path]::GetTempPath() }
$profileDir = Join-Path $tempRoot ("pico-dmx-pdf-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

$args = @(
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--disable-features=MediaRouter,OptimizationHints",
    "--no-sandbox",
    "--no-first-run",
    "--user-data-dir=$profileDir",
    "--print-to-pdf=$pdfFull",
    "--print-to-pdf-no-header",
    "file:///$($htmlFull.Replace('\','/'))"
)

try {
    Remove-Item -LiteralPath $pdfFull -Force -ErrorAction SilentlyContinue
    & $chrome @args
    Wait-FileStable -Path $pdfFull
    Normalize-PdfMetadata -Path $pdfFull
} finally {
    Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "Wrote $htmlFull"
Write-Host "Wrote $pdfFull"
