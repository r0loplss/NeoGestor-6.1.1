# NeoApoyos — Notas de diseño

> Documento de decisiones para la interfaz de Apoyo.

## Estado
- **Versión:** NeoApoyos **v0.1** (numeración propia; el motor del gestor sigue en 6.1.x).
- **Fase 0 (hecha):** modo `--apoyo` + dock lateral que abre las herramientas.
- **Tema cristal + luz/nocturno (hecho):** skin inyectado en TODAS las herramientas.
- **Fast (hecho):** botón flotante reestilizado (cristal) y reubicado junto a la barra.

## Arquitectura
- NeoApoyos es un **modo del mismo programa** (`--apoyo`) que **reutiliza `src/main.js`**.
- **Mismo `userData`** (`%APPDATA%\gestor-casos`) → mismo `gestor-data.json` / `gestor-pos.json`.
  El contenido del usuario **no se pierde ni se duplica**.
- `src/NeoApoyos/package.json` → `"start": "electron ../.. --apoyo"` (se corre con `npm start`).

## Barra lateral (dock)
- Ancho **FIJO de 78px**. No se expande la barra.
- **Hover:** se ensancha **únicamente el botón** (flyout con ícono + nombre) y **sale de la barra**;
  al quitar el mouse, se contrae. La barra **no** cambia de ancho.
- **Movible:** se arrastra desde la barra y se **ancla a la izquierda o derecha** de la pantalla
  (el flyout y los paneles se reflejan según el lado).
- Controles del pie: **Notas**, **Ajustes**, **Cerrar barra** (colapsa a un handle).
- **Click-through:** solo la barra y los paneles capturan el mouse.

## Tema "cristal líquido" (skin)
- Archivos: `src/NeoApoyos/theme/glass.css` + `glass.js` (se **inyectan** en cada herramienta).
- Cambia **modo luz/nocturno** y **tono** en **todas** las herramientas (el tono = `--primary`).
- Se controla desde **Ajustes** del dock; se guarda en `gestor-data.json` (`apoyoTheme`) y se
  propaga a las ventanas abiertas.

## Herramientas
- Se abren como **ventanas** (igual que en el programa), con **tamaño y posición recordados**.
- Adoptan el tema cristal automáticamente (sin tocar su lógica).

## Notas
- Drawer de cristal en el dock (diseño aprobado) **conectado a las notas REALES** del gestor
  (mismo dato `notes: [{id, content}]`, máx 10). Lista, buscador, crear (＋ Nueva), eliminar y
  abrir la nota (usa las ventanas de nota existentes, ya tematizadas).
- Sincroniza en vivo con `notes-updated`.

## Fast
- Botón **flotante** reestilizado (cristal, sigue el tono) y **reubicado junto a la barra**.
- No se pierde su función (abre/cierra Fast; atajo Ctrl+Shift+F).

## Pendiente
- Pulir detalles por herramienta (algunos textos/colores propios pueden necesitar ajuste fino).
