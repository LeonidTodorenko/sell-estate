@echo off
setlocal

set "SOURCE=C:\Data\sell_estate\sell-estate\InvestorApp"
set "TARGET=C:\App"

echo ==========================================
echo Syncing React Native project...
echo Source: %SOURCE%
echo Target: %TARGET%
echo ==========================================

if not exist "%TARGET%" (
    mkdir "%TARGET%"
)

robocopy "%SOURCE%" "%TARGET%" /MIR ^
    /XD ^
        node_modules ^
        .git ^
        android\.gradle ^
        android\build ^
        android\app\build ^
        android\.cxx ^
        android\app\.cxx ^
    /XF ^
        npm-debug.log ^
        yarn-error.log

set "ROBOCOPY_EXIT=%ERRORLEVEL%"

if %ROBOCOPY_EXIT% GEQ 8 (
    echo.
    echo ERROR: Robocopy failed with exit code %ROBOCOPY_EXIT%.
    exit /b %ROBOCOPY_EXIT%
)

echo.
echo Sync completed.

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
echo Starting Android release build...

cd /d "%TARGET%\android"

call gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a

if errorlevel 1 (
    echo.
    echo ERROR: Android build failed.
    exit /b 1
)

echo.
echo ==========================================
echo BUILD SUCCESSFUL
echo APK folder:
echo %TARGET%\android\app\build\outputs\apk\release
echo ==========================================

endlocal
pause