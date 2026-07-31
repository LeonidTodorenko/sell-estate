@echo off

set "SOURCE=C:\Data\sell_estate\sell-estate\InvestorApp"
set "TARGET=C:\App"

robocopy "%SOURCE%" "%TARGET%" /MIR ^
    /XD ^
        node_modules ^
        .git ^
        android\.gradle ^
        android\build ^
        android\app\build ^
        android\.cxx ^
        android\app\.cxx

if %ERRORLEVEL% GEQ 8 (
    exit /b %ERRORLEVEL%
)

exit /b 0