$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$hermesHome = Join-Path $env:USERPROFILE ".hermes"
$pluginSource = Join-Path $PSScriptRoot "plugins\alphaclawxiv"
$skillSource = Join-Path $PSScriptRoot "skills\alphaxiv"
$pluginTarget = Join-Path $hermesHome "plugins\alphaclawxiv"
$skillTarget = Join-Path $hermesHome "skills\alphaxiv"

New-Item -ItemType Directory -Force -Path $pluginTarget | Out-Null
New-Item -ItemType Directory -Force -Path $skillTarget | Out-Null

Copy-Item -Path (Join-Path $pluginSource "*") -Destination $pluginTarget -Recurse -Force
Copy-Item -Path (Join-Path $skillSource "*") -Destination $skillTarget -Recurse -Force

Write-Host "Installed Hermes plugin to: $pluginTarget"
Write-Host "Installed Hermes skill to:  $skillTarget"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Set ALPHAXIV_AUTH_HEADER for Hermes."
Write-Host "2. Restart Hermes Agent if it is already running."
Write-Host "3. Run 'hermes alphaclawxiv status' to verify the plugin is visible."
