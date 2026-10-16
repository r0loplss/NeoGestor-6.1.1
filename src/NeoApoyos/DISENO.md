# NeoApoyos — Notas de diseño

> Interfaz de Apoyo. Modo `--apoyo` del NeoGestor (mismo motor y datos).

## Estado
- **Versión:** NeoApoyos **v0.2** (numeración propia; el motor del gestor sigue en 6.1.x).
- Motor: `--apoyo` reutiliza `src/main.js` (herramientas, ventanas con tamaño guardado, datos, IPC).
- **Mismo `userData`** (`%APPDATA%\gestor-casos`) → el contenido **no se pierde ni se duplica**.

## Arquitectura de ventana (v0.2)
- **Ventana de 78px, SIN click-through** (antes: 460px transparente con click-through → "ventana fantasma").
- **Arrastre NATIVO** (`-webkit-app-region: drag`): se eliminó el drag por `setInterval(16ms)`.
- **Crecimiento bajo demanda** (`setSize`): reposo 96px · hover/flyout 320px · Notas/Ajustes 452px.
- **Snap bipolar**: al soltar se imanta al lado más cercano (izquierda/derecha) + toggle en Ajustes.
- **Altura manual** (tirador inferior, sin loops) con `min 380 / max workArea-20`, ancho bloqueado, persistida en `gestor-pos.json`.
- **Ghost mode**: opacidad ~18% tras 1.5s inactiva.
- **Modo Contenedor (auto-ocultar)**: se repliega al borde (franja de 3px); reingreso con poll de baja frecuencia (~120ms) solo cuando está oculto.
- **Fast**: botón flotante (44×44, cristal, sigue el tono) contiguo a la barra; se repliega con ella.

## Tema "cristal líquido"
- Skin inyectado (`src/NeoApoyos/theme/glass.css` + `glass.js`) en cada herramienta.
- **Tono** (acento): paleta curada **cian · azul · índigo · violeta · turquesa** (se quitaron verde/ámbar/rosa por choque semántico).
- **Tema**: **Claro · Auto (sistema) · Nocturno** + **preview** + **reset**.
- Se oculta el toggle de tema propio de las tools (lo maneja NeoApoyos).
- `backdrop-filter` **solo** en contenedores principales (rendimiento).
- **Modo luz**: best-effort (algunas tools tienen colores hardcodeados; se pulirán por iteración).

## Notas
- Drawer conectado a las **notas reales** (`notes`, máx 10); toast en `note-limit-reached`.

## Pendiente
- Modo luz fino por herramienta (las pesadas: fast, ciclos).
- Afinar opacidad del cristal y detalles por tool.

## Auditoría v0.2.1 (correcciones aplicadas)
- **✕ de cierre** restaurado en el pie (cierra la app).
- **Multi-monitor**: se persiste `displayId` y el dock reabre en el monitor donde estaba.
- **Sensor de borde** valida **X e Y** y **no dispara** si hay un monitor contiguo en ese lado.
- **Flyout en ventana overlay separada** (`flyout.html`): el dock **ya no se redimensiona al pasar el mouse** (menos carga DWM); solo crece al abrir Notas/Ajustes.
- **Snap solo al soltar**: se usa el evento nativo `WM_EXITSIZEMOVE` (no hay imán a mitad del arrastre).
- **Ghost** también al perder **foco** (clic en otra ventana), no solo al salir el mouse.

## Auditoría v0.2.2 (correcciones aplicadas)
- **Deadlock de auto-ocultar**: `ocultarDock()` no oculta si el borde **no tiene sensor** (monitor contiguo); y el **poll de borde corre siempre que esté oculto** (manual o auto) → nunca queda sepultada.
- **Fast** reaparece: al terminar la animación de entrada se reposiciona y muestra.
- **Flyout sin píldora vacía**: se **pre-crea** al abrir el dock y se envían los datos en `dom-ready`.
- **Tema/tono** se propaga también a **Fast** y al **flyout**.
- **⤺ (Ocultar)** funciona siempre (acción manual), no solo con auto-ocultar activo.
- **Scroll de la lista** oculta el flyout (evita desfase vertical).
- **✕ de cierre** movida a la **corona superior** (separada del pie) para evitar clics accidentales.
- **Ajustes** ahora se abre **al lado de la barra** (no tapa el dock) y tiene su propia **✕**.

## Auditoría v0.2.3 (correcciones aplicadas)
- **✕ de la corona** con `-webkit-app-region: no-drag` (recibe el clic; ya no se interpreta como arrastre).
- **Fast** se **oculta** mientras hay un panel abierto (Notas/Ajustes) y reaparece al cerrarlo.
- **Notas y Ajustes mutuamente excluyentes** y ambos **toggle**; se cierran con **Esc** o al elegir una herramienta.
- **Filamento `.edge`** ahora queda visible al auto-ocultarse (se invierte el anclaje según `hidden`).
- **Altura** acotada contra el borde inferior (`b.y + h <= wa.y + wa.height`) en resize y snap.
- **Desconexión de pantallas**: se escucha `display-removed`/`display-metrics-changed` y se reancla si la ventana queda fuera.
- **Salida limpia**: `apoyo-quit` persiste posición/altura y hace `flushSavePos()` antes de salir.
- **Alineación/animación**: Notas y Ajustes alineados a 95px y ambos con transición; el dock no se encoge hasta terminar la animación de cierre.
- **Estado de Fast** sincronizado (`fast-docked-state` → botón activo).
- **Ghost** también atenúa el botón de Fast (opacidad solidaria).
- **Scrollbar** fina en la lista de herramientas (indica que hay scroll).

## Auditoría v0.2.4 (correcciones aplicadas)
- **Sin parpadeo al abrir paneles**: Notas y Ajustes pasaron a **ventanas propias** (`notas.html` / `ajustes.html`). El dock **ya no se redimensiona nunca** (siempre 78px) → se elimina el flash de DWM y el "movimiento extraño" de los paneles.
- Las ventanas de panel se posicionan **junto a la barra** (según el lado), se ocultan entre sí (excluyentes) y se cierran con **Esc** o su **✕**.
- **Fast** se oculta mientras hay un panel abierto.
- **Ghost** ahora también **atenúa el botón de Fast** (opacidad solidaria).
