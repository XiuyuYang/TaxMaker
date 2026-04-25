@echo off
cd /d "%~dp0"
echo.
echo ========================================
echo  TaxMaker - Deploy to Cloudflare
echo ========================================
echo.

:: Check wrangler login
npx wrangler whoami >nul 2>&1
if %errorlevel% neq 0 (
  echo Not logged in to Cloudflare. Running wrangler login...
  npx wrangler login
)

echo.
echo Step 1/4: Installing dependencies...
call npm install
cd frontend && call npm install && cd ..
cd worker && call npm install && cd ..

echo.
echo Step 2/4: Creating D1 database (skip if already exists)...
npx wrangler d1 create taxmaker-db 2>nul
echo If you see an error above, the database likely already exists - that is OK.

echo.
echo Step 3/4: Running D1 migrations...
npx wrangler d1 execute taxmaker-db --file=schema.sql --remote
if %errorlevel% neq 0 (
  echo ERROR: Failed to run schema migrations.
  pause
  exit /b 1
)

echo.
echo Step 4/4: Building frontend and deploying worker...
cd frontend && call npm run build && cd ..
npx wrangler deploy
if %errorlevel% neq 0 (
  echo ERROR: Deployment failed.
  pause
  exit /b 1
)

echo.
echo ========================================
echo  Deployment complete!
echo  Visit: https://sqdyxy.com/tax
echo ========================================
echo.
pause
