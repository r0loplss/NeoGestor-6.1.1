# Instrucciones del proyecto — Gestor de Casos (NeoGestor 6.1.1)

## PROTECCIÓN DEL CONTENIDO DEL USUARIO (REGLAS CRÍTICAS — INQUEBRANTABLE)

> **El contenido ingresado por el usuario (tarjetas, hojas, imágenes, notas, enlaces,
> textos, colores, posición/orden y cualquier dato almacenado) NUNCA debe perderse,
> sobrescribirse, migrarse ni reformatearse sin autorización explícita del usuario.**
>
> Aplica a **ambos agentes (Antigravity y Open Code)** y a cualquier cambio de código,
> compilación, limpieza o proceso.
>
> **Prohibiciones absolutas:**
> - No tocar ni editar directamente los archivos de datos del usuario:
>   `gestor-data.json`, `gestor-fast.json`, sus `.bak` ni la carpeta `backups/`.
> - No re-sembrar hojas/tarjetas/datos "de fábrica" ni reemplazar `state.sheets`
>   sobre datos existentes.
> - No migrar, renombrar ni reformatear el almacenamiento sin backup verificado previo
>   y autorización explícita del usuario.
> - No ejecutar scripts de prueba que apunten a las rutas de datos reales.
>
> **Obligaciones antes de cualquier cambio que roce datos:**
> 1. **Respaldar primero** (copia con hash/verificación) y validar sobre **copias**,
>    nunca sobre los originales.
> 2. Preservar compatibilidad hacia atrás: datos viejos deben seguir cargando.
> 3. Si algo pudiera afectar contenido del usuario, **detenerse y pedir autorización**.
>
> Salvaguardas ya presentes que deben mantenerse y no debilitarse:
> `writeFileAtomic`, cola de guardado serializada, backups rotativos, restauración
> automática ante JSON corrupto (`src/main.js`) y backups de Fast con planificador.

## Fuente canónica del proyecto (Git) (IMPORTANTE, 21/08/2026)

> **Desde ahora la versión de referencia es el repositorio de GitHub:
> `https://github.com/r0loplss/NeoGestor-6.1.1.git` (rama `main`).**
> - Repositorio anterior archivado: `https://github.com/r0loplss/Neogestor-V6.0.git` (se mantiene como está, sin nuevos cambios).
> - El trabajo se hace sobre un clon local y los cambios se suben a ese repo
>   (puede haber clones en varias PCs; el repo es la única fuente de verdad).
> - Clonar en otra PC: `git clone https://github.com/r0loplss/NeoGestor-6.1.1.git`.
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

## Identificación y Roles de Agentes IA (IMPORTANTE, actualizado 01/10/2026)

> **Open Code** es ahora el agente principal de desarrollo:
>   - **Programación**: desarrollo de nuevas funciones, refactorizaciones y corrección de bugs en el código.
>   - **Compilación**: `package.json`, borrado de portables antiguos en `dist/` y `npm run build:portable`.
>   - **Git**: gestión completa (inicio con `git pull`; fin con `git add -A`, `git commit -m "[Open Code] ..."` y `git push`).
>   - **Publicación de Releases**: cada push que corresponda a una versión nueva debe crear/actualizar el Release en GitHub con el portable como asset y las notas de la bitácora.
>   - **Bitácora**: registro y actualización de `BITACORA.html`.
>
> **Antigravity** (Google DeepMind) pasa a ser **consultor**:
>   - Solo interviene cuando el usuario lo solicite explícitamente (revisiones, consejo técnico, análisis).
>   - **NO** programa, **NO** compila y **NO** realiza operaciones Git.
>
> **Reglas de identificación:**
> 1. **En `BITACORA.html`:** Toda nueva entrada insertada debe incluir la etiqueta del agente responsable en la cabecera `.enc`:
>    - **Open Code** (habitual): `<span class="agente oc">Open Code</span>`
>    - **Antigravity** (solo consultoría puntual): `<span class="agente agy">Antigravity</span>`
> 2. **En los mensajes de Commit:** Prefijar siempre el commit con el nombre del agente:
>    - `git commit -m "[Open Code] Descripción clara del cambio"` (Open Code es el encargado exclusivo de Git).

## Bitácora de modificaciones (BITACORA.html) (IMPORTANTE, 12/08/2026 - Actualizado 24/08/2026)

> **Cada vez que el usuario pida subir cambios a GitHub ("carga/sube a GitHub") o se registren avances de sesión:**
> ANTES de hacer el commit se debe actualizar `BITACORA.html` agregando al INICIO
> de la lista `#lista` una nueva anotación (sección `.entry`) con la fecha del día,
> etiqueta del agente responsable, y un contexto BREVE de los cambios realizados
> en esa sesión (qué se modificó, funcionalidades nuevas, correcciones, versión si aplica).
>
> - El usuario trabaja desde 2 escritorios distintos; la bitácora permite saber
>   qué se hizo en cada sesión y qué agente lo realizó.
> - **Separación estricta por fecha/día (OBLIGATORIO):** Cada día de trabajo DEBE tener su propio bloque `<section class="entry">` independiente.
>   **NUNCA** fusionar ni anexar cambios de fechas distintas en una entrada previa existente, incluso si comparten la misma versión `vX.Y.Z`.
> - Las anotaciones van con la fecha más reciente al inicio (las nuevas se
>   insertan ANTES de las existentes).
> - Seguir el formato estándar:
>   `<div class="enc"><span class="fecha">DIA mes año</span><span class="ver">vX.Y.Z</span><span class="agente agy">Antigravity</span></div>`
>   (o `<span class="agente oc">Open Code</span>` según corresponda) + descripción breve (`<ul>` o texto).
> - La bitácora se sube a GitHub junto con los cambios de la sesión.

## Workflow de compilación estandarizado (A cargo exclusivo de Open Code)

> **IMPORTANTE (24/08/2026):**
> La compilación y armado del ejecutable portable es responsabilidad exclusiva de **Open Code**.
> NO compilar portables por cada cambio de código, solo cuando el usuario lo solicite explícitamente.

Rutina de compilación (a ejecutar por Open Code):

1. Subir la versión en `package.json` (campo `version`), incrementando en 1 el patch
   (ej.: 6.1.1 → 6.1.2).
2. Eliminar los archivos portables anteriores (`dist/GestorCasos-portable-*.exe`).
3. Compilar uno nuevo con: `npm run build:portable`.
4. Confirmar al usuario la ruta y la nueva versión del portable generado.

Nota: no eliminar los instaladores (`Gestor de Casos Setup *.exe`) a menos que el
usuario lo indique explícitamente.
