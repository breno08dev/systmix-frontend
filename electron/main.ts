import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, '../public/icon.png') 
    : path.join(__dirname, '../dist/icon.png');

  mainWindow = new BrowserWindow({
    width: 1280, 
    height: 720, 
    icon: iconPath, 
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), // ATENÇÃO: Verifique se no seu build gera .mjs ou .cjs
      nodeIntegration: false, 
      contextIsolation: true,
      sandbox: false // Necessário para algumas comunicações
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.loadURL(isDev as string);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// --- GERENCIADOR DE IMPRESSÃO (O FIX DO TRAVAMENTO) ---
ipcMain.handle('imprimir-silencioso', async (_, { content, styles }) => {
    const workerWindow = new BrowserWindow({ 
        show: false, 
        webPreferences: { nodeIntegration: true } 
    });

    const html = `
        <html>
            <head>${styles}</head>
            <body>${content}</body>
        </html>
    `;

    await workerWindow.loadURL('data:text/html;charset=utf-8,' + encodeURI(html));

    // Removemos 'reject' pois não estava sendo usado
    return new Promise((resolve) => {
        workerWindow.webContents.print({ silent: false, printBackground: true }, (success, errorType) => {
            if (!success) console.error("Erro na impressão:", errorType);
            workerWindow.close();
            resolve(success);
        });
    });
});
// -----------------------------------------------------

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});