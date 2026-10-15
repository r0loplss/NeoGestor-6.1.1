@echo off
rem ============================================================
rem  Abre NeoApoyos (barra lateral) en Electron.
rem  Alternativa:  cd src\NeoApoyos  &&  npm start
rem ============================================================
cd /d "%~dp0"
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0" --apoyo
exit /b
