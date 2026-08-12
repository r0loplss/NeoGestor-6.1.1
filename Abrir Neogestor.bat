@echo off
rem ============================================================
rem  Abre el Gestor de Casos (Neogestor V6.0)
rem  Ruta correcta del proyecto: C:\Users\rolta\Downloads\Proyecto Gestor\Neogestor V6.0
rem  Usa la version portable si existe en dist\, si no abre
rem  el codigo actual con Electron.
rem ============================================================
set "RUTA=C:\Users\rolta\Downloads\Proyecto Gestor\Neogestor V6.0"

if not exist "%RUTA%" (
    echo ERROR: No se encontro la carpeta del proyecto en:
    echo %RUTA%
    echo Verifica la ruta en este archivo .bat
    pause
    exit /b 1
)

cd /d "%RUTA%"

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
