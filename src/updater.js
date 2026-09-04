const { app, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const GITHUB_OWNER = 'r0loplss';
const GITHUB_REPO = 'NeoGestor-6.1.1';
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

let downloadedUpdatePath = null;
let isDownloading = false;

let pkgVersion = '6.1.6';
try {
    const pkg = require(path.join(__dirname, '..', 'package.json'));
    if (pkg && pkg.version) pkgVersion = pkg.version;
} catch (e) {}

function getCurrentVersion() {
    if (app && typeof app.getVersion === 'function') {
        try {
            const v = app.getVersion();
            if (v && v !== process.versions.electron) return v;
        } catch (e) {}
    }
    return pkgVersion;
}

function getTempDirectory() {
    if (app && typeof app.getPath === 'function') {
        try { return app.getPath('temp'); } catch (e) {}
    }
    return process.env.TEMP || process.env.TMP || require('os').tmpdir();
}

/**
 * Parsea una versión semántica tipo "v6.1.6" o "6.1.7" a un array [major, minor, patch]
 */
function parseSemver(v) {
    if (!v) return [0, 0, 0];
    const clean = String(v).trim().replace(/^v/i, '');
    const parts = clean.split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return parts;
}

/**
 * Compara dos versiones semánticas.
 * Retorna: 1 si v1 > v2, -1 si v1 < v2, 0 si son iguales.
 */
function compareVersions(v1, v2) {
    const [maj1, min1, pat1] = parseSemver(v1);
    const [maj2, min2, pat2] = parseSemver(v2);
    if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
    if (min1 !== min2) return min1 > min2 ? 1 : -1;
    if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
    return 0;
}

/**
 * Obtiene la información del entorno de ejecución actual (Portable vs Instalado vs Dev)
 */
function getExecutionInfo() {
    const isPortable = !!process.env.PORTABLE_EXECUTABLE_FILE;
    const isPackaged = app ? !!app.isPackaged : false;
    return {
        version: getCurrentVersion(),
        isPortable,
        portableFile: process.env.PORTABLE_EXECUTABLE_FILE || null,
        portableDir: process.env.PORTABLE_EXECUTABLE_DIR || null,
        isPackaged,
        execPath: process.execPath,
        platform: process.platform,
        arch: process.arch
    };
}

/**
 * Encuentra el asset correspondiente según el modo de ejecución (portable o instalador)
 */
function findMatchingAsset(assets, isPortable) {
    if (!assets || !Array.isArray(assets) || assets.length === 0) return null;

    if (isPortable) {
        const portableAsset = assets.find(a => /portable.*\.exe$/i.test(a.name));
        if (portableAsset) return portableAsset;
    } else {
        const setupAsset = assets.find(a => /setup.*\.exe$/i.test(a.name));
        if (setupAsset) return setupAsset;
    }

    const exeAsset = assets.find(a => /\.exe$/i.test(a.name));
    if (exeAsset) return exeAsset;

    return assets[0] || null;
}

/**
 * Consulta la API pública de GitHub Releases para comprobar si hay actualizaciones disponibles
 */
async function checkForUpdates() {
    try {
        const currentVersion = getCurrentVersion();
        const execInfo = getExecutionInfo();

        const res = await fetch(RELEASES_API_URL, {
            headers: {
                'User-Agent': 'NeoGestor-App/' + currentVersion,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (res.status === 404) {
            return {
                success: true,
                status: 'no_releases',
                currentVersion,
                message: 'Aún no hay versiones publicadas en GitHub Releases.',
                execInfo
            };
        }

        if (!res.ok) {
            return {
                success: false,
                status: 'error',
                currentVersion,
                error: `Error al consultar GitHub Releases (${res.status} ${res.statusText})`,
                execInfo
            };
        }

        const release = await res.json();
        const latestVersion = release.tag_name || release.name || '';
        const cmp = compareVersions(latestVersion, currentVersion);

        if (cmp > 0) {
            const asset = findMatchingAsset(release.assets, execInfo.isPortable);
            return {
                success: true,
                status: 'update_available',
                currentVersion,
                latestVersion,
                releaseName: release.name || latestVersion,
                releaseNotes: release.body || 'Sin notas de versión disponibles.',
                releaseUrl: release.html_url,
                publishedAt: release.published_at,
                asset: asset ? {
                    name: asset.name,
                    size: asset.size,
                    downloadUrl: asset.browser_download_url
                } : null,
                execInfo
            };
        } else {
            return {
                success: true,
                status: 'up_to_date',
                currentVersion,
                latestVersion,
                releaseName: release.name || latestVersion,
                releaseUrl: release.html_url,
                publishedAt: release.published_at,
                message: '¡Tienes la versión más reciente instalada!',
                execInfo
            };
        }
    } catch (err) {
        return {
            success: false,
            status: 'error',
            currentVersion: getCurrentVersion(),
            error: err.message || 'Error de conexión con GitHub.'
        };
    }
}

/**
 * Descarga el archivo de actualización transmitiendo el progreso a la ventana solicitante
 */
async function downloadUpdate(downloadUrl, senderWebContents) {
    if (isDownloading) {
        return { success: false, error: 'Ya hay una descarga en curso.' };
    }
    isDownloading = true;

    try {
        const tempDir = getTempDirectory();
        const isPortable = !!process.env.PORTABLE_EXECUTABLE_FILE;
        const filename = isPortable
            ? `GestorCasos-portable-update-${Date.now()}.exe`
            : `GestorCasos-Setup-update-${Date.now()}.exe`;
        const tempFilePath = path.join(tempDir, filename);

        const res = await fetch(downloadUrl, {
            redirect: 'follow',
            headers: {
                'User-Agent': 'NeoGestor-App/' + getCurrentVersion()
            }
        });

        if (!res.ok) {
            isDownloading = false;
            return { success: false, error: `Error de descarga desde GitHub (${res.status} ${res.statusText})` };
        }

        const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
        let receivedBytes = 0;
        const fileStream = fs.createWriteStream(tempFilePath);

        const reader = res.body.getReader();
        let lastPercent = -1;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            fileStream.write(Buffer.from(value));
            receivedBytes += value.length;

            if (contentLength > 0 && senderWebContents && !senderWebContents.isDestroyed()) {
                const percent = Math.min(100, Math.round((receivedBytes / contentLength) * 100));
                if (percent !== lastPercent) {
                    lastPercent = percent;
                    senderWebContents.send('updater:progress', {
                        percent,
                        received: receivedBytes,
                        total: contentLength
                    });
                }
            }
        }

        await new Promise((resolve, reject) => {
            fileStream.end((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        downloadedUpdatePath = tempFilePath;
        isDownloading = false;

        return {
            success: true,
            filePath: tempFilePath,
            totalBytes: receivedBytes
        };
    } catch (err) {
        isDownloading = false;
        return {
            success: false,
            error: err.message || 'Error durante la descarga del archivo.'
        };
    }
}

/**
 * Aplica la actualización y reinicia la aplicación según el modo (Portable vs Setup)
 */
function applyUpdateAndRestart() {
    if (!downloadedUpdatePath || !fs.existsSync(downloadedUpdatePath)) {
        return { success: false, error: 'No se encontró el archivo de actualización descargado.' };
    }

    const execInfo = getExecutionInfo();

    if (execInfo.isPortable && execInfo.portableFile) {
        const targetPath = execInfo.portableFile;
        const tempDir = getTempDirectory();
        const batPath = path.join(tempDir, `neogestor_updater_${Date.now()}.bat`);

        const batScript = `@echo off
chcp 65001 > nul
set PID=${process.pid}
set NEW_EXE=${downloadedUpdatePath}
set TARGET_EXE=${targetPath}

:wait_proc
timeout /t 1 /nobreak > nul
tasklist /fi "PID eq %PID%" 2>nul | find "%PID%" > nul
if not errorlevel 1 goto wait_proc

timeout /t 1 /nobreak > nul
copy /y "%NEW_EXE%" "%TARGET_EXE%" > nul
if errorlevel 1 (
    timeout /t 1 /nobreak > nul
    copy /y "%NEW_EXE%" "%TARGET_EXE%" > nul
)

del /f /q "%NEW_EXE%" > nul
start "" "%TARGET_EXE%"
del /f /q "%~f0" > nul
`;

        fs.writeFileSync(batPath, batScript, 'utf8');

        const child = child_process.spawn('cmd.exe', ['/c', batPath], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();
        app.quit();
        return { success: true };
    } else if (execInfo.isPackaged) {
        const child = child_process.spawn(downloadedUpdatePath, ['--updated'], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();
        app.quit();
        return { success: true };
    } else {
        // En modo desarrollo, abrir la carpeta contenedora
        shell.showItemInFolder(downloadedUpdatePath);
        return {
            success: true,
            message: 'Modo desarrollo: el archivo descargado se ubicó en la carpeta temporal.'
        };
    }
}

/**
 * Registra los escuchadores IPC en el proceso principal
 */
function initUpdater(ipc) {
    const ipcTarget = ipc || ipcMain;

    ipcTarget.handle('updater:check', async () => {
        return await checkForUpdates();
    });

    ipcTarget.handle('updater:download', async (event, downloadUrl) => {
        return await downloadUpdate(downloadUrl, event.sender);
    });

    ipcTarget.handle('updater:apply', async () => {
        return applyUpdateAndRestart();
    });

    ipcTarget.handle('updater:get-info', () => {
        return getExecutionInfo();
    });

    ipcTarget.handle('updater:open-url', (event, url) => {
        if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
            shell.openExternal(url);
            return true;
        }
        return false;
    });
}

module.exports = {
    initUpdater,
    checkForUpdates,
    downloadUpdate,
    applyUpdateAndRestart,
    getExecutionInfo,
    compareVersions
};
