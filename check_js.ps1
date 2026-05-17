$html = Get-Content "E:\Software\xampp\htdocs\dmx\dmx_motion.html" -Raw
$start = $html.IndexOf("<script>") + 8
$end = $html.LastIndexOf("</script>")
$js = $html.Substring($start, $end - $start)
if (!(Test-Path "C:\Temp")) { New-Item -ItemType Directory -Path "C:\Temp" -Force }
$js | Out-File "C:\Temp\dmx_motion_check.js" -Encoding utf8
node --check "C:\Temp\dmx_motion_check.js"
