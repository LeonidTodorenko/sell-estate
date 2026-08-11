@echo off
setlocal

set "SOURCE=C:\Data\sell_estate\sell-estate\InvestorApp"
set "TARGET=C:\App"

echo ==========================================
echo Syncing React Native project for Debug...
echo Source: %SOURCE%
echo Target: %TARGET%
echo ==========================================

call "%~dp0sync-investor-app.bat"

if errorlevel 1 (
    echo.
    echo ERROR: Sync failed.
    exit /b 1
)

cd /d "%TARGET%"

if not exist "node_modules" (
    echo.
    echo node_modules not found. Running npm ci...
    call npm ci

    if errorlevel 1 (
        echo.
        echo ERROR: npm ci failed.
        exit /b 1
    )
)

echo.
echo Starting Android Debug build...
echo.

call npx react-native run-android --active-arch-only

if errorlevel 1 (
    echo.
    echo ERROR: Android Debug build failed.
    exit /b 1
)

echo.
echo ==========================================
echo DEBUG BUILD SUCCESSFUL
echo ==========================================

endlocal
pause