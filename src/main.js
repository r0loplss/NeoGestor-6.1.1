const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, shell, net } = require('electron');
const path = require('path');
const fs   = require('fs');

const DATA_FILE = path.join(app.getPath('userData'), 'gestor-data.json');
const POS_FILE  = path.join(app.getPath('userData'), 'gestor-pos.json');

const ROOT  = app.getAppPath();
const SRC   = path.join(ROOT, 'src');
const TOOLS = path.join(ROOT, 'src', 'tools');

// ============================================================
// SISTEMA DE ACTUALIZACIÓN (GitHub Releases)
// ============================================================
const updater = require('./updater');
updater.initUpdater(ipcMain);

// ============================================================
// RUTAS DE HTML (con nuevas herramientas)
// ============================================================
const HTML = {
  index:         path.join(SRC,   'index.html'),
  occ:           path.join(TOOLS, 'occ.html'),
  enlaces:       path.join(TOOLS, 'enlaces.html'),
  note:          path.join(TOOLS, 'note.html'),
  contingencias: path.join(TOOLS, 'contingencias.html'),
  trafico:       path.join(TOOLS, 'trafico.html'),
  alerta:        path.join(TOOLS, 'alerta.html'),
  // NUEVAS HERRAMIENTAS
  calculadora:   path.join(TOOLS, 'calculadora-dias.html'),
  ciclos:        path.join(TOOLS, 'ciclos.html'),
  tipificaciones:path.join(TOOLS, 'tipificaciones.html'),
  fast:          path.join(TOOLS, 'fast.html'),
  fastBtn:       path.join(TOOLS, 'fast-btn.html'),
  vault:         path.join(TOOLS, 'vault.html'),
  horarios:      path.join(TOOLS, 'horarios.html'),
  acerca:        path.join(TOOLS, 'acerca.html'),
  easter:        path.join(TOOLS, 'easter.html'),
  imgview:       path.join(TOOLS, 'imgview.html')
};

let mainWin = null;
let alertaWin = null;

// ── SISTEMA DE VENTANAS CENTRALIZADO ──
const toolWins = new Map();
const noteWins = new Map();
const pinnedNotes = new Set(); 
let isQuitting = false; 
let alertDataCache = null; 

// ── CONFIGURACIÓN DE HERRAMIENTAS ──
const TOOLS_CONFIG = {
  'occ':           { file: HTML.occ,           w: 320, h: 650, resize: false, top: false },
  'enlaces':       { file: HTML.enlaces,       w: 320, h: 600, resize: true,  top: false },
  'contingencias': { file: HTML.contingencias, w: 340, h: 500, resize: true,  top: true  },
  'trafico':       { file: HTML.trafico,       w: 450, h: 600, resize: true,  top: false },
  // NUEVAS HERRAMIENTAS
  'calculadora-dias': { file: HTML.calculadora, w: 380, h: 480, resize: true, top: false },
  'ciclos':           { file: HTML.ciclos,     w: 480, h: 580, resize: true, top: false },
  'tipificaciones':   { file: HTML.tipificaciones, w: 1000, h: 700, resize: true, top: false },
  'fast':             { file: HTML.fast,       w: 1000, h: 900, resize: true, top: false },
  'notas-vault':      { file: HTML.vault,      w: 460, h: 560, resize: true,  top: false },
  'horarios':         { file: HTML.horarios,   w: 460, h: 580, resize: true,  top: false }
};

// ── LÓGICA DE PERSISTENCIA SEGURA (COLA + BACKUP + ESCRITURA ATÓMICA) ──
let isSaving = false;
let saveQueue = [];
const BACKUP_DIR = path.join(app.getPath('userData'), 'backups');
const MAX_BACKUPS = 20;

function ensureBackupDir() {
  try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (e) { console.error('Error creando directorio de backups:', e); }
}

function writeFileAtomic(filePath, content) {
  const tmpPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    let renamed = false;
    for (let i = 0; i < 4; i++) {
      try {
        fs.renameSync(tmpPath, filePath);
        renamed = true;
        break;
      } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') {
          // Breve espera síncrona para que el antivirus o indexador de Windows libere el handle
          const start = Date.now();
          while (Date.now() - start < 30) {}
        } else {
          throw err;
        }
      }
    }
    if (!renamed) {
      // Fallback seguro: escribir directamente sobre el archivo destino si Windows bloquea el renombrado
      fs.writeFileSync(filePath, content, 'utf8');
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  } catch (err) {
    // Si falló el archivo temporal, intentar escritura directa como último recurso
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    } catch (fallbackErr) {
      console.error(`Error crítico escribiendo en ${filePath}:`, fallbackErr);
      throw fallbackErr;
    }
  }
}

// Copia el estado actual a backups/ y rota manteniendo solo las últimas MAX_BACKUPS
function rotateBackup() {
  try {
    ensureBackupDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(BACKUP_DIR, `gestor-data-${stamp}.json`);
    fs.copyFileSync(DATA_FILE, dest);
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => /^gestor-data-.*\.json$/.test(f))
      .sort();
    while (files.length > MAX_BACKUPS) {
      const oldest = files.shift();
      fs.unlinkSync(path.join(BACKUP_DIR, oldest));
    }
  } catch (e) { console.error('Error en backup rotativo:', e); }
}

// Restaura el último backup válido (usado si el archivo principal se corrompe)
function restoreLatestBackup() {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => /^gestor-data-.*\.json$/.test(f))
      .sort();
    const latest = files[files.length - 1];
    if (!latest) return null;
    const raw = fs.readFileSync(path.join(BACKUP_DIR, latest), 'utf8');
    const parsed = JSON.parse(raw);
    writeFileAtomic(DATA_FILE, raw);
    console.log('Se restauró gestor-data.json desde el backup:', latest);
    return parsed;
  } catch (e) { console.error('No se pudo restaurar backup:', e); return null; }
}

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (err) {
    console.error('gestor-data.json corrupto, intentando restaurar último backup:', err);
    const restored = restoreLatestBackup();
    if (restored) return restored;
    return {};
  }
}

function processSaveQueue() {
  if (isSaving || saveQueue.length === 0) return;
  isSaving = true;
  const patch = saveQueue.shift();
  try {
    const d = loadData();
    const merged = Object.assign({}, d);
    Object.keys(patch).forEach(key => {
      const incoming = patch[key];
      // Guardia: nunca pisar una clave con undefined/null
      if (incoming === undefined || incoming === null) return;
      const existing = merged[key];
      if (Array.isArray(existing) && existing.length > 0 && Array.isArray(incoming) && incoming.length === 0) {
        console.warn(`[guardia] '${key}' pasa de ${existing.length} items a 0. Se aplica, pero el estado anterior queda respaldado en backups/.`);
      }
      merged[key] = incoming;
    });
    // Backup del estado anterior antes de sobrescribir
    if (fs.existsSync(DATA_FILE)) rotateBackup();
    writeFileAtomic(DATA_FILE, JSON.stringify(merged));
  } catch (error) {
    console.error('Error crítico al guardar datos:', error);
  } finally {
    isSaving = false;
    processSaveQueue();
  }
}

function saveData(patch) { 
  saveQueue.push(patch); 
  processSaveQueue(); 
}

let pendingPosPatch = {};
let savePosTimer = null;

function loadPos() { 
  try { return JSON.parse(fs.readFileSync(POS_FILE, 'utf8')); } 
  catch { return {}; } 
}

function flushSavePos() {
  if (savePosTimer) {
    clearTimeout(savePosTimer);
    savePosTimer = null;
  }
  if (!pendingPosPatch || Object.keys(pendingPosPatch).length === 0) return;
  const toSave = Object.assign({}, pendingPosPatch);
  pendingPosPatch = {};
  try {
    const p = loadPos(); 
    Object.assign(p, toSave); 
    writeFileAtomic(POS_FILE, JSON.stringify(p));
  } catch (err) {
    console.warn('Error no fatal al persistir posiciones en gestor-pos.json:', err && err.message ? err.message : err);
  }
}

function savePos(patch) { 
  if (!patch) return;
  Object.assign(pendingPosPatch, patch);
  if (savePosTimer) clearTimeout(savePosTimer);
  savePosTimer = setTimeout(() => {
    flushSavePos();
  }, 300);
}

function getPos(key, defaults) { 
  const p = Object.assign({}, loadPos(), pendingPosPatch);
  return p[key] || defaults; 
}

// ── SOPORTE PARA "ALWAYS ON TOP" ──
function getAlwaysOnTopPreference() {
  const data = loadData();
  return data.alwaysOnTop !== undefined ? data.alwaysOnTop : true; // por defecto true
}

function setAlwaysOnTopPreference(value) {
  saveData({ alwaysOnTop: value });
  
  // Solo afecta a la ventana principal, la alerta y el botón flotante Fast.
  // Las herramientas, notas y el visor de imagen NO participan de esta opción.
  try {
    // Ventana principal
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.setAlwaysOnTop(value);
    }
    
    // Alerta (acompaña a la ventana principal)
    if (alertaWin && !alertaWin.isDestroyed()) {
      alertaWin.setAlwaysOnTop(value);
    }

    // Botón flotante Fast: visible solo con la app activa (fade in/out)
    refreshFastBtnVisibility();
  } catch (err) {
    console.warn('Error al aplicar AlwaysOnTop a ventanas:', err);
  }
}

// ── INTELIGENCIA ESPACIAL (MULTI-MONITOR) ──
function toolPos(key, toolWidth) {
  const saved = loadPos()[key];
  if (saved) {
    const w = (saved.width > 0) ? saved.width : toolWidth;
    const h = (saved.height > 0) ? saved.height : 0;
    const displays = screen.getAllDisplays();
    const isVisible = displays.some(d => {
       return saved.x >= d.bounds.x && saved.x + w <= d.bounds.x + d.bounds.width &&
              saved.y >= d.bounds.y && saved.y + h <= d.bounds.y + d.bounds.height;
    });
    if (isVisible) return saved;
  }
  
  if (!mainWin || mainWin.isDestroyed()) return { x: 0, y: 0 };
  const [mx, my] = mainWin.getPosition();
  const currentDisplay = screen.getDisplayMatching(mainWin.getBounds());
  const { width: sw, x: sx } = currentDisplay.workArea;
  let x = mx - toolWidth - 8;
  if (x < sx) x = mx + mainWin.getSize()[0] + 8;
  if (x + toolWidth > sx + sw) x = sx + sw - toolWidth - 8;
  return { x, y: my };
}

// ── REPOSICIONAMIENTO DE ALERTA ──
function repositionAlerta() {
  if (!alertDataCache || !mainWin || mainWin.isDestroyed() || mainWin.isMinimized()) return;

  const [mx, my] = mainWin.getPosition();
  const mw = mainWin.getSize()[0];
  const currentDisplay = screen.getDisplayMatching(mainWin.getBounds());
  const { width: sw, x: sx } = currentDisplay.workArea;

  const ALERTA_WIDTH = 210;
  let ax = mx + mw; 
  let side = 'right';

  if (ax + ALERTA_WIDTH > sx + sw) { ax = mx - ALERTA_WIDTH; side = 'left'; }

  let ay = Math.round(my + alertDataCache.y - 12);
  ax = Math.round(ax);

  if (alertaWin && !alertaWin.isDestroyed()) {
    alertaWin.setPosition(ax, ay);
    alertaWin.webContents.send('update-alerta', { ...alertDataCache, side });
  } else {
    alertaWin = new BrowserWindow({
      width: ALERTA_WIDTH, height: 60, x: ax, y: ay,
      frame: false, transparent: true, 
      alwaysOnTop: getAlwaysOnTopPreference(),
      skipTaskbar: true, focusable: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    alertaWin.loadFile(HTML.alerta);
    alertaWin.on('ready-to-show', () => {
      if(alertaWin) { 
        alertaWin.webContents.send('init-alerta', { ...alertDataCache, side }); 
        alertaWin.showInactive(); 
      }
    });
  }
}

// ── FAST: BOTÓN FLOTANTE EXTERNO + VENTANA GRANDE 1000×900 ──
const FAST_BTN_W = 24;
const FAST_BTN_H = 80;
const FAST_WIN_W = 1000;
const FAST_WIN_H = 900;
const FAST_GAP = 4;

let fastWin = null;
let fastBtnWin = null;
let fastVisible = false;
let fastBusy = false;
let fastClosing = false;
let fastLastFocusAt = 0;

function getFastWin() {
  if (fastWin && !fastWin.isDestroyed()) return fastWin;
  const saved = loadPos().fast || {};
  const w = (saved.width && saved.width > 0) ? saved.width : FAST_WIN_W;
  const h = (saved.height && saved.height > 0) ? saved.height : FAST_WIN_H;
  fastWin = new BrowserWindow({
    width: w, height: h,
    frame: false, resizable: true, movable: true,
    alwaysOnTop: false,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  fastWin.fastLoaded = false;
  fastWin.once('ready-to-show', () => { fastWin.fastLoaded = true; });
  fastWin.on('focus', () => { fastLastFocusAt = Date.now(); });
  fastWin.loadFile(TOOLS_CONFIG.fast.file);
  fastWin.on('closed', () => {
    if (toolWins.get('fast') === fastWin) toolWins.delete('fast');
    fastWin = null;
    fastVisible = false;
    fastBusy = false;
    fastClosing = false;
    notifyFastState();
  });
  fastWin.on('move', () => {
    if (fastWin && !fastWin.isDestroyed()) {
      const b = fastWin.getBounds();
      savePos({ fast: { x: b.x, y: b.y, width: b.width, height: b.height } });
    }
  });
  fastWin.on('resize', () => {
    if (fastWin && !fastWin.isDestroyed()) {
      const b = fastWin.getBounds();
      savePos({ fast: { x: b.x, y: b.y, width: b.width, height: b.height } });
    }
  });
  fastWin.on('close', () => {
    if (fastWin && !fastWin.isDestroyed()) {
      const b = fastWin.getBounds();
      savePos({ fast: { x: b.x, y: b.y, width: b.width, height: b.height } });
      flushSavePos();
    }
  });
  toolWins.set('fast', fastWin);
  return fastWin;
}

function openFast() {
  if (fastBusy) return;
  const win = getFastWin();
  if (!win || win.isDestroyed()) return;
  fastBusy = true;
  const doOpen = () => {
    fastBusy = false;
    if (win.isDestroyed()) return;
    const saved = loadPos().fast || {};
    const pos = toolPos('fast', FAST_WIN_W);
    const w = (saved.width && saved.width > 0) ? saved.width : FAST_WIN_W;
    const h = (saved.height && saved.height > 0) ? saved.height : FAST_WIN_H;
    win.setBounds({ x: pos.x, y: pos.y, width: w, height: h });
    win.setAlwaysOnTop(false);
    win.show();
    win.focus();
    fastVisible = true;
    notifyFastState();
  };
  if (win.fastLoaded) doOpen();
  else win.once('ready-to-show', doOpen);
}

function closeFast() {
  const win = fastWin;
  if (!win || win.isDestroyed()) {
    fastVisible = false;
    fastBusy = false;
    fastClosing = false;
    notifyFastState();
    return;
  }
  // Ya se pidió el cierre limpio; el renderer responderá con close-tool → win.close()
  if (fastClosing) return;
  if (fastVisible) {
    fastClosing = true;
    win.webContents.send('fast-close-request');
    return;
  }
  win.close();
}

function toggleFast() {
  if (fastBusy) return;
  if (fastClosing) return;

  // 1) Cerrada (o nunca abierta) → abrir
  const win = fastWin;
  if (!win || win.isDestroyed()) {
    openFast();
    return;
  }

  // 2) Minimizada → restaurar y traer al frente
  if (win.isMinimized()) {
    win.restore();
    win.show();
    win.focus();
    fastVisible = true;
    notifyFastState();
    return;
  }

  // 3) Visible y con el foco (el usuario la está viendo/activa) → cerrar.
  //    También cuenta como "visible" si estaba enfocada hace muy poco (caso del
  //    botón del drawer, que al hacer clic roba el foco a Fast).
  if (fastVisible && (win.isFocused() || (Date.now() - fastLastFocusAt) < 3000)) {
    closeFast();
    return;
  }

  // 4) Visible pero al fondo (sin foco) → traer al frente
  if (fastVisible) {
    win.show();
    win.moveTop();
    win.focus();
    notifyFastState();
    return;
  }

  // 5) Existe pero oculta → mostrar (equivale a abrir)
  openFast();
}

function createFastBtn() {
  if (fastBtnWin && !fastBtnWin.isDestroyed()) return fastBtnWin;
  fastBtnWin = new BrowserWindow({
    width: FAST_BTN_W, height: FAST_BTN_H,
    frame: false, resizable: false, movable: false,
    transparent: true,
    alwaysOnTop: true,
    show: false, skipTaskbar: true,
    focusable: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  fastBtnWin.loadFile(HTML.fastBtn);
  refreshFastBtnVisibility();
  fastBtnWin.on('ready-to-show', () => {
    if (fastBtnWin && !fastBtnWin.isDestroyed()) {
      positionFastBtn();
      refreshFastBtnVisibility();
    }
  });
  fastBtnWin.on('closed', () => { fastBtnWin = null; });
  return fastBtnWin;
}

function positionFastBtn() {
  if (!fastBtnWin || fastBtnWin.isDestroyed()) return;
  if (!mainWin || mainWin.isDestroyed()) return;
  const mb = mainWin.getBounds();
  const wa = screen.getDisplayMatching(mb).workArea;
  const spaceRight = (wa.x + wa.width) - (mb.x + mb.width);
  const spaceLeft = mb.x - wa.x;

  let x;
  if (spaceRight >= FAST_BTN_W + FAST_GAP) {
    x = mb.x + mb.width + FAST_GAP;
  } else if (spaceLeft >= FAST_BTN_W + FAST_GAP) {
    x = mb.x - FAST_GAP - FAST_BTN_W;
  } else {
    // Sin espacio a ambos lados: ancla al borde con más margen
    x = spaceRight >= spaceLeft
      ? wa.x + wa.width - FAST_BTN_W - 4
      : wa.x + 4;
  }
  x = Math.round(Math.max(wa.x, Math.min(wa.x + wa.width - FAST_BTN_W, x)));

  const y = Math.round(mb.y + (mb.height - FAST_BTN_H) / 2);
  const yClamped = Math.max(wa.y + 4, Math.min(wa.y + wa.height - FAST_BTN_H - 4, y));
  fastBtnWin.setBounds({ x, y: yClamped, width: FAST_BTN_W, height: FAST_BTN_H });
}

function repositionFastBtn() {
  positionFastBtn();
}

function notifyFastState() {
  const payload = { visible: fastVisible };
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('fast-docked-state', payload);
  }
  if (fastBtnWin && !fastBtnWin.isDestroyed()) {
    fastBtnWin.webContents.send('fast-state', payload);
  }
  const fw = toolWins.get('fast');
  if (fw && !fw.isDestroyed()) {
    fw.webContents.send('fast-docked-state', payload);
  }
}

// Botón flotante Fast: con "always on top" activado queda SIEMPRE visible
// (no se desvanece al hacer clic fuera). Con la preferencia desactivada se
// muestra (fade-in) cuando la app está activa y se oculta (fade-out) al
// hacer clic fuera del programa.
let appActive = false;
let fastBtnFadeId = 0;

function refreshFastBtnVisibility() {
  if (!fastBtnWin || fastBtnWin.isDestroyed()) return;
  if (getAlwaysOnTopPreference() || appActive) showFastBtn();
  else hideFastBtn();
}

function showFastBtn() {
  if (!fastBtnWin || fastBtnWin.isDestroyed()) return;
  fastBtnFadeId++;
  try {
    fastBtnWin.setAlwaysOnTop(true);
    if (!fastBtnWin.isVisible()) fastBtnWin.setOpacity(0);
    fastBtnWin.showInactive();
    fadeFastBtn(1);
  } catch (err) {
    console.warn('Error al mostrar el botón Fast:', err);
  }
}

function hideFastBtn() {
  if (!fastBtnWin || fastBtnWin.isDestroyed()) return;
  fastBtnFadeId++;
  try {
    if (fastBtnWin.isVisible()) fadeFastBtn(0);
  } catch (err) {
    console.warn('Error al ocultar el botón Fast:', err);
  }
}

function fadeFastBtn(target) {
  const id = ++fastBtnFadeId;
  const from = fastBtnWin.getOpacity();
  const steps = 4;
  const tick = (i) => {
    if (!fastBtnWin || fastBtnWin.isDestroyed()) return;
    if (id !== fastBtnFadeId) return;
    const t = i / steps;
    fastBtnWin.setOpacity(from + (target - from) * t);
    if (i < steps) setTimeout(() => tick(i + 1), 35);
    else if (target === 0) fastBtnWin.hide();
  };
  tick(0);
}

app.on('browser-window-focus', () => {
  appActive = true;
  refreshFastBtnVisibility();
});

app.on('browser-window-blur', () => {
  const focused = BrowserWindow.getFocusedWindow();
  appActive = !!(focused && !focused.isDestroyed());
  refreshFastBtnVisibility();
});

// IPC de Fast
ipcMain.on('fast-toggle', () => toggleFast());
ipcMain.on('fast-request-state', () => notifyFastState());

// ── VISOR DE IMAGEN (frameless, sin marcos, X roja / Escape para cerrar) ──
let imgViewWin = null;

function openImgView(payload) {
  if (imgViewWin && !imgViewWin.isDestroyed()) { imgViewWin.close(); imgViewWin = null; }
  if (!payload || !payload.data) return;

  const refBounds = (mainWin && !mainWin.isDestroyed()) ? mainWin.getBounds() : null;
  const wa = refBounds
    ? screen.getDisplayMatching(refBounds).workArea
    : screen.getPrimaryDisplay().workArea;
  let w = (payload.w && payload.w > 0) ? payload.w : 600;
  let h = (payload.h && payload.h > 0) ? payload.h : 400;
  // Tamaño real, sin superar el área de trabajo
  const scale = Math.min(1, (wa.width - 40) / w, (wa.height - 40) / h);
  w = Math.max(120, Math.round(w * scale));
  h = Math.max(120, Math.round(h * scale));

  imgViewWin = new BrowserWindow({
    width: w, height: h,
    x: wa.x + Math.round((wa.width - w) / 2),
    y: wa.y + Math.round((wa.height - h) / 2),
    frame: false, transparent: true, resizable: false, movable: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  imgViewWin.loadFile(HTML.imgview);
  imgViewWin.once('ready-to-show', () => {
    if (imgViewWin && !imgViewWin.isDestroyed()) {
      imgViewWin.webContents.send('init-imgview', payload);
      imgViewWin.showInactive();
    }
  });
  imgViewWin.on('closed', () => { imgViewWin = null; });
}

ipcMain.on('fast-view-image', (e, payload) => openImgView(payload));
ipcMain.on('imgview-close', () => {
  if (imgViewWin && !imgViewWin.isDestroyed()) imgViewWin.close();
  imgViewWin = null;
});

// ── INICIALIZACIÓN DE LA VENTANA PRINCIPAL ──
let mainBoundsSaveTimer = null;
function saveMainBounds() {
  if (mainBoundsSaveTimer) clearTimeout(mainBoundsSaveTimer);
  mainBoundsSaveTimer = setTimeout(() => {
    mainBoundsSaveTimer = null;
    if (!mainWin || mainWin.isDestroyed()) return;
    const b = mainWin.getBounds();
    savePos({ main: { x: b.x, y: b.y, width: b.width, height: b.height } });
  }, 250);
}

app.whenReady().then(() => {
  const pos = getPos('main', {});
  // Solo restaurar si la posición guardada sigue visible en algún monitor (evita ventana fuera de pantalla)
  const posOk = !!(pos && typeof pos.x === 'number' && typeof pos.y === 'number' &&
    screen.getAllDisplays().some(d =>
      pos.x >= d.bounds.x - 60 && pos.x < d.bounds.x + d.bounds.width - 60 &&
      pos.y >= d.bounds.y - 30 && pos.y < d.bounds.y + d.bounds.height - 30));
  const sizeOk = posOk && pos.width > 0 && pos.height > 0;
  mainWin = new BrowserWindow({ 
    width: sizeOk ? pos.width : 330, height: sizeOk ? pos.height : 720,
    minWidth: 60, minHeight: 40,
    x: posOk ? pos.x : undefined, y: posOk ? pos.y : undefined,
    frame: false, resizable: true, movable: true, 
    alwaysOnTop: getAlwaysOnTopPreference(),
    webPreferences: { nodeIntegration: true, contextIsolation: false } 
  });
  mainWin.loadFile(HTML.index);
  mainWin.on('ready-to-show', () => { 
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('init-data', loadData());
    }
  });

  // Botón flotante externo de Fast (siempre al frente, sigue a la principal)
  createFastBtn();

  // Hotkey global para abrir/cerrar Fast
  try {
    globalShortcut.register('CommandOrControl+Shift+F', () => toggleFast());
  } catch (err) {
    console.warn('No se pudo registrar el hotkey global de Fast:', err);
  }
  
  mainWin.on('move', () => { 
    if (!mainWin || mainWin.isDestroyed()) return; 
    saveMainBounds(); 
    repositionAlerta(); 
    repositionFastBtn();
  });
  mainWin.on('resize', () => { repositionFastBtn(); saveMainBounds(); });
  
  mainWin.on('close', e => { 
    if (isQuitting) return; 
    e.preventDefault(); 
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('request-close-confirm'); 
    }
  });
});

// ── IPC: CIERRE Y MINIMIZAR ──
ipcMain.on('confirm-close', () => { 
  try { flushSavePos(); } catch (e) {}
  isQuitting = true; 
  app.quit(); 
});
ipcMain.on('close-main', () => { 
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('request-close-confirm'); 
  } 
});
ipcMain.on('minimize-main', () => { 
  if (mainWin && !mainWin.isDestroyed()) mainWin.minimize(); 
});

// ── IPC: PERSISTENCIA ──
ipcMain.on('save-data', (e, patch) => saveData(patch));
ipcMain.on('save-occ', (e, state) => saveData({ occState: state }));
ipcMain.on('save-enlaces', (e, data) => saveData({ enlaces: data.enlaces, tags: data.tags }));
ipcMain.on('save-contingencias', (e, data) => saveData({ contingencias: data }));
ipcMain.on('save-ciclos', (e, data) => saveData({ ciclosState: data }));
ipcMain.on('save-calculadora-dias', (e, data) => saveData({ diasState: data }));
ipcMain.on('save-trafico', (e, data) => saveData({ traficoState: data }));
ipcMain.on('save-pos', (e, patch) => savePos(patch));

// ── IPC: TURNOS WEB (Extranet Entel) ──
const TURNOS_BASE = 'http://192.168.223.158/turnos_agentesVer';
const FIRMA_URL = 'https://movil.asisscad.cl/ingreso.aspx';

function normalizarTurno(h) {
  if (!h || typeof h !== 'object') return null;
  const d = { fecha: h.fecha != null ? String(h.fecha) : '' };
  if (h.segmento != null) {
    d.descanso = true;
    d.detalle = String(h.segmento);
    return d;
  }
  const mk = (i, f) => (i != null && f != null) ? { ini: String(i).trim(), fin: String(f).trim() } : null;
  d.entrada = h.inicio != null ? String(h.inicio).trim() : null;
  d.salida = h.fin != null ? String(h.fin).trim() : null;
  d.break1 = mk(h.break1_ini, h.break1_fin);   // 1° Break
  d.colacion = mk(h.break2_ini, h.break2_fin); // Colación
  d.ext = mk(h.break3_ini, h.break3_fin);      // Ext: se suma al bloque original
  d.break2 = mk(h.break4_ini, h.break4_fin);   // 2° Break

  // Bloques efectivos (ext suma al bloque base; por sí solo no genera alerta)
  const bloques = [];
  if (d.entrada) bloques.push({ tipo: 'entrada', icon: '🟢', ini: d.entrada, fin: d.entrada });
  if (d.break1) bloques.push({ tipo: 'break1', icon: '☕', ini: d.break1.ini, fin: d.break1.fin });
  let colIni = d.colacion ? d.colacion.ini : (d.ext ? d.ext.ini : null);
  let colFin = d.colacion ? d.colacion.fin : (d.ext ? d.ext.fin : null);
  if (d.colacion && d.ext && d.ext.fin) colFin = d.ext.fin;
  if (colIni != null) bloques.push({ tipo: 'colacion', icon: '🍽️', ini: colIni, fin: colFin != null ? colFin : colIni, ext: !!d.ext });
  if (d.break2) bloques.push({ tipo: 'break2', icon: '☕', ini: d.break2.ini, fin: d.break2.fin });
  if (d.salida) bloques.push({ tipo: 'salida', icon: '🔴', ini: d.salida, fin: d.salida });
  d.bloques = bloques;
  return d;
}

async function consultarTurnos(rut) {
  const rutLimpio = String(rut || '').replace(/\D/g, '');
  if (!rutLimpio) throw new Error('RUT vacío');
  await net.fetch(TURNOS_BASE + '/Main.aspx');
  const res = await net.fetch(TURNOS_BASE + '/Main.aspx/ConsultaTurno', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ rut: rutLimpio })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  const d = json && json.d;
  if (!d || d.ret !== 'OK') throw new Error((d && d.msg) || 'Respuesta inválida');
  const tur = (d.values && d.values[0]) || [];
  const nom = (d.values && d.values[1]) || null;
  const nombre = (nom && nom.KeyValue) ? String(nom.KeyValue) : 'USUARIO NO EXISTE';
  const dias = Array.isArray(tur) ? tur.map(normalizarTurno).filter(Boolean) : [];
  return { ok: true, nombre, rut: rutLimpio, dias, fechaCarga: new Date().toISOString() };
}

ipcMain.handle('fetch-turnos', async (e, rut) => {
  try {
    return await consultarTurnos(rut);
  } catch (err) {
    return { ok: false, error: (err && err.message) || 'Error de red' };
  }
});

ipcMain.on('save-turnos', (e, data) => {
  saveData({ turnosWeb: data });
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('turnos-web-updated', data);
});

ipcMain.on('open-firma', () => {
  shell.openExternal(FIRMA_URL);
});

// ── IPC: PREFERENCIA ALWAYS ON TOP ──
ipcMain.on('set-always-on-top', (e, value) => {
  setAlwaysOnTopPreference(value);
});

ipcMain.handle('get-always-on-top', () => {
  return getAlwaysOnTopPreference();
});

// ── IPC: GET USER DATA PATH (CORRECCIÓN: error 7) ──
ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

// ── IPC: GET POS (para barra de apoyo) ──
ipcMain.on('get-pos', (e, key) => {
  const pos = loadPos()[key] || null;
  e.returnValue = pos;
});

// ── IPC: DATOS DE LA BÓVEDA (ventana externa de notas en modo apoyo) ──
ipcMain.on('get-vault-notes', (e) => {
  const d = loadData();
  e.returnValue = d.notes || [];
});

// ── IPC: EXPORTAR HISTORIAL ──
ipcMain.on('export-history', (e, { content, defaultName }) => { 
  if (!mainWin || mainWin.isDestroyed()) return; 
  dialog.showSaveDialog(mainWin, { 
    defaultPath: defaultName, 
    filters: [{ name: 'Texto', extensions: ['txt'] }] 
  }).then(r => { 
    if (!r.canceled) fs.writeFileSync(r.filePath, content, 'utf8'); 
  }); 
});

// ── IPC: DIÁLOGOS DE ARCHIVO (dialog no está disponible en el renderer) ──
ipcMain.handle('show-open-dialog', (e, opts) => {
  const parent = BrowserWindow.fromWebContents(e.sender);
  return dialog.showOpenDialog(parent, opts || {});
});
ipcMain.handle('show-save-dialog', (e, opts) => {
  const parent = BrowserWindow.fromWebContents(e.sender);
  return dialog.showSaveDialog(parent, opts || {});
});

// ── IPC: ALERTAS ──
ipcMain.on('show-alerta', (e, payload) => { 
  alertDataCache = payload; 
  repositionAlerta(); 
});
ipcMain.on('hide-alerta', () => { 
  alertDataCache = null; 
  if (alertaWin && !alertaWin.isDestroyed()) { 
    alertaWin.close(); 
    alertaWin = null; 
  } 
});
ipcMain.on('alerta-action', (e, data) => {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('alerta-action', data);
  }
  if (data.action === 'close') { 
    alertDataCache = null; 
    if (alertaWin && !alertaWin.isDestroyed()) { 
      alertaWin.close(); 
      alertaWin = null; 
    }
  }
});

ipcMain.on('contingencias-updated', (e, data) => { 
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('contingencias-sync', data); 
  }
});

// ── IPC: PREVIEWS Y NOTAS ──
ipcMain.on('note-preview-show', (e, id) => { 
  let win = noteWins.get(id); 
  if (!win) { 
    openNote(id, true); 
    win = noteWins.get(id); 
  } 
  if (win && !win.isDestroyed()) { 
    // Si la nota ya está abierta y fijada, no atenuarla
    if (pinnedNotes.has(id)) { 
      win.setOpacity(1.0); 
      win.show(); 
      win.focus(); 
      return; 
    } 
    win.setOpacity(0.6); 
    win.showInactive(); 
  } 
});
ipcMain.on('note-preview-hide', (e, id) => { 
  const win = noteWins.get(id); 
  if (win && !win.isDestroyed()) { 
    if (!pinnedNotes.has(id)) win.hide(); 
    else win.setOpacity(1.0); 
  } 
});
ipcMain.on('note-minimize', (e, id) => { 
  const win = noteWins.get(id); 
  if (win && !win.isDestroyed()) { 
    win.hide(); 
    pinnedNotes.delete(id); 
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('note-closed', id); 
    }
  } 
});

// ── IPC: APERTURA, CONMUTACIÓN Y CIERRE DE HERRAMIENTAS ──
const toolLastFocusAt = new Map();
let lastFocusedToolId = null;
let lastFocusedToolTime = 0;

function openTool(id) {
  if (!TOOLS_CONFIG[id]) return null;

  // Fast: se abre como ventana grande 1000×900 (botón flotante externo o drawer)
  if (id === 'fast') {
    openFast();
    return fastWin;
  }

  const conf = TOOLS_CONFIG[id];

  if (toolWins.has(id)) {
    const win = toolWins.get(id);
    if (!win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.moveTop();
      win.focus();
      toolLastFocusAt.set(id, Date.now());
      lastFocusedToolId = id;
      lastFocusedToolTime = Date.now();
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('tool-restored', id);
        mainWin.webContents.send('tool-focused', id);
      }
      return win;
    }
  }

  const saved = loadPos()[id];
  const sw = (saved && saved.width > 0) ? saved.width : conf.w;
  const sh = (saved && saved.height > 0) ? saved.height : conf.h;
  const pos = toolPos(id, sw);
  const win = new BrowserWindow({
    width: sw, height: sh, x: pos.x, y: pos.y,
    frame: false, resizable: conf.resize, movable: true, 
    alwaysOnTop: conf.top === true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  toolWins.set(id, win);
  toolLastFocusAt.set(id, Date.now());
  lastFocusedToolId = id;
  lastFocusedToolTime = Date.now();

  win.on('focus', () => {
    toolLastFocusAt.set(id, Date.now());
    lastFocusedToolId = id;
    lastFocusedToolTime = Date.now();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('tool-focused', id);
    }
  });

  win.loadFile(conf.file);

  win.on('ready-to-show', () => {
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
      toolLastFocusAt.set(id, Date.now());
      lastFocusedToolId = id;
      lastFocusedToolTime = Date.now();
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('tool-opened', id);
      }
      const d = loadData();
      if (id === 'occ') {
        win.webContents.send('init-occ', d.occState || null);
      } else if (id === 'enlaces') {
        win.webContents.send('init-enlaces', d.enlaces || null, d.tags || null);
      } else if (id === 'horarios') {
        win.webContents.send('init-turnos', d.turnosWeb || null);
      } else if (id === 'contingencias') {
        win.webContents.send('init-contingencias', d.contingencias || null);
      } else if (id === 'notas-vault') {
        win.webContents.send('init-vault', { notes: d.notes || [], favNotes: d.favNotes || [] });
      } else if (id === 'ciclos') {
        win.webContents.send('init-ciclos', d.ciclosState || null);
      } else if (id === 'calculadora-dias') {
        win.webContents.send('init-calculadora-dias', d.diasState || null);
      } else if (id === 'trafico') {
        win.webContents.send('init-trafico', d.traficoState || null);
      }
    }
  });

  win.on('move', () => {
    if (win && !win.isDestroyed()) {
      const b = win.getBounds();
      savePos({ [id]: { x: b.x, y: b.y, width: b.width, height: b.height } });
    }
  });

  win.on('resize', () => {
    if (win && !win.isDestroyed()) {
      const b = win.getBounds();
      savePos({ [id]: { x: b.x, y: b.y, width: b.width, height: b.height } });
    }
  });

  win.on('close', () => {
    if (win && !win.isDestroyed()) {
      const b = win.getBounds();
      savePos({ [id]: { x: b.x, y: b.y, width: b.width, height: b.height } });
      flushSavePos();
    }
  });

  win.on('minimize', () => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('tool-minimized', id);
    }
  });
  win.on('restore', () => {
    toolLastFocusAt.set(id, Date.now());
    lastFocusedToolId = id;
    lastFocusedToolTime = Date.now();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('tool-restored', id);
    }
  });

  win.on('closed', () => {
    toolLastFocusAt.delete(id);
    if (lastFocusedToolId === id) lastFocusedToolId = null;
    if (toolWins.get(id) === win) {
      toolWins.delete(id);
    }
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('tool-closed', id);
    }
  });

  toolWins.set(id, win);
  return win;
}

function toggleTool(id) {
  if (!TOOLS_CONFIG[id]) return;

  // Fast: delegar a su lógica de toggle consolidada
  if (id === 'fast') {
    toggleFast();
    return;
  }

  const win = toolWins.get(id);

  // 1) Cerrada (o nunca abierta) → abrir
  if (!win || win.isDestroyed()) {
    openTool(id);
    return;
  }

  // 2) Minimizada → restaurar y traer al frente
  if (win.isMinimized()) {
    win.restore();
    win.show();
    win.moveTop();
    win.focus();
    toolLastFocusAt.set(id, Date.now());
    lastFocusedToolId = id;
    lastFocusedToolTime = Date.now();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('tool-restored', id);
    }
    return;
  }

  // 3) Visible y con foco (o enfocada recientemente antes de interactuar con el launcher) → cerrar
  const lastFocus = toolLastFocusAt.get(id) || 0;
  const isRecentFocus = (Date.now() - lastFocus) < 3000;
  const wasLastActive = (lastFocusedToolId === id) && ((Date.now() - lastFocusedToolTime) < 5000);
  const wasInFocus = win.isFocused() || isRecentFocus || wasLastActive;

  if (win.isVisible() && wasInFocus) {
    win.close();
    return;
  }

  // 4) Visible pero al fondo (sin foco) → traer al frente
  if (win.isVisible()) {
    win.show();
    win.moveTop();
    win.focus();
    toolLastFocusAt.set(id, Date.now());
    lastFocusedToolId = id;
    lastFocusedToolTime = Date.now();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('tool-restored', id);
    }
    return;
  }

  // 5) Existe pero oculta → mostrar y enfocar
  win.show();
  win.moveTop();
  win.focus();
  toolLastFocusAt.set(id, Date.now());
  lastFocusedToolId = id;
  lastFocusedToolTime = Date.now();
}

ipcMain.on('open-tool', (e, id) => {
  openTool(id);
});

ipcMain.on('toggle-tool', (e, id) => {
  toggleTool(id);
});

ipcMain.on('request-tools-state', (e) => {
  const states = {};
  for (const [id, win] of toolWins.entries()) {
    if (win && !win.isDestroyed()) {
      states[id] = { open: true, minimized: win.isMinimized() };
    }
  }
  if (fastWin && !fastWin.isDestroyed()) {
    states['fast'] = { open: true, minimized: fastWin.isMinimized() };
  }
  e.reply('tools-state', states);
});

ipcMain.on('close-tool', (e, id) => {
  // Fast: cerrar desde el botón flotante o el drawer
  if (id === 'fast') {
    const win = fastWin;
    if (win && !win.isDestroyed()) win.close();
    else {
      fastVisible = false;
      fastBusy = false;
      fastClosing = false;
      notifyFastState();
    }
    return;
  }
  const win = toolWins.get(id);
  if (win && !win.isDestroyed()) win.close();
});

// ── IPC: MINIMIZAR HERRAMIENTA (a la barra de tareas; el clic restaura) ──
ipcMain.on('minimize-tool', (e, id) => {
  if (id === 'fast' || !TOOLS_CONFIG[id]) return; // Fast queda excluido
  const win = toolWins.get(id);
  if (win && !win.isDestroyed() && !win.isMinimized()) {
    win.minimize();
  }
});

// ── IPC: VENTANA INDEPENDIENTE "ACERCA DE" (450×350) ──
let acercaWin = null;
ipcMain.on('open-acerca', () => {
  if (acercaWin && !acercaWin.isDestroyed()) {
    if (acercaWin.isMinimized()) acercaWin.restore();
    acercaWin.show();
    acercaWin.focus();
    return;
  }
  acercaWin = new BrowserWindow({
    width: 450, height: 350,
    frame: false, resizable: false, movable: true,
    alwaysOnTop: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  acercaWin.loadFile(HTML.acerca);
  acercaWin.on('closed', () => { acercaWin = null; });
});

// ── IPC: VENTANA INDEPENDIENTE "EASTER EGG" (600×500) ──
let easterWin = null;
ipcMain.on('open-easter-egg', () => {
  if (easterWin && !easterWin.isDestroyed()) {
    if (easterWin.isMinimized()) easterWin.restore();
    easterWin.show();
    easterWin.focus();
    return;
  }
  easterWin = new BrowserWindow({
    width: 600, height: 500,
    frame: false, transparent: true, resizable: false, movable: true,
    alwaysOnTop: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  easterWin.loadFile(HTML.easter);
  easterWin.on('closed', () => { easterWin = null; });
});

// ── IPC: NOTAS ──
// Difunde el cambio de notas a la ventana principal y a la bóveda externa
function broadcastNotes(notes) {
  const targets = [];
  if (mainWin && !mainWin.isDestroyed()) targets.push(mainWin);
  const vaultWin = toolWins.get('notas-vault');
  if (vaultWin && !vaultWin.isDestroyed()) targets.push(vaultWin);
  targets.forEach(w => w.webContents.send('notes-updated', notes));
}

ipcMain.on('note-create', () => { 
  const d = loadData(); 
  const notes = d.notes || []; 
  if (notes.length >= 10) { 
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('note-limit-reached'); 
    }
    return; 
  } 
  const id = Date.now(); 
  notes.push({ id, content: '' }); 
  saveData({ notes }); 
  broadcastNotes(notes);
  openNote(id); 
});

ipcMain.on('open-note', (e, id) => openNote(id, false));
ipcMain.on('note-close', (e, id) => { 
  pinnedNotes.delete(id); 
  const win = noteWins.get(id); 
  if (win && !win.isDestroyed()) win.close(); 
});

function handleNoteSave(e, { id, content }) { 
  const notes = (loadData().notes || []).map(n => n.id === id ? { ...n, content } : n); 
  saveData({ notes }); 
  broadcastNotes(notes);
}

ipcMain.on('note-save', handleNoteSave);
ipcMain.on('note-update', handleNoteSave);

ipcMain.on('note-delete', (e, id) => { 
  const win = noteWins.get(id); 
  if (win && !win.isDestroyed()) win.close(); 
  const notes = (loadData().notes || []).filter(n => n.id !== id); 
  saveData({ notes }); 
  broadcastNotes(notes);
});

function openNote(id, isPreview = false) { 
  if (noteWins.has(id)) { 
    const win = noteWins.get(id); 
    if (win && !win.isDestroyed() && !isPreview) { 
      pinnedNotes.add(id); 
      win.setOpacity(1.0); 
      win.show(); 
      win.focus(); 
      return; 
    } 
    // Si la ventana guardada está destruida, recrearla (no retornar sin hacer nada)
    noteWins.delete(id);
  } 
  const savedNote = loadPos()[`note-${id}`];
  const noteW = (savedNote && savedNote.width > 0) ? savedNote.width : 260;
  const noteH = (savedNote && savedNote.height > 0) ? savedNote.height : 300;
  const pos = toolPos(`note-${id}`, noteW);
  const offset = noteWins.size * 24;
  const win = new BrowserWindow({ 
    width: noteW, height: noteH, 
    x: pos.x + offset, y: pos.y + offset, 
    frame: false, resizable: true, movable: true, 
    alwaysOnTop: false,
    show: false, skipTaskbar: true, 
    webPreferences: { nodeIntegration: true, contextIsolation: false } 
  }); 
  win.loadFile(HTML.note); 
  win.on('ready-to-show', () => { 
    if (win && !win.isDestroyed()) { 
      const note = (loadData().notes || []).find(n => n.id === id); 
      win.webContents.send('init-note', note || { id, content: '' }); 
      if (!isPreview) { 
        pinnedNotes.add(id); 
        win.setOpacity(1.0); 
        win.show(); 
      } 
    } 
  }); 
  win.on('move', () => { 
    if (win && !win.isDestroyed()) { 
      const b = win.getBounds(); 
      savePos({ [`note-${id}`]: { x: b.x, y: b.y, width: b.width, height: b.height } }); 
    }
  }); 
  win.on('resize', () => { 
    if (win && !win.isDestroyed()) { 
      const b = win.getBounds(); 
      savePos({ [`note-${id}`]: { x: b.x, y: b.y, width: b.width, height: b.height } }); 
    }
  }); 
  win.on('close', () => { 
    if (win && !win.isDestroyed()) { 
      const b = win.getBounds(); 
      savePos({ [`note-${id}`]: { x: b.x, y: b.y, width: b.width, height: b.height } }); 
      flushSavePos();
    }
  }); 
  win.on('closed', () => { 
    if (noteWins.get(id) === win) {
      noteWins.delete(id); 
    }
    pinnedNotes.delete(id); 
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('note-closed', id); 
    }
  }); 
  noteWins.set(id, win); 
}

app.on('window-all-closed', () => { 
  if (process.platform !== 'darwin') app.quit(); 
});

app.on('will-quit', () => {
  try { flushSavePos(); } catch (e) {}
  try { globalShortcut.unregisterAll(); } catch (err) { console.warn(err); }
});