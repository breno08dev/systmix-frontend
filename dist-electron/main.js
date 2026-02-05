import { ipcMain as h, BrowserWindow as a, app as i } from "electron";
import e from "path";
import { fileURLToPath as u } from "url";
const b = u(import.meta.url), n = e.dirname(b), r = process.env.VITE_DEV_SERVER_URL;
let o = null;
function d() {
  const l = r ? e.join(n, "../public/icon.png") : e.join(n, "../dist/icon.png");
  o = new a({
    width: 1280,
    height: 720,
    icon: l,
    webPreferences: {
      preload: e.join(n, "preload.cjs"),
      // ATENÇÃO: Verifique se no seu build gera .mjs ou .cjs
      nodeIntegration: !1,
      contextIsolation: !0,
      sandbox: !1
      // Necessário para algumas comunicações
    }
  }), o.setMenuBarVisibility(!1), r ? o.loadURL(r) : o.loadFile(e.join(n, "../dist/index.html"));
}
h.handle("imprimir-silencioso", async (l, { content: c, styles: m }) => {
  const t = new a({
    show: !1,
    webPreferences: { nodeIntegration: !0 }
  }), p = `
        <html>
            <head>${m}</head>
            <body>${c}</body>
        </html>
    `;
  return await t.loadURL("data:text/html;charset=utf-8," + encodeURI(p)), new Promise((w) => {
    t.webContents.print({ silent: !1, printBackground: !0 }, (s, f) => {
      s || console.error("Erro na impressão:", f), t.close(), w(s);
    });
  });
});
i.whenReady().then(d);
i.on("window-all-closed", () => {
  process.platform !== "darwin" && i.quit();
});
i.on("activate", () => {
  a.getAllWindows().length === 0 && d();
});
