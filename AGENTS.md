# Instrucciones del proyecto — Gestor de Casos (Neogestor V6.0)

## Ruta canónica del proyecto (IMPORTANTE)

> **Este es el proyecto real y único: `C:\Users\usuario\Downloads\Proyecto\Neogestor V6.0`.**
> - El bat para abrir la app es `Abrir Gestor.bat` (dentro de esta carpeta).
> - NO usar la carpeta `C:\Users\usuario\Downloads\Proyecto\Gestor de casos V6.0`
>   (copia obsoleta) para editar, compilar ni abrir la app: usar otras rutas es
>   perjudicial para el trabajo del usuario.
> - Todas las ediciones, comandos npm y compilaciones se hacen sobre esta carpeta.

## Workflow de compilación estandarizado

> **IMPORTANTE (cambio de preferencia del usuario, 10/08/2026):**
> NO compilar portables (`npm run build:portable`) por cada cambio de código.
> Solo compilar cuando el usuario lo pida explícitamente ("compila", "arma el
> portable", etc.). Mantener el resto de la rutina (subir versión, eliminar
> portables antiguos, confirmar ruta) cuando sí se compile.

Cuando el usuario solicite compilar:

1. Subir la versión en `package.json` (campo `version`), incrementando en 1 el patch
   (ej.: 6.0.1 → 6.0.2).
2. Eliminar los archivos portables anteriores (`dist/GestorCasos-portable-*.exe`).
3. Compilar uno nuevo con: `npm run build:portable`.
4. Confirmar al usuario la ruta y la nueva versión del portable generado.

Nota: no eliminar los instaladores (`Gestor de Casos Setup *.exe`) a menos que el
usuario lo indique explícitamente.
