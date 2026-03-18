import { protocol as f, ipcMain as P, BrowserWindow as h, app as a, net as m } from "electron";
import e from "path";
import { fileURLToPath as b, pathToFileURL as w } from "url";
const R = b(import.meta.url), o = e.dirname(R), d = process.env.VITE_DEV_SERVER_URL;
f.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: !0,
      secure: !0,
      supportFetchAPI: !0,
      allowServiceWorkers: !0,
      // Habilita cache offline
      corsEnabled: !0
    }
  }
]);
let n = null;
function u() {
  const i = d ? e.join(o, "../public/icon.png") : e.join(o, "../dist/icon.png");
  n = new h({
    width: 1280,
    height: 720,
    icon: i,
    webPreferences: {
      preload: e.join(o, "preload.cjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      sandbox: !1
    }
  }), n.setMenuBarVisibility(!1), d ? (n.loadURL(d), n.webContents.openDevTools()) : n.loadFile(e.join(o, "../dist/index.html"));
}
P.handle("imprimir-silencioso", async (i, { content: r, styles: s }) => {
  const t = new h({
    show: !1,
    webPreferences: { nodeIntegration: !0 }
  }), l = `<html><head>${s}</head><body>${r}</body></html>`;
  return await t.loadURL("data:text/html;charset=utf-8," + encodeURI(l)), new Promise((c) => {
    t.webContents.print(
      { silent: !1, printBackground: !0 },
      (p, g) => {
        p || console.error("Erro na impressão:", g), t.close(), c(p);
      }
    );
  });
});
a.whenReady().then(() => {
  f.handle("app", (i) => {
    const { pathname: r } = new URL(i.url), s = r === "/" ? "index.html" : r.slice(1), t = e.join(o, "../dist"), l = e.join(t, s);
    return m.fetch(w(l).toString()).catch(() => {
      const c = e.join(t, "index.html");
      return m.fetch(w(c).toString());
    });
  }), u();
});
a.on("window-all-closed", () => {
  process.platform !== "darwin" && a.quit();
});
a.on("activate", () => {
  h.getAllWindows().length === 0 && u();
});
