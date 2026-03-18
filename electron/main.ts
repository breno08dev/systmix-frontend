// electron/main.ts
import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.VITE_DEV_SERVER_URL;

// 1. REGISTRO DO PROTOCOLO (Antes do app 'ready')
// Define 'app://' como seguro, padrão e com suporte a fetch/CORS
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      allowServiceWorkers: true, // Habilita cache offline
      corsEnabled: true,
    },
  },
]);

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
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.loadURL(isDev as string);
    
    // Adicione esta linha para abrir o console automaticamente:
    mainWindow.webContents.openDevTools(); 
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    
    // Se precisar forçar a abertura do console na versão final de produção, adicione aqui também:
    // mainWindow.webContents.openDevTools();
  }
}

// --- GERENCIADOR DE IMPRESSÃO ---
ipcMain.handle('imprimir-silencioso', async (_, { content, styles }) => {
  const workerWindow = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true },
  });

  const html = `<html><head>${styles}</head><body>${content}</body></html>`;
  await workerWindow.loadURL('data:text/html;charset=utf-8,' + encodeURI(html));

  return new Promise((resolve) => {
    workerWindow.webContents.print(
      { silent: false, printBackground: true },
      (success, errorType) => {
        if (!success) console.error('Erro na impressão:', errorType);
        workerWindow.close();
        resolve(success);
      }
    );
  });
});

app.whenReady().then(() => {
  // 3. HANDLER DO PROTOCOLO (A Mágica acontece aqui)
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);

    // Normaliza a requisição:
    // Se pedir raiz '/', entrega o index.html
    const resolvedPath = pathname === '/' ? 'index.html' : pathname.slice(1); // remove a barra inicial

    // Caminho da pasta 'dist' dentro do ASAR
    // __dirname é '.../resources/app.asar/dist-electron'
    // ../dist é '.../resources/app.asar/dist'
    const distPath = path.join(__dirname, '../dist');
    const finalPath = path.join(distPath, resolvedPath);

    // Tenta servir o arquivo solicitado.
    // Se der erro (ex: rota do React '/clientes' que não é arquivo), serve o index.html (SPA Fallback)
    return net.fetch(pathToFileURL(finalPath).toString()).catch(() => {
        const indexPath = path.join(distPath, 'index.html');
        return net.fetch(pathToFileURL(indexPath).toString());
    });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});