const { app, BrowserWindow } = require("electron");
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

function createWindow() {
  const win = new BrowserWindow({ width: 1280, height: 820, title: "Hishab", webPreferences: { contextIsolation: true } });
  waitForServer(win);
}

const lock = app.requestSingleInstanceLock();
if (!lock) { app.quit(); }
else {
  app.whenReady().then(() => { log("app ready; packaged=" + app.isPackaged); startServer(); createWindow();
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
  app.on("window-all-closed", () => { if (serverProc) serverProc.kill(); if (process.platform !== "darwin") app.quit(); });
  app.on("quit", () => { if (serverProc) serverProc.kill(); });
}
