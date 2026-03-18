import { protocol, ipcMain, BrowserWindow, app, net } from "electron";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
const isDev = process.env.VITE_DEV_SERVER_URL;
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      allowServiceWorkers: true,
      // Habilita cache offline
      corsEnabled: true
    }
  }
]);
let mainWindow = null;
function createWindow() {
  const iconPath = isDev ? path.join(__dirname$1, "../public/icon.png") : path.join(__dirname$1, "../dist/icon.png");
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  if (isDev) {
    mainWindow.loadURL(isDev);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
}
ipcMain.handle("imprimir-silencioso", async (_, { content, styles }) => {
  const workerWindow = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true }
  });
  const html = `<html><head>${styles}</head><body>${content}</body></html>`;
  await workerWindow.loadURL("data:text/html;charset=utf-8," + encodeURI(html));
  return new Promise((resolve) => {
    workerWindow.webContents.print(
      { silent: false, printBackground: true },
      (success, errorType) => {
        if (!success) console.error("Erro na impressão:", errorType);
        workerWindow.close();
        resolve(success);
      }
    );
  });
});
app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    const resolvedPath = pathname === "/" ? "index.html" : pathname.slice(1);
    const distPath = path.join(__dirname$1, "../dist");
    const finalPath = path.join(distPath, resolvedPath);
    return net.fetch(pathToFileURL(finalPath).toString()).catch(() => {
      const indexPath = path.join(distPath, "index.html");
      return net.fetch(pathToFileURL(indexPath).toString());
    });
  });
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
