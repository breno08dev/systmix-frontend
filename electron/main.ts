// electron/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. CRIAÇÃO MANUAL DO __dirname (CRUCIAL PARA O ERRO QUE VOCÊ TEVE)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Variável que indica se está em modo de desenvolvimento
const isDev = process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  // Lógica para encontrar o ícone correto dependendo se é DEV ou PROD
  const iconPath = isDev
    ? path.join(__dirname, '../public/favicon.conect.png') // Em desenvolvimento
    : path.join(__dirname, '../dist/favicon.conect.png');  // Em produção (build)

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: iconPath, // <--- Usa o caminho calculado acima
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Remove a barra de menu padrão (opcional, deixa o visual mais limpo)
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    // Em DEV, carrega a URL do servidor Vite
    mainWindow.loadURL(isDev);
    // Abre o DevTools apenas em desenvolvimento se quiser
    // mainWindow.webContents.openDevTools(); 
  } else {
    // Em PRODUÇÃO, carrega o index.html compilado
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