# AECS Hikvision attendance bridge

This server-side bridge polls the DS-K1A8503EF-B terminal through Hikvision ISAPI, sends immutable punch events to Supabase, and lets the database calculate first-punch check-in and last-punch check-out.

The terminal may keep its configured EHome 4.0 connection enabled. This bridge does not consume port 7660; EHome push requires Hikvision's matching proprietary SDK runtime.

## Before installation

1. Apply `supabase/migrations/202610040001_hikvision_attendance_bridge.sql` in Supabase.
2. Confirm `192.168.100.84` can reach `192.168.100.80:80`.
3. Have the terminal administrator credentials and Supabase service-role key ready.
4. Assign each employee's Device User Number in HRMS.

## Install

Open Administrator PowerShell from the repository and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& ".\bridge\hikvision-attendance\install-hikvision-bridge.ps1"
```

The installer copies the bridge to `C:\ProgramData\AECS\HikvisionAttendanceBridge`, restricts its configuration to SYSTEM and Administrators, performs a live diagnostic, and registers an auto-restarting startup task.

## Manual diagnostics

```powershell
node "C:\ProgramData\AECS\HikvisionAttendanceBridge\index.mjs" "C:\ProgramData\AECS\HikvisionAttendanceBridge\bridge.config.json" --diagnose
```

Never commit `bridge.config.json`; it contains the terminal password and Supabase service-role key.
