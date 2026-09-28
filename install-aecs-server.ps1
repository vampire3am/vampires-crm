#Requires -RunAsAdministrator
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$taskName = "AECS CRM Server"
$firewallName = "AECS CRM HTTP"

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
  throw "Node.js/npm is not installed or npm.cmd is not available in PATH."
}
$npmPath = $npmCommand.Source
$taskRunner = Join-Path $repoRoot ".aecs-server-task.cmd"
$logDirectory = Join-Path $repoRoot "logs"
$logPath = Join-Path $logDirectory "server.log"

$existingListener = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue
if ($existingListener) {
  $processNames = $existingListener |
    ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue } |
    Select-Object -ExpandProperty ProcessName -Unique
  throw "Port 80 is already in use by: $($processNames -join ', '). Stop or reconfigure that web server before installing AECS CRM."
}

Push-Location $repoRoot
try {
  npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Production build failed with exit code $LASTEXITCODE." }
} finally {
  Pop-Location
}

$existingRule = Get-NetFirewallRule -DisplayName $firewallName -ErrorAction SilentlyContinue
if (-not $existingRule) {
  New-NetFirewallRule -DisplayName $firewallName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 -Profile Domain,Private | Out-Null
}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
@"
@echo off
cd /d "$repoRoot"
"$npmPath" run serve:lan >> "$logPath" 2>&1
"@ | Set-Content -LiteralPath $taskRunner -Encoding Ascii

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ('/d /c "{0}"' -f $taskRunner) -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Start-Sleep -Seconds 5
$listener = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
  throw "The startup task was installed, but nothing is listening on port 80. Review '$logPath' and Task Scheduler history for '$taskName'."
}

$address = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.AddressState -eq "Preferred" -and $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object -First 1 -ExpandProperty IPAddress

Write-Host "AECS CRM is installed and listening on port 80." -ForegroundColor Green
Write-Host "Local:   http://localhost/"
if ($address) { Write-Host "Network: http://$address/" }
