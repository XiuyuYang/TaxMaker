@echo off
cd /d "%~dp0"
echo.
echo ========================================
echo  TaxMaker - Local Development Server
echo ========================================
echo.

if not exist ".dev.vars" (
  echo ERROR: .dev.vars not found.
  echo Copy .dev.vars.example to .dev.vars and add your GEMINI_API_KEY.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing root dependencies...
  call npm install
)
if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  cd frontend && call npm install && cd ..
)
if not exist "worker\node_modules" (
  echo Installing worker dependencies...
  cd worker && call npm install && cd ..
)

echo.
echo Starting Wrangler dev (port 8787) in background...
start "Wrangler Dev" cmd /k "npx wrangler dev --local"
timeout /t 2 /nobreak >nul

echo Starting Vite dev server...
echo   App: http://localhost:5173/tax
echo.
cd frontend && npx vite
