# AGENTS.md — Gestor de Casos (NeoGestor 6.1.1)

App de escritorio **Electron** (Windows x64) para operación de call center. Sin bundler: HTML + JS/CSS inline cargados directo. Windows, PowerShell 5.1.

## REGLAS CRÍTICAS — CONTENIDO DEL USUARIO (INQUEBRANTABLE)

**El contenido del usuario (tarjetas, hojas, imágenes, notas, enlaces, textos, colores, orden y cualquier dato almacenado) NUNCA debe perderse, sobrescribirse, migrarse ni reformatearse sin autorización explícita. Aplica a ambos agentes y a cualquier cambio, compilación o limpieza.**

- No editar/tocar `gestor-data.json`, `gestor-fast.json`, sus `.bak` ni `backups/`.
- No re-sembrar datos "de fábrica" ni reemplazar `state.sheets` sobre datos existentes.
- No migrar/renombrar/reformatear el almacenamiento sin backup verificado y autorización.
- No correr pruebas contra las rutas de datos reales.
- Antes de tocar algo que roce datos: **respaldar con hash y validar sobre copias**; preservar compatibilidad hacia atrás; si hay riesgo, **detenerse y preguntar**.
- Salvaguardas a mantener: `writeFileAtomic`, cola de guardado serializada, backups rotativos, restauración ante JSON corrupto (`src/main.js`) y backups de Fast con planificador.

## Comandos

En PowerShell `npm` está bloqueado (`npm.ps1`): usar siempre **`npm.cmd`**.

- `npm.cmd start` — abre la app (dev).
- `npm.cmd test` — tests con `node --test` (archivos en `test/`).
- `npm.cmd run build:portable` — genera `dist/GestorCasos-portable-<version>.exe`.
- `npm.cmd run build` — instalador NSIS + portable.
- No hay lint, typecheck ni formatter configurados.
- **No hay hot reload**: cerrar y reabrir la app para tomar cambios.

## Arquitectura

- **Proceso principal:** `src/main.js` — ventanas, IPC, persistencia y wiring del updater.
- **Renderers:** `src/index.html` (principal) y `src/tools/*.html` (herramientas satélite: `fast`, `trafico`, `contingencias`, `ciclos`, `calculadora-dias`, `occ`, `enlaces`, `horarios`, `vault`, `tipificaciones`, `note`, `alerta`, `acerca`, `imgview`, `easter`, `fast-btn`). Cada una es un `BrowserWindow` sin marco.
- Todas usan `nodeIntegration: true, contextIsolation: false` y hacen `require('electron')` directo.
- **Fast** (`src/tools/fast.html`, el más grande) tiene 4 modos de hoja: `cards`, `containers`, `images`, `process`. Estado: `state.sheets[]` con `cards[]`, `containers[]`, `rootOrder[]`. Incluye deshacer/rehacer (`Ctrl+Z`/`Ctrl+Y`) y búsqueda (Marcar/Ocultar).
- **Updater:** `src/updater.js` + UI en `index.html`/`acerca.html`. Lee `releases/latest` de GitHub, valida el host de descarga y cachea con ETag/throttle.
- Los HTML son grandes y monolíticos con JS inline: editar con cuidado y validar sintaxis extrayendo el bloque `<script>` y `node --check`.

## Datos del usuario (NO tocar sin autorización)

En `app.getPath('userData')` = `%APPDATA%\gestor-casos\`: `gestor-data.json`, `gestor-pos.json`, `gestor-fast.json`, `updater-cache.json` y `backups/`.

## Git

- **Canónico:** `https://github.com/r0loplss/NeoGestor-6.1.1.git` (rama `main`). Remoto `origin`. **Archivado:** `r0loplss/Neogestor-V6.0.git`, remoto `origin-old` (sin cambios nuevos).
- La URL de `origin` embebe un token (`x-access-token`) en `.git/config` (no versionado): **no imprimir ni commitear ese token**; `git push` ya va sin prompt.
- Clonar en otra PC: `git clone https://github.com/r0loplss/NeoGestor-6.1.1.git` y guardar credenciales con `cmdkey /generic:git:https://github.com /user:r0loplss /pass:<token>`.
- Abrir la app con **`Abrir Gestor.bat`** (dentro de la carpeta del clon). **No usar carpetas obsoletas** (p. ej. `Gestor de casos V6.0`) para editar, compilar ni abrir.
- `dist/` y `*.exe` están en `.gitignore`: los portables **no se commitean**, van a GitHub Releases. El repo debe ser **público** para que el updater consulte `releases/latest`.

## Roles de agentes

- **Open Code** (principal): programa, compila, gestiona Git, **publica Releases** y actualiza la bitácora.
- **Antigravity**: solo **consultor** cuando el usuario lo pida (no programa, no compila, no Git).
- Prefijar commits: `git commit -m "[Open Code] descripción"`.

## Bitácora (`BITACORA.html`)

Antes de cada commit, agregar al **inicio** de `#lista` una `<section class="entry">` con fecha, versión y etiqueta de agente (`<span class="agente oc">Open Code</span>` o `<span class="agente agy">Antigravity</span>`), con contexto breve. **Un bloque por día** (nunca fusionar días distintos), más reciente primero.

## Sesión y publicación

- **Inicio:** `git pull`.
- **Fin / "sube a git":** actualizar bitácora → `git add -A` → commit `[Open Code]` → `git push`.
- **Compilar y publicar** (solo cuando el usuario lo pida): 1) subir `version` en `package.json` (patch); 2) `npm.cmd run build:portable`; 3) crear/actualizar el **Release** `v<version>` con el asset `GestorCasos-portable-<version>.exe` y las notas de la bitácora; 4) push.
- No compilar portables por cada cambio. No borrar los instaladores (`Gestor de Casos Setup *.exe`) salvo indicación explícita.
