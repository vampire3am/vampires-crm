@echo off
cd /d "%~dp0"
echo Starting AECS preview...
call npm.cmd run dev -- --host 127.0.0.1
echo.
echo The preview stopped. Review any error above before closing this window.
pause
