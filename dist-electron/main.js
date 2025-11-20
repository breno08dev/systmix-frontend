import { app as e, BrowserWindow as r } from "electron";
import n from "path";
import { fileURLToPath as l } from "url";
const i = process.env.VITE_DEV_SERVER_URL, s = l(import.meta.url), t = n.dirname(s);
function a() {
  const o = new r({
    width: 1280,
    height: 720,
    webPreferences: {
      // Agora o path.join funciona, pois __dirname está definido
      preload: n.join(t, "preload.js")
    }
  });
  i ? (o.loadURL(i), o.webContents.openDevTools()) : o.loadFile(n.join(t, "../dist/index.html"));
}
e.whenReady().then(a);
e.on("window-all-closed", () => {
  process.platform !== "darwin" && e.quit();
});
e.on("activate", () => {
  r.getAllWindows().length === 0 && a();
});
