@echo off
rem ---------------------------------------------------------------------
rem  Naplanovany beh Cmuchala nad frontou objednavek pruzkumu.
rem
rem  Spousti se ze Spravce uloh (viz skripty/NAPLANOVANI.md). Bez parametru
rem  vyridi bezne objednavky; s parametrem "urgent" jen ty spechajici.
rem
rem  Soubor je zamerne .cmd bez diakritiky — Spravce uloh a konzole si
rem  s cestinou v davkovem souboru neporadi spolehlive.
rem ---------------------------------------------------------------------

cd /d "%~dp0.."

if /i "%~1"=="urgent" (
  call npm run cli -- pruzkum obsluz --jen-urgentni --nejvyse-objednavek 1 >> "%~dp0..\data\cmuchal-fronta.log" 2>&1
) else (
  call npm run cli -- pruzkum obsluz --nejvyse-objednavek 3 >> "%~dp0..\data\cmuchal-fronta.log" 2>&1
)

exit /b %errorlevel%
