param(
    [string]$HermesHome
)

$ErrorActionPreference = "Stop"

function Resolve-HermesHome {
    param([string]$ExplicitHome)

    if ($ExplicitHome) {
        return (Resolve-Path -LiteralPath $ExplicitHome).Path
    }

    if ($env:HERMES_HOME) {
        return $env:HERMES_HOME
    }

    $localHermes = Join-Path $env:LOCALAPPDATA "hermes"
    if (Test-Path (Join-Path $localHermes "config.yaml")) {
        return $localHermes
    }

    return (Join-Path $env:USERPROFILE ".hermes")
}

$hermesHome = Resolve-HermesHome -ExplicitHome $HermesHome
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
Write-Host "1. If Hermes is already running, restart it."
Write-Host "2. Run 'hermes plugins enable alphaclawxiv' once if the plugin is not enabled yet."
Write-Host "3. Run 'hermes alphaclawxiv auth login' to start the native AlphaXiv OAuth flow."
Write-Host "4. Run 'hermes alphaclawxiv auth status' to verify auth state."
