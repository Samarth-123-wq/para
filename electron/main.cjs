const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  systemPreferences,
  screen,
  globalShortcut,
} = require("electron");
const path = require("path");
const gemini = require("./gemini.cjs");
const { initMain } = require("electron-audio-loopback");

const APP_VERSION = "0.1.0";
initMain({ forceCoreAudioTap: true });

function applyCaptureExclusion(win, enabled) {
  if (!win || win.isDestroyed()) return;
  console.log("applyCaptureExclusion", enabled);
  win.setContentProtection(Boolean(enabled));
  win.setTitle("");
  if (typeof win.setHiddenInMissionControl === "function") {
    win.setHiddenInMissionControl(Boolean(enabled));
  }
  if (process.platform === "win32" && enabled) {
    setTimeout(() => {
      if (win && !win.isDestroyed()) {
        win.setContentProtection(true);
      }
    }, 50);
  }
}

function moveToOtherDisplay(win) {
  const displays = screen.getAllDisplays();
  if (displays.length < 2) {
    return { moved: false, displayCount: displays.length };
  }
  const current = screen.getDisplayMatching(win.getBounds());
  const other = displays.find((display) => display.id !== current.id);
  if (!other) {
    return { moved: false, displayCount: displays.length };
  }
  win.setPosition(other.workArea.x + 24, other.workArea.y + 24);
  return { moved: true, displayCount: displays.length };
}

function setPinned(win, enabled) {
  if (enabled) {
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else {
    win.setAlwaysOnTop(false);
    win.setVisibleOnAllWorkspaces(false);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 520,
    height: 760,
    minWidth: 360,
    minHeight: 550,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    show: false,
    title: "Interview Assistant",
    backgroundColor: "#16181d",
    autoHideMenuBar: true,
    frame: true, // ✅ Gives the user the native close/minimize buttons
    focusable: true, // ✅ Allows the user to click inputs and paste text
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      const labels = ["log", "warn", "error", "debug"];
      console.log(
        `[renderer:${labels[level] ?? level}] ${message} (${sourceId}:${line})`,
      );
    },
  );

  win.on("page-title-updated", (e) => {
    e.preventDefault();
    win.setTitle("");
  });

  setPinned(win, true);

  win.once("ready-to-show", () => {
    win.show();
    applyCaptureExclusion(win, true);
    setTimeout(() => applyCaptureExclusion(win, true), 250);
  });

  win.on("show", () => {
    setTimeout(() => applyCaptureExclusion(win, true), 10);
  });
  win.on("focus", () => applyCaptureExclusion(win, true));
  win.on("move", () => applyCaptureExclusion(win, true));
  win.on("resize", () => applyCaptureExclusion(win, true));
  win.on("restore", () => applyCaptureExclusion(win, true));

  const isPackaged = app.isPackaged;
  if (!isPackaged) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  return win;
}
ipcMain.on("renderer-log", (_e, args) => {
  console.log("[renderer]", ...args);
});

function registerIpc() {
  ipcMain.handle("app:getInfo", () => ({
    version: APP_VERSION,
    platform: process.platform,
    name: "Interview Assistant",
    captureExclusionReliable: process.platform === "win32",
  }));
  ipcMain.handle("gemini:getKey", () => gemini.getApiKey());

  ipcMain.handle("window:getAlwaysOnTop", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? win.isAlwaysOnTop() : false;
  });

  ipcMain.handle("window:setAlwaysOnTop", (event, enabled) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    setPinned(win, Boolean(enabled));
    return win.isAlwaysOnTop();
  });

  ipcMain.handle("window:getContentProtection", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    return typeof win.isContentProtected === "function"
      ? win.isContentProtected()
      : true;
  });

  ipcMain.handle("window:moveToOtherDisplay", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { moved: false, displayCount: 0 };
    return moveToOtherDisplay(win);
  });

  ipcMain.handle("window:setContentProtection", (event, enabled) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    applyCaptureExclusion(win, Boolean(enabled));
    return typeof win.isContentProtected === "function"
      ? win.isContentProtected()
      : Boolean(enabled);
  });

  ipcMain.handle("window:hideOverlay", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.hide();
    return true;
  });

  ipcMain.handle("window:showOverlay", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.show();
      win.focus();
      setTimeout(() => applyCaptureExclusion(win, true), 10);
    }
    return true;
  });

  ipcMain.handle("gemini:hasKey", () => gemini.hasApiKey());
  ipcMain.handle("gemini:setKey", (_event, key) => gemini.setApiKey(key));
  ipcMain.handle("gemini:suggestAnswer", (_event, transcript) =>
    gemini.suggestAnswer(transcript),
  );

  ipcMain.handle("audio:requestMicrophoneAccess", async () => {
    if (process.platform === "darwin" && systemPreferences?.askForMediaAccess) {
      const current = systemPreferences.getMediaAccessStatus("microphone");
      if (current === "granted") {
        return { granted: true, status: current };
      }
      const granted = await systemPreferences.askForMediaAccess("microphone");
      return {
        granted,
        status: systemPreferences.getMediaAccessStatus("microphone"),
      };
    }

    return { granted: true, status: "prompt" };
  });
}

app.commandLine.appendSwitch(
  "disable-features",
  "IOSurfaceCapturer,DesktopCaptureMacV2",
);

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      if (
        permission === "media" ||
        permission === "microphone" ||
        permission === "audioCapture" ||
        permission === "display-capture"
      ) {
        callback(true);
        return;
      }
      callback(false);
    },
  );

  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => {
      return (
        permission === "media" ||
        permission === "microphone" ||
        permission === "audioCapture" ||
        permission === "display-capture"
      );
    },
  );

  gemini.init(app.getPath("userData"));
  registerIpc();
  createWindow();

  const shortcutOk = globalShortcut.register("CommandOrControl+Shift+H", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
      setTimeout(() => applyCaptureExclusion(win, true), 10);
    }
  });
  if (!shortcutOk) {
    console.error(
      "[main] Failed to register global shortcut CommandOrControl+Shift+H",
    );
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
