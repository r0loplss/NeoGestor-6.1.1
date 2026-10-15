/* ============================================================
   NeoApoyos — Vista previa (Electron, ventana sin marco)
   Uso:  npm.cmd run preview:apoyos
   (o)   node_modules\electron\dist\electron.exe src\NeoApoyos\preview.js
   ============================================================ */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win = null;

function crearVentana() {
    win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 720,
        minHeight: 520,
        frame: false,
        show: false,
        backgroundColor: '#070b12',
        title: 'NeoApoyos — Vista previa',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile(path.join(__dirname, 'index.html'));
    win.on('ready-to-show', () => { win.show(); win.focus(); });

    // Conecta los controles decorativos de la máscara a la ventana real
    win.webContents.on('did-finish-load', () => {
        win.webContents.executeJavaScript(`
            (function () {
                try {
                    var ipc = require('electron').ipcRenderer;
                    var btns = document.querySelectorAll('.win-controls .wc');
                    if (btns[0]) btns[0].addEventListener('click', function () { ipc.send('neoapoyos-minimize'); });
                    if (btns[btns.length - 1]) btns[btns.length - 1].addEventListener('click', function () { ipc.send('neoapoyos-close'); });
                } catch (e) {}
            })();
        `).catch(() => {});
    });

    // Atajos: F12 = DevTools · Ctrl+Shift+I = DevTools · Esc = cerrar
    win.webContents.on('before-input-event', (e, input) => {
        if (input.type !== 'keyDown') return;
        if (input.key === 'F12' || (input.control && input.shift && (input.key === 'I' || input.key === 'i'))) {
            win.webContents.toggleDevTools();
        } else if (input.key === 'Escape') {
            win.close();
        }
    });

    win.on('closed', () => { win = null; });
}

ipcMain.on('neoapoyos-minimize', () => { if (win) win.minimize(); });
ipcMain.on('neoapoyos-close', () => { if (win) win.close(); });

app.whenReady().then(crearVentana);
app.on('window-all-closed', () => app.quit());
