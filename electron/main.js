// Electron shell for Hishab: runs the bundled Next standalone server locally and
// loads it in a window. User data (SQLite) lives in Electron userData so it
// survives reinstalls.
const { app, BrowserWindow } = require("electron");
const { fork } = require("child_process");
const path = require("path");
const http = require("http");

const PORT = 34117;
let serverProc;

function resourcePath(...p) {
  // In a packaged app, extraResources land in process.resourcesPath
  return app.isPackaged ? path.join(process.resourcesPath, ...p) : path.join(__dirname, "..", ...p);
}

function startServer() {
  const serverJs = resourcePath("standalone", "server.js");
  serverProc = fork(serverJs, [], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      SMS_DATA_DIR: app.getPath("userData"),
      NODE_ENV: "production",
    },
    stdio: "ignore",
  });
}

function waitForServer(cb, tries = 0) {
  http.get(`http://127.0.0.1:${PORT}/login`, () => cb()).on("error", () => {
    if (tries > 60) return cb();
    setTimeout(() => waitForServer(cb, tries + 1), 300);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: "Hishab",
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(`http://127.0.0.1:${PORT}/`);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    startServer();
    waitForServer(() => createWindow());
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on("window-all-closed", () => {
    if (serverProc) serverProc.kill();
    if (process.platform !== "darwin") app.quit();
  });
  app.on("quit", () => { if (serverProc) serverProc.kill(); });
}
