@echo off
cd /d "%~dp0"
echo Starting AECS CRM for this computer and the local network...
call npm.cmd run dev -- --host 0.0.0.0 --port 5173
echo.
echo The preview stopped. Review any error above before closing this window.
pause
