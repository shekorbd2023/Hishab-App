const { app, BrowserWindow, dialog, shell } = require("electron");
const { fork } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const PORT = 34117;
let serverProc;
const logFile = path.join(app.getPath("userData"), "hishab.log");
const debugSinks = ["G:\\bsuiness management oftwrae\\hishab-desktop.log"];
function log(m) {
  const line = "[" + new Date().toISOString() + "] " + m + "\n";
  try { fs.appendFileSync(logFile, line); } catch (e) {}
  for (const p of debugSinks) { try { fs.appendFileSync(p, line); } catch (e) {} }
}

function resourcePath(...p) {
  return app.isPackaged ? path.join(process.resourcesPath, ...p) : path.join(__dirname, "..", ...p);
}

function startServer() {
  const dir = resourcePath("standalone");
  const serverJs = path.join(dir, "server.js");
  log("server.js=" + serverJs + " exists=" + fs.existsSync(serverJs));
  log("node_modules/next exists=" + fs.existsSync(path.join(dir, "node_modules", "next")));
  serverProc = fork(serverJs, [], {
    cwd: dir,
    execArgv: ["--experimental-sqlite"],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_OPTIONS: "--experimental-sqlite",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      SMS_DATA_DIR: app.getPath("userData"),
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  if (serverProc.stdout) serverProc.stdout.on("data", (d) => log("[srv] " + d.toString().trim()));
  if (serverProc.stderr) serverProc.stderr.on("data", (d) => log("[err] " + d.toString().trim()));
  serverProc.on("error", (e) => log("fork error: " + e.message));
  // Forgot-password: the server asks us to show the reset-code file in Explorer.
  serverProc.on("message", (m) => {
    try {
      if (!m || m.type !== "hishab:reveal-reset-file" || typeof m.path !== "string") return;
      const want = path.resolve(m.path), dataDir = path.resolve(app.getPath("userData"));
      if (path.dirname(want) !== dataDir || path.basename(want) !== "PASSWORD-RESET-CODE.txt") return;
      shell.showItemInFolder(want);
    } catch (e) { log("reveal failed: " + e.message); }
  });
  serverProc.on("exit", (c, s) => log("server exit code=" + c + " sig=" + s));
}

function ping(cb) {
  const r = http.get("http://127.0.0.1:" + PORT + "/login", (res) => { res.resume(); cb(true); });
  r.on("error", () => cb(false));
  r.setTimeout(2000, () => { r.destroy(); cb(false); });
}

function waitForServer(win, tries = 0) {
  ping((ok) => {
    if (ok) { log("server up, loading UI"); win.loadURL("http://127.0.0.1:" + PORT + "/"); return; }
    if (tries > 24) {
      let tail = "no log";
      try { tail = fs.readFileSync(logFile, "utf8").slice(-4000); } catch (e) {}
      win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(
        "<body style='font-family:sans-serif;padding:20px'><h2>Hishab could not start its local server</h2>" +
        "<p>Please send this log to support:</p><pre style='white-space:pre-wrap;background:#f4f4f4;padding:10px'>" +
        tail.replace(/</g, "&lt;") + "</pre></body>"));
      return;
    }
    setTimeout(() => waitForServer(win, tries + 1), 500);
  });
}

/* ---- Auto-update --------------------------------------------------------------
 * Checks GitHub Releases (shekorbd2023/Hishab-App) for a newer version on start and every 4 hours,
 * downloads it in the background and installs it on restart. Data lives in userData, which the
 * installer never touches, so updates keep every business, invoice and setting. */
let mainWin = null;
function setupAutoUpdate() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require("electron-updater")); } catch (e) { log("updater missing: " + e.message); return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = { info: (m) => log("[upd] " + m), warn: (m) => log("[upd] WARN " + m), error: (m) => log("[upd] ERR " + m), debug: () => {} };
  autoUpdater.on("update-available", (i) => log("update available: " + i.version));
  autoUpdater.on("update-not-available", () => log("no update"));
  autoUpdater.on("error", (e) => log("update error: " + (e && e.message)));
  autoUpdater.on("update-downloaded", async (info) => {
    log("update downloaded: " + info.version);
    const r = await dialog.showMessageBox(mainWin || undefined, {
      type: "info",
      buttons: ["এখনই রিস্টার্ট করুন (Restart now)", "পরে (Later)"],
      defaultId: 0, cancelId: 1,
      title: "Hishab update",
      message: "Hishab " + info.version + " ডাউনলোড হয়েছে।",
      detail: "রিস্টার্ট করলেই নতুন ভার্সন চালু হবে। আপনার সব ডেটা আগের মতোই থাকবে।\n\n" +
        "\"পরে\" চাপলে অ্যাপ বন্ধ করার সময় আপডেট নিজে থেকেই ইনস্টল হবে।",
    });
    if (r.response === 0) {
      if (serverProc) { try { serverProc.kill(); } catch (e) {} }
      setImmediate(() => autoUpdater.quitAndInstall(true, true));
    }
  });
  const check = () => autoUpdater.checkForUpdates().catch((e) => log("check failed: " + (e && e.message)));
  setTimeout(check, 10 * 1000);
  setInterval(check, 4 * 60 * 60 * 1000);
}

function createWindow() {
  const winIcon = resourcePath("standalone", "public", "icon.png");
  const win = new BrowserWindow({ width: 1280, height: 820, title: "Hishab " + app.getVersion(), icon: winIcon, webPreferences: { contextIsolation: true } });
  mainWin = win;
  win.on("page-title-updated", (e) => e.preventDefault());
  waitForServer(win);
}

const lock = app.requestSingleInstanceLock();
if (!lock) { app.quit(); }
else {
  app.whenReady().then(() => { try{ app.setAppUserModelId("app.hishab.desktop"); }catch(e){} log("app ready; packaged=" + app.isPackaged); startServer(); createWindow(); setupAutoUpdate();
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
  app.on("second-instance", () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });
  app.on("window-all-closed", () => { if (serverProc) serverProc.kill(); if (process.platform !== "darwin") app.quit(); });
  app.on("quit", () => { if (serverProc) serverProc.kill(); });
}
