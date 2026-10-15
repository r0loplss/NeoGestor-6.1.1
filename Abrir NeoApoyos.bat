@echo off
rem ============================================================
rem  Abre NeoApoyos (interfaz de apoyo) en Electron, sin marco.
rem  Alternativa:  cd src\NeoApoyos  &&  npm start
rem ============================================================
cd /d "%~dp0"
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0src\NeoApoyos"
exit /b
