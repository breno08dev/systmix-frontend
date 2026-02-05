import { app as n, BrowserWindow as a } from "electron";
import i from "path";
import { fileURLToPath as l } from "url";
const c = l(import.meta.url), o = i.dirname(c), t = process.env.VITE_DEV_SERVER_URL;
function r() {
  const s = t ? i.join(o, "../public/icon.png") : i.join(o, "../dist/icon.png"), e = new a({
    width: 1280,
    height: 720,
    icon: s,
    // Define o ícone da janela e barra de tarefas
    webPreferences: {
      preload: i.join(o, "preload.cjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  e.setMenuBarVisibility(!1), t ? e.loadURL(t) : e.loadFile(i.join(o, "../dist/index.html"));
}
n.whenReady().then(r);
n.on("window-all-closed", () => {
  process.platform !== "darwin" && n.quit();
});
n.on("activate", () => {
  a.getAllWindows().length === 0 && r();
});
