#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
$installRoot = "C:\ProgramData\AECS\HikvisionAttendanceBridge"
$configPath = Join-Path $installRoot "bridge.config.json"
$taskName = "AECS Hikvision Attendance Bridge"
$node = (Get-Command node -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "The saved bridge configuration was not found. Run install-hikvision-bridge.ps1 once to enter the credentials."
}

$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) { Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue }
Copy-Item "$PSScriptRoot\*.mjs" $installRoot -Force
Copy-Item "$PSScriptRoot\hikvision-request.ps1" $installRoot -Force

Write-Host "Testing saved terminal and database configuration..." -ForegroundColor Cyan
$diagnosticOutput = & $node "$installRoot\index.mjs" $configPath --diagnose 2>&1
$diagnosticOutput | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) { throw "Bridge diagnostics failed. The detailed error is printed immediately above." }

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$installRoot\index.mjs`" `"$configPath`"" -WorkingDirectory $installRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "Bridge repaired and started. Log: $installRoot\bridge.log" -ForegroundColor Green
