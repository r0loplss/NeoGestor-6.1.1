# NeoApoyos — Notas de diseño

> Documento de decisiones para la interfaz de Apoyo. Se irá completando a medida que avancemos.

## Estado
- **Versión:** NeoApoyos **v0.1** (numeración propia; el motor del gestor sigue en 6.1.x).
- **Fase 0 (hecha):** modo `--apoyo` + dock real que abre las herramientas.

## Arquitectura (decidida)
- NeoApoyos es un **modo del mismo programa** (`--apoyo`) que **reutiliza `src/main.js`**.
- **Mismo `userData`** (`%APPDATA%\gestor-casos`) → mismo `gestor-data.json` / `gestor-pos.json`.
  El contenido del usuario **no se pierde ni se duplica**.
- `src/NeoApoyos/package.json` → `"start": "electron ../.. --apoyo"` (se corre con `npm start`).
- En modo apoyo la **ventana principal** carga `src/NeoApoyos/index.html` (el dock), no la UI de agente.

## Barra lateral (dock)
- Ancho base: **78px** (fijo).
- **REGLA IMPORTANTE (hover):** al pasar el mouse por un **botón/herramienta**, se ensancha **únicamente el botón** (flyout que muestra ícono + nombre). **La barra completa NO cambia de ancho ni se deforma.**
  - El ancho de la barra solo cambia si el **usuario** lo hace (arrastrar el borde / botón expandir).
  - Al quitar el mouse, el botón vuelve a su ancho normal (se contrae).
- La barra es la **única** superficie de NeoApoyos (no hay área de contenido): las herramientas se abren en **ventanas aparte**.
- Controles del pie: **Notas** (drawer), **Expandir/estrechar**, **Cerrar**.
- Estado del dock persistido: ancho, cerrado/abierto, expandido, siempre-encima, posición.

## Herramientas
- Se abren como **ventanas** (igual que en el programa), con **tamaño y posición recordados**.
- Deben adoptar el **tema "cristal líquido"** (vía CSS de tema compartido inyectado + mapeo por tool).
- Se migran **una por una**, validadas con smoke tests para no romper nada.

## Notas
- El **drawer de notas** (el aprobado en la máscara) se conecta a las **notas reales** existentes.

## Fast
- Se **mantiene el botón flotante de Fast** (no se pierde) y además Fast queda en el dock.

## Pendiente de confirmar
1. Arquitectura: modo del mismo programa (recomendado) vs app separada.
2. Barra: transparente vs fondo ambiente interno.
3. Herramientas: fondo ambiente interno (recomendado) vs transparentes.
