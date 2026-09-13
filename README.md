# NeoGestor — Gestor de Casos Call Center

![Release](https://img.shields.io/github/v/release/r0loplss/NeoGestor-6.1.1?sort=semver&display_name=release)
![Electron](https://img.shields.io/badge/Electron-33.4.0-47848F?logo=electron&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey)
![Uso](https://img.shields.io/badge/uso-interno-yellow)

Gestor integral para operación de call center: tarjetas Fast de reenvío rápido, tráfico móvil, contingencias, ciclos y herramientas satélite. Se distribuye como portable y se actualiza desde GitHub Releases.

---

## ✨ Funcionalidades

**Fast — Tarjetas de reenvío**
- Modos Tarjetas / Imágenes / Procesos (cuadrícula tipo planilla)
- Búsqueda precisa sin tildes, favoritas, colores y tamaños de fuente por tarjeta
- Arrastrar y soltar con espacios vacíos, auto-scroll y `🧹 Compactar` (`Ctrl+Shift+C`)
- Copiado fiel (texto con formato WhatsApp `*negrita*` `_cursiva_`, imágenes PNG de alta resolución, enlaces)

**Tráfico Móvil PRO (100% offline)**
- Análisis de planillas Excel con librería empaquetada localmente
- Vistas Simple y Detallada, KPIs y copiado con formato WhatsApp citado (`> `)

**Radar de Contingencias PRO**
- Extracción inteligente TSV/Siebel/CRM, detección de red vs. no-red, editor visual

**Otras herramientas**
- **OCC Postpago** (solicitud SS + fecha inteligente)
- **Ciclos** y **Calculadora de Días**
- **Horarios**, **Enlaces**, **Bóveda de Notas**
- **Actualizador automático** — consulta el último Release, descarga y reemplaza el portable

---

## 📦 Instalación

**Portable (recomendado):**
1. Ve a [Releases](https://github.com/r0loplss/NeoGestor-6.1.1/releases) y descarga el `GestorCasos-portable-*.exe` más reciente
2. Ejecútalo — no requiere instalación. Se actualiza desde *Ajustes → Actualizaciones del sistema*

**Instalador:**
- `Gestor de Casos Setup *.exe` — instalador NSIS x64

---

## 🚀 Desarrollo

```powershell
git clone https://github.com/r0loplss/NeoGestor-6.1.1.git
cd NeoGestor-6.1.1
npm install
npm start               # desarrollo
npm run build:portable  # genera dist/GestorCasos-portable-*.exe
```

---

## 🔄 Actualizaciones

Desde *Ajustes → Actualizaciones del sistema* o *Acerca de → Buscar actualizaciones*:
1. Consulta el último Release publicado
2. Descarga el portable con barra de progreso
3. Un script auxiliar reemplaza el `.exe` en uso y reinicia la app

Cada Release incluye sus notas de cambios.

---

## 🛠️ Stack

Electron 33, electron-builder 25, vanilla JS/HTML/CSS.

---

## 📄 Licencia

Uso interno — no redistribuir fuera de la organización sin autorización.
