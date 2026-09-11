// ============================================================
// PROYECT MANZANA — ELECTRON MAIN PROCESS (MOCKUP RUNNER)
// Permite ejecutar la maqueta con soporte para ventanas translúcidas
// ============================================================

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const TOOL_CONFIGS = {
    'trafico': {
        file: path.join(__dirname, 'tools', 'trafico.html'),
        width: 620,
        height: 780,
        title: 'Tráfico Móvil PRO — Liquid Glass'
    },
    'fast': {
        file: path.join(__dirname, 'tools', 'fast.html'),
        width: 1040,
        height: 740,
        title: 'FAST — Liquid Glass'
    },
    'ciclos': {
        file: path.join(__dirname, 'tools', 'ciclos.html'),
        width: 580,
        height: 740,
        title: 'Cambio de Ciclo — Liquid Glass'
    },
    'tipificaciones': {
        file: path.join(__dirname, 'tools', 'tipificaciones.html'),
        width: 940,
        height: 680,
        title: 'Tipificaciones — Liquid Glass'
    }
};

let mainWindow = null;
const openToolWindows = new Map();

function createMainWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

    const winW = Math.min(980, Math.floor(screenW * 0.85));
    const winH = Math.min(700, Math.floor(screenH * 0.88));

    mainWindow = new BrowserWindow({
        width: winW,
        height: winH,
        frame: false,
        transparent: true,
        hasShadow: true,
        resizable: true,
        minWidth: 840,
        minHeight: 580,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
        // Cerrar herramientas hijas
        openToolWindows.forEach(w => {
            if (w && !w.isDestroyed()) w.close();
        });
        openToolWindows.clear();
    });
}

function openMockTool(toolId) {
    const conf = TOOL_CONFIGS[toolId];
    if (!conf) return;

    if (openToolWindows.has(toolId)) {
        const existing = openToolWindows.get(toolId);
        if (existing && !existing.isDestroyed()) {
            existing.focus();
            return;
        }
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

    // Calcular posición flotante tipo Stage Manager
    const count = openToolWindows.size;
    const offsetX = 40 + (count * 30);
    const offsetY = 40 + (count * 30);

    const win = new BrowserWindow({
        width: Math.min(conf.width, screenW - 60),
        height: Math.min(conf.height, screenH - 60),
        x: Math.min(offsetX, screenW - conf.width - 20),
        y: Math.min(offsetY, screenH - conf.height - 20),
        frame: false,
        transparent: true,
        hasShadow: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile(conf.file);

    win.on('closed', () => {
        openToolWindows.delete(toolId);
    });

    openToolWindows.set(toolId, win);
}

// IPC Handlers
ipcMain.on('open-mock-tool', (e, toolId) => {
    openMockTool(toolId);
});

ipcMain.on('close-window', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && !win.isDestroyed()) win.close();
});

ipcMain.on('minimize-window', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && !win.isDestroyed()) win.minimize();
});

ipcMain.on('maximize-window', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && !win.isDestroyed()) {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
    }
});

app.whenReady().then(() => {
    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
