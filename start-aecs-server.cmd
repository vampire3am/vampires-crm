@echo off
setlocal
cd /d "%~dp0"

echo Starting AECS CRM production server on http://0.0.0.0/ ...
if not exist node_modules (
  echo Installing dependencies...
  call npm.cmd ci
  if errorlevel 1 exit /b %errorlevel%
)

call npm.cmd run serve:lan
if errorlevel 1 (
  echo.
  echo AECS CRM failed to start. Port 80 may already be in use or administrator access may be required.
  exit /b %errorlevel%
)
