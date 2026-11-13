const { app, BrowserWindow, ipcMain, session, systemPreferences, screen } = require('electron')
const path = require('path')
const gemini = require('./gemini.cjs')

const APP_VERSION = '0.1.0'

function applyCaptureExclusion(win, enabled) {
  win.setContentProtection(Boolean(enabled))
  if (typeof win.setHiddenInMissionControl === 'function') {
    win.setHiddenInMissionControl(Boolean(enabled))
  }
}

function moveToOtherDisplay(win) {
  const displays = screen.getAllDisplays()
  if (displays.length < 2) {
    return { moved: false, displayCount: displays.length }
  }
  const current = screen.getDisplayMatching(win.getBounds())
  const other = displays.find((display) => display.id !== current.id)
  if (!other) {
    return { moved: false, displayCount: displays.length }
  }
  win.setPosition(other.workArea.x + 24, other.workArea.y + 24)
  return { moved: true, displayCount: displays.length }
}

function setPinned(win, enabled) {
  if (enabled) {
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    win.setAlwaysOnTop(false)
    win.setVisibleOnAllWorkspaces(false)
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 360,
    minHeight: 550,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    show: false,
    title: 'Interview Assistant',
    backgroundColor: '#16181d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  setPinned(win, true)

  win.once('ready-to-show', () => {
    win.show()
    applyCaptureExclusion(win, true)
    setTimeout(() => applyCaptureExclusion(win, true), 250)
  })

  win.on('show', () => applyCaptureExclusion(win, true))
  win.on('focus', () => applyCaptureExclusion(win, true))

  const isPackaged = app.isPackaged
  if (!isPackaged) {
    win.loadURL('http://127.0.0.1:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return win
}

function registerIpc() {
  ipcMain.handle('app:getInfo', () => ({
    version: APP_VERSION,
    platform: process.platform,
    name: 'Interview Assistant',
    captureExclusionReliable: process.platform === 'win32',
  }))

  ipcMain.handle('window:getAlwaysOnTop', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isAlwaysOnTop() : false
  })

  ipcMain.handle('window:setAlwaysOnTop', (event, enabled) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    setPinned(win, Boolean(enabled))
    return win.isAlwaysOnTop()
  })

  ipcMain.handle('window:getContentProtection', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    return typeof win.isContentProtected === 'function' ? win.isContentProtected() : true
  })

  ipcMain.handle('window:moveToOtherDisplay', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { moved: false, displayCount: 0 }
    return moveToOtherDisplay(win)
  })

  ipcMain.handle('window:setContentProtection', (event, enabled) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    applyCaptureExclusion(win, Boolean(enabled))
    return typeof win.isContentProtected === 'function' ? win.isContentProtected() : Boolean(enabled)
  })

  ipcMain.handle('gemini:hasKey', () => gemini.hasApiKey())
  ipcMain.handle('gemini:setKey', (_event, key) => gemini.setApiKey(key))
  ipcMain.handle('gemini:suggestAnswer', (_event, transcript) => gemini.suggestAnswer(transcript))

  ipcMain.handle('audio:requestMicrophoneAccess', async () => {
    if (process.platform === 'darwin' && systemPreferences?.askForMediaAccess) {
      const current = systemPreferences.getMediaAccessStatus('microphone')
      if (current === 'granted') {
        return { granted: true, status: current }
      }
      const granted = await systemPreferences.askForMediaAccess('microphone')
      return {
        granted,
        status: systemPreferences.getMediaAccessStatus('microphone'),
      }
    }

    return { granted: true, status: 'prompt' }
  })
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
      callback(true)
      return
    }
    callback(false)
  })

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media' || permission === 'microphone' || permission === 'audioCapture'
  })

  gemini.init(app.getPath('userData'))
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
