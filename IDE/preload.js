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
  unpackMod: (directoryName) => ipcRenderer.invoke("mods:unpack", directoryName)
});
