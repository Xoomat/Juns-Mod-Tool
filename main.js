const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

let mainWindow = null;

const LAUNCH_KEY = "Ig70ZwMbfpdkPaautsL3YmxJWvfoMezG44OZs0Zxh9wQ9REbd66Y7JnC30uZ9On9WSPtmDoHPJkBotYTFPN6vhFaoqv3AMOh3tsr";

// Disable the default menu
Menu.setApplicationMenu(null);

function validateLaunchKey() {
  const args = process.argv.slice(1);
  const launchKeyArg = args.find(arg => arg.startsWith("--launch-key="));
  
  if (!launchKeyArg) {
    return false;
  }

  const providedKey = launchKeyArg.split("=")[1];
  return providedKey === LAUNCH_KEY;
}

async function findWorkspaceRoot() {
  // Use Documents/JuneModTools as the workspace root
  const documentsPath = path.join(os.homedir(), "Documents");
  const workspaceRoot = path.join(documentsPath, "JuneModTools");
  return workspaceRoot;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getTranslationsPath() {
  const workspaceRoot = await findWorkspaceRoot();
  const modsPath = path.join(workspaceRoot, "mods");
  await fs.mkdir(modsPath, { recursive: true });
  return modsPath;
}

function getModTranslatePath(modsPath, modGUID) {
  return path.join(modsPath, modGUID, "translate");
}

async function findModGUIDByName(modsPath, modName) {
  // If modName is already a GUID (looks like UUID), return it
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(modName)) {
    return modName;
  }

  // Otherwise, search for a mod with matching name
  try {
    const entries = await fs.readdir(modsPath, { withFileTypes: true });
    const modGUIDs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    for (const modGUID of modGUIDs) {
      const unpackPath = path.join(modsPath, modGUID, "unpack");
      if (await pathExists(unpackPath)) {
        try {
          const modJsonPath = path.join(unpackPath, "mod.json");
          const modJsonContent = await fs.readFile(modJsonPath, "utf8");
          const modJson = JSON.parse(modJsonContent);
          if (modJson.name === modName) {
            return modGUID;
          }
        } catch (e) {
          // Skip
        }
      }
    }
  } catch (e) {
    // Ignore errors
  }

  return null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "src", "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.webContents.on("context-menu", (e) => {
    e.preventDefault();
  });

  mainWindow.on("close", (event) => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, "public", "index.html"));
}

ipcMain.handle("translator:get-translations-path", async () => {
  return await getTranslationsPath();
});

ipcMain.handle("translator:list-mod-translations", async () => {
  const modsPath = await getTranslationsPath();
  
  try {
    const entries = await fs.readdir(modsPath, { withFileTypes: true });
    const modGUIDs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();

    const modData = [];
    for (const modGUID of modGUIDs) {
      const translatePath = path.join(modsPath, modGUID, "translate");
      
      // Check if translate folder exists
      if (!(await pathExists(translatePath))) {
        continue;
      }

      // Try to get mod name from mod.json
      const unpackPath = path.join(modsPath, modGUID, "unpack");
      let modName = modGUID;
      
      if (await pathExists(unpackPath)) {
        try {
          const modJsonPath = path.join(unpackPath, "mod.json");
          const modJsonContent = await fs.readFile(modJsonPath, "utf8");
          const modJson = JSON.parse(modJsonContent);
          modName = modJson.name || modGUID;
        } catch (e) {
          // Use GUID if mod.json reading fails
          modName = modGUID;
        }
      }

      try {
        const files = await fs.readdir(translatePath);
        const translationFiles = files.filter(f => f.endsWith(".json"));
        
        if (translationFiles.length > 0 || true) {  // Include even if no files
          modData.push({
            modGUID: modGUID,
            modName: modName,
            translationFiles: translationFiles
          });
        }
      } catch (e) {
        // Skip if can't read directory
        continue;
      }
    }

    return modData;
  } catch (error) {
    console.error("Error listing mod translations:", error);
    return [];
  }
});

ipcMain.handle("translator:load-translation", async (_event, modName, fileName) => {
  const modsPath = await getTranslationsPath();
  const modGUID = await findModGUIDByName(modsPath, modName);
  
  if (!modGUID) {
    throw new Error(`Mod "${modName}" not found`);
  }

  const filePath = path.join(modsPath, modGUID, "translate", fileName);

  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load translation file: ${error.message}`);
  }
});

ipcMain.handle("translator:save-translation", async (_event, modName, fileName, data) => {
  const modsPath = await getTranslationsPath();
  const modGUID = await findModGUIDByName(modsPath, modName);
  
  if (!modGUID) {
    throw new Error(`Mod "${modName}" not found`);
  }

  const modPath = path.join(modsPath, modGUID, "translate");
  const filePath = path.join(modPath, fileName);

  try {
    await fs.mkdir(modPath, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 4), "utf8");
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to save translation file: ${error.message}`);
  }
});

ipcMain.handle("translator:create-mod-folder", async (_event, modName) => {
  const modsPath = await getTranslationsPath();
  const modGUID = await findModGUIDByName(modsPath, modName);
  
  if (!modGUID) {
    throw new Error(`Mod "${modName}" not found`);
  }

  const modPath = path.join(modsPath, modGUID, "translate");

  try {
    await fs.mkdir(modPath, { recursive: true });
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to create mod folder: ${error.message}`);
  }
});

app.whenReady().then(() => {
  if (validateLaunchKey()) {
    createWindow();
  } else {
    app.quit();
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
