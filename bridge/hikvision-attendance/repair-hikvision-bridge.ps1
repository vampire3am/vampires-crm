#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
$installRoot = "C:\ProgramData\AECS\HikvisionAttendanceBridge"
$configPath = Join-Path $installRoot "bridge.config.json"
$taskName = "AECS Hikvision Attendance Bridge"
$nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1
$node = $nodeCommand.Source
if (-not (Test-Path -LiteralPath $node -PathType Leaf)) { throw "Node.js executable was not found." }

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "The saved bridge configuration was not found. Run install-hikvision-bridge.ps1 once to enter the credentials."
}

$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $state = (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue).State
    if ($state -ne "Running") { break }
    Start-Sleep -Milliseconds 250
  }
}

# A previous failed task can leave Node running after Task Scheduler reports it
# stopped. Terminate only this bridge's process so installed files can be
# replaced without affecting other Node applications on the CRM server.
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*$installRoot*index.mjs*" } |
  ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate -ErrorAction SilentlyContinue | Out-Null }

New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
foreach ($source in @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter "*.mjs") + @(Get-Item -LiteralPath "$PSScriptRoot\hikvision-request.ps1")) {
  $destination = Join-Path $installRoot $source.Name
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try { Copy-Item -LiteralPath $source.FullName -Destination $destination -Force; break }
    catch {
      if ($attempt -eq 5) { throw }
      Start-Sleep -Milliseconds 500
    }
  }
}

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
