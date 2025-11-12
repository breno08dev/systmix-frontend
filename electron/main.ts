// electron/main.ts
import { app, BrowserWindow } from 'electron';

// === NOVAS LINHAS AQUI ===
// Importamos os módulos 'path' e 'url' nativos do Node.js
import path from 'path';
import { fileURLToPath } from 'url';
// =========================

// A variável 'isDev' agora guarda a URL do servidor
const isDev = process.env.VITE_DEV_SERVER_URL;

// === DEFININDO __dirname PARA O MODO ES MODULE ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ===============================================

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      // Agora o path.join funciona, pois __dirname está definido
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL(isDev);
    mainWindow.webContents.openDevTools();
  } else {
    // E aqui também
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});