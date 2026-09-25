@echo off
setlocal
title Hospitality Atlas V5.2.0 - Clean Rebuild
cd /d "%~dp0"
set PORT=8000
set URL=http://localhost:%PORT%/?build=5.2.0
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>&1
if %errorlevel%==0 (echo [ERROR] Port %PORT% is already in use.&echo Close the older Atlas server window first.&pause&exit /b 1)
where py >nul 2>&1
if %errorlevel%==0 (set PYTHON_CMD=py -3&goto :found)
where python >nul 2>&1
if %errorlevel%==0 (set PYTHON_CMD=python&goto :found)
echo [ERROR] Python 3 not found.&pause&exit /b 1
:found
echo Hospitality Atlas V5.2.0 running at %URL%
echo Keep this window open. Ctrl+C stops the server.
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 1; Start-Process '%URL%'"
%PYTHON_CMD% -m http.server %PORT% --bind 127.0.0.1
pause
