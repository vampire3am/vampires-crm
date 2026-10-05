#Requires -RunAsAdministrator
$taskName = "AECS Hikvision Attendance Bridge"
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "The bridge task was removed. C:\ProgramData\AECS\HikvisionAttendanceBridge was preserved for recovery." -ForegroundColor Yellow
