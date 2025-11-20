import { app as e, BrowserWindow as a } from "electron";
import o from "path";
import { fileURLToPath as c } from "url";
const l = c(import.meta.url), n = o.dirname(l), t = process.env.VITE_DEV_SERVER_URL;
function r() {
  const s = t ? o.join(n, "../public/favicon.conect.png") : o.join(n, "../dist/favicon.conect.png"), i = new a({
    width: 1280,
    height: 720,
    icon: s,
    // <--- Usa o caminho calculado acima
    webPreferences: {
      preload: o.join(n, "preload.js"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  i.setMenuBarVisibility(!1), t ? i.loadURL(t) : i.loadFile(o.join(n, "../dist/index.html"));
}
e.whenReady().then(r);
e.on("window-all-closed", () => {
  process.platform !== "darwin" && e.quit();
});
e.on("activate", () => {
  a.getAllWindows().length === 0 && r();
});
