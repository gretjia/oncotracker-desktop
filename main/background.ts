import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import net from 'net';

const isProd = process.env.NODE_ENV === 'production';
const isDev = !app.isPackaged;

// Helper to check if port is ready
const checkPort = (port: number, timeout = 30000): Promise<void> => {
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

const createWindow = (port: number) => {
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
    console.log(`[Electron] Loading URL: ${url}`);
    mainWindow.loadURL(url);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

app.on('ready', async () => {
    try {
        const port = await findFreePort();
        console.log(`[Electron] Selected free port: ${port}`);

        if (isProd) {
            const serverPath = path.join(process.resourcesPath, '.next/standalone/server.js');
            console.log(`[Electron] Spawning Next.js server at: ${serverPath}`);

            const serverEnv = { ...process.env, PORT: port.toString(), HOST: '127.0.0.1' };

            const nextServer = spawn(process.execPath, [serverPath], {
                env: serverEnv,
                cwd: path.join(process.resourcesPath),
                stdio: 'inherit'
            });

            nextServer.on('error', (err) => {
                console.error('[Electron] Failed to start Next.js server:', err);
            });
        } else {
            // In Dev, we assume 'npm run dev' is running on 3000 (or we could proxy, but usually we just load 3000)
            // Adjust logic if you want dev to verify port 3000
            console.log('[Electron] Dev mode: Loading localhost:3000');
            createWindow(3000);
            return;
        }

        // Wait for port to be ready
        await checkPort(port);
        console.log('[Electron] Server is ready!');
        createWindow(port);

    } catch (err) {
        console.error('[Electron] Startup failed:', err);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
