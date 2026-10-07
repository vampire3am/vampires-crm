#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
$installRoot = "C:\ProgramData\AECS\HikvisionAttendanceBridge"
$taskName = "AECS Hikvision Attendance Bridge"
$node = (Get-Command node -ErrorAction Stop).Source
$nodeVersion = & $node --version
if ([version]($nodeVersion.TrimStart('v')) -lt [version]"20.0.0") { throw "Node.js 20 or newer is required." }

Write-Host "Installing AECS Hikvision Attendance Bridge" -ForegroundColor Cyan
if (-not (Test-NetConnection 192.168.100.80 -Port 80 -InformationLevel Quiet)) {
  throw "The Hikvision terminal is not reachable at 192.168.100.80:80. Check its cable, IP and network first."
}

$deviceUser = Read-Host "Hikvision administrator username [admin]"
if ([string]::IsNullOrWhiteSpace($deviceUser)) { $deviceUser = "admin" }
$deviceSecurePassword = Read-Host "Hikvision administrator password" -AsSecureString
$serviceSecureKey = Read-Host "Supabase secret key (sb_secret_...) or legacy service-role key" -AsSecureString
$toPlain = { param($secret) $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)} }
$devicePassword = & $toPlain $deviceSecurePassword
$serviceRoleKey = & $toPlain $serviceSecureKey
if ([string]::IsNullOrWhiteSpace($devicePassword) -or [string]::IsNullOrWhiteSpace($serviceRoleKey)) { throw "Both secrets are required." }

New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
Copy-Item "$PSScriptRoot\*.mjs" $installRoot -Force
$config = [ordered]@{
  deviceIp = "192.168.100.80"; deviceHttpPort = 80; deviceSerial = "GR6140877"
  deviceUsername = $deviceUser; devicePassword = $devicePassword
  supabaseUrl = "https://igzrcgicslcgbowzrtzz.supabase.co"; supabaseServiceRoleKey = $serviceRoleKey
  pollSeconds = 30; overlapMinutes = 10; initialLookbackDays = 7
  logPath = "$installRoot\bridge.log"
}
$configPath = Join-Path $installRoot "bridge.config.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json), $utf8NoBom)
& icacls $installRoot /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null

$stdout = Join-Path $installRoot "bridge.log"
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$installRoot\index.mjs`" `"$configPath`"" -WorkingDirectory $installRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "Testing terminal and database connectivity..." -ForegroundColor Cyan
& $node "$installRoot\index.mjs" $configPath --diagnose 2>&1 | Tee-Object -FilePath $stdout
if ($LASTEXITCODE -ne 0) { throw "Diagnostics failed. Review $stdout before starting the background task." }
Start-ScheduledTask -TaskName $taskName
Write-Host "Bridge installed and started. Log: $stdout" -ForegroundColor Green
