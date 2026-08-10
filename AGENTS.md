# Instrucciones del proyecto — Gestor de Casos (Neogestor V6.0)

## Fuente canónica del proyecto (Git) (IMPORTANTE, 10/08/2026)

> **Desde ahora la versión de referencia es el repositorio de GitHub:
> `https://github.com/r0loplss/Neogestor-V6.0.git` (rama `main`).**
> - El trabajo se hace sobre un clon local y los cambios se suben a ese repo
>   (puede haber clones en varias PCs; el repo es la única fuente de verdad).
> - Clonar en otra PC: `git clone https://github.com/r0loplss/Neogestor-V6.0.git`.
> - Guardar credenciales en esa PC:
>   `cmdkey /generic:git:https://github.com /user:r0loplss /pass:<token>`.
> - El bat para abrir la app es `Abrir Gestor.bat` (dentro de la carpeta local).
> - NO usar carpetas obsoletas (p. ej. `Gestor de casos V6.0`) para editar,
>   compilar ni abrir la app.
> - Todas las ediciones, comandos npm y compilaciones se hacen sobre la carpeta
>   del clon local.

## Workflow Git (inicio y fin de sesión)

> Al comenzar a trabajar: `git pull` (traer lo último del repo).
> Al terminar de trabajar, subir los cambios:
> 1. `git add -A`
> 2. `git commit -m "mensaje descriptivo del cambio"`
> 3. `git push`

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
