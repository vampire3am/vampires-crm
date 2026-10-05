# Hikvision fingerprint attendance setup

This integration supports the AECS Hikvision DS-K1A8503EF-B at `192.168.100.80`. The CRM server at `192.168.100.84` polls fingerprint events over ISAPI HTTP with Digest authentication and sends them to Supabase through a server-only bridge.

## Attendance rules

- The first accepted fingerprint punch in a Nepal calendar day is check-in.
- The last accepted punch becomes check-out after at least two punches exist.
- Extra punches update the last check-out; they do not create breaks.
- Repeated punches within 30 seconds are retained in the audit log and ignored for calculation.
- Every raw event is retained, including an event whose device user number has not been mapped.
- A manual HR attendance correction is never overwritten by a later device sync.
- All date boundaries use `Asia/Kathmandu`.

## Work completed in the repository

- Supabase schema, row-level security, role permissions, event ingestion and first/last aggregation
- Employee-to-device user number mapping in onboarding and employee profiles
- CRM device health, sync error and unmapped punch display
- Digest-authenticated ISAPI polling bridge with overlap polling and idempotent event IDs
- Windows startup task with automatic restart, restricted secret storage and diagnostics

The terminal currently has EHome enabled with address type `IP`, server `192.168.100.84`, port `7660`, version `EHome 4.0` and account `aecs`; those values are recorded in the CRM device inventory. The working bridge still uses ISAPI because an EHome endpoint requires Hikvision's proprietary EHome 4.0 SDK libraries. EHome may stay enabled on the terminal, but the current bridge does not listen on `7660` and the Windows firewall does not need that port opened. An EHome receiver can replace polling later when Hikvision supplies the matching SDK package and license for this terminal.

## Work the server administrator must do

1. In Supabase SQL Editor, run the complete file `supabase/migrations/202610040001_hikvision_attendance_bridge.sql` once.
2. In CRM **HRMS → Employees**, edit each employee and copy the exact terminal user ID into **Device User Number**. For the currently photographed terminal these appear to be `1` Arun, `2` Aashish, `3` Lata, `4` Sudhan and `5` Madan. Confirm the names before saving.
3. Confirm the Windows CRM server can reach the device:

   ```powershell
   Test-NetConnection 192.168.100.80 -Port 80
   ```

4. Install Node.js 20 or newer on the server if `node --version` is unavailable.
5. Open **Administrator PowerShell** in the repository and run:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   & ".\bridge\hikvision-attendance\install-hikvision-bridge.ps1"
   ```

   Enter the terminal administrator password and the Supabase **service_role** key when prompted. The key belongs only in the server bridge. Never put it in a browser `.env` file or commit it to Git.

6. Thumb once and refresh **HRMS → Attendance**. The device panel should become green and show the punch. Thumb again later; that punch becomes check-out.

## Device settings to verify

| Setting | Value |
| --- | --- |
| Device IP | `192.168.100.80` |
| Subnet mask | `255.255.255.0` |
| Gateway | `192.168.100.1` |
| HTTP port | `80` |
| Server IP | `192.168.100.84` |
| EHome | On · IP · `192.168.100.84:7660` · EHome 4.0 · account `aecs` |
| Time zone | Kathmandu / UTC+05:45 |
| NTP | Enabled and pointed to a reachable time source |

The device and Windows server clocks must agree. A wrong device clock creates a punch on the wrong attendance date.

## Diagnostics and recovery

Run a one-time live diagnostic:

```powershell
node "C:\ProgramData\AECS\HikvisionAttendanceBridge\index.mjs" "C:\ProgramData\AECS\HikvisionAttendanceBridge\bridge.config.json" --diagnose
```

Check the background task:

```powershell
Get-ScheduledTask -TaskName "AECS Hikvision Attendance Bridge"
Get-ScheduledTaskInfo -TaskName "AECS Hikvision Attendance Bridge"
Get-Content "C:\ProgramData\AECS\HikvisionAttendanceBridge\bridge.log" -Tail 100
```

Remove the bridge without deleting database attendance history:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& ".\bridge\hikvision-attendance\uninstall-hikvision-bridge.ps1"
```

## Acceptance test

1. Map a test employee's terminal ID in CRM.
2. Make one fingerprint punch. Within about 30 seconds the daily record must show check-in and no check-out.
3. Punch again after more than 30 seconds. The daily record must show the first punch as check-in and the second as check-out.
4. Make a third punch. Check-in must remain unchanged and check-out must move to the third punch.
5. Punch with an unmapped device user. No employee attendance record should be changed, and the device panel must show an unmapped ID.
6. Make a manual HR correction and wait for another sync. The manual record must remain unchanged.
