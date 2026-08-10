@echo off
rem ============================================================
rem  Abre el Gestor de Casos (Neogestor V6.0)
rem  Usa la version portable si existe en dist\, si no abre
rem  el codigo actual con Electron.
rem ============================================================
cd /d "%~dp0"

set "PORTABLE="
for %%f in ("dist\GestorCasos-portable-*.exe") do set "PORTABLE=%%f"

if defined PORTABLE (
    echo Lanzando portable: %PORTABLE%
    start "" "%PORTABLE%"
) else (
    echo No hay portable, lanzando codigo con Electron...
    start "" "node_modules\.bin\electron.cmd" .
)
exit /b
