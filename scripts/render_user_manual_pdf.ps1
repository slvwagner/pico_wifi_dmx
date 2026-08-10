param(
    [string]$MarkdownPath = "docs/user-manual.md",
    [string]$HtmlPath = "docs/user-manual.html",
    [string]$PdfPath = "docs/user-manual.pdf",
    [string]$ChromePath = "",
    [int]$Port = 9230,
    [switch]$PdfWithNavigation
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "local_path_config.ps1")
. (Join-Path $PSScriptRoot "manual_screenshot_helpers.ps1")
$scriptTiming = Start-ManualScriptTiming -Name "render_user_manual_pdf.ps1"
$localPaths = Get-LocalPathConfig -RepoRoot $repoRoot
if (-not $ChromePath) { $ChromePath = $localPaths.chromePath }

$mdFull = Join-Path $repoRoot $MarkdownPath
$htmlFull = Join-Path $repoRoot $HtmlPath
$pdfFull = Join-Path $repoRoot $PdfPath
$manualScreenshotReferenceWidth = 1440

if (-not (Test-Path -LiteralPath $mdFull)) {
    throw "Markdown file not found: $mdFull"
}

function Escape-Html {
    param([string]$Text)
    return [System.Net.WebUtility]::HtmlEncode($Text)
}

function Get-PngWidth {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) { return 0 }

    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $header = New-Object byte[] 24
        if ($stream.Read($header, 0, $header.Length) -ne $header.Length) { return 0 }
        $pngSignature = @(137, 80, 78, 71, 13, 10, 26, 10)
        for ($index = 0; $index -lt $pngSignature.Length; $index++) {
            if ($header[$index] -ne $pngSignature[$index]) { return 0 }
        }
        return [int](
            ([uint32]$header[16] * 16777216) +
            ([uint32]$header[17] * 65536) +
            ([uint32]$header[18] * 256) +
            [uint32]$header[19]
        )
    } finally {
        $stream.Dispose()
    }
}

function Convert-InlineMarkdown {
    param([string]$Text)
    $html = Escape-Html $Text
    $html = [regex]::Replace($html, '!\[([^\]]*)\]\(([^)]+)\)', {
        param($m)
        $alt = $m.Groups[1].Value
        $src = $m.Groups[2].Value
        $decodedSrc = [System.Net.WebUtility]::HtmlDecode($src)
        $imagePath = Join-Path (Split-Path -Parent $mdFull) $decodedSrc
        $nativeWidth = Get-PngWidth -Path $imagePath
        if ($nativeWidth -gt 0) {
            $displayPercentValue = [Math]::Min(
                [double]100.0,
                ([double]$nativeWidth / [double]$manualScreenshotReferenceWidth) * [double]100.0
            )
            $displayPercent = $displayPercentValue.ToString(
                "0.####",
                [System.Globalization.CultureInfo]::InvariantCulture
            )
            return "<img src=`"$src`" alt=`"$alt`" style=`"--manual-image-width: $displayPercent%`" data-native-width=`"$nativeWidth`">"
        }
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

$manualMarkdown = Get-Content -LiteralPath $mdFull -Raw
$changelogMarker = "<!-- PICO_DMX_CHANGELOG -->"
if ($manualMarkdown.Contains($changelogMarker)) {
    $changelogPath = Join-Path $repoRoot "CHANGELOG.md"
    if (-not (Test-Path -LiteralPath $changelogPath)) {
        throw "Changelog file not found: $changelogPath"
    }
    $changelogMarkdown = Get-Content -LiteralPath $changelogPath -Raw
    $changelogMarkdown = [regex]::Replace($changelogMarkdown, '^\s*#\s+Changelog\s*\r?\n+', '')
    $changelogMarkdown = [regex]::Replace($changelogMarkdown, '(?m)^##\s+', '### ')
    $manualMarkdown = $manualMarkdown.Replace(
        $changelogMarker,
        $changelogMarkdown.Trim()
    )
}
$lines = $manualMarkdown -split '\r?\n'
$body = [System.Collections.Generic.List[string]]::new()
$manualSections = [System.Collections.Generic.List[object]]::new()
$currentManualSection = $null
$currentManualPage = $null
$headingIds = @{}
$inCode = $false
$ulDepth = 0
$openUnorderedListItemIndex = -1
$inOl = $false
$inTable = $false
$codeLines = [System.Collections.Generic.List[string]]::new()
$tableLines = [System.Collections.Generic.List[string]]::new()

function Close-Lists {
    while ($script:ulDepth -gt 0) {
        $script:body.Add("</li></ul>")
        $script:ulDepth--
    }
    $script:openUnorderedListItemIndex = -1
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
        $headingSource = $matches[2]
        $id = New-HeadingId $headingSource
        $text = Convert-InlineMarkdown $headingSource
        if ($level -eq 2) {
            $currentManualPage = $null
        }
        if ($level -eq 2 -and $id -ne "table-of-contents") {
            $currentManualSection = [pscustomobject]@{
                Id = $id
                TitleHtml = $text
                Pages = [System.Collections.Generic.List[object]]::new()
            }
            $manualSections.Add($currentManualSection)
        } elseif ($level -eq 3 -and $null -ne $currentManualSection) {
            $currentManualPage = [pscustomobject]@{
                Id = $id
                TitleHtml = $text
                Topics = [System.Collections.Generic.List[object]]::new()
            }
            $currentManualSection.Pages.Add($currentManualPage)
        } elseif ($level -eq 4 -and $null -ne $currentManualPage -and $headingSource -match 'Tools and Toolboxes$') {
            $currentManualPage.Topics.Add([pscustomobject]@{
                Id = $id
                TitleHtml = $text
            })
        }
        $body.Add("<h$level id=`"$id`">$text</h$level>")
        continue
    }

    if ($line -match '^(\s*)-\s+(.+)$') {
        if ($inOl) {
            $body.Add("</ol>")
            $inOl = $false
        }
        $targetDepth = [math]::Floor($matches[1].Length / 2) + 1
        if ($targetDepth -gt ($ulDepth + 1)) { $targetDepth = $ulDepth + 1 }
        if ($targetDepth -gt $ulDepth) {
            while ($ulDepth -lt $targetDepth) {
                $body.Add("<ul>")
                $ulDepth++
            }
            $body.Add("<li>" + (Convert-InlineMarkdown $matches[2]))
            $openUnorderedListItemIndex = $body.Count - 1
        } elseif ($targetDepth -eq $ulDepth) {
            $body.Add("</li><li>" + (Convert-InlineMarkdown $matches[2]))
            $openUnorderedListItemIndex = $body.Count - 1
        } else {
            while ($ulDepth -gt $targetDepth) {
                $body.Add("</li></ul>")
                $ulDepth--
            }
            $body.Add("</li><li>" + (Convert-InlineMarkdown $matches[2]))
            $openUnorderedListItemIndex = $body.Count - 1
        }
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

    # Markdown permits a list item's prose to continue on an indented physical
    # line. Keep that text in the open <li>; otherwise wrapped changelog entries
    # become unrelated paragraphs in the generated manuals.
    if ($ulDepth -gt 0 -and $openUnorderedListItemIndex -ge 0 -and $line -match '^\s{2,}(\S.*)$') {
        $body[$openUnorderedListItemIndex] += " " + (Convert-InlineMarkdown $matches[1])
        continue
    }

    Close-Lists
    $body.Add("<p>" + (Convert-InlineMarkdown $line) + "</p>")
}

Flush-Table
Close-Lists

$manualNavItems = @($manualSections | ForEach-Object {
    $section = $_
    $submenuId = "manual-nav-$($section.Id)"
    $pageItems = @($section.Pages | ForEach-Object {
        $page = $_
        if ($page.Topics.Count -eq 0) {
            "<li><a href=`"#$($page.Id)`">$($page.TitleHtml)</a></li>"
        } else {
            $topicListId = "manual-nav-topics-$($page.Id)"
            $topicItems = @($page.Topics | ForEach-Object {
                "<li><a href=`"#$($_.Id)`">$($_.TitleHtml)</a></li>"
            }) -join "`n"
            @"
<li class="manual-nav-page" data-page-id="$($page.Id)">
  <div class="manual-nav-page-row">
    <a href="#$($page.Id)">$($page.TitleHtml)</a>
    <button class="manual-nav-page-toggle" type="button" aria-controls="$topicListId" aria-expanded="false" aria-label="Show manual points for this page">⌄</button>
  </div>
  <ul class="manual-nav-topic-list" id="$topicListId" hidden>
$topicItems
  </ul>
</li>
"@
        }
    }) -join "`n"
    @"
<li class="manual-nav-group" data-section-id="$($section.Id)">
  <div class="manual-nav-group-row">
    <a href="#$($section.Id)">$($section.TitleHtml)</a>
    <button class="manual-nav-group-toggle" type="button" aria-controls="$submenuId" aria-expanded="false" aria-label="Show pages in this section">⌄</button>
  </div>
  <ul class="manual-nav-submenu" id="$submenuId" hidden>
$pageItems
  </ul>
</li>
"@
}) -join "`n"
$htmlClass = if ($PdfWithNavigation) { ' class="manual-pdf-navigation"' } else { ' class="manual-print"' }
$pdfPageSize = if ($PdfWithNavigation) { "A4 landscape" } else { "A4" }
$pdfPageMargin = if ($PdfWithNavigation) { "0" } else { "12mm" }

$html = @"
<!doctype html>
<html$htmlClass lang="en">
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
@page { size: $pdfPageSize; margin: $pdfPageMargin; }
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
  width: var(--manual-image-width, 100%);
  max-width: 100%;
  height: auto;
  box-sizing: border-box;
  margin: 16px 0 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  break-inside: avoid;
}
strong { color: #ffffff; }
html.manual-print {
  color-scheme: light;
  --bg: #ffffff;
  --paper: #ffffff;
  --panel: #f3f5f4;
  --line: #aeb8b5;
  --text: #111715;
  --muted: #46534f;
  --accent: #006b5b;
  --warn: #844400;
}
html.manual-print h1,
html.manual-print strong {
  color: #111715;
}
html.manual-print h3 {
  color: #214941;
}
html.manual-print code,
html.manual-print pre {
  border-color: #c7cfcc;
  background: #f3f5f4;
  color: #111715;
}
html.manual-print th {
  background: #e3e9e7;
  color: #111715;
}
html.manual-print td {
  background: #ffffff;
}
.manual-nav-toggle {
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 1002;
  min-height: 44px;
  padding: 9px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.manual-nav {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 1003;
  width: min(86vw, 320px);
  padding: 18px;
  overflow-y: auto;
  background: var(--panel);
  border-right: 1px solid var(--line);
  transform: translateX(-105%);
  transition: transform 180ms ease;
  box-shadow: 12px 0 32px rgba(0, 0, 0, 0.42);
}
body.manual-nav-open {
  overflow: hidden;
}
body.manual-nav-open .manual-nav {
  transform: translateX(0);
}
.manual-nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1001;
  border: 0;
  background: rgba(0, 0, 0, 0.62);
  opacity: 0;
  pointer-events: none;
  transition: opacity 180ms ease;
}
body.manual-nav-open .manual-nav-backdrop {
  opacity: 1;
  pointer-events: auto;
}
.manual-nav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.manual-nav-title {
  color: #ffffff;
  font-size: 18px;
}
.manual-nav-downloads {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 12px;
}
.manual-nav-downloads a {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--text);
  text-align: center;
  text-decoration: none;
  font-size: 12px;
}
.manual-nav-downloads a:hover,
.manual-nav-downloads a:focus-visible {
  border-color: var(--accent);
}
.manual-nav-close {
  width: 44px;
  height: 44px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #0d141a;
  color: var(--text);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}
.manual-nav-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.manual-nav-list li,
.manual-nav-submenu {
  margin: 2px 0;
}
.manual-nav-group-row,
.manual-nav-page-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38px;
  align-items: stretch;
}
.manual-nav-list a {
  display: block;
  padding: 8px 10px;
  border-left: 3px solid transparent;
  border-radius: 5px;
  color: var(--muted);
  text-decoration: none;
}
.manual-nav-list a:hover,
.manual-nav-list a:focus-visible {
  background: #1d2a34;
  color: #ffffff;
}
.manual-nav-list a.is-active {
  border-left-color: var(--accent);
  background: #20332f;
  color: #ffffff;
  font-weight: 700;
}
.manual-nav-group-toggle,
.manual-nav-page-toggle {
  min-width: 38px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 19px;
  cursor: pointer;
  transition: transform 150ms ease, background 150ms ease;
}
.manual-nav-group-toggle:hover,
.manual-nav-group-toggle:focus-visible,
.manual-nav-page-toggle:hover,
.manual-nav-page-toggle:focus-visible {
  background: #1d2a34;
  color: #ffffff;
}
.manual-nav-group-toggle[aria-expanded="true"],
.manual-nav-page-toggle[aria-expanded="true"] {
  transform: rotate(180deg);
}
.manual-nav-submenu {
  padding: 2px 0 4px 13px;
  list-style: none;
  border-left: 1px solid var(--line);
}
.manual-nav-submenu[hidden] {
  display: none;
}
.manual-nav-submenu a {
  padding: 6px 8px;
  font-size: 12px;
}
.manual-nav-topic-list {
  margin: 0 0 3px 10px;
  padding: 2px 0 2px 9px;
  list-style: none;
  border-left: 1px dashed var(--line);
}
.manual-nav-topic-list[hidden] {
  display: none;
}
.manual-nav-topic-list a {
  padding: 5px 7px;
  font-size: 11px;
}
.manual-current-location {
  margin: 0 0 12px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #101820;
}
.manual-current-location span {
  display: block;
  margin-bottom: 3px;
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.manual-current-location strong {
  display: block;
  color: var(--text);
  font-size: 12px;
  line-height: 1.35;
}
.manual-back-to-contents {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 1000;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--panel);
  color: var(--text);
  text-decoration: none;
  font-weight: 700;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.section-pager {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 28px 0 10px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}
.section-pager a,
.section-pager span {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  text-align: center;
}
.section-pager a {
  background: var(--panel);
  color: var(--text);
  text-decoration: none;
}
.section-pager a:hover,
.section-pager a:focus-visible {
  border-color: var(--accent);
}
.section-pager span {
  visibility: hidden;
}
@media (min-width: 1320px) and (hover: hover) and (pointer: fine) {
  body {
    display: grid;
    grid-template-columns: 250px minmax(0, 980px);
    align-items: start;
    justify-content: center;
    gap: 24px;
  }
  main {
    width: 100%;
    margin: 0;
  }
  .manual-nav {
    position: sticky;
    inset: auto;
    top: 28px;
    z-index: 1;
    width: 250px;
    max-height: calc(100vh - 56px);
    border: 1px solid var(--line);
    border-radius: 12px;
    transform: none;
    box-shadow: none;
  }
  .manual-nav-toggle,
  .manual-nav-close,
  .manual-nav-backdrop {
    display: none;
  }
  body.manual-nav-open {
    overflow: auto;
  }
}
@media (max-width: 700px) {
  body {
    padding: 72px 10px 18px;
  }
  main {
    padding: 24px 18px;
  }
  .section-pager {
    grid-template-columns: 1fr;
  }
  .section-pager span {
    display: none;
  }
  .manual-back-to-contents {
    right: 10px;
    bottom: 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .manual-nav,
  .manual-nav-backdrop {
    transition: none;
  }
}
@media print {
  body {
    display: block;
    padding: 28px;
  }
  main {
    max-width: 980px;
    margin: 0 auto;
  }
  .manual-nav,
  .manual-nav-toggle,
  .manual-nav-backdrop,
  .manual-back-to-contents,
  .section-pager {
    display: none !important;
  }
  html.manual-pdf-navigation body {
    display: block;
    padding: 20px 20px 20px 250px;
  }
  html.manual-pdf-navigation main {
    max-width: none;
    margin: 0;
    padding: 24px 28px;
  }
  html.manual-pdf-navigation .manual-nav {
    display: block !important;
    position: fixed;
    inset: 20px auto 20px 20px;
    width: 210px;
    max-height: none;
    padding: 10px;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 8px;
    transform: none;
    box-shadow: none;
  }
  html.manual-pdf-navigation .manual-nav-header {
    margin-bottom: 6px;
    padding-bottom: 6px;
  }
  html.manual-pdf-navigation .manual-nav-title {
    font-size: 14px;
  }
  html.manual-pdf-navigation .manual-nav-close,
  html.manual-pdf-navigation .manual-nav-downloads,
  html.manual-pdf-navigation .manual-current-location,
  html.manual-pdf-navigation .manual-nav-group-toggle,
  html.manual-pdf-navigation .manual-nav-page-toggle {
    display: none !important;
  }
  html.manual-pdf-navigation .manual-nav-group-row,
  html.manual-pdf-navigation .manual-nav-page-row {
    display: block;
  }
  html.manual-pdf-navigation .manual-nav-submenu {
    display: block !important;
    margin: 0;
    padding: 0 0 2px 8px;
  }
  html.manual-pdf-navigation .manual-nav-list li {
    margin: 0;
  }
  html.manual-pdf-navigation .manual-nav-list a {
    padding: 2px 5px;
    border-left-width: 2px;
    font-size: 9px;
    line-height: 1.2;
  }
  html.manual-pdf-navigation .manual-nav-submenu a {
    padding: 1px 4px;
    font-size: 7.5px;
    line-height: 1.1;
  }
  html.manual-pdf-navigation .manual-nav-topic-list {
    display: block !important;
    margin: 0;
    padding: 0 0 1px 12px;
    border-left: 0;
  }
  html.manual-pdf-navigation .manual-nav-topic-list a {
    padding: 0 3px;
    font-size: 6.5px;
    line-height: 1.05;
  }
  html.manual-pdf-navigation .manual-nav-list a.is-active {
    border-left-color: transparent;
    background: transparent;
    color: var(--muted);
    font-weight: 400;
  }
  html.manual-print body {
    padding: 0;
    background: #ffffff;
  }
  html.manual-print main {
    max-width: none;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: #ffffff;
  }
}
</style>
</head>
<body>
<button class="manual-nav-toggle" type="button" aria-controls="manual-nav" aria-expanded="false">☰ Contents</button>
<button class="manual-nav-backdrop" type="button" aria-label="Close contents"></button>
<aside class="manual-nav" id="manual-nav" aria-label="Manual contents">
  <div class="manual-nav-header">
    <strong class="manual-nav-title">Contents</strong>
    <button class="manual-nav-close" type="button" aria-label="Close contents">×</button>
  </div>
  <div class="manual-nav-downloads">
    <a href="user-manual.pdf">Clean PDF</a>
    <a href="user-manual-navigation.pdf">PDF with navigation</a>
  </div>
  <p class="manual-current-location">
    <span>Current location</span>
    <strong id="manual-current-location">Table of Contents</strong>
  </p>
  <ul class="manual-nav-list">
    <li><a href="#table-of-contents">Full table of contents</a></li>
$manualNavItems
  </ul>
</aside>
<main id="manual-content">
$($body -join "`n")
</main>
<a class="manual-back-to-contents" href="#table-of-contents">↑ Contents</a>
<script>
(function () {
  const body = document.body;
  const toggle = document.querySelector('.manual-nav-toggle');
  const closeButton = document.querySelector('.manual-nav-close');
  const backdrop = document.querySelector('.manual-nav-backdrop');
  const nav = document.querySelector('.manual-nav');
  const main = document.getElementById('manual-content');
  const currentLocation = document.getElementById('manual-current-location');
  const navLinks = Array.from(nav.querySelectorAll('a[href^="#"]'));
  const navGroups = Array.from(nav.querySelectorAll('.manual-nav-group'));
  const navPages = Array.from(nav.querySelectorAll('.manual-nav-page'));
  const groupToggles = Array.from(nav.querySelectorAll('.manual-nav-group-toggle'));
  const pageToggles = Array.from(nav.querySelectorAll('.manual-nav-page-toggle'));
  const sectionHeadings = Array.from(main.querySelectorAll(':scope > h2[id]'))
    .filter(function (heading) { return heading.id !== 'table-of-contents'; });
  const locationHeadings = Array.from(main.querySelectorAll(':scope > h2[id], :scope > h3[id], :scope > h4[id]'));

  function setGroupExpanded(group, expanded) {
    const button = group.querySelector('.manual-nav-group-toggle');
    const submenu = group.querySelector('.manual-nav-submenu');
    if (!button || !submenu) { return; }
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    submenu.hidden = !expanded;
  }

  groupToggles.forEach(function (button) {
    button.addEventListener('click', function () {
      const group = button.closest('.manual-nav-group');
      setGroupExpanded(group, button.getAttribute('aria-expanded') !== 'true');
    });
  });

  function setPageExpanded(pageItem, expanded) {
    const button = pageItem.querySelector('.manual-nav-page-toggle');
    const topicList = pageItem.querySelector('.manual-nav-topic-list');
    if (!button || !topicList) { return; }
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    topicList.hidden = !expanded;
  }

  pageToggles.forEach(function (button) {
    button.addEventListener('click', function () {
      const pageItem = button.closest('.manual-nav-page');
      setPageExpanded(pageItem, button.getAttribute('aria-expanded') !== 'true');
    });
  });

  function setDrawerOpen(open) {
    body.classList.toggle('manual-nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  toggle.addEventListener('click', function () {
    setDrawerOpen(!body.classList.contains('manual-nav-open'));
  });
  closeButton.addEventListener('click', function () { setDrawerOpen(false); });
  backdrop.addEventListener('click', function () { setDrawerOpen(false); });
  navLinks.forEach(function (link) {
    link.addEventListener('click', function () { setDrawerOpen(false); });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { setDrawerOpen(false); }
  });

  sectionHeadings.forEach(function (heading, index) {
    const pager = document.createElement('nav');
    pager.className = 'section-pager';
    pager.setAttribute('aria-label', 'Section navigation');

    const previous = sectionHeadings[index - 1];
    const next = sectionHeadings[index + 1];
    const previousControl = document.createElement(previous ? 'a' : 'span');
    const contentsControl = document.createElement('a');
    const nextControl = document.createElement(next ? 'a' : 'span');

    if (previous) {
      previousControl.href = '#' + previous.id;
      previousControl.textContent = '← ' + previous.textContent;
    }
    contentsControl.href = '#table-of-contents';
    contentsControl.textContent = '↑ Contents';
    if (next) {
      nextControl.href = '#' + next.id;
      nextControl.textContent = next.textContent + ' →';
    }

    pager.append(previousControl, contentsControl, nextControl);
    if (next) {
      main.insertBefore(pager, next);
    } else {
      main.appendChild(pager);
    }
  });

  function getLocationPath(heading) {
    const path = [];
    let expectedLevel = Number(heading.tagName.slice(1));
    let index = locationHeadings.indexOf(heading);
    for (; index >= 0 && expectedLevel >= 2; index -= 1) {
      const candidate = locationHeadings[index];
      const level = Number(candidate.tagName.slice(1));
      if (level === expectedLevel) {
        path.unshift(candidate.textContent.trim());
        expectedLevel -= 1;
      }
    }
    return path;
  }

  function activateLocation(heading) {
    const path = getLocationPath(heading);
    const locationIds = new Set();
    const navIds = new Set(navLinks.map(function (link) { return link.getAttribute('href').slice(1); }));
    let activeNavId = '';
    let index = locationHeadings.indexOf(heading);
    let expectedLevel = Number(heading.tagName.slice(1));
    for (; index >= 0 && expectedLevel >= 2; index -= 1) {
      const candidate = locationHeadings[index];
      const level = Number(candidate.tagName.slice(1));
      if (level === expectedLevel) {
        locationIds.add(candidate.id);
        if (!activeNavId && navIds.has(candidate.id)) { activeNavId = candidate.id; }
        expectedLevel -= 1;
      }
    }
    navLinks.forEach(function (link) {
      const active = locationIds.has(link.getAttribute('href').slice(1));
      link.classList.toggle('is-active', active);
      if (link.getAttribute('href') === '#' + activeNavId) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    navGroups.forEach(function (group) {
      const active = locationIds.has(group.dataset.sectionId);
      group.classList.toggle('is-current-group', active);
      if (active) { setGroupExpanded(group, true); }
    });
    navPages.forEach(function (pageItem) {
      const active = locationIds.has(pageItem.dataset.pageId);
      pageItem.classList.toggle('is-current-page', active);
      if (active) { setPageExpanded(pageItem, true); }
    });
    currentLocation.textContent = path.join(' › ');
  }

  let updateQueued = false;
  function updateActiveSection() {
    updateQueued = false;
    let current = locationHeadings[0];
    locationHeadings.forEach(function (heading) {
      if (heading.getBoundingClientRect().top <= 150) { current = heading; }
    });
    if (current) { activateLocation(current); }
  }
  function queueActiveSectionUpdate() {
    if (updateQueued) { return; }
    updateQueued = true;
    window.requestAnimationFrame(updateActiveSection);
  }

  window.addEventListener('scroll', queueActiveSectionUpdate, { passive: true });
  window.addEventListener('hashchange', queueActiveSectionUpdate);
  updateActiveSection();
})();
</script>
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
    Complete-ManualScriptTiming -Timing $scriptTiming
}
Write-Host "Wrote $htmlFull"
Write-Host "Wrote $pdfFull"
