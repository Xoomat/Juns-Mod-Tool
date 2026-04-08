const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { execFile } = require("child_process");
const fs = require("fs/promises");
const path = require("path");

let mainWindow = null;
let hasUnsavedChanges = false;
let closeRequestPending = false;
let allowImmediateClose = false;

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findWorkspaceRoot() {
  const startPoints = [
    process.cwd(),
    __dirname,
    path.resolve(__dirname, ".."),
    path.resolve(process.cwd(), "..")
  ];

  for (const startPoint of startPoints) {
    let current = path.resolve(startPoint);

    while (true) {
      const modsPath = path.join(current, "mods");
      if (await pathExists(modsPath)) {
        return current;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }

      current = parent;
    }
  }

  return path.resolve(process.cwd(), "..");
}

async function getPaths() {
  const workspaceRoot = await findWorkspaceRoot();
  const modsRoot = path.join(workspaceRoot, "mods");
  const unpackRoot = path.join(modsRoot, "unpack");
  const packRoot = path.join(modsRoot, "pack");

  await fs.mkdir(unpackRoot, { recursive: true });
  await fs.mkdir(packRoot, { recursive: true });

  return {
    workspaceRoot,
    modsRoot,
    unpackRoot,
    packRoot
  };
}

function sanitizeFolderName(folderName) {
  return (folderName || "")
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

function getStorageStatus({ hasUnpacked, hasPacked }) {
  if (hasUnpacked && hasPacked) {
    return "packed+unpacked";
  }
  if (hasPacked) {
    return "packed";
  }
  return "unpacked";
}

function getPackPath(packRoot, directoryName) {
  return path.join(packRoot, `${directoryName}.zip`);
}

async function readJson(filePath, fallback = null) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function getLuaFilesFromFolder(modFolderPath, modJson) {
  const preferredFiles = Array.isArray(modJson?.OnGameStart?.luaFiles)
    ? modJson.OnGameStart.luaFiles
    : [];

  const discoveredLuaFiles = [];

  for (const fileName of preferredFiles) {
    const absolutePath = path.join(modFolderPath, fileName);
    const content = await fs.readFile(absolutePath, "utf8").catch(() => "");
    discoveredLuaFiles.push({ fileName, content });
  }

  const entries = await fs.readdir(modFolderPath, { withFileTypes: true });
  const additionalLuaFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".lua"))
    .map((entry) => entry.name)
    .filter((fileName) => !preferredFiles.includes(fileName))
    .sort((left, right) => left.localeCompare(right, "en"));

  for (const fileName of additionalLuaFiles) {
    const absolutePath = path.join(modFolderPath, fileName);
    const content = await fs.readFile(absolutePath, "utf8").catch(() => "");
    discoveredLuaFiles.push({ fileName, content });
  }

  return discoveredLuaFiles;
}

async function summarizeUnpackedMod(modFolderPath, directoryName, storageStatus) {
  const modJsonPath = path.join(modFolderPath, "mod.json");
  const modJson = await readJson(modJsonPath, {});
  const luaFiles = await getLuaFilesFromFolder(modFolderPath, modJson);
  const entries = await fs.readdir(modFolderPath, { withFileTypes: true });

  const assetCounts = {
    textureJson: 0,
    png: 0,
    psd: 0
  };

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const childPath = path.join(modFolderPath, entry.name);
    const childFiles = await fs.readdir(childPath).catch(() => []);
    for (const childFile of childFiles) {
      const lower = childFile.toLowerCase();
      if (lower.endsWith(".json")) {
        assetCounts.textureJson += 1;
      }
      if (lower.endsWith(".png")) {
        assetCounts.png += 1;
      }
      if (lower.endsWith(".psd")) {
        assetCounts.psd += 1;
      }
    }
  }

  return {
    id: directoryName,
    directoryName,
    name: modJson?.name || directoryName,
    description: modJson?.description || "",
    targetVersion: modJson?.targetVersion || "",
    luaFileCount: luaFiles.length,
    textureJsonCount: assetCounts.textureJson,
    pngCount: assetCounts.png,
    psdCount: assetCounts.psd,
    storageStatus,
    isPacked: storageStatus === "packed" || storageStatus === "packed+unpacked",
    isUnpacked: storageStatus === "unpacked" || storageStatus === "packed+unpacked"
  };
}

function summarizePackedOnlyMod(directoryName) {
  return {
    id: directoryName,
    directoryName,
    name: directoryName,
    description: "",
    targetVersion: "",
    luaFileCount: 0,
    textureJsonCount: 0,
    pngCount: 0,
    psdCount: 0,
    storageStatus: "packed",
    isPacked: true,
    isUnpacked: false
  };
}

async function ensureModIsUnpacked(directoryName) {
  const { unpackRoot, packRoot } = await getPaths();
  const modFolderPath = path.join(unpackRoot, directoryName);
  const zipPath = getPackPath(packRoot, directoryName);

  if (await pathExists(modFolderPath)) {
    return { modFolderPath, unpackedFromArchive: false };
  }

  if (!await pathExists(zipPath)) {
    throw new Error(`Mod "${directoryName}" was not found in unpack or pack.`);
  }

  await fs.mkdir(modFolderPath, { recursive: true });

  const script = `
    $archive = '${escapePowerShellString(zipPath)}'
    $destination = '${escapePowerShellString(modFolderPath)}'
    if (Test-Path -LiteralPath $destination) {
      Remove-Item -LiteralPath $destination -Recurse -Force
    }
    New-Item -ItemType Directory -Path $destination | Out-Null
    Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
  `;

  await runPowerShell(script);

  const rootModJsonPath = path.join(modFolderPath, "mod.json");
  if (!await pathExists(rootModJsonPath)) {
    const childEntries = await fs.readdir(modFolderPath, { withFileTypes: true });
    const childDirectories = childEntries.filter((entry) => entry.isDirectory());

    if (childDirectories.length === 1) {
      const nestedRoot = path.join(modFolderPath, childDirectories[0].name);
      const nestedModJsonPath = path.join(nestedRoot, "mod.json");

      if (await pathExists(nestedModJsonPath)) {
        const nestedEntries = await fs.readdir(nestedRoot, { withFileTypes: true });
        for (const entry of nestedEntries) {
          await fs.rename(
            path.join(nestedRoot, entry.name),
            path.join(modFolderPath, entry.name)
          );
        }
        await fs.rm(nestedRoot, { recursive: true, force: true });
      }
    }
  }

  return { modFolderPath, unpackedFromArchive: true };
}

function createDefaultLuaTemplate() {
  return [
    "-- This script was generated by Juns Mod Tool.",
    "-- Use the item generator on the right to rebuild this file.",
    "do",
    "",
    "",
    "end",
    ""
  ].join("\n");
}

function createDefaultModJson({ name, description, targetVersion, mainLuaFile }) {
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
        serializedGuid: ""
      }
    }
  };
}

async function listMods() {
  const { unpackRoot, packRoot } = await getPaths();
  const [unpackEntries, packEntries] = await Promise.all([
    fs.readdir(unpackRoot, { withFileTypes: true }),
    fs.readdir(packRoot, { withFileTypes: true })
  ]);

  const unpacked = new Set(
    unpackEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  );
  const packed = new Set(
    packEntries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip"))
      .map((entry) => path.parse(entry.name).name)
  );

  const modIds = [...new Set([...unpacked, ...packed])].sort((left, right) =>
    left.localeCompare(right, "en")
  );

  const mods = [];
  for (const directoryName of modIds) {
    const hasUnpacked = unpacked.has(directoryName);
    const hasPacked = packed.has(directoryName);
    const storageStatus = getStorageStatus({ hasUnpacked, hasPacked });

    if (hasUnpacked) {
      mods.push(await summarizeUnpackedMod(
        path.join(unpackRoot, directoryName),
        directoryName,
        storageStatus
      ));
      continue;
    }

    mods.push(summarizePackedOnlyMod(directoryName));
  }

  mods.sort((left, right) => left.name.localeCompare(right.name, "en"));
  return mods;
}

async function loadMod(directoryName) {
  const { unpackedFromArchive } = await ensureModIsUnpacked(directoryName);
  const { unpackRoot, packRoot } = await getPaths();
  const modFolderPath = path.join(unpackRoot, directoryName);
  const modJsonPath = path.join(modFolderPath, "mod.json");
  const modJson = await readJson(modJsonPath, createDefaultModJson({
    name: directoryName,
    description: "",
    targetVersion: "",
    mainLuaFile: "script.lua"
  }));
  const luaFiles = await getLuaFilesFromFolder(modFolderPath, modJson);
  const storageStatus = getStorageStatus({
    hasUnpacked: true,
    hasPacked: await pathExists(getPackPath(packRoot, directoryName))
  });

  return {
    summary: await summarizeUnpackedMod(modFolderPath, directoryName, storageStatus),
    modJson,
    luaFiles,
    unpackedFromArchive
  };
}

async function createMod(payload) {
  const { unpackRoot } = await getPaths();
  const safeDirectoryName = sanitizeFolderName(payload.folderName || payload.name);

  if (!safeDirectoryName) {
    throw new Error("Folder name is empty after sanitization.");
  }

  const modFolderPath = path.join(unpackRoot, safeDirectoryName);
  if (await pathExists(modFolderPath)) {
    throw new Error("A mod with this folder name already exists.");
  }

  const mainLuaFile = sanitizeFolderName(payload.mainLuaFile || "script.lua").replace(/ /g, "_");
  const normalizedLuaFile = mainLuaFile.toLowerCase().endsWith(".lua")
    ? mainLuaFile
    : `${mainLuaFile}.lua`;

  await fs.mkdir(modFolderPath, { recursive: true });

  const modJson = createDefaultModJson({
    name: payload.name || safeDirectoryName,
    description: payload.description || "",
    targetVersion: payload.targetVersion || "",
    mainLuaFile: normalizedLuaFile
  });

  await fs.writeFile(
    path.join(modFolderPath, "mod.json"),
    JSON.stringify(modJson, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(modFolderPath, normalizedLuaFile),
    createDefaultLuaTemplate(),
    "utf8"
  );

  return loadMod(safeDirectoryName);
}

async function saveMod(payload) {
  const { unpackRoot } = await getPaths();
  const modFolderPath = path.join(unpackRoot, payload.directoryName);
  await fs.mkdir(modFolderPath, { recursive: true });

  const luaFiles = Array.isArray(payload.luaFiles) ? payload.luaFiles : [];
  const normalizedLuaFiles = luaFiles
    .map((file) => ({
      fileName: file.fileName.trim(),
      content: file.content ?? ""
    }))
    .filter((file) => file.fileName.toLowerCase().endsWith(".lua"));

  payload.modJson.OnGameStart = payload.modJson.OnGameStart || {};
  payload.modJson.OnGameStart.luaFiles = normalizedLuaFiles.map((file) => file.fileName);

  await fs.writeFile(
    path.join(modFolderPath, "mod.json"),
    JSON.stringify(payload.modJson, null, 2),
    "utf8"
  );

  const existingEntries = await fs.readdir(modFolderPath, { withFileTypes: true });
  const existingLuaFiles = existingEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".lua"))
    .map((entry) => entry.name);

  for (const file of normalizedLuaFiles) {
    await fs.writeFile(path.join(modFolderPath, file.fileName), file.content, "utf8");
  }

  for (const existingLuaFile of existingLuaFiles) {
    if (!normalizedLuaFiles.some((file) => file.fileName === existingLuaFile)) {
      await fs.unlink(path.join(modFolderPath, existingLuaFile)).catch(() => {});
    }
  }

  return loadMod(payload.directoryName);
}

async function openFolder(targetPath) {
  const errorMessage = await shell.openPath(targetPath);
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  return true;
}

async function packMod(directoryName) {
  const { unpackRoot, packRoot } = await getPaths();
  const modFolderPath = path.join(unpackRoot, directoryName);
  const zipPath = getPackPath(packRoot, directoryName);

  if (!await pathExists(modFolderPath)) {
    throw new Error(`Cannot pack "${directoryName}" because unpacked files were not found.`);
  }

  const script = `
    Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
    $source = '${escapePowerShellString(modFolderPath)}'
    $destination = '${escapePowerShellString(zipPath)}'
    if (Test-Path -LiteralPath $destination) {
      Remove-Item -LiteralPath $destination -Force
    }
    [System.IO.Compression.ZipFile]::CreateFromDirectory($source, $destination)
  `;

  await runPowerShell(script);
  return loadMod(directoryName);
}

async function unpackMod(directoryName) {
  await ensureModIsUnpacked(directoryName);
  return loadMod(directoryName);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#0f1117",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
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

  mainWindow.loadFile(path.join(__dirname, "index.html"));
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
ipcMain.handle("mods:load", async (_event, directoryName) => loadMod(directoryName));
ipcMain.handle("mods:create", async (_event, payload) => createMod(payload));
ipcMain.handle("mods:save", async (_event, payload) => saveMod(payload));
ipcMain.handle("mods:pack", async (_event, directoryName) => packMod(directoryName));
ipcMain.handle("mods:unpack", async (_event, directoryName) => unpackMod(directoryName));

const LAUNCH_KEY = "76vDS0AHUpdLOwqa3RYCkpdaHIOJVI61wj5ejdUz8bmzddNPU9dbOsoIcDUUaZbKtaRGnTGDwmJflfap7rHB3FV9Cy8hlPJR6bRN";

function validateLaunchKey() {
  const args = process.argv.slice(1);
  const launchKeyArg = args.find(arg => arg.startsWith("--launch-key="));
  
  if (!launchKeyArg) {
    app.quit();
    return false;
  }

  const providedKey = launchKeyArg.split("=")[1];
  if (providedKey !== LAUNCH_KEY) {
    app.quit();
    return false;
  }

  return true;
}

app.whenReady().then(() => {
  if (validateLaunchKey()) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
