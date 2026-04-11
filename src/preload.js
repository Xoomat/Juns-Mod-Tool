const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("translatorAPI", {
  getTranslationsPath: () => ipcRenderer.invoke("translator:get-translations-path"),
  listModTranslations: () => ipcRenderer.invoke("translator:list-mod-translations"),
  loadTranslation: (modName, fileName) =>
    ipcRenderer.invoke("translator:load-translation", modName, fileName),
  saveTranslation: (modName, fileName, data) =>
    ipcRenderer.invoke("translator:save-translation", modName, fileName, data),
  createModFolder: (modName) =>
    ipcRenderer.invoke("translator:create-mod-folder", modName)
});
