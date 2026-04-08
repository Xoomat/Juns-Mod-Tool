const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const fs = require("fs/promises");
const path = require("path");

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
  const startPoints = [
    process.cwd(),
    __dirname,
    path.resolve(__dirname, "../.."),
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
  const translationsPath = path.join(workspaceRoot, "mods", "translations");
  await fs.mkdir(translationsPath, { recursive: true });
  return translationsPath;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("translator:get-translations-path", async () => {
  return await getTranslationsPath();
});

ipcMain.handle("translator:list-mod-translations", async () => {
  const translationsPath = await getTranslationsPath();
  
  try {
    const entries = await fs.readdir(translationsPath, { withFileTypes: true });
    const modFolders = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();

    const modData = [];
    for (const modFolder of modFolders) {
      const modPath = path.join(translationsPath, modFolder);
      const files = await fs.readdir(modPath);
      const translationFiles = files.filter(f => f.endsWith(".json"));
      
      modData.push({
        modName: modFolder,
        translationFiles: translationFiles
      });
    }

    return modData;
  } catch (error) {
    return [];
  }
});

ipcMain.handle("translator:load-translation", async (_event, modName, fileName) => {
  const translationsPath = await getTranslationsPath();
  const filePath = path.join(translationsPath, modName, fileName);

  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load translation file: ${error.message}`);
  }
});

ipcMain.handle("translator:save-translation", async (_event, modName, fileName, data) => {
  const translationsPath = await getTranslationsPath();
  const modPath = path.join(translationsPath, modName);
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
  const translationsPath = await getTranslationsPath();
  const modPath = path.join(translationsPath, modName);

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
