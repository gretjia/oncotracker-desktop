import { app, BrowserWindow, screen, dialog } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import fs from 'fs';

// --- ROBUST LOGGING SETUP ---
let logStream: fs.WriteStream | null = null;

try {
    const logPath = path.join(app.getPath('desktop'), 'oncotracker-debug.log');
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(`\n\n=== APP STARTUP: ${new Date().toISOString()} ===\n`);
    logStream.write(`Node: ${process.version}, Electron: ${process.versions.electron}\n`);
    logStream.write(`Platform: ${process.platform}, Arch: ${process.arch}\n`);
} catch (e) {
    console.error('Failed to setup logger:', e);
}

const log = (msg: string) => {
    console.log(msg);
    if (logStream) logStream.write(`[INFO] ${msg}\n`);
};

const logError = (msg: string, err: any) => {
    console.error(msg, err);
    if (logStream) {
        logStream.write(`[ERROR] ${msg}: ${err instanceof Error ? err.stack : String(err)}\n`);
    }
    // Try to show dialog if app is ready, otherwise might crash but at least we logged
    try {
        dialog.showErrorBox('Critical Error', `${msg}\n\n${err}`);
    } catch (_) { }
};

process.on('uncaughtException', (err) => {
    logError('Uncaught Exception', err);
    app.quit();
});

process.on('unhandledRejection', (reason) => {
    logError('Unhandled Rejection', reason);
    app.quit();
});

// --- SINGLE INSTANCE LOCK (CRITICAL for Windows) ---
// Prevents multiple Electron instances from cascading and exhausting handles
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    log('Another instance is already running. Exiting this one.');
    app.quit();
}

// Use app.isPackaged for reliable production detection (NODE_ENV is not set in packaged apps)
const isProd = app.isPackaged;
log(`isProd (app.isPackaged): ${isProd}`);
log(`resourcesPath: ${process.resourcesPath}`);

// Helper to check if port is ready (increased to 120s for cold Windows starts)
const checkPort = (port: number, timeout = 120000): Promise<void> => {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const tryConnect = () => {
            if (Date.now() - start > timeout) {
                return reject(new Error('Timeout waiting for port ' + port));
            }
            const socket = new net.Socket();
            socket.connect(port, '127.0.0.1', () => {
                socket.destroy();
                resolve();
            });
            socket.on('error', () => {
                socket.destroy();
                setTimeout(tryConnect, 1000);
            });
        };
        tryConnect();
    });
};

// Helper to find a free port
const findFreePort = (): Promise<number> => {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, () => {
            const address = server.address();
            const port = typeof address === 'string' ? 0 : address?.port || 0;
            server.close(() => {
                resolve(port);
            });
        });
    });
};

let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;

// Cleanup function for graceful shutdown
const cleanupServer = () => {
    if (nextServer) {
        log('Cleaning up Next.js server process...');
        try {
            if (process.platform === 'win32' && nextServer.pid) {
                // For detached processes on Windows, use taskkill with /T to kill tree
                spawn('taskkill', ['/pid', nextServer.pid.toString(), '/f', '/t'], {
                    shell: true,
                    detached: true,
                    windowsHide: true
                });
            } else if (!nextServer.killed) {
                nextServer.kill('SIGTERM');
            }
        } catch (e) {
            log(`Cleanup error (non-fatal): ${e}`);
        }
        nextServer = null;
    }
};

// Handle second instance attempt (focus existing window)
app.on('second-instance', () => {
    log('Second instance attempted, focusing existing window');
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

const createWindow = (port: number) => {
    log('Creating window...');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // preload: path.join(__dirname, 'preload.js') 
        },
    });

    const url = `http://127.0.0.1:${port}`;
    log(`Loading URL: ${url}`);
    mainWindow.loadURL(url);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

app.on('ready', async () => {
    // Exit early if we didn't get the lock (already handled above but be safe)
    if (!gotTheLock) return;

    log('App ready event received');
    try {
        const port = await findFreePort();
        log(`Selected free port: ${port}`);

        if (isProd) {
            // asar is disabled, so files are directly in resources/app folder
            const standaloneDir = path.join(process.resourcesPath, 'app', '.next', 'standalone');
            const serverPath = path.join(standaloneDir, 'server.js');

            log(`Standalone dir: ${standaloneDir}`);
            log(`Server path: ${serverPath}`);

            // Verify paths exist
            if (!fs.existsSync(standaloneDir)) {
                throw new Error(`Standalone directory not found: ${standaloneDir}`);
            }

            if (!fs.existsSync(serverPath)) {
                throw new Error(`Server.js not found: ${serverPath}`);
            }

            log(`Spawning Next.js server at: ${serverPath}`);

            // Spawn with a clean, typed env so Next runs under Node (not Electron)
            const serverEnv: NodeJS.ProcessEnv = {
                ...process.env,
                PORT: port.toString(),
                HOST: '127.0.0.1',
                NODE_ENV: 'production',
                ELECTRON_RUN_AS_NODE: '1',
            };

            const nodeExecutable = process.execPath;
            log(`Using executable to launch Next.js server: ${nodeExecutable}`);

            // CRITICAL FIX: Use detached + shell to bypass Windows Job Object restrictions
            // This fixes: "AssignProcessToJobObject: (50) The request is not supported"
            // Quote paths for shell to handle spaces in "OncoTracker Local.exe"
            const quotedExe = `"${nodeExecutable}"`;
            const quotedServer = `"${serverPath}"`;
            log(`Shell command: ${quotedExe} ${quotedServer}`);

            nextServer = spawn(quotedExe, [quotedServer], {
                env: serverEnv,
                cwd: standaloneDir,
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: true,      // Bypass job object inheritance
                shell: true,         // Spawn via cmd.exe for process isolation  
                windowsHide: true    // Don't show console window
            });

            // Redirect logs
            nextServer.stdout?.on('data', (data) => {
                const msg = data.toString();
                log(`[NEXT STDOUT] ${msg.trim()}`);
            });

            nextServer.stderr?.on('data', (data) => {
                const msg = data.toString();
                log(`[NEXT STDERR] ${msg.trim()}`);
            });

            nextServer.on('error', (err) => {
                logError('Failed to start Next.js server', err);
            });

            nextServer.on('exit', (code, signal) => {
                log(`Next.js server exited with code ${code}, signal ${signal}`);
                if (code !== 0 && code !== null && mainWindow) {
                    logError('Next.js server exited abnormally', `Code: ${code}`);
                }
            });

            // Don't wait for detached child when parent exits
            nextServer.unref();

        } else {
            log('Dev mode: Loading localhost:3000');
            createWindow(3000);
            return;
        }

        // Wait for port to be ready
        log(`Waiting for port ${port} to be ready...`);
        await checkPort(port);
        log('Server is ready! Creating window.');
        createWindow(port);

    } catch (err) {
        logError('Startup failed', err);
        cleanupServer();
        dialog.showErrorBox(
            'OncoTracker Startup Failed',
            `The application could not start.\n\n` +
            `${err}\n\n` +
            `Please try:\n` +
            `1. Close any other OncoTracker windows\n` +
            `2. Restart your computer\n` +
            `3. Check the log file on your Desktop`
        );
        app.quit();
    }
});

app.on('before-quit', () => {
    log('App before-quit event');
    cleanupServer();
});

app.on('window-all-closed', () => {
    log('All windows closed');
    cleanupServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('quit', () => {
    log('App quit event');
    cleanupServer();
    if (logStream) {
        logStream.write(`=== APP SHUTDOWN: ${new Date().toISOString()} ===\n`);
        logStream.end();
    }
});
