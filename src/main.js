const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut } = require('electron');
const path = require('path');
const fs   = require('fs');

const DATA_FILE = path.join(app.getPath('userData'), 'gestor-data.json');
const POS_FILE  = path.join(app.getPath('userData'), 'gestor-pos.json');

const ROOT  = app.getAppPath();
const SRC   = path.join(ROOT, 'src');
const TOOLS = path.join(ROOT, 'src', 'tools');

// ============================================================
// RUTAS DE HTML (con nuevas herramientas)
// ============================================================
const HTML = {
  index:         path.join(SRC,   'index.html'),
  occ:           path.join(TOOLS, 'occ.html'),
  enlaces:       path.join(TOOLS, 'enlaces.html'),
  horario:       path.join(TOOLS, 'horario.html'),
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
  vault:         path.join(TOOLS, 'vault.html')
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
  'horario':       { file: HTML.horario,       w: 300, h: 500, resize: true,  top: false },
  'contingencias': { file: HTML.contingencias, w: 340, h: 500, resize: true,  top: true  },
  'trafico':       { file: HTML.trafico,       w: 450, h: 600, resize: true,  top: false },
  // NUEVAS HERRAMIENTAS
  'calculadora-dias': { file: HTML.calculadora, w: 380, h: 480, resize: true, top: false },
  'ciclos':           { file: HTML.ciclos,     w: 480, h: 580, resize: true, top: false },
  'tipificaciones':   { file: HTML.tipificaciones, w: 580, h: 620, resize: true, top: false },
  'fast':             { file: HTML.fast,       w: 1000, h: 900, resize: true, top: false },
  'notas-vault':      { file: HTML.vault,      w: 460, h: 560, resize: true,  top: false }
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
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
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

function loadPos() { 
  try { return JSON.parse(fs.readFileSync(POS_FILE, 'utf8')); } 
  catch { return {}; } 
}

function savePos(patch) { 
  const p = loadPos(); 
  Object.assign(p, patch); 
  writeFileAtomic(POS_FILE, JSON.stringify(p));
}

function getPos(key, defaults) { 
  return loadPos()[key] || defaults; 
}

// ── SOPORTE PARA "ALWAYS ON TOP" ──
function getAlwaysOnTopPreference() {
  const data = loadData();
  return data.alwaysOnTop !== undefined ? data.alwaysOnTop : true; // por defecto true
}

function setAlwaysOnTopPreference(value) {
  saveData({ alwaysOnTop: value });
  
  // Aplicar a todas las ventanas existentes (CORRECCIÓN: errores 8 y 32)
  try {
    // Ventana principal
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.setAlwaysOnTop(value);
    }
    
    // Alerta
    if (alertaWin && !alertaWin.isDestroyed()) {
      alertaWin.setAlwaysOnTop(value);
    }

    // Botón flotante Fast
    if (fastBtnWin && !fastBtnWin.isDestroyed()) {
      fastBtnWin.setAlwaysOnTop(value);
    }
    
    // Herramientas
    for (const [id, win] of toolWins) {
      if (win && !win.isDestroyed()) {
        win.setAlwaysOnTop(value);
      }
    }
    
    // Notas
    for (const [id, win] of noteWins) {
      if (win && !win.isDestroyed()) {
        win.setAlwaysOnTop(value);
      }
    }
  } catch (err) {
    console.warn('Error al aplicar AlwaysOnTop a ventanas:', err);
  }
}

// ── INTELIGENCIA ESPACIAL (MULTI-MONITOR) ──
function toolPos(key, toolWidth) {
  const saved = loadPos()[key];
  if (saved) {
    const displays = screen.getAllDisplays();
    const isVisible = displays.some(d => {
       return saved.x >= d.bounds.x && saved.x + toolWidth <= d.bounds.x + d.bounds.width &&
              saved.y >= d.bounds.y && saved.y <= d.bounds.y + d.bounds.height;
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

function getFastWin() {
  if (fastWin && !fastWin.isDestroyed()) return fastWin;
  fastWin = new BrowserWindow({
    width: FAST_WIN_W, height: FAST_WIN_H,
    frame: false, resizable: true, movable: true,
    alwaysOnTop: getAlwaysOnTopPreference(),
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  fastWin.fastLoaded = false;
  fastWin.once('ready-to-show', () => { fastWin.fastLoaded = true; });
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
      const [x, y] = fastWin.getPosition();
      savePos({ fast: { x, y } });
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
    const pos = toolPos('fast', FAST_WIN_W);
    win.setBounds({ x: pos.x, y: pos.y, width: FAST_WIN_W, height: FAST_WIN_H });
    win.setAlwaysOnTop(getAlwaysOnTopPreference());
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
  if (fastVisible || fastClosing) closeFast();
  else openFast();
}

function createFastBtn() {
  if (fastBtnWin && !fastBtnWin.isDestroyed()) return fastBtnWin;
  fastBtnWin = new BrowserWindow({
    width: FAST_BTN_W, height: FAST_BTN_H,
    frame: false, resizable: false, movable: false,
    transparent: true,
    alwaysOnTop: getAlwaysOnTopPreference(),
    show: false, skipTaskbar: true,
    focusable: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  fastBtnWin.loadFile(HTML.fastBtn);
  fastBtnWin.on('ready-to-show', () => {
    if (fastBtnWin && !fastBtnWin.isDestroyed()) {
      positionFastBtn();
      fastBtnWin.showInactive();
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

// IPC de Fast
ipcMain.on('fast-toggle', () => toggleFast());
ipcMain.on('fast-request-state', () => notifyFastState());

// ── INICIALIZACIÓN DE LA VENTANA PRINCIPAL ──
app.whenReady().then(() => {
  const pos = getPos('main', {});
  mainWin = new BrowserWindow({ 
    width: 330, height: 720, x: pos.x, y: pos.y, 
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
    const [x, y] = mainWin.getPosition(); 
    savePos({ main: { x, y } }); 
    repositionAlerta(); 
    repositionFastBtn();
  });
  mainWin.on('resize', () => repositionFastBtn());
  
  mainWin.on('close', e => { 
    if (isQuitting) return; 
    const d = loadData(); 
    if (d.draft && (d.draft.name || d.draft.content || d.draft.comuna || d.draft.huerfanos || (d.draft.customFields && d.draft.customFields.length > 0))) { 
      e.preventDefault(); 
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('request-close-confirm'); 
      }
    } 
  });
});

// ── IPC: CIERRE Y MINIMIZAR ──
ipcMain.on('confirm-close', () => { isQuitting = true; app.quit(); });
ipcMain.on('close-main', () => { 
  const d = loadData(); 
  if (d.draft && (d.draft.name || d.draft.content || d.draft.comuna || d.draft.huerfanos || (d.draft.customFields && d.draft.customFields.length > 0))) { 
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('request-close-confirm'); 
    }
  } else { 
    isQuitting = true; 
    app.quit(); 
  } 
});
ipcMain.on('minimize-main', () => { 
  if (mainWin && !mainWin.isDestroyed()) mainWin.minimize(); 
});

// ── IPC: PERSISTENCIA ──
ipcMain.on('save-data', (e, patch) => saveData(patch));
ipcMain.on('save-occ', (e, state) => saveData({ occState: state }));
ipcMain.on('save-enlaces', (e, data) => saveData({ enlaces: data.enlaces, tags: data.tags }));
ipcMain.on('save-horario', (e, data) => saveData({ horario: data.horario }));
ipcMain.on('save-contingencias', (e, data) => saveData({ contingencias: data }));
ipcMain.on('save-pos', (e, patch) => savePos(patch));

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

// ── IPC: APERTURA Y CIERRE DE HERRAMIENTAS ──
ipcMain.on('open-tool', (e, id) => {
  if (!TOOLS_CONFIG[id]) return;

  // Fast: se abre como ventana grande 1000×900 (botón flotante externo)
  if (id === 'fast') {
    openFast();
    return;
  }

  const conf = TOOLS_CONFIG[id];

  if (toolWins.has(id)) {
    const win = toolWins.get(id);
    if (!win.isDestroyed()) { 
      win.focus(); 
      return; 
    }
  }

  const pos = toolPos(id, conf.w);
  const win = new BrowserWindow({
    width: conf.w, height: conf.h, x: pos.x, y: pos.y,
    frame: false, resizable: conf.resize, movable: true, 
    alwaysOnTop: conf.top || getAlwaysOnTopPreference(),
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  win.loadFile(conf.file);

  win.on('ready-to-show', () => {
    if (win && !win.isDestroyed()) {
      const d = loadData();
      if (id === 'occ') {
        win.webContents.send('init-occ', d.occState || null);
      } else if (id === 'enlaces') {
        win.webContents.send('init-enlaces', d.enlaces || null, d.tags || null);
      } else if (id === 'horario') {
        win.webContents.send('init-horario', d.horario || null);
      } else if (id === 'contingencias') {
        win.webContents.send('init-contingencias', d.contingencias || null);
      } else if (id === 'notas-vault') {
        win.webContents.send('init-vault', { notes: d.notes || [], favNotes: d.favNotes || [] });
      }
    }
  });

  win.on('move', () => {
    if (win && !win.isDestroyed()) {
      const [x, y] = win.getPosition();
      savePos({ [id]: { x, y } });
    }
  });

  win.on('closed', () => {
    if (toolWins.get(id) === win) {
      toolWins.delete(id);
    }
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('tool-closed', id);
    }
  });

  toolWins.set(id, win);
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
  const pos = toolPos(`note-${id}`, 260); 
  const offset = noteWins.size * 24; 
  const win = new BrowserWindow({ 
    width: 260, height: 300, 
    x: pos.x + offset, y: pos.y + offset, 
    frame: false, resizable: true, movable: true, 
    alwaysOnTop: getAlwaysOnTopPreference(),
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
      const [x, y] = win.getPosition(); 
      savePos({ [`note-${id}`]: { x, y } }); 
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
  try { globalShortcut.unregisterAll(); } catch (err) { console.warn(err); }
});