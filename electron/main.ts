import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.VITE_DEV_SERVER_URL;


function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, '../public/favicon.conect.png')
    : path.join(__dirname, '../dist/favicon.conect.png');

  const mainWindow = new BrowserWindow({
    width: 1280, 
    height: 720, 
    icon: iconPath,
    webPreferences: {
      // Atenção: Mantendo .cjs pois é o padrão do seu build
      preload: path.join(__dirname, 'preload.cjs'), 
      nodeIntegration: false, 
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.loadURL(isDev as string);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});