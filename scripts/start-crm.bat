@echo off
setlocal
title Atlas CRM (local)
rem Starts the local Atlas CRM: Docker engine -> Postgres container -> Next dev server on :3100,
rem then opens the browser. Close this window (or Ctrl+C) to stop the app; the database keeps
rem running in Docker until "docker compose stop".

cd /d "%~dp0.."
set PORT=3100
set URL=http://localhost:%PORT%/login

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo Atlas CRM already seems to be running on port %PORT%. Opening it...
  start "" "%URL%"
  exit /b 0
)

rem 1) Docker engine
docker version >nul 2>&1
if %errorlevel%==0 goto dockerup

set "DOCKER_EXE=%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
if not exist "%DOCKER_EXE%" set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if not exist "%DOCKER_EXE%" (
  echo [ERROR] Docker Desktop not found. Install it or start it manually.
  pause
  exit /b 1
)
echo Starting Docker Desktop...
start "" "%DOCKER_EXE%"
echo Waiting for the Docker engine - can take a few minutes; check the Docker window for prompts...
set /a tries=0
:waitdocker
timeout /t 5 /nobreak >nul
docker version >nul 2>&1
if %errorlevel%==0 goto dockerup
set /a tries+=1
if %tries% GEQ 60 goto dockerfail
goto waitdocker
:dockerfail
echo [ERROR] Docker engine didn't start within 5 minutes.
pause
exit /b 1
:dockerup

rem 2) Database
echo Starting the database...
docker compose up -d postgres
if not %errorlevel%==0 goto dbfail
set /a tries=0
:waitdb
docker compose exec -T postgres pg_isready -U atlas >nul 2>&1
if %errorlevel%==0 goto dbup
set /a tries+=1
if %tries% GEQ 30 goto dbfail
timeout /t 2 /nobreak >nul
goto waitdb
:dbfail
echo [ERROR] Could not start Postgres. Try "docker compose up postgres" to see why.
pause
exit /b 1
:dbup

rem 3) Dependencies (first run / after pulling changes) and migrations
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
call npm run db:migrate >nul 2>&1
if %errorlevel%==0 goto migrated
echo [ERROR] Database migration failed. Run "npm run db:migrate" to see why.
pause
exit /b 1
:migrated

rem 4) Open the browser once the server answers, then run the dev server in this window
start "" /min powershell.exe -NoProfile -WindowStyle Hidden -Command ^
  "for($i=0;$i -lt 90;$i++){try{Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 2 | Out-Null; Start-Process '%URL%'; break}catch{Start-Sleep 2}}"

echo.
echo Atlas CRM: %URL%   (sign in as admin@dev.local)
echo Keep this window open. Close it or press Ctrl+C to stop.
echo.
call npm run dev -- -p %PORT%
pause
