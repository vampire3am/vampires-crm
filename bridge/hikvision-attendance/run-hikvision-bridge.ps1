param(
  [Parameter(Mandatory = $true)][string]$NodePath,
  [Parameter(Mandatory = $true)][string]$InstallRoot
)

$ErrorActionPreference = "Continue"
$configPath = Join-Path $InstallRoot "bridge.config.json"
$entryPoint = Join-Path $InstallRoot "index.mjs"
$supervisorLog = Join-Path $InstallRoot "supervisor.log"

while ($true) {
  try {
    $startedAt = (Get-Date).ToUniversalTime().ToString("o")
    Add-Content -LiteralPath $supervisorLog -Value "$startedAt INFO Starting attendance bridge process." -Encoding UTF8
    & $NodePath $entryPoint $configPath
    $exitCode = $LASTEXITCODE
    $endedAt = (Get-Date).ToUniversalTime().ToString("o")
    Add-Content -LiteralPath $supervisorLog -Value "$endedAt WARN Attendance bridge exited with code $exitCode; restarting in 5 seconds." -Encoding UTF8
  } catch {
    $failedAt = (Get-Date).ToUniversalTime().ToString("o")
    Add-Content -LiteralPath $supervisorLog -Value "$failedAt ERROR Attendance bridge crashed: $($_.Exception.Message); restarting in 5 seconds." -Encoding UTF8
  }
  Start-Sleep -Seconds 5
}
