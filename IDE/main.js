const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { execFile } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

let mainWindow = null;
let hasUnsavedChanges = false;
let closeRequestPending = false;
let allowImmediateClose = false;
let modsWatcher = null;

const DEFAULT_SETTINGS = {
  language: "en",
  xq: "zero"
};

const LANGUAGE_PACKS = {
  en: {
    name: "English",
    translations: {
      menuFile: "File",
      menuEdit: "Edit",
      menuView: "View",
      menuNewMod: "New Mod",
      menuSave: "Save",
      menuPackCurrent: "Pack Current Mod",
      menuOpenModsFolder: "Open Mods Folder",
      menuUndo: "Undo",
      menuRedo: "Redo",
      menuModsList: "Mods List",
      menuExplorer: "Explorer",
      sidebarModsTitle: "MOD EXPLORER",
      sectionInfo: "Information",
      sectionLua: "Lua",
      sectionItems: "Items",
      panelModJson: "mod.json",
      panelLuaFiles: "Lua Files",
      panelItems: "Items in Current Lua",
      buttonSave: "Save",
      buttonPack: "Pack",
      buttonNewGuid: "New GUID",
      buttonAddFile: "Add File",
      buttonRemoveFile: "Remove File",
      buttonNewItem: "New Item",
      buttonBack: "Back",
      buttonDelete: "Delete",
      buttonSaveItem: "Save Item",
      settingsTitle: "Settings",
      settingsLanguage: "Language",
      settingsHint: "Custom languages are loaded from Documents/JuneModTools/settings/languages.",
      settingsSaved: "Settings saved."
    }
  },
  ru: {
    name: "Русский",
    translations: {
      menuFile: "Файл",
      menuEdit: "Редактировать",
      menuView: "Вид",
      menuNewMod: "Новый мод",
      menuSave: "Сохранить",
      menuPackCurrent: "Упаковать текущий мод",
      menuOpenModsFolder: "Открыть папку модов",
      menuUndo: "Отменить",
      menuRedo: "Повторить",
      menuModsList: "Список модов",
      menuExplorer: "Обозреватель",
      sidebarModsTitle: "РЕДАКТОР МОДОВ",
      sectionInfo: "Информация",
      sectionLua: "Lua",
      sectionItems: "Предметы",
      panelModJson: "mod.json",
      panelLuaFiles: "Файлы Lua",
      panelItems: "Предметы в текущем Lua",
      buttonSave: "Сохранить",
      buttonPack: "Упаковать",
      buttonNewGuid: "Новый GUID",
      buttonAddFile: "Добавить файл",
      buttonRemoveFile: "Удалить файл",
      buttonNewItem: "Новый предмет",
      buttonBack: "Назад",
      buttonDelete: "Удалить",
      buttonSaveItem: "Сохранить предмет",
      settingsTitle: "Настройки",
      settingsLanguage: "Язык",
      settingsHint: "Пользовательские языки загружаются из Documents/JuneModTools/settings/languages.",
      settingsSaved: "Настройки сохранены."
    }
  }
};

function buildWorkspacePaths() {
  const workspaceRoot = path.join(os.homedir(), "Documents", "JuneModTools");
  const modsRoot = path.join(workspaceRoot, "mods");
  const settingsRoot = path.join(workspaceRoot, "settings");

  return {
    workspaceRoot,
    modsRoot,
    settingsRoot,
    languagesRoot: path.join(settingsRoot, "languages"),
    localModInfoPath: path.join(modsRoot, "localmodinfo.json"),
    settingsPath: path.join(settingsRoot, "settings.json")
  };
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureWorkspace() {
  const paths = buildWorkspacePaths();
  await fs.mkdir(paths.modsRoot, { recursive: true });
  await fs.mkdir(paths.settingsRoot, { recursive: true });
  await fs.mkdir(paths.languagesRoot, { recursive: true });

  if (!await pathExists(paths.localModInfoPath)) {
    await fs.writeFile(
      paths.localModInfoPath,
      JSON.stringify({ localModInfos: [] }, null, 2),
      "utf8"
    );
  }

  if (!await pathExists(paths.settingsPath)) {
    await fs.writeFile(paths.settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf8");
  }

  // Create English and Russian language files if they don't exist
  const enPath = path.join(paths.languagesRoot, "en.json");
  if (!await pathExists(enPath)) {
    await fs.writeFile(
      enPath,
      JSON.stringify({ name: LANGUAGE_PACKS.en.name, ...LANGUAGE_PACKS.en.translations }, null, 2),
      "utf8"
    );
  }

  const ruPath = path.join(paths.languagesRoot, "ru.json");
  if (!await pathExists(ruPath)) {
    await fs.writeFile(
      ruPath,
      JSON.stringify({ name: LANGUAGE_PACKS.ru.name, ...LANGUAGE_PACKS.ru.translations }, null, 2),
      "utf8"
    );
  }

  return paths;
}

async function getPaths() {
  return ensureWorkspace();
}

function getModPaths(modsRoot, modGuid) {
  const basePath = path.join(modsRoot, modGuid);
  return {
    basePath,
    unpackPath: path.join(basePath, "unpack"),
    packPath: path.join(basePath, "pack"),
    translatePath: path.join(basePath, "translate"),
    zipPath: path.join(basePath, "pack", `${modGuid}.zip`)
  };
}

function sanitizeFolderName(value) {
  return String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "");
}

function escapePowerShellString(value) {
  return String(value).replaceAll("'", "''");
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || stdout?.trim() || error.message));
          return;
        }

        resolve(stdout);
      }
    );
  });
}

async function readJson(filePath, fallback = null) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

function generateGuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : ((random & 0x3) | 0x8);
    return value.toString(16);
  });
}

function createDefaultLuaTemplate() {
  return [
    "-- This script was generated by Juns Mod Tool.",
    "do",
    "",
    "",
    "end",
    ""
  ].join("\n");
}

function createDefaultModJson({ name, description, targetVersion, mainLuaFile, guid }) {
  return {
    name,
    description,
    OnGameStart: {
      luaScript: "",
      luaFiles: [mainLuaFile]
    },
    targetVersion,
    doNotChangeVariablesBelowThis: {
      timeCreated: Date.now(),
      guid: {
        serializedGuid: guid
      }
    }
  };
}

async function getLuaFilesFromFolder(modFolderPath, modJson) {
  const preferredFiles = Array.isArray(modJson?.OnGameStart?.luaFiles)
    ? modJson.OnGameStart.luaFiles
    : [];

  const luaFiles = [];

  for (const fileName of preferredFiles) {
    const absolutePath = path.join(modFolderPath, fileName);
    const content = await fs.readFile(absolutePath, "utf8").catch(() => "");
    luaFiles.push({ fileName, content });
  }

  const entries = await fs.readdir(modFolderPath, { withFileTypes: true }).catch(() => []);
  const discoveredFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".lua"))
    .map((entry) => entry.name)
    .filter((fileName) => !preferredFiles.includes(fileName))
    .sort((left, right) => left.localeCompare(right, "en"));

  for (const fileName of discoveredFiles) {
    const absolutePath = path.join(modFolderPath, fileName);
    const content = await fs.readFile(absolutePath, "utf8").catch(() => "");
    luaFiles.push({ fileName, content });
  }

  return luaFiles;
}

async function summarizeUnpackedMod(modGuid, unpackPath, storageStatus, localInfoEntry = null) {
  const modJson = await readJson(path.join(unpackPath, "mod.json"), {});
  const luaFiles = await getLuaFilesFromFolder(unpackPath, modJson);
  const entries = await fs.readdir(unpackPath, { withFileTypes: true }).catch(() => []);

  let textureJsonCount = 0;
  let pngCount = 0;
  let psdCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const childPath = path.join(unpackPath, entry.name);
    const childFiles = await fs.readdir(childPath).catch(() => []);
    for (const childFile of childFiles) {
      const lower = childFile.toLowerCase();
      if (lower.endsWith(".json")) {
        textureJsonCount += 1;
      } else if (lower.endsWith(".png")) {
        pngCount += 1;
      } else if (lower.endsWith(".psd")) {
        psdCount += 1;
      }
    }
  }

  return {
    id: modGuid,
    directoryName: modGuid,
    name: modJson?.name || localInfoEntry?.ModName || modGuid,
    description: modJson?.description || "",
    targetVersion: modJson?.targetVersion || "",
    luaFileCount: luaFiles.length,
    textureJsonCount,
    pngCount,
    psdCount,
    storageStatus,
    loadOnStart: Boolean(localInfoEntry?.LoadOnStart),
    modOrder: Number.isFinite(localInfoEntry?.ModOrder) ? localInfoEntry.ModOrder : null,
    isPacked: storageStatus === "packed" || storageStatus === "packed+unpacked",
    isUnpacked: storageStatus === "unpacked" || storageStatus === "packed+unpacked"
  };
}

function summarizePackedOnlyMod(modGuid, localInfoEntry = null) {
  return {
    id: modGuid,
    directoryName: modGuid,
    name: localInfoEntry?.ModName || modGuid,
    description: "",
    targetVersion: "",
    luaFileCount: 0,
    textureJsonCount: 0,
    pngCount: 0,
    psdCount: 0,
    storageStatus: "packed",
    loadOnStart: Boolean(localInfoEntry?.LoadOnStart),
    modOrder: Number.isFinite(localInfoEntry?.ModOrder) ? localInfoEntry.ModOrder : null,
    isPacked: true,
    isUnpacked: false
  };
}

async function loadLocalModInfo() {
  const paths = await ensureWorkspace();
  return readJson(paths.localModInfoPath, { localModInfos: [] });
}

async function saveLocalModInfo(data) {
  const paths = await ensureWorkspace();
  await fs.writeFile(paths.localModInfoPath, JSON.stringify(data, null, 2), "utf8");
  return { success: true };
}

async function updateLocalModInfo(modGuid, modName, loadOnStart = true) {
  const localModInfo = await loadLocalModInfo();
  const existingIndex = localModInfo.localModInfos.findIndex((entry) =>
    entry.ModGuid?.serializedGuid === modGuid
  );

  if (existingIndex >= 0) {
    localModInfo.localModInfos[existingIndex].ModName = modName;
    localModInfo.localModInfos[existingIndex].LoadOnStart = loadOnStart;
  } else {
    localModInfo.localModInfos.push({
      ModGuid: { serializedGuid: modGuid },
      LoadOnStart: loadOnStart,
      ModOrder: localModInfo.localModInfos.length * 10,
      ModName: modName
    });
  }

  await saveLocalModInfo(localModInfo);
  return { success: true };
}

async function removeFromLocalModInfo(modGuid) {
  const localModInfo = await loadLocalModInfo();
  localModInfo.localModInfos = localModInfo.localModInfos.filter((entry) =>
    entry.ModGuid?.serializedGuid !== modGuid
  );
  await saveLocalModInfo(localModInfo);
  return { success: true };
}

async function ensureModStructure(modGuid) {
  const { modsRoot } = await ensureWorkspace();
  const paths = getModPaths(modsRoot, modGuid);
  await fs.mkdir(paths.basePath, { recursive: true });
  await fs.mkdir(paths.unpackPath, { recursive: true });
  await fs.mkdir(paths.packPath, { recursive: true });
  await fs.mkdir(paths.translatePath, { recursive: true });
  return paths;
}

async function ensureModIsUnpacked(modGuid) {
  const { modsRoot } = await ensureWorkspace();
  const modPaths = getModPaths(modsRoot, modGuid);
  const hasUnpack = await pathExists(modPaths.unpackPath);
  const hasPack = await pathExists(modPaths.zipPath);

  if (hasUnpack) {
    return { unpackPath: modPaths.unpackPath, unpackedFromArchive: false };
  }

  if (!hasPack) {
    throw new Error(`Mod "${modGuid}" was not found.`);
  }

  await fs.mkdir(modPaths.unpackPath, { recursive: true });

  const script = `
    $archive = '${escapePowerShellString(modPaths.zipPath)}'
    $destination = '${escapePowerShellString(modPaths.unpackPath)}'
    if (Test-Path -LiteralPath $destination) {
      Remove-Item -LiteralPath $destination -Recurse -Force
    }
    New-Item -ItemType Directory -Path $destination | Out-Null
    Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
  `;
  await runPowerShell(script);

  const rootModJsonPath = path.join(modPaths.unpackPath, "mod.json");
  if (!await pathExists(rootModJsonPath)) {
    const entries = await fs.readdir(modPaths.unpackPath, { withFileTypes: true }).catch(() => []);
    const nestedDirectories = entries.filter((entry) => entry.isDirectory());

    if (nestedDirectories.length === 1) {
      const nestedRoot = path.join(modPaths.unpackPath, nestedDirectories[0].name);
      if (await pathExists(path.join(nestedRoot, "mod.json"))) {
        const nestedEntries = await fs.readdir(nestedRoot, { withFileTypes: true });
        for (const entry of nestedEntries) {
          await fs.rename(
            path.join(nestedRoot, entry.name),
            path.join(modPaths.unpackPath, entry.name)
          );
        }
        await fs.rm(nestedRoot, { recursive: true, force: true });
      }
    }
  }

  return { unpackPath: modPaths.unpackPath, unpackedFromArchive: true };
}

async function listMods() {
  const { modsRoot } = await ensureWorkspace();
  const localModInfo = await loadLocalModInfo();
  const localInfoMap = new Map(
    localModInfo.localModInfos.map((entry) => [entry.ModGuid?.serializedGuid, entry])
  );

  const entries = await fs.readdir(modsRoot, { withFileTypes: true }).catch(() => []);
  const directoryGuids = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const knownGuids = new Set([
    ...directoryGuids,
    ...localModInfo.localModInfos.map((entry) => entry.ModGuid?.serializedGuid).filter(Boolean)
  ]);

  const mods = [];

  for (const modGuid of knownGuids) {
    const modPaths = getModPaths(modsRoot, modGuid);
    const hasUnpacked = await pathExists(modPaths.unpackPath);
    const hasPacked = await pathExists(modPaths.zipPath);
    const localInfoEntry = localInfoMap.get(modGuid) || null;

    if (hasUnpacked) {
      const storageStatus = hasPacked ? "packed+unpacked" : "unpacked";
      mods.push(await summarizeUnpackedMod(modGuid, modPaths.unpackPath, storageStatus, localInfoEntry));
      continue;
    }

    if (hasPacked) {
      mods.push(summarizePackedOnlyMod(modGuid, localInfoEntry));
    }
  }

  mods.sort((left, right) => {
    const leftOrder = left.modOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.modOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.name.localeCompare(right.name, "en");
  });

  return mods;
}

async function loadMod(modGuid) {
  const { modsRoot } = await ensureWorkspace();
  const { unpackPath, unpackedFromArchive } = await ensureModIsUnpacked(modGuid);
  const modJsonPath = path.join(unpackPath, "mod.json");
  const modJson = await readJson(modJsonPath, createDefaultModJson({
    name: modGuid,
    description: "",
    targetVersion: "",
    mainLuaFile: "script.lua",
    guid: modGuid
  }));
  const luaFiles = await getLuaFilesFromFolder(unpackPath, modJson);
  const modPaths = getModPaths(modsRoot, modGuid);
  const storageStatus = await pathExists(modPaths.zipPath) ? "packed+unpacked" : "unpacked";
  const localModInfo = await loadLocalModInfo();
  const localInfoEntry = localModInfo.localModInfos.find((entry) =>
    entry.ModGuid?.serializedGuid === modGuid
  ) || null;

  return {
    summary: await summarizeUnpackedMod(modGuid, unpackPath, storageStatus, localInfoEntry),
    modJson,
    luaFiles,
    unpackedFromArchive
  };
}

async function createMod(payload) {
  const paths = await ensureWorkspace();
  const modGuid = generateGuid();
  const modPaths = getModPaths(paths.modsRoot, modGuid);
  await ensureModStructure(modGuid);

  const requestedLuaFile = sanitizeFolderName(payload.mainLuaFile || "script.lua").replace(/ /g, "_");
  const mainLuaFile = requestedLuaFile.toLowerCase().endsWith(".lua")
    ? requestedLuaFile
    : `${requestedLuaFile}.lua`;
  const modJson = createDefaultModJson({
    name: payload.name || modGuid,
    description: payload.description || "",
    targetVersion: payload.targetVersion || "",
    mainLuaFile,
    guid: modGuid
  });

  await fs.writeFile(path.join(modPaths.unpackPath, "mod.json"), JSON.stringify(modJson, null, 2), "utf8");
  await fs.writeFile(path.join(modPaths.unpackPath, mainLuaFile), createDefaultLuaTemplate(), "utf8");
  await updateLocalModInfo(modGuid, modJson.name, true);

  return loadMod(modGuid);
}

async function saveMod(payload) {
  const paths = await ensureWorkspace();
  const modPaths = getModPaths(paths.modsRoot, payload.directoryName);
  await ensureModStructure(payload.directoryName);

  const luaFiles = Array.isArray(payload.luaFiles) ? payload.luaFiles : [];
  const normalizedLuaFiles = luaFiles
    .map((file) => ({
      fileName: String(file.fileName || "").trim(),
      content: file.content ?? ""
    }))
    .filter((file) => file.fileName.toLowerCase().endsWith(".lua"));

  payload.modJson.OnGameStart = payload.modJson.OnGameStart || {};
  payload.modJson.OnGameStart.luaFiles = normalizedLuaFiles.map((file) => file.fileName);

  await fs.writeFile(
    path.join(modPaths.unpackPath, "mod.json"),
    JSON.stringify(payload.modJson, null, 2),
    "utf8"
  );

  const existingEntries = await fs.readdir(modPaths.unpackPath, { withFileTypes: true }).catch(() => []);
  const existingLuaFiles = existingEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".lua"))
    .map((entry) => entry.name);

  for (const file of normalizedLuaFiles) {
    await fs.writeFile(path.join(modPaths.unpackPath, file.fileName), file.content, "utf8");
  }

  for (const existingLuaFile of existingLuaFiles) {
    if (!normalizedLuaFiles.some((file) => file.fileName === existingLuaFile)) {
      await fs.unlink(path.join(modPaths.unpackPath, existingLuaFile)).catch(() => {});
    }
  }

  await updateLocalModInfo(
    payload.directoryName,
    payload.modJson?.name || payload.directoryName,
    true
  );

  return loadMod(payload.directoryName);
}

async function packMod(modGuid) {
  const paths = await ensureWorkspace();
  const modPaths = getModPaths(paths.modsRoot, modGuid);

  if (!await pathExists(modPaths.unpackPath)) {
    throw new Error(`Cannot pack "${modGuid}" because unpacked files were not found.`);
  }

  await fs.mkdir(modPaths.packPath, { recursive: true });

  const script = `
    Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
    $source = '${escapePowerShellString(modPaths.unpackPath)}'
    $destination = '${escapePowerShellString(modPaths.zipPath)}'
    if (Test-Path -LiteralPath $destination) {
      Remove-Item -LiteralPath $destination -Force
    }
    [System.IO.Compression.ZipFile]::CreateFromDirectory($source, $destination)
  `;
  await runPowerShell(script);

  return loadMod(modGuid);
}

async function unpackMod(modGuid) {
  await ensureModIsUnpacked(modGuid);
  return loadMod(modGuid);
}

async function deleteMod(modGuid) {
  const { modsRoot } = await ensureWorkspace();
  const modPaths = getModPaths(modsRoot, modGuid);

  if (!await pathExists(modPaths.basePath)) {
    throw new Error(`Mod folder not found: ${modGuid}`);
  }

  await fs.rm(modPaths.basePath, { recursive: true, force: true });
  await removeFromLocalModInfo(modGuid);

  return { success: true };
}

async function duplicateMod(sourceModGuid, nextGuid, nextName) {
  const { modsRoot } = await ensureWorkspace();
  const sourcePaths = getModPaths(modsRoot, sourceModGuid);
  const targetGuid = nextGuid || generateGuid();
  const targetPaths = getModPaths(modsRoot, targetGuid);

  if (!await pathExists(sourcePaths.basePath)) {
    throw new Error(`Source mod not found: ${sourceModGuid}`);
  }

  const script = `
    Copy-Item -LiteralPath '${escapePowerShellString(sourcePaths.basePath)}' -Destination '${escapePowerShellString(targetPaths.basePath)}' -Recurse -Force
  `;
  await runPowerShell(script);

  const duplicated = await loadMod(targetGuid);
  duplicated.modJson.name = nextName || `${duplicated.modJson.name} Copy`;
  duplicated.modJson.doNotChangeVariablesBelowThis.guid.serializedGuid = targetGuid;
  await saveMod({
    directoryName: targetGuid,
    modJson: duplicated.modJson,
    luaFiles: duplicated.luaFiles
  });

  return { success: true, modGuid: targetGuid };
}

async function openFolder(targetPath) {
  const errorMessage = await shell.openPath(targetPath);
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  return true;
}

async function readSettings() {
  const paths = await ensureWorkspace();
  return readJson(paths.settingsPath, DEFAULT_SETTINGS);
}

async function saveSettings(settings) {
  const paths = await ensureWorkspace();
  const nextSettings = {
    ...DEFAULT_SETTINGS,
    ...(settings || {})
  };
  await fs.writeFile(paths.settingsPath, JSON.stringify(nextSettings, null, 2), "utf8");
  return { success: true, settings: nextSettings };
}

async function listLanguagePacks() {
  const paths = await ensureWorkspace();
  const customPacks = [];

  const entries = await fs.readdir(paths.languagesRoot, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) {
      continue;
    }

    const code = path.parse(entry.name).name;
    const payload = await readJson(path.join(paths.languagesRoot, entry.name), null);
    if (!payload || typeof payload !== "object") {
      continue;
    }

    // Extract translations from the payload
    const { name, ...translations } = payload;
    
    customPacks.push({
      code,
      name: name || payload.languageName || code,
      translations: Object.keys(translations).length > 0 ? translations : payload
    });
  }

  return customPacks;
}

async function startModsWatcher() {
  const paths = await ensureWorkspace();

  if (modsWatcher) {
    modsWatcher.close();
  }

  try {
    modsWatcher = require("fs").watch(paths.modsRoot, { recursive: true }, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("mods:changed");
      }
    });
  } catch {
    modsWatcher = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#1e1e1e",
    titleBarStyle: 'hidden',
        webPreferences: {
      preload: path.join(__dirname, "src", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    frame: false,
    icon: path.join(__dirname, 'public', 'icon.ico')
  });

  mainWindow.on("close", (event) => {
    if (allowImmediateClose || !hasUnsavedChanges) {
      return;
    }

    event.preventDefault();

    if (closeRequestPending) {
      return;
    }

    closeRequestPending = true;
    mainWindow.webContents.send("app:close-requested");
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    closeRequestPending = false;
    allowImmediateClose = false;
  });

  mainWindow.loadFile(path.join(__dirname, "public", "index.html"));
}

ipcMain.handle("app:get-paths", async () => getPaths());
ipcMain.handle("app:open-folder", async (_event, targetPath) => openFolder(targetPath));
ipcMain.handle("app:confirm-unsaved-changes", async (_event, options = {}) => {
  const response = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: options.title || "Unsaved changes",
    message: options.message || "There are unsaved changes.",
    detail: options.detail || "",
    buttons: [
      options.saveLabel || "Save changes",
      options.cancelLabel || "Cancel",
      options.discardLabel || "Close without saving"
    ],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });

  if (response.response === 0) {
    return "save";
  }
  if (response.response === 2) {
    return "discard";
  }
  return "cancel";
});
ipcMain.handle("app:finish-close-request", async (_event, shouldClose) => {
  closeRequestPending = false;

  if (shouldClose && mainWindow) {
    allowImmediateClose = true;
    mainWindow.close();
  }

  if (!shouldClose) {
    allowImmediateClose = false;
  }

  return true;
});
ipcMain.on("app:set-has-unsaved-changes", (_event, value) => {
  hasUnsavedChanges = Boolean(value);
});

ipcMain.handle("mods:list", async () => listMods());
ipcMain.handle("mods:load", async (_event, modGuid) => loadMod(modGuid));
ipcMain.handle("mods:create", async (_event, payload) => createMod(payload));
ipcMain.handle("mods:save", async (_event, payload) => saveMod(payload));
ipcMain.handle("mods:pack", async (_event, modGuid) => packMod(modGuid));
ipcMain.handle("mods:unpack", async (_event, modGuid) => unpackMod(modGuid));
ipcMain.handle("mods:delete", async (_event, modGuid) => deleteMod(modGuid));
ipcMain.handle("mods:duplicate", async (_event, modGuid, nextGuid, nextName) => duplicateMod(modGuid, nextGuid, nextName));
ipcMain.handle("mods:update-localmodinfo", async (_event, modGuid, modName, loadOnStart) => updateLocalModInfo(modGuid, modName, loadOnStart));
ipcMain.handle("mods:get-localmodinfo", async () => loadLocalModInfo());
ipcMain.handle("app:read-settings", async () => readSettings());
ipcMain.handle("app:save-settings", async (_event, settings) => saveSettings(settings));
ipcMain.handle("app:list-languages", async () => listLanguagePacks());

// Window control handlers
ipcMain.handle("app:minimize", () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle("app:maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle("app:restore", () => {
  if (mainWindow) {
    mainWindow.restore();
  }
});

ipcMain.handle("app:close", () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

app.whenReady().then(async () => {
  await startModsWatcher();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (modsWatcher) {
    modsWatcher.close();
    modsWatcher = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Обработчики для кнопок управления окном
ipcMain.on('window-minimize', () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.minimize();
  }
});

ipcMain.on('window-close', () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.close();
  }
});
