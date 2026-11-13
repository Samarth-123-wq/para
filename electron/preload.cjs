const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopApi', {
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  requestMicrophoneAccess: () => ipcRenderer.invoke('audio:requestMicrophoneAccess'),
  getAlwaysOnTop: () => ipcRenderer.invoke('window:getAlwaysOnTop'),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('window:setAlwaysOnTop', enabled),
  getContentProtection: () => ipcRenderer.invoke('window:getContentProtection'),
  setContentProtection: (enabled) => ipcRenderer.invoke('window:setContentProtection', enabled),
  moveToOtherDisplay: () => ipcRenderer.invoke('window:moveToOtherDisplay'),
  geminiHasKey: () => ipcRenderer.invoke('gemini:hasKey'),
  setGeminiApiKey: (key) => ipcRenderer.invoke('gemini:setKey', key),
  suggestAnswer: (transcript) => ipcRenderer.invoke('gemini:suggestAnswer', transcript),
})
