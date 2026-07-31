@echo off

call sync-investor-app.bat

if errorlevel 1 (
    echo Sync failed.
    exit /b 1
)

cd /d C:\App\android

call gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a

pause