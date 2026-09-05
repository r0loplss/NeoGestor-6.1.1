# NeoGestor 6.1.1 — Gestor de Casos Call Center

![Version](https://img.shields.io/badge/version-6.1.6-blue)
![Electron](https://img.shields.io/badge/Electron-33.4.0-47848F?logo=electron)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey)
![License](https://img.shields.io/badge/license-Privado-red)

Gestor integral para operación de Call Center — tarjetas Fast de reenvío rápido, tráfico móvil, contingencias, ciclos y herramientas satélite. Portable y actualizable vía GitHub Releases.

> **Repositorio canónico:** `https://github.com/r0loplss/NeoGestor-6.1.1.git` (rama `main`)  
> Repositorio anterior archivado: `Neogestor-V6.0` (solo lectura).

---

## ✨ Funcionalidades

**Fast — Tarjetas de reenvío**
- Modos Tarjetas / Imágenes / Procesos (cuadrícula tipo Excel)
- Búsqueda precisa sin tildes, favoritos, colores y tamaños de fuente por tarjeta
- Drag & Drop con slots vacíos, auto-scroll y `🧹 Compactar` (`Ctrl+Shift+C`)
- Copiado 100% fiel (texto WhatsApp con formato `*negrita*` `_cursiva_`, imágenes lossless 2560px PNG, enlaces)

**Tráfico Móvil PRO (100% offline)**
- Análisis de planillas Excel local (`xlsx.full.min.js` empaquetado)
- Vistas Simple y Detallada, KPIs y copiado con formato WhatsApp citado (`> `)

**Radar de Contingencias PRO**
- Extracción inteligente TSV/Siebel/CRM, detección de red vs no-red, editor visual

**Otras herramientas**
- **OCC Postpago** (Solicitud SS + fecha inteligente)
- **Ciclos** y **Calculadora de Días** (hito 18 meses)
- **Horarios**, **Enlaces**, **Bóveda de Notas**, **Vault**
- **Actualizador automático** — consulta `releases/latest`, descarga y reemplazo detached del portable

---

## 📦 Instalación

**Portable (recomendado):**
1. Ve a [Releases](https://github.com/r0loplss/NeoGestor-6.1.1/releases) y descarga `GestorCasos-portable-X.Y.Z.exe`
2. Ejecuta — no requiere instalación. Se auto-actualiza desde *Ajustes → Actualizaciones del Sistema*.

**Setup:**
- `Gestor de Casos Setup X.Y.Z.exe` — instalador NSIS x64.

---

## 🚀 Uso

```powershell
git clone https://github.com/r0loplss/NeoGestor-6.1.1.git
cd NeoGestor-6.1.1
npm install
npm start          # desarrollo
npm run build:portable  # genera dist/GestorCasos-portable-*.exe
```

El bat `Abrir Gestor.bat` dentro del clon abre la app sin compilar.

---

## 🔄 Actualizaciones

Desde `Ajustes → Actualizaciones del Sistema` o `Acerca de → Buscar actualizaciones`:
1. Consulta `https://api.github.com/repos/r0loplss/NeoGestor-6.1.1/releases/latest`
2. Descarga el asset `GestorCasos-portable-*.exe` con progreso
3. Script `.bat` detached reemplaza el `.exe` bloqueado en Windows y reinicia

Cada Release incluye changelog tomado de `BITACORA.html`.

---

## 📋 Bitácora y versiones

- `BITACORA.html` — historial por sesión (fecha, versión, agente)
- `package.json:version` ↔ tag `vX.Y.Z`

---

## 🛠️ Stack

Electron 33.4.0, electron-builder 25.1.8, vanilla JS/HTML/CSS.

---

## 📄 Licencia

Uso interno privado. No distribuir fuera de la organización sin autorización.
