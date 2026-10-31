@echo off
rem Double-click to rebuild docs/. Then commit and push in GitHub Desktop to deploy.
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto failed
)

call npm run build
if errorlevel 1 goto failed

call node scripts/update-directory.js
if errorlevel 1 goto failed

echo.
echo Build succeeded. Commit and push in GitHub Desktop to deploy.
if not defined NO_PAUSE pause
exit /b 0

:failed
echo.
echo BUILD FAILED. See the errors above. Nothing is ready to deploy.
if not defined NO_PAUSE pause
exit /b 1
