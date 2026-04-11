const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("modTool", {
  getPaths: () => ipcRenderer.invoke("app:get-paths"),
  openFolder: (targetPath) => ipcRenderer.invoke("app:open-folder", targetPath),
  confirmUnsavedChanges: (options) => ipcRenderer.invoke("app:confirm-unsaved-changes", options),
  finishCloseRequest: (shouldClose) => ipcRenderer.invoke("app:finish-close-request", shouldClose),
  setHasUnsavedChanges: (value) => ipcRenderer.send("app:set-has-unsaved-changes", value),
  onCloseRequested: (callback) => {
    ipcRenderer.removeAllListeners("app:close-requested");
    ipcRenderer.on("app:close-requested", callback);
  },
  listMods: () => ipcRenderer.invoke("mods:list"),
  loadMod: (directoryName) => ipcRenderer.invoke("mods:load", directoryName),
  createMod: (payload) => ipcRenderer.invoke("mods:create", payload),
  saveMod: (payload) => ipcRenderer.invoke("mods:save", payload),
  packMod: (directoryName) => ipcRenderer.invoke("mods:pack", directoryName),
  unpackMod: (directoryName) => ipcRenderer.invoke("mods:unpack", directoryName),
  deleteMod: (modId) => ipcRenderer.invoke("mods:delete", modId),
  duplicateMod: (modId, newGuid, newName) => ipcRenderer.invoke("mods:duplicate", modId, newGuid, newName),
  updateLocalModInfo: (modId, modName, loadOnStart) => ipcRenderer.invoke("mods:update-localmodinfo", modId, modName, loadOnStart),
  getLocalModInfo: () => ipcRenderer.invoke("mods:get-localmodinfo"),
  readSettings: () => ipcRenderer.invoke("app:read-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("app:save-settings", settings),
  listLanguages: () => ipcRenderer.invoke("app:list-languages"),
  onModsChanged: (callback) => {
    ipcRenderer.removeAllListeners("mods:changed");
    ipcRenderer.on("mods:changed", callback);
  }
});

// Window control API
contextBridge.exposeInMainWorld("electron", {
  minimize: () => ipcRenderer.invoke("app:minimize"),
  maximize: () => ipcRenderer.invoke("app:maximize"),
  restore: () => ipcRenderer.invoke("app:restore"),
  close: () => ipcRenderer.invoke("app:close")
});

// For compatibility with i18n module
contextBridge.exposeInMainWorld("electronAPI", {
  readSettings: () => ipcRenderer.invoke("app:read-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("app:save-settings", settings),
  listLanguages: () => ipcRenderer.invoke("app:list-languages")
});
