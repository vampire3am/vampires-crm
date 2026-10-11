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
Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*run-hikvision-bridge.ps1*" } |
  ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate -ErrorAction SilentlyContinue | Out-Null }

New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
foreach ($source in @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter "*.mjs") + @(
  Get-Item -LiteralPath "$PSScriptRoot\hikvision-request.ps1"
  Get-Item -LiteralPath "$PSScriptRoot\run-hikvision-bridge.ps1"
)) {
  $destination = Join-Path $installRoot $source.Name
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try { Copy-Item -LiteralPath $source.FullName -Destination $destination -Force; break }
    catch {
      if ($attempt -eq 5) { throw }
      Start-Sleep -Milliseconds 500
    }
  }
}

# Poll frequently and run a bounded reconciliation every minute. The older
# terminal firmware can omit fresh events from a narrow cursor query, while
# the bounded query consistently returns them.
$savedConfig = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$savedConfig.pollSeconds = 3
if ($savedConfig.PSObject.Properties.Name -contains "reconciliationMinutes") { $savedConfig.reconciliationMinutes = 1 }
else { $savedConfig | Add-Member -NotePropertyName reconciliationMinutes -NotePropertyValue 1 }
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($configPath, ($savedConfig | ConvertTo-Json), $utf8NoBom)

Write-Host "Testing saved terminal and database configuration..." -ForegroundColor Cyan
$diagnosticOutput = & $node "$installRoot\index.mjs" $configPath --diagnose 2>&1
$diagnosticOutput | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) { throw "Bridge diagnostics failed. The detailed error is printed immediately above." }

$powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$runner = Join-Path $installRoot "run-hikvision-bridge.ps1"
$action = New-ScheduledTaskAction -Execute $powerShell -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$runner`" -NodePath `"$node`" -InstallRoot `"$installRoot`"" -WorkingDirectory $installRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
$backgroundStartedAt = (Get-Date).ToUniversalTime()
Start-ScheduledTask -TaskName $taskName
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Seconds 1
  $task = Get-ScheduledTask -TaskName $taskName
  $bridgeProcess = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$installRoot*index.mjs*" } |
    Select-Object -First 1
  $freshLog = (Test-Path -LiteralPath "$installRoot\bridge.log" -PathType Leaf) -and (Get-Item -LiteralPath "$installRoot\bridge.log").LastWriteTimeUtc -gt $backgroundStartedAt
  if ($task.State -eq "Running" -and $bridgeProcess -and $freshLog) { break }
}
if ($task.State -ne "Running" -or -not $bridgeProcess -or -not $freshLog) {
  $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
  throw "The supervised background bridge failed its live check (task state $($task.State), result $($taskInfo.LastTaskResult)). Review $installRoot\supervisor.log."
}
Write-Host "Supervised background bridge verified: Running. Attendance is checked every 3 seconds." -ForegroundColor Cyan
Write-Host "Bridge repaired and started. Log: $installRoot\bridge.log" -ForegroundColor Green
