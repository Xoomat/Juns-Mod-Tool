const CATEGORY_OPTIONS = ["Modules", "Clothing", "Other", "Package"];
const SHOP_OPTIONS = ["", "clothier", "ladyparts.ic"];
const SCRATCH_OPTIONS = ["Universal", "Hard"];
const EQUIPMENT_SLOT_OPTIONS = [
  "Bra",
  "Panties",
  "StockingL",
  "StockingR",
  "LegL",
  "LegR",
  "Hairfront",
  "Lips",
  "Eyes",
  "Hairband",
  "UpperBody",
  "UpperBodyOuter",
  "LowerBody",
  "Head",
  "Tail",
  "ArmL",
  "ArmR"
];

const state = {
  paths: null,
  mods: [],
  openTabs: [],
  activeTab: null,
  activeSidebarView: "mods",
  currentEditorTab: "info",
  currentLuaFileName: null,
  homeSelectedModId: null,
  dirtyTabs: new Set(),
  tabUndoHistory: new Map(),
  tabRedoHistory: new Map(),
  contextMenuModId: null,
  contextMenuItemId: null,
  languagePacks: [],
  currentLanguage: "en",
  refreshTimer: null,
  settings: {
    autoSaveEnabled: true,
    autoSaveInterval: 300000
  },
  autoSaveTimer: null,
  searchQuery: "",
  searchReplaceMode: false
};

const elements = {
  fileMenuButton: document.getElementById("fileMenuButton"),
  editMenuButton: document.getElementById("editMenuButton"),
  viewMenuButton: document.getElementById("viewMenuButton"),
  fileMenuDropdown: document.getElementById("fileMenuDropdown"),
  editMenuDropdown: document.getElementById("editMenuDropdown"),
  viewMenuDropdown: document.getElementById("viewMenuDropdown"),
  menuNewMod: document.getElementById("menuNewMod"),
  menuSaveMod: document.getElementById("menuSaveMod"),
  menuPackMod: document.getElementById("menuPackMod"),
  menuOpenModsFolder: document.getElementById("menuOpenModsFolder"),
  menuUndo: document.getElementById("menuUndo"),
  menuRedo: document.getElementById("menuRedo"),
  menuViewMods: document.getElementById("menuViewMods"),
  menuViewExplorer: document.getElementById("menuViewExplorer"),
  // menuCheckUpdates removed
  activityModsButton: document.getElementById("activityModsButton"),
  activityExplorerButton: document.getElementById("activityExplorerButton"),
  settingsButton: document.getElementById("settingsButton"),
  explorerTitle: document.getElementById("explorerTitle"),
  explorerMeta: document.getElementById("explorerMeta"),
  modsPane: document.getElementById("modsPane"),
  modSectionsPane: document.getElementById("modSectionsPane"),
  modsList: document.getElementById("modsList"),
  sectionInfoButton: document.getElementById("sectionInfoButton"),
  sectionLuaButton: document.getElementById("sectionLuaButton"),
  sectionItemsButton: document.getElementById("sectionItemsButton"),
  workspaceTabs: document.getElementById("workspaceTabs"),
  editorPlaceholder: document.getElementById("editorPlaceholder"),
  editorShell: document.getElementById("editorShell"),
  panelInfo: document.getElementById("panel-info"),
  panelLua: document.getElementById("panel-lua"),
  panelItems: document.getElementById("panel-items"),
  modNameInput: document.getElementById("modNameInput"),
  modDescriptionInput: document.getElementById("modDescriptionInput"),
  modTargetVersionInput: document.getElementById("modTargetVersionInput"),
  modGuidInput: document.getElementById("modGuidInput"),
  modFolderInput: document.getElementById("modFolderInput"),
  modStorageStatusInput: document.getElementById("modStorageStatusInput"),
  generateGuidButton: document.getElementById("generateGuidButton"),
  saveModButton: document.getElementById("saveModButton"),
  packCurrentModButton: document.getElementById("packCurrentModButton"),
  addLuaFileButton: document.getElementById("addLuaFileButton"),
  removeLuaFileButton: document.getElementById("removeLuaFileButton"),
  luaTabs: document.getElementById("luaTabs"),
  luaEditor: document.getElementById("luaEditor"),
  itemPrefabList: document.getElementById("itemPrefabList"),
  itemListView: document.getElementById("itemListView"),
  itemEditorView: document.getElementById("itemEditorView"),
  newItemPrefabButton: document.getElementById("newItemPrefabButton"),
  backToItemListButton: document.getElementById("backToItemListButton"),
  deleteItemPrefabButton: document.getElementById("deleteItemPrefabButton"),
  saveItemPrefabButton: document.getElementById("saveItemPrefabButton"),
  generatorForm: document.getElementById("generatorForm"),
  categorySelect: document.getElementById("categorySelect"),
  shopIdSelect: document.getElementById("shopIdSelect"),
  scratchTypeSelect: document.getElementById("scratchTypeSelect"),
  texturesContainer: document.getElementById("texturesContainer"),
  addTextureButton: document.getElementById("addTextureButton"),
  equipmentSlots: document.getElementById("equipmentSlots"),
  colorSlotsContainer: document.getElementById("colorSlotsContainer"),
  addColorSlotButton: document.getElementById("addColorSlotButton"),
  createModal: document.getElementById("createModal"),
  createModForm: document.getElementById("createModForm"),
  closeCreateModalButton: document.getElementById("closeCreateModalButton"),
  closeCreateModalButton2: document.getElementById("closeCreateModalButton2"),
  contextMenu: document.getElementById("contextMenu"),
  contextMenuOpen: document.getElementById("contextMenuOpen"),
  contextMenuPack: document.getElementById("contextMenuPack"),
  contextMenuDuplicate: document.getElementById("contextMenuDuplicate"),
  contextMenuDelete: document.getElementById("contextMenuDelete"),
  itemContextMenu: document.getElementById("itemContextMenu"),
  itemContextMenuDuplicate: document.getElementById("itemContextMenuDuplicate"),
  itemContextMenuDelete: document.getElementById("itemContextMenuDelete"),
  settingsModal: document.getElementById("settingsModal"),
  settingsForm: document.getElementById("settingsForm"),
  settingsLanguageSelect: document.getElementById("settingsLanguageSelect"),
  settingsAutoSaveCheckbox: document.getElementById("settingsAutoSaveCheckbox"),
  closeSettingsModalButton: document.getElementById("closeSettingsModalButton"),
  cancelSettingsButton: document.getElementById("cancelSettingsButton"),
  statusBox: document.getElementById("statusBox"),
  minimizeBtn: document.getElementById("minimizeBtn"),
  maximizeBtn: document.getElementById("maximizeBtn"),
  closeBtn: document.getElementById("closeBtn")
};

function setStatus(message, type = "info") {
  elements.statusBox.textContent = message;
  elements.statusBox.dataset.type = type;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function startAutoSave() {
  if (!state.settings.autoSaveEnabled) {
    return;
  }

  if (state.autoSaveTimer) {
    clearInterval(state.autoSaveTimer);
  }

  state.autoSaveTimer = setInterval(async () => {
    const tab = getActiveTabData();
    if (tab && state.dirtyTabs.has(tab.id)) {
      try {
        syncMetaIntoState();
        syncEditorIntoState();
        await window.modTool.saveMod({
          directoryName: tab.summary.directoryName,
          modJson: tab.modJson,
          luaFiles: tab.luaFiles
        });
        markTabDirty(tab.id, false);
        setStatus("Auto-saved successfully", "success");
      } catch (error) {
        setStatus(`Auto-save failed: ${error.message}`, "error");
      }
    }
  }, state.settings.autoSaveInterval);
}

function stopAutoSave() {
  if (state.autoSaveTimer) {
    clearInterval(state.autoSaveTimer);
    state.autoSaveTimer = null;
  }
}

async function loadSettings() {
  try {
    const settings = await window.modTool.readSettings();
    state.settings = {
      ...state.settings,
      ...settings
    };

  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

function performSearch(query, matchCase = false) {
  const currentFile = getCurrentLuaFile();
  if (!currentFile) return [];

  const content = currentFile.content;
  const pattern = matchCase ? query : query.toLowerCase();
  const contentToSearch = matchCase ? content : content.toLowerCase();
  
  const matches = [];
  let startIndex = 0;

  while (true) {
    const index = contentToSearch.indexOf(pattern, startIndex);
    if (index === -1) break;
    
    const lineStart = content.lastIndexOf("\n", index) + 1;
    const lineEnd = content.indexOf("\n", index);
    const lineNumber = content.substring(0, index).split("\n").length;
    const lineContent = content.substring(lineStart, lineEnd === -1 ? undefined : lineEnd);
    
    matches.push({
      index,
      lineNumber,
      lineContent,
      column: index - lineStart
    });
    
    startIndex = index + 1;
  }

  return matches;
}

function performReplace(query, replacement, matchCase = false, replaceAll = false) {
  const currentFile = getCurrentLuaFile();
  if (!currentFile) return 0;

  const flags = matchCase ? "g" : "gi";
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
  const originalContent = currentFile.content;
  
  let replaced = 0;
  if (replaceAll) {
    const newContent = originalContent.replace(regex, (match) => {
      replaced++;
      return replacement;
    });
    currentFile.content = newContent;
  } else {
    if (originalContent.match(regex)) {
      currentFile.content = originalContent.replace(regex, replacement);
      replaced = 1;
    }
  }

  if (replaced > 0) {
    markTabDirty(state.activeTab, true);
    renderLuaEditor();
  }

  return replaced;
}

async function validateCurrentMod() {
  const tab = getActiveTabData();
  if (!tab) {
    setStatus("No mod selected", "error");
    return;
  }

  try {
    const validation = await window.modTool.validateMod(tab.summary.id);
    
    if (validation.isValid) {
      setStatus("✓ Mod validation passed", "success");
    } else {
      const errorList = validation.errors.join("\n");
      alert(`Validation failed:\n${errorList}`);
      setStatus("✗ Validation failed", "error");
    }

    if (validation.warnings.length > 0) {
      console.warn("Mod warnings:", validation.warnings);
    }
  } catch (error) {
    setStatus(`Validation error: ${error.message}`, "error");
  }
}

function getModStats() {
  const tab = getActiveTabData();
  if (!tab) return null;

  const summary = tab.summary;
  const totalLuaLines = tab.luaFiles.reduce((sum, f) => sum + (f.content?.split("\n").length || 0), 0);
  
  return {
    modName: summary.name,
    guid: summary.id,
    luaFileCount: summary.luaFileCount,
    totalLuaLines,
    textureJsonCount: summary.textureJsonCount,
    pngCount: summary.pngCount,
    psdCount: summary.psdCount,
    storageStatus: summary.storageStatus,
    description: summary.description,
    targetVersion: summary.targetVersion
  };
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    const isMeta = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    // Ctrl+S - Save
    if (isMeta && event.key === "s") {
      event.preventDefault();
      const tab = getActiveTabData();
      if (tab) {
        saveTabById(tab.id);
      }
      return;
    }

    // Ctrl+Shift+S - Validate
    if (isMeta && isShift && event.key === "S") {
      event.preventDefault();
      validateCurrentMod();
      return;
    }

    // Ctrl+H - Open Find/Replace
    if (isMeta && event.key === "h") {
      event.preventDefault();
      openFindReplace();
      return;
    }

    // Ctrl+F - Open Find
    if (isMeta && event.key === "f") {
      event.preventDefault();
      openFind();
      return;
    }

    // Ctrl+G - Go to Line
    if (isMeta && event.key === "g") {
      event.preventDefault();
      goToLine();
      return;
    }

    // Ctrl+Z - Undo
    if (isMeta && event.key === "z") {
      event.preventDefault();
      undoActiveTab();
      renderAll();
      return;
    }

    // Ctrl+Shift+Z or Ctrl+Y - Redo
    if ((isMeta && isShift && event.key === "z") || (isMeta && event.key === "y")) {
      event.preventDefault();
      redoActiveTab();
      renderAll();
      return;
    }
  });
}

function openFind() {
  state.searchReplaceMode = false;
  showSearchDialog(false);
}

function openFindReplace() {
  state.searchReplaceMode = true;
  showSearchDialog(true);
}

function showSearchDialog(showReplace = false) {
  const query = prompt(showReplace ? "Find text:" : "Find text:");
  if (!query) return;

  if (showReplace) {
    const replacement = prompt("Replace with:");
    if (replacement === null) return;

    const count = performReplace(query, replacement, false, true);
    setStatus(`Replaced ${count} occurrence${count !== 1 ? "s" : ""}.`, "success");
  } else {
    const matches = performSearch(query, false);
    if (matches.length > 0) {
      setStatus(`Found ${matches.length} match${matches.length !== 1 ? "es" : ""}.`, "success");
      // Highlight first match
      if (elements.luaEditor.value.includes(query)) {
        const index = elements.luaEditor.value.toLowerCase().indexOf(query.toLowerCase());
        elements.luaEditor.setSelectionRange(index, index + query.length);
        elements.luaEditor.focus();
      }
    } else {
      setStatus("No matches found.", "warning");
    }
  }
}

function goToLine() {
  const currentFile = getCurrentLuaFile();
  if (!currentFile) {
    setStatus("No Lua file selected", "warning");
    return;
  }

  const lineStr = prompt(`Go to line (1-${currentFile.content.split("\n").length}):`);
  if (!lineStr) return;

  const lineNum = parseInt(lineStr, 10);
  const lines = currentFile.content.split("\n");

  if (lineNum < 1 || lineNum > lines.length) {
    setStatus(`Line ${lineNum} is out of range`, "warning");
    return;
  }

  // Find position in editor
  let pos = 0;
  for (let i = 0; i < lineNum - 1; i++) {
    pos += lines[i].length + 1;
  }

  elements.luaEditor.setSelectionRange(pos, pos);
  elements.luaEditor.focus();
  elements.luaEditor.scrollTop = (lineNum - 1) * 16; // Approximate line height
  setStatus(`Jumped to line ${lineNum}`, "success");
}

function generateGuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const nextValue = char === "x" ? random : ((random & 0x3) | 0x8);
    return nextValue.toString(16);
  });
}

const BUILT_IN_TRANSLATIONS = {
  en: {
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
};

function getCurrentTranslations() {
  const customPack = state.languagePacks.find((pack) => pack.code === state.currentLanguage);
  // If custom pack exists, use its translations merged with English as fallback
  if (customPack && customPack.translations) {
    return {
      ...BUILT_IN_TRANSLATIONS.en,
      ...customPack.translations
    };
  }
  // Default to English
  return BUILT_IN_TRANSLATIONS.en;
}

function applyLanguageToUI() {
  const translations = getCurrentTranslations();
  elements.fileMenuButton.textContent = translations.menuFile || "File";
  elements.editMenuButton.textContent = translations.menuEdit || "Edit";
  elements.viewMenuButton.textContent = translations.menuView || "View";
  elements.menuNewMod.textContent = translations.menuNewMod || "New Mod";
  elements.menuSaveMod.textContent = translations.menuSave || "Save";
  elements.menuPackMod.textContent = translations.menuPackCurrent || "Pack Current Mod";
  elements.menuOpenModsFolder.textContent = translations.menuOpenModsFolder || "Open Mods Folder";
  elements.menuUndo.textContent = translations.menuUndo || "Undo";
  elements.menuRedo.textContent = translations.menuRedo || "Redo";
  elements.menuViewMods.textContent = translations.menuModsList || "Mods List";
  elements.menuViewExplorer.textContent = translations.menuExplorer || "Explorer";
  elements.sectionInfoButton.textContent = translations.sectionInfo || "Information";
  elements.sectionLuaButton.textContent = translations.sectionLua || "Lua";
  elements.sectionItemsButton.textContent = translations.sectionItems || "Items";
  document.querySelector("#panel-info .panel__title").textContent = translations.panelModJson || "mod.json";
  document.querySelector("#panel-lua .panel__title span").textContent = translations.panelLuaFiles || "Lua Files";
  document.querySelector("#panel-items #itemListView .panel__title span").textContent = translations.panelItems || "Items in Current Lua";
  elements.saveModButton.textContent = translations.buttonSave || "Save";
  elements.packCurrentModButton.textContent = translations.buttonPack || "Pack";
  elements.generateGuidButton.textContent = translations.buttonNewGuid || "New GUID";
  elements.addLuaFileButton.textContent = translations.buttonAddFile || "Add File";
  elements.removeLuaFileButton.textContent = translations.buttonRemoveFile || "Remove File";
  elements.newItemPrefabButton.textContent = translations.buttonNewItem || "New Item";
  elements.backToItemListButton.textContent = translations.buttonBack || "Back";
  elements.deleteItemPrefabButton.textContent = translations.buttonDelete || "Delete";
  elements.saveItemPrefabButton.textContent = translations.buttonSaveItem || "Save Item";
  const settingsTitle = elements.settingsModal.querySelector("h2");
  const settingsLabel = elements.settingsForm.querySelector("label span");
  const hint = elements.settingsModal.querySelector(".modal__hint");

  if (settingsTitle) {
    settingsTitle.textContent = translations.settingsTitle || "Settings";
  }
  if (settingsLabel) {
    settingsLabel.textContent = translations.settingsLanguage || "Language";
  }
  if (hint) {
    hint.innerHTML = `${escapeHtml(translations.settingsHint || "Custom languages are loaded from Documents/JuneModTools/settings/languages")} <code>Documents/JuneModTools/settings/languages</code>.`;
  }

  if (state.activeSidebarView === "mods" || !state.activeTab) {
    elements.explorerTitle.textContent = translations.sidebarModsTitle || "MOD EXPLORER";
  }
}

function scheduleRefreshMods() {
  if (state.refreshTimer) {
    clearTimeout(state.refreshTimer);
  }
  state.refreshTimer = setTimeout(async () => {
    try {
      await refreshMods();
    } catch (error) {
      setStatus(error.message, "error");
    }
  }, 150);
}

function getStorageStatusLabel(storageStatus) {
  if (storageStatus === "packed") {
    return "Packed only";
  }
  if (storageStatus === "packed+unpacked") {
    return "Packed and unpacked";
  }
  return "Unpacked";
}

function parseLuaStringArray(source) {
  const matches = source.match(/'([^']*)'/g) || [];
  return matches.map((part) => part.slice(1, -1));
}

function createDefaultManagedItem() {
  return {
    id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    sourceMode: "create",
    baseVanillaId: 0,
    name: "",
    description: "",
    price: 3000,
    shopId: "clothier",
    category: "Clothing",
    scratchType: "Universal",
    possibleEquipmentSlots: [],
    requiredSlots: [],
    useSlotData: false,
    targetSlotString: "",
    controllerElementOverride: [],
    forbiddenSlots: [],
    throwingOutForbidden: false,
    partners: [],
  colorSlots: [], // Array of {slotName, paletteName}
    susModifiers: [],
    textures: [],
    isIllegal: false,
    hasQuality: false,
    isStackable: false,
    canChangeColor: true
  };
}

function inferTextureTargets(texturePath) {
  const fileName = texturePath.split("/").pop() || "";
  const match = fileName.match(/tex\s+\d+\s*-\s*(.+)\.json/i);
  return match ? match[1].split(",").map((entry) => entry.trim()).filter(Boolean) : [];
}

function extractSingleQuoted(block, pattern) {
  const match = block.match(pattern);
  return match ? match[1] : "";
}

function extractBoolean(block, fieldName, defaultValue = false) {
  const match = block.match(new RegExp(`${fieldName}\\s*=\\s*(true|false)`));
  return match ? match[1] === "true" : defaultValue;
}

function extractNumber(block, fieldName, defaultValue = 0) {
  const match = block.match(new RegExp(`${fieldName}\\s*=\\s*([0-9.]+)`));
  return match ? Number(match[1]) : defaultValue;
}

function parseManagedItemsFromLua(content) {
  const items = [];
  const blockRegex = /local itemprefab(\d+)\s*=\s*([\s\S]*?)local itemgameid\1\s*=\s*ModUtilities\.CreateNewItemAutoAssignId\(CurrentModGuid,\s*itemprefab\1\)([\s\S]*?)(?=\n\s*local itemprefab\d+\s*=|\nend\b|$)/g;
  let match = blockRegex.exec(content);

  while (match) {
    const index = match[1];
    const body = match[2];
    const tail = match[3] || "";
    const item = createDefaultManagedItem();
    item.id = `parsed-${index}-${Math.random().toString(16).slice(2, 8)}`;
    const shopMatch = tail.match(/ModUtilities\.AddSingleBuyItemToShop\('([^']+)',\s*itemgameid\d+\)/);
    item.shopId = shopMatch ? shopMatch[1] : "";

    if (body.includes("ItemPrefabManager.GetItemById(GameId.CreateVanilla(")) {
      item.sourceMode = "clone_vanilla";
      const vanillaMatch = body.match(/ItemPrefabManager\.GetItemById\(GameId\.CreateVanilla\((\d+)\)\)\.Clone\(\)/);
      item.baseVanillaId = vanillaMatch ? Number(vanillaMatch[1]) : 8;
    }

    item.name = extractSingleQuoted(body, new RegExp(`itemprefab${index}\\.Name\\s*=\\s*'([^']*)'`));
    item.description = extractSingleQuoted(body, new RegExp(`itemprefab${index}\\.Description\\s*=\\s*'([^']*)'`));
    item.price = extractNumber(body, `itemprefab${index}\\.Price`, 3000);
    item.category = extractSingleQuoted(
      body.replace(/ItemCategory\./g, "'"),
      new RegExp(`itemprefab${index}\\.Category\\s*=\\s*'([^']*)'`)
    ) || "Clothing";
    item.scratchType = extractSingleQuoted(
      body.replace(/ScratchTextureType\./g, "'"),
      new RegExp(`itemprefab${index}\\.ScratchType\\s*=\\s*'([^']*)'`)
    ) || "Universal";
    item.isIllegal = extractBoolean(body, `itemprefab${index}\\.IsIllegal`);
    item.hasQuality = extractBoolean(body, `itemprefab${index}\\.HasQuality`);
    item.isStackable = extractBoolean(body, `itemprefab${index}\\.IsStackable`);
    item.canChangeColor = extractBoolean(body, `itemprefab${index}\\.CanChangeColor`, true);
    item.throwingOutForbidden = extractBoolean(body, `itemprefab${index}\\.ThrowingOutForbidden`);

    const possibleMatch = body.match(new RegExp(`itemprefab${index}\\.PossibleEquipmentSlots\\s*=\\s*(\\{[^\\n]*\\})`));
    const requiredMatch = body.match(new RegExp(`itemprefab${index}\\.RequiredSlots\\s*=\\s*(\\{[^\\n]*\\})`));
    item.possibleEquipmentSlots = possibleMatch ? parseLuaStringArray(possibleMatch[1]) : [];
    item.requiredSlots = requiredMatch ? parseLuaStringArray(requiredMatch[1]) : [];

    if (body.includes(`itemprefab${index}.SlotData`)) {
      item.useSlotData = true;
      const slotCreateMatch = body.match(new RegExp(`itemprefab${index}\\.SlotData\\s*=\\s*SlotEquipData\\.CreateInstance\\('([^']*)'\\)`));
      item.targetSlotString = slotCreateMatch
        ? slotCreateMatch[1]
        : extractSingleQuoted(body, /sd\.TargetSlotString\s*=\s*'([^']*)'/);
      const overrideMatch = body.match(/sd\.ControllerElementOverride\s*=\s*(\{[^\n]*\})/);
      const reqSlotsMatch = body.match(/sd\.SetRequiredSlotsString\((\{[^\n]*\})\)/);
      const forbiddenMatch = body.match(/sd\.SetForbiddenSlotsString\((\{[^\n]*\})\)/);
      item.controllerElementOverride = overrideMatch ? parseLuaStringArray(overrideMatch[1]) : [];
      item.requiredSlots = reqSlotsMatch ? parseLuaStringArray(reqSlotsMatch[1]) : item.requiredSlots;
      item.forbiddenSlots = forbiddenMatch ? parseLuaStringArray(forbiddenMatch[1]) : [];
    }

const colorSlotMatches = [...body.matchAll(/ColorSlot\.CreateInstance\('([^']*)',\s*ColorPaletteManager\.GetColorPaletteByName\('([^']*)'\)\)/g)];
    item.colorSlots = colorSlotMatches.map((entry) => ({
      slotName: entry[1],
      paletteName: entry[2]
    }));
    item.colorPalette = "partpalette"; // default

    item.susModifiers = [...body.matchAll(/SusModifier\.CreateInstance\(SusArea\.([A-Za-z0-9_]+),\s*([0-9.]+)\)/g)]
      .map((entry) => ({ area: entry[1], value: Number(entry[2]) }));

    item.textures = [...body.matchAll(/GetPackedTexture\(CurrentModGuid,\s*'([^']+)'\)/g)]
      .map((entry) => ({ path: entry[1], targets: inferTextureTargets(entry[1]) }));

    items.push(item);
    match = blockRegex.exec(content);
  }

  return items;
}

function prepareLuaFile(file) {
  const managedItems = parseManagedItemsFromLua(file.content || "");
  return {
    ...file,
    managedItems,
    selectedManagedItemId: managedItems[0]?.id || null,
    itemViewMode: "list"
  };
}

function getActiveTabData() {
  if (!state.activeTab) {
    return null;
  }
  return state.openTabs.find((tab) => tab.id === state.activeTab) || null;
}

function getCurrentLuaFile() {
  const tab = getActiveTabData();
  if (!tab || !state.currentLuaFileName) {
    return null;
  }
  return tab.luaFiles.find((file) => file.fileName === state.currentLuaFileName) || null;
}

function getSelectedManagedItem() {
  const currentFile = getCurrentLuaFile();
  if (!currentFile || !currentFile.selectedManagedItemId) {
    return null;
  }
  return currentFile.managedItems.find((item) => item.id === currentFile.selectedManagedItemId) || null;
}

function updateDocumentTitle() {
  const dirty = state.dirtyTabs.size > 0 ? "* " : "";
  document.title = `${dirty}June Mod Tool`;
}

function markTabDirty(tabId, isDirty = true) {
  if (isDirty) {
    state.dirtyTabs.add(tabId);
  } else {
    state.dirtyTabs.delete(tabId);
  }
  window.modTool.setHasUnsavedChanges(state.dirtyTabs.size > 0);
  updateDocumentTitle();
  renderWorkspaceTabs();
}

function pushTabHistory(tabId) {
  const tab = state.openTabs.find((entry) => entry.id === tabId);
  if (!tab) {
    return;
  }

  const undoStack = state.tabUndoHistory.get(tabId) || [];
  undoStack.push({
    summary: deepClone(tab.summary),
    modJson: deepClone(tab.modJson),
    luaFiles: deepClone(tab.luaFiles),
    currentLuaFileName: state.currentLuaFileName,
    currentEditorTab: state.currentEditorTab
  });
  if (undoStack.length > 50) {
    undoStack.shift();
  }

  state.tabUndoHistory.set(tabId, undoStack);
  state.tabRedoHistory.set(tabId, []);
}

function restoreTabFromSnapshot(tabId, snapshot) {
  const index = state.openTabs.findIndex((entry) => entry.id === tabId);
  if (index === -1 || !snapshot) {
    return;
  }

  state.openTabs[index] = {
    id: tabId,
    summary: deepClone(snapshot.summary),
    modJson: deepClone(snapshot.modJson),
    luaFiles: deepClone(snapshot.luaFiles)
  };
  state.activeTab = tabId;
  state.currentLuaFileName = snapshot.currentLuaFileName || state.openTabs[index].luaFiles[0]?.fileName || null;
  state.currentEditorTab = snapshot.currentEditorTab || "info";
  markTabDirty(tabId, true);
  renderAll();
}

function undoActiveTab() {
  const tab = getActiveTabData();
  if (!tab) {
    return false;
  }

  const undoStack = state.tabUndoHistory.get(tab.id) || [];
  if (undoStack.length === 0) {
    return false;
  }

  const redoStack = state.tabRedoHistory.get(tab.id) || [];
  redoStack.push({
    summary: deepClone(tab.summary),
    modJson: deepClone(tab.modJson),
    luaFiles: deepClone(tab.luaFiles),
    currentLuaFileName: state.currentLuaFileName,
    currentEditorTab: state.currentEditorTab
  });
  state.tabRedoHistory.set(tab.id, redoStack);

  const snapshot = undoStack.pop();
  state.tabUndoHistory.set(tab.id, undoStack);
  restoreTabFromSnapshot(tab.id, snapshot);
  setStatus(`Undo applied for "${tab.summary.name}".`);
  return true;
}

function redoActiveTab() {
  const tab = getActiveTabData();
  if (!tab) {
    return false;
  }

  const redoStack = state.tabRedoHistory.get(tab.id) || [];
  if (redoStack.length === 0) {
    return false;
  }

  const undoStack = state.tabUndoHistory.get(tab.id) || [];
  undoStack.push({
    summary: deepClone(tab.summary),
    modJson: deepClone(tab.modJson),
    luaFiles: deepClone(tab.luaFiles),
    currentLuaFileName: state.currentLuaFileName,
    currentEditorTab: state.currentEditorTab
  });
  state.tabUndoHistory.set(tab.id, undoStack);

  const snapshot = redoStack.pop();
  state.tabRedoHistory.set(tab.id, redoStack);
  restoreTabFromSnapshot(tab.id, snapshot);
  setStatus(`Redo applied for "${tab.summary.name}".`);
  return true;
}

function populateStaticOptions() {
  for (const category of CATEGORY_OPTIONS) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.categorySelect.append(option);
  }

  for (const shopId of SHOP_OPTIONS) {
    const option = document.createElement("option");
    option.value = shopId;
    option.textContent = shopId || "No direct shop";
    elements.shopIdSelect.append(option);
  }

  for (const scratchType of SCRATCH_OPTIONS) {
    const option = document.createElement("option");
    option.value = scratchType;
    option.textContent = scratchType;
    elements.scratchTypeSelect.append(option);
  }

  for (const slot of EQUIPMENT_SLOT_OPTIONS) {
    const option = document.createElement("option");
    option.value = slot;
    elements.equipmentSlots.append(option);
  }
}

function syncMetaIntoState() {
  const tab = getActiveTabData();
  if (!tab) {
    return;
  }

  tab.modJson.name = elements.modNameInput.value.trim();
  tab.modJson.description = elements.modDescriptionInput.value;
  tab.modJson.targetVersion = elements.modTargetVersionInput.value.trim();
  tab.modJson.doNotChangeVariablesBelowThis = tab.modJson.doNotChangeVariablesBelowThis || {};
  tab.modJson.doNotChangeVariablesBelowThis.guid = tab.modJson.doNotChangeVariablesBelowThis.guid || {};
  tab.modJson.doNotChangeVariablesBelowThis.guid.serializedGuid = elements.modGuidInput.value.trim();

  tab.summary.name = tab.modJson.name || tab.summary.directoryName;
  tab.summary.description = tab.modJson.description || "";
  tab.summary.targetVersion = tab.modJson.targetVersion || "";
}

function syncEditorIntoState() {
  const currentFile = getCurrentLuaFile();
  if (currentFile) {
    currentFile.content = elements.luaEditor.value;
  }
}

function renderTextureRows(textures) {
  elements.texturesContainer.innerHTML = "";

  for (const texture of textures) {
    const row = document.createElement("div");
    row.className = "texture-row";
    row.innerHTML = `
      <label class="field">
        <span>Texture json path</span>
        <input class="field__input texture-path" value="${escapeHtml(texture.path || "")}" />
      </label>
      <label class="field">
        <span>Targets</span>
        <input class="field__input texture-targets" value="${escapeHtml((texture.targets || []).join(", "))}" />
      </label>
      <button type="button" class="toolbar-button toolbar-button--danger" data-remove-texture>Remove</button>
    `;
    elements.texturesContainer.append(row);
  }

  for (const removeButton of elements.texturesContainer.querySelectorAll("[data-remove-texture]")) {
    removeButton.addEventListener("click", () => {
      removeButton.closest(".texture-row")?.remove();
    });
  }
}

function renderColorSlotRows(colorSlots = []) {
  elements.colorSlotsContainer.innerHTML = "";
  for (const cs of colorSlots) {
    const row = document.createElement("div");
    row.className = "texture-row"; // reuse style
    row.innerHTML = `
      <label class="field">
        <span>Slot Name</span>
        <input class="field__input color-slot-name" value="${escapeHtml(cs.slotName || cs || "")}" />
      </label>
      <label class="field">
        <span>Palette</span>
        <input class="field__input color-slot-palette" value="${escapeHtml(cs.paletteName || "partpalette")}" />
      </label>
      <button type="button" class="toolbar-button toolbar-button--danger" data-remove-color-slot>Remove</button>
    `;
    elements.colorSlotsContainer.append(row);
  }

  for (const removeButton of elements.colorSlotsContainer.querySelectorAll("[data-remove-color-slot]")) {
    removeButton.addEventListener("click", () => {
      removeButton.closest(".texture-row")?.remove();
    });
  }
}

function loadManagedItemIntoForm(item) {
  const form = elements.generatorForm;
  form.elements.sourceMode.value = item.sourceMode || "create";
  form.elements.baseVanillaId.value = item.baseVanillaId ?? 8;
  form.elements.itemName.value = item.name || "";
  form.elements.itemDescription.value = item.description || "";
  form.elements.price.value = item.price ?? 3000;
  form.elements.shopId.value = item.shopId || "clothier";
  form.elements.category.value = item.category || "Clothing";
  form.elements.scratchType.value = item.scratchType || "Universal";
  form.elements.possibleEquipmentSlots.value = (item.possibleEquipmentSlots || []).join(", ");
  form.elements.requiredSlots.value = (item.requiredSlots || []).join(", ");
  form.elements.useSlotData.value = item.useSlotData ? "true" : "false";
  form.elements.targetSlotString.value = item.targetSlotString || "";
  form.elements.controllerElementOverride.value = (item.controllerElementOverride || []).join(", ");
  form.elements.forbiddenSlots.value = (item.forbiddenSlots || []).join(", ");
  form.elements.partners.value = (item.partners || []).join(", ");
  renderColorSlotRows(item.colorSlots || []);
  form.elements.susModifiers.value = (item.susModifiers || []).map((entry) => `${entry.area}:${entry.value}`).join(", ");
  form.elements.isIllegal.checked = Boolean(item.isIllegal);
  form.elements.hasQuality.checked = Boolean(item.hasQuality);
  form.elements.isStackable.checked = Boolean(item.isStackable);
  form.elements.canChangeColor.checked = Boolean(item.canChangeColor);
  form.elements.throwingOutForbidden.checked = Boolean(item.throwingOutForbidden);
  renderTextureRows(item.textures || []);
}

function resetManagedItemForm() {
  loadManagedItemIntoForm(createDefaultManagedItem());
}

function collectManagedItemFromForm(existingId = null) {
  const formData = new FormData(elements.generatorForm);
  return {
    id: existingId || `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    sourceMode: String(formData.get("sourceMode") || "create"),
    baseVanillaId: Number(formData.get("baseVanillaId") || 8),
    name: String(formData.get("itemName") || "").trim(),
    description: String(formData.get("itemDescription") || ""),
    price: Number(formData.get("price") || 0),
    shopId: String(formData.get("shopId") || "clothier"),
    category: String(formData.get("category") || "Clothing"),
    scratchType: String(formData.get("scratchType") || "Universal"),
    possibleEquipmentSlots: splitCsv(formData.get("possibleEquipmentSlots")),
    requiredSlots: splitCsv(formData.get("requiredSlots")),
    useSlotData: String(formData.get("useSlotData")) === "true",
    targetSlotString: String(formData.get("targetSlotString") || "").trim(),
    controllerElementOverride: splitCsv(formData.get("controllerElementOverride")),
    forbiddenSlots: splitCsv(formData.get("forbiddenSlots")),
    throwingOutForbidden: formData.get("throwingOutForbidden") === "on",
    partners: splitCsv(formData.get("partners")),
    colorSlots: Array.from(elements.colorSlotsContainer.querySelectorAll(".texture-row")).map((row) => ({
      slotName: row.querySelector(".color-slot-name").value.trim(),
      paletteName: row.querySelector(".color-slot-palette").value.trim()
    })).filter(cs => cs.slotName),
    susModifiers: splitCsv(formData.get("susModifiers"))
      .map((entry) => {
        const [area, value] = entry.split(":").map((part) => part.trim());
        return { area, value: Number(value || 0) };
      })
      .filter((entry) => entry.area && !Number.isNaN(entry.value)),
    textures: Array.from(elements.texturesContainer.querySelectorAll(".texture-row"))
      .map((row) => ({
        path: row.querySelector(".texture-path").value.trim(),
        targets: splitCsv(row.querySelector(".texture-targets").value)
      }))
      .filter((entry) => entry.path),
    isIllegal: formData.get("isIllegal") === "on",
    hasQuality: formData.get("hasQuality") === "on",
    isStackable: formData.get("isStackable") === "on",
    canChangeColor: formData.get("canChangeColor") === "on"
  };
}

function luaArray(values) {
  return values.length ? `{${values.map((value) => `'${value.replaceAll("'", "\\'")}'`).join(", ")}}` : "{}";
}

function luaColorSlots(colorSlots, palette) {
  return colorSlots.length
    ? `{${colorSlots.map((slot) => `ColorSlot.CreateInstance('${slot.replaceAll("'", "\\'")}', ColorPaletteManager.GetColorPaletteByName('${palette.replaceAll("'", "\\'")}'))`).join(", ")}}`
    : "{}";
}

function luaSusModifiers(items) {
  return items.length
    ? `{${items.map((item) => `SusModifier.CreateInstance(SusArea.${item.area}, ${item.value})`).join(", ")}}`
    : "{}";
}

function normalizeLuaIdentifier(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "texture";
}

function renderItemPrefabLua(item, index) {
  const itemVar = `itemprefab${index}`;
  const gameVar = `itemgameid${index}`;
  const lines = [];

  if (item.sourceMode === "clone_vanilla" && Number.isFinite(item.baseVanillaId)) {
    lines.push(`local ${itemVar} = ItemPrefabManager.GetItemById(GameId.CreateVanilla(${item.baseVanillaId})).Clone()`);
  } else {
    lines.push(`local ${itemVar} = ModUtilities.CreateItemPrefab()`);
  }

  lines.push(`${itemVar}.Name = '${item.name.replaceAll("'", "\\'")}'`);
  lines.push(`${itemVar}.Description = '${item.description.replaceAll("'", "\\'")}'`);
  lines.push(`${itemVar}.Price = ${Number.isFinite(item.price) ? item.price : 0}`);

  if (item.useSlotData) {
    lines.push(`${itemVar}.SlotData = (function()`);
    lines.push("\tlocal sd = SlotEquipData.CreateInstance()");
    if (item.targetSlotString) {
      lines.push(`\tsd.TargetSlotString = '${item.targetSlotString.replaceAll("'", "\\'")}'`);
    }
    if (item.controllerElementOverride.length > 0) {
      lines.push(`\tsd.ControllerElementOverride = ${luaArray(item.controllerElementOverride)}`);
    }
    if (item.requiredSlots.length > 0) {
      lines.push(`\tsd.SetRequiredSlotsString(${luaArray(item.requiredSlots)})`);
    }
    if (item.forbiddenSlots.length > 0) {
      lines.push(`\tsd.SetForbiddenSlotsString(${luaArray(item.forbiddenSlots)})`);
    }
    lines.push("\treturn sd end)()");
    lines.push(`${itemVar}.ThrowingOutForbidden = ${item.throwingOutForbidden ? "true" : "false"}`);
  } else {
    lines.push(`${itemVar}.PossibleEquipmentSlots = ${luaArray(item.possibleEquipmentSlots)}`);
    lines.push(`${itemVar}.RequiredSlots = ${luaArray(item.requiredSlots)}`);
  }

  lines.push(`${itemVar}.IsIllegal = ${item.isIllegal ? "true" : "false"}`);
  lines.push(`${itemVar}.HasQuality = ${item.hasQuality ? "true" : "false"}`);
  lines.push(`${itemVar}.IsStackable = ${item.isStackable ? "true" : "false"}`);
  lines.push(`${itemVar}.Category = ItemCategory.${item.category}`);
  lines.push(`${itemVar}.CanChangeColor = ${item.canChangeColor ? "true" : "false"}`);
  lines.push(`${itemVar}.ColorSlots = ${luaColorSlots(item.colorSlots, item.colorPalette)}`);
  lines.push(`${itemVar}.Partners = ${luaArray(item.partners)}`);
  lines.push(`${itemVar}.ScratchType = ScratchTextureType.${item.scratchType}`);
  lines.push(`${itemVar}.SusModifiers = ${luaSusModifiers(item.susModifiers)}`);
  lines.push("");

  item.textures.forEach((texture, textureIndex) => {
    const labelSeed = texture.targets.length > 0 ? texture.targets.join("_") : `texture_${textureIndex}`;
    const variableName = `${itemVar}_${normalizeLuaIdentifier(labelSeed)}_${textureIndex}`;
    const normalizedPath = texture.path.startsWith("/") ? texture.path : `/${texture.path}`;
    lines.push(`local ${variableName} = ModUtilities.GetPackedTexture(CurrentModGuid, '${normalizedPath.replaceAll("'", "\\'")}')`);
    lines.push("");
    lines.push(`${itemVar}.AddTexture(${variableName})`);
    lines.push("");
  });

  lines.push(`local ${gameVar} = ModUtilities.CreateNewItemAutoAssignId(CurrentModGuid, ${itemVar})`);
  if (item.shopId) {
    lines.push(`ModUtilities.AddSingleBuyItemToShop('${item.shopId.replaceAll("'", "\\'")}', ${gameVar})`);
  }
  lines.push("");
  return lines.join("\n");
}

function rebuildLuaFromManagedItems(file) {
  const lines = [
    "-- This script is managed by June Mod Tool item list.",
    "do",
    ""
  ];

  file.managedItems.forEach((item, index) => {
    lines.push(renderItemPrefabLua(item, index));
  });

  lines.push("end");
  lines.push("");
  file.content = lines.join("\n");
}

function getNextLuaFileName(luaFiles) {
  const used = new Set(luaFiles.map((file) => file.fileName.toLowerCase()));
  if (!used.has("script.lua")) {
    return "script.lua";
  }

  let counter = 2;
  while (used.has(`script${counter}.lua`)) {
    counter += 1;
  }
  return `script${counter}.lua`;
}

function hideAllMenus() {
  elements.fileMenuDropdown.classList.add("hidden");
  elements.editMenuDropdown.classList.add("hidden");
  elements.viewMenuDropdown.classList.add("hidden");
}

function showDropdown(trigger, dropdown) {
  const rect = trigger.getBoundingClientRect();
  hideAllMenus();
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.top = `${rect.bottom}px`;
  dropdown.classList.remove("hidden");
}

function hideContextMenu() {
  elements.contextMenu.classList.add("hidden");
  elements.itemContextMenu.classList.add("hidden");
  state.contextMenuModId = null;
  state.contextMenuItemId = null;
}

function renderExplorer() {
  const activeTab = getActiveTabData();
  const canShowExplorer = Boolean(activeTab);
  const explorerView = canShowExplorer && state.activeSidebarView === "explorer" ? "explorer" : "mods";
  const translations = getCurrentTranslations();

  elements.activityModsButton.classList.toggle("activity-bar__button--active", explorerView === "mods");
  elements.activityExplorerButton.classList.toggle("activity-bar__button--active", explorerView === "explorer");
  elements.modsPane.classList.toggle("sidebar__pane--active", explorerView === "mods");
  elements.modSectionsPane.classList.toggle("sidebar__pane--active", explorerView === "explorer");

  if (explorerView === "mods") {
    elements.explorerTitle.textContent = translations.sidebarModsTitle || "MOD EXPLORER";
    elements.explorerMeta.textContent = state.mods.length > 0
      ? `${state.mods.length} mods available`
      : "No mods found";
  } else {
    elements.explorerTitle.textContent = (activeTab.summary.name || "MOD").toUpperCase();
    elements.explorerMeta.textContent = activeTab.summary.directoryName;
  }

  for (const button of [elements.sectionInfoButton, elements.sectionLuaButton, elements.sectionItemsButton]) {
    button.classList.toggle("tree-item--active", button.dataset.section === state.currentEditorTab);
  }
}

function renderModsList() {
  if (state.mods.length === 0) {
    elements.modsList.innerHTML = `<div class="empty-state">No mods found in Documents/JuneModTools/mods.</div>`;
    return;
  }

  elements.modsList.innerHTML = state.mods.map((mod) => {
    const selectedClass = mod.id === state.homeSelectedModId ? " mod-card--active" : "";
    const statusClass = mod.storageStatus === "packed"
      ? " mod-card__status--packed"
      : mod.storageStatus === "packed+unpacked"
        ? " mod-card__status--mixed"
        : "";
    return `
      <button class="mod-card${selectedClass}" data-mod-id="${escapeHtml(mod.id)}">
        <span class="mod-card__status${statusClass}"></span>
        <span class="mod-card__text">
          <span class="mod-card__name">${escapeHtml(mod.name)}</span>
          <span class="mod-card__meta">${escapeHtml(mod.id)}</span>
        </span>
      </button>
    `;
  }).join("");

  for (const button of elements.modsList.querySelectorAll("[data-mod-id]")) {
    button.addEventListener("click", async () => {
      state.homeSelectedModId = button.dataset.modId;
      await openModInTab(button.dataset.modId);
    });

    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      state.homeSelectedModId = button.dataset.modId;
      state.contextMenuModId = button.dataset.modId;
      renderModsList();
      elements.contextMenu.style.left = `${event.clientX}px`;
      elements.contextMenu.style.top = `${event.clientY}px`;
      elements.contextMenu.classList.remove("hidden");
    });
  }
}

function renderWorkspaceTabs() {
  if (state.openTabs.length === 0) {
    elements.workspaceTabs.innerHTML = "";
    return;
  }

  elements.workspaceTabs.innerHTML = state.openTabs.map((tab) => {
    const activeClass = tab.id === state.activeTab ? " workspace-tab--active" : "";
    const dirtyMark = state.dirtyTabs.has(tab.id) ? "* " : "";
    return `
      <div class="workspace-tab${activeClass}" data-workspace-tab="${escapeHtml(tab.id)}">
        <span class="workspace-tab__name">${escapeHtml(`${dirtyMark}${tab.summary.name}`)}</span>
        <button class="workspace-tab__close" data-close-tab="${escapeHtml(tab.id)}">&times;</button>
      </div>
    `;
  }).join("");

  for (const tabButton of elements.workspaceTabs.querySelectorAll("[data-workspace-tab]")) {
    tabButton.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-tab]")) {
        return;
      }
      activateTab(tabButton.dataset.workspaceTab);
    });
  }

  for (const closeButton of elements.workspaceTabs.querySelectorAll("[data-close-tab]")) {
    closeButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      await closeTab(closeButton.dataset.closeTab);
    });
  }
}

function renderMetaForm() {
  const tab = getActiveTabData();
  if (!tab) {
    elements.modNameInput.value = "";
    elements.modDescriptionInput.value = "";
    elements.modTargetVersionInput.value = "";
    elements.modGuidInput.value = "";
    elements.modFolderInput.value = "";
    elements.modStorageStatusInput.value = "";
    return;
  }

  elements.modNameInput.value = tab.modJson.name || "";
  elements.modDescriptionInput.value = tab.modJson.description || "";
  elements.modTargetVersionInput.value = tab.modJson.targetVersion || "";
  elements.modGuidInput.value = tab.modJson?.doNotChangeVariablesBelowThis?.guid?.serializedGuid || "";
  elements.modFolderInput.value = tab.summary.directoryName;
  elements.modStorageStatusInput.value = getStorageStatusLabel(tab.summary.storageStatus);
}

function renderLuaTabs() {
  const tab = getActiveTabData();
  if (!tab) {
    elements.luaTabs.innerHTML = "";
    elements.luaEditor.value = "";
    elements.luaEditor.disabled = true;
    return;
  }

  elements.luaTabs.innerHTML = tab.luaFiles.map((file) => {
    const activeClass = file.fileName === state.currentLuaFileName ? " subtab--active" : "";
    return `<button class="subtab${activeClass}" data-lua-file="${escapeHtml(file.fileName)}">${escapeHtml(file.fileName)}</button>`;
  }).join("");

  for (const button of elements.luaTabs.querySelectorAll("[data-lua-file]")) {
    button.addEventListener("click", () => {
      syncEditorIntoState();
      state.currentLuaFileName = button.dataset.luaFile;
      renderLuaTabs();
      renderLuaEditor();
      renderItemPrefabList();
    });
  }
}

function renderLuaEditor() {
  const currentFile = getCurrentLuaFile();
  elements.luaEditor.value = currentFile ? currentFile.content : "";
  elements.luaEditor.disabled = !currentFile;
}

function renderItemViewMode() {
  const currentFile = getCurrentLuaFile();
  const isEditorMode = Boolean(currentFile && currentFile.itemViewMode === "editor");
  elements.itemListView.classList.toggle("hidden", isEditorMode);
  elements.itemEditorView.classList.toggle("hidden", !isEditorMode);
}

function renderItemPrefabList() {
  const currentFile = getCurrentLuaFile();
  if (!currentFile) {
    elements.itemPrefabList.innerHTML = `<div class="empty-state">Select a Lua file first.</div>`;
    resetManagedItemForm();
    renderItemViewMode();
    return;
  }

  if (!currentFile.selectedManagedItemId && currentFile.managedItems[0]) {
    currentFile.selectedManagedItemId = currentFile.managedItems[0].id;
  }

  if (currentFile.managedItems.length === 0) {
    elements.itemPrefabList.innerHTML = `<div class="empty-state">No parsed items yet. Create a new item.</div>`;
    resetManagedItemForm();
    renderItemViewMode();
    return;
  }

  elements.itemPrefabList.innerHTML = currentFile.managedItems.map((item) => {
    const activeClass = item.id === currentFile.selectedManagedItemId ? " item-card--active" : "";
    const modeLabel = item.sourceMode === "clone_vanilla" ? `clone ${item.baseVanillaId}` : "new prefab";
    return `
      <button class="item-card${activeClass}" data-item-id="${escapeHtml(item.id)}">
        <span class="item-card__name">${escapeHtml(item.name || "Unnamed item")}</span>
        <span class="item-card__meta">${escapeHtml(`${modeLabel} • ${item.category}`)}</span>
      </button>
    `;
  }).join("");

  for (const button of elements.itemPrefabList.querySelectorAll("[data-item-id]")) {
    button.addEventListener("click", () => {
      currentFile.selectedManagedItemId = button.dataset.itemId;
      currentFile.itemViewMode = "editor";
      const selectedItem = getSelectedManagedItem();
      if (selectedItem) {
        loadManagedItemIntoForm(selectedItem);
      }
      renderItemViewMode();
      renderItemPrefabList();
    });

    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      currentFile.selectedManagedItemId = button.dataset.itemId;
      state.contextMenuItemId = button.dataset.itemId;
      elements.itemContextMenu.style.left = `${event.clientX}px`;
      elements.itemContextMenu.style.top = `${event.clientY}px`;
      elements.itemContextMenu.classList.remove("hidden");
      renderItemPrefabList();
    });
  }

  const selectedItem = getSelectedManagedItem();
  if (selectedItem && currentFile.itemViewMode === "editor") {
    loadManagedItemIntoForm(selectedItem);
  }

  renderItemViewMode();
}

function renderEditorPanels() {
  const panelMap = {
    info: elements.panelInfo,
    lua: elements.panelLua,
    items: elements.panelItems
  };

  for (const [key, panel] of Object.entries(panelMap)) {
    panel.classList.toggle("editor-panel--active", key === state.currentEditorTab);
  }
}

function renderWorkspace() {
  const activeTab = getActiveTabData();
  const hasActiveTab = Boolean(activeTab);
  elements.editorPlaceholder.classList.toggle("placeholder--active", !hasActiveTab);
  elements.editorShell.classList.toggle("editor-shell--active", hasActiveTab);

  if (!hasActiveTab) {
    return;
  }

  renderEditorPanels();
  renderMetaForm();
  renderLuaTabs();
  renderLuaEditor();
  renderItemPrefabList();
}

function renderAll() {
  renderExplorer();
  renderModsList();
  renderWorkspaceTabs();
  renderWorkspace();
}

async function refreshMods() {
  state.mods = await window.modTool.listMods();

  if (state.homeSelectedModId && !state.mods.some((mod) => mod.id === state.homeSelectedModId)) {
    state.homeSelectedModId = null;
  }

  if (!state.homeSelectedModId && state.mods[0]) {
    state.homeSelectedModId = state.mods[0].id;
  }

  renderAll();
}

async function openModInTab(modId) {
  const existingTab = state.openTabs.find((tab) => tab.id === modId);
  if (existingTab) {
    activateTab(modId);
    return;
  }

  const loadedMod = await window.modTool.loadMod(modId);
  state.openTabs.push({
    id: modId,
    summary: loadedMod.summary,
    modJson: loadedMod.modJson,
    luaFiles: loadedMod.luaFiles.map(prepareLuaFile)
  });
  state.tabUndoHistory.set(modId, []);
  state.tabRedoHistory.set(modId, []);
  state.activeTab = modId;
  state.currentLuaFileName = loadedMod.luaFiles[0]?.fileName || null;
  state.activeSidebarView = "explorer";
  state.currentEditorTab = "info";
  renderAll();
  setStatus(
    loadedMod.unpackedFromArchive
      ? `Unpacked and opened "${loadedMod.summary.name}".`
      : `Opened "${loadedMod.summary.name}".`,
    "success"
  );
}

function activateTab(tabId) {
  syncEditorIntoState();
  state.activeTab = tabId;
  const tab = getActiveTabData();
  state.currentLuaFileName = tab?.luaFiles[0]?.fileName || null;
  state.activeSidebarView = "explorer";
  renderAll();
}

async function confirmTabClose(tabId) {
  if (!state.dirtyTabs.has(tabId)) {
    return "discard";
  }

  const tab = state.openTabs.find((entry) => entry.id === tabId);
  if (!tab) {
    return "discard";
  }

  return window.modTool.confirmUnsavedChanges({
    title: "Unsaved changes",
    message: `Save changes for "${tab.summary.name}"?`,
    detail: "The current mod has unsaved changes.",
    saveLabel: "Save changes",
    cancelLabel: "Cancel",
    discardLabel: "Close without saving"
  });
}

async function closeTab(tabId) {
  const decision = await confirmTabClose(tabId);
  if (decision === "cancel") {
    return;
  }

  if (decision === "save") {
    await saveTabById(tabId);
  }

  state.openTabs = state.openTabs.filter((tab) => tab.id !== tabId);
  state.dirtyTabs.delete(tabId);
  state.tabUndoHistory.delete(tabId);
  state.tabRedoHistory.delete(tabId);

  if (state.activeTab === tabId) {
    state.activeTab = state.openTabs.at(-1)?.id || null;
    state.currentLuaFileName = getActiveTabData()?.luaFiles[0]?.fileName || null;
  }

  window.modTool.setHasUnsavedChanges(state.dirtyTabs.size > 0);
  renderAll();
}

async function saveTabById(tabId) {
  const tab = state.openTabs.find((entry) => entry.id === tabId);
  if (!tab) {
    setStatus("Open a mod tab first.", "error");
    return;
  }

  if (state.activeTab === tabId) {
    syncMetaIntoState();
    syncEditorIntoState();
  }

  try {
    // Create backup before saving
    await window.modTool.createModBackup(tab.summary.directoryName);
  } catch (error) {
    console.warn("Backup creation failed:", error);
  }

  const savedMod = await window.modTool.saveMod({
    directoryName: tab.summary.directoryName,
    modJson: tab.modJson,
    luaFiles: tab.luaFiles.map(({ fileName, content }) => ({ fileName, content }))
  });

  const index = state.openTabs.findIndex((openTab) => openTab.id === tabId);
  state.openTabs[index] = {
    id: tabId,
    summary: savedMod.summary,
    modJson: savedMod.modJson,
    luaFiles: savedMod.luaFiles.map(prepareLuaFile)
  };
  state.currentLuaFileName = savedMod.luaFiles[0]?.fileName || null;
  state.tabUndoHistory.set(tabId, []);
  state.tabRedoHistory.set(tabId, []);
  markTabDirty(tabId, false);
  await refreshMods();
  setStatus(`Saved "${savedMod.summary.name}".`, "success");
}

async function saveCurrentMod() {
  if (!state.activeTab) {
    setStatus("Open a mod tab first.", "error");
    return;
  }
  await saveTabById(state.activeTab);
}

async function saveDirtyTabsBeforeClose() {
  for (const tabId of [...state.dirtyTabs]) {
    await saveTabById(tabId);
  }
}

async function packCurrentMod() {
  const tab = getActiveTabData();
  if (!tab) {
    setStatus("Open a mod tab first.", "error");
    return;
  }

  if (state.dirtyTabs.has(tab.id)) {
    await saveTabById(tab.id);
  }

  const packedMod = await window.modTool.packMod(tab.summary.directoryName);
  const index = state.openTabs.findIndex((entry) => entry.id === tab.id);
  state.openTabs[index] = {
    id: tab.id,
    summary: packedMod.summary,
    modJson: packedMod.modJson,
    luaFiles: packedMod.luaFiles.map(prepareLuaFile)
  };
  await refreshMods();
  renderAll();
  setStatus(`Packed "${packedMod.summary.name}".`, "success");
}

function openCreateModal() {
  elements.createModal.classList.remove("hidden");
}

function closeCreateModal() {
  elements.createModal.classList.add("hidden");
}

function openSettingsModal() {
  elements.settingsModal.classList.remove("hidden");
}

function closeSettingsModal() {
  elements.settingsModal.classList.add("hidden");
}

async function duplicateMod(modId) {
  const mod = state.mods.find((entry) => entry.id === modId);
  if (!mod) {
    return;
  }

  const duplicatedName = `${mod.name} Copy`;
  await window.modTool.duplicateMod(modId, generateGuid(), duplicatedName);
  await refreshMods();
  setStatus(`Duplicated "${mod.name}".`, "success");
}

async function deleteMod(modId) {
  const mod = state.mods.find((entry) => entry.id === modId);
  if (!mod) {
    return;
  }

  if (!globalThis.confirm(`Delete mod "${mod.name}"?`)) {
    return;
  }

  await window.modTool.deleteMod(modId);
  state.openTabs = state.openTabs.filter((tab) => tab.id !== modId);
  state.dirtyTabs.delete(modId);
  if (state.activeTab === modId) {
    state.activeTab = state.openTabs.at(-1)?.id || null;
  }
  await refreshMods();
  renderAll();
  setStatus(`Deleted "${mod.name}".`, "success");
}

function duplicateSelectedItem() {
  const tab = getActiveTabData();
  const currentFile = getCurrentLuaFile();
  const selectedItem = getSelectedManagedItem();
  if (!tab || !currentFile || !selectedItem) {
    setStatus("Select an item first.", "error");
    return;
  }

  pushTabHistory(tab.id);
  const duplicatedItem = {
    ...deepClone(selectedItem),
    id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: `${selectedItem.name || "Item"} Copy`
  };
  currentFile.managedItems.push(duplicatedItem);
  currentFile.selectedManagedItemId = duplicatedItem.id;
  currentFile.itemViewMode = "list";
  rebuildLuaFromManagedItems(currentFile);
  markTabDirty(tab.id, true);
  renderLuaEditor();
  renderItemPrefabList();
  setStatus(`Duplicated item "${selectedItem.name}".`, "success");
}

function deleteSelectedItemFromContext() {
  const tab = getActiveTabData();
  const currentFile = getCurrentLuaFile();
  const selectedItem = getSelectedManagedItem();
  if (!tab || !currentFile || !selectedItem) {
    setStatus("Select an item first.", "error");
    return;
  }

  pushTabHistory(tab.id);
  currentFile.managedItems = currentFile.managedItems.filter((item) => item.id !== selectedItem.id);
  currentFile.selectedManagedItemId = currentFile.managedItems[0]?.id || null;
  currentFile.itemViewMode = "list";
  rebuildLuaFromManagedItems(currentFile);
  markTabDirty(tab.id, true);
  renderLuaEditor();
  renderItemPrefabList();
  setStatus(`Deleted item "${selectedItem.name}".`, "success");
}

async function handleCreateMod(event) {
  event.preventDefault();
  const formData = new FormData(elements.createModForm);

  const createdMod = await window.modTool.createMod({
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || ""),
    targetVersion: String(formData.get("targetVersion") || "").trim(),
    mainLuaFile: String(formData.get("mainLuaFile") || "script.lua")
  });

  elements.createModForm.reset();
  elements.createModForm.elements.mainLuaFile.value = "script.lua";
  closeCreateModal();
  await refreshMods();
  state.homeSelectedModId = createdMod.summary.directoryName;
  await openModInTab(createdMod.summary.directoryName);
  setStatus(`Created "${createdMod.summary.name}".`, "success");
}

async function loadLanguageSettings() {
  const [packs, settings] = await Promise.all([
    window.modTool.listLanguages(),
    window.modTool.readSettings()
  ]);

  state.languagePacks = packs;
  state.currentLanguage = settings?.language || "en";
  
  // Load all settings
  state.settings = {
    ...state.settings,
    ...settings
  };

  // Populate language dropdown
  elements.settingsLanguageSelect.innerHTML = packs.map((pack) => {
    const selected = pack.code === state.currentLanguage ? " selected" : "";
    return `<option value="${escapeHtml(pack.code)}"${selected}>${escapeHtml(pack.name)}</option>`;
  }).join("");

  if (elements.settingsAutoSaveCheckbox) {
    elements.settingsAutoSaveCheckbox.checked = state.settings.autoSaveEnabled !== false;
  }

  applyLanguageToUI();
}

async function saveSettingsFromModal(event) {
  event.preventDefault();
  const language = elements.settingsLanguageSelect.value || "en";
  const autoSaveEnabled = elements.settingsAutoSaveCheckbox?.checked ?? true;

  await window.modTool.saveSettings({
    language,
    autoSaveEnabled,
    autoSaveInterval: 300000
  });

  state.currentLanguage = language;
  state.settings.autoSaveEnabled = autoSaveEnabled;
  
  applyLanguageToUI();
  stopAutoSave();
  startAutoSave();
  
  closeSettingsModal();
  setStatus(getCurrentTranslations().settingsSaved || "Settings saved.", "success");
}

function bindMenuButton(button, dropdown) {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const isHidden = dropdown.classList.contains("hidden");
    hideAllMenus();
    if (isHidden) {
      showDropdown(button, dropdown);
    }
  });
}

function bindEvents() {
  bindMenuButton(elements.fileMenuButton, elements.fileMenuDropdown);
  bindMenuButton(elements.editMenuButton, elements.editMenuDropdown);
  bindMenuButton(elements.viewMenuButton, elements.viewMenuDropdown);

  elements.menuNewMod.addEventListener("click", () => {
    hideAllMenus();
    openCreateModal();
  });
  elements.menuSaveMod.addEventListener("click", async () => {
    hideAllMenus();
    await saveCurrentMod();
  });
  elements.menuPackMod.addEventListener("click", async () => {
    hideAllMenus();
    await packCurrentMod();
  });
  elements.menuOpenModsFolder.addEventListener("click", async () => {
    hideAllMenus();
    await window.modTool.openFolder(state.paths.modsRoot);
  });
  elements.menuUndo.addEventListener("click", () => {
    hideAllMenus();
    undoActiveTab();
  });
  elements.menuRedo.addEventListener("click", () => {
    hideAllMenus();
    redoActiveTab();
  });
  elements.menuViewMods.addEventListener("click", () => {
    hideAllMenus();
    state.activeSidebarView = "mods";
    renderExplorer();
  });
  elements.menuViewExplorer.addEventListener("click", () => {
    hideAllMenus();
    if (state.activeTab) {
      state.activeSidebarView = "explorer";
      renderExplorer();
    }
  });

  elements.activityModsButton.addEventListener("click", () => {
    state.activeSidebarView = "mods";
    renderExplorer();
  });
  elements.activityExplorerButton.addEventListener("click", () => {
    if (!state.activeTab) {
      setStatus("Open a mod first.", "error");
      return;
    }
    state.activeSidebarView = "explorer";
    renderExplorer();
  });
  elements.settingsButton.addEventListener("click", () => {
    openSettingsModal();
  });

  for (const sectionButton of [elements.sectionInfoButton, elements.sectionLuaButton, elements.sectionItemsButton]) {
    sectionButton.addEventListener("click", () => {
      state.currentEditorTab = sectionButton.dataset.section;
      renderAll();
    });
  }

  elements.generateGuidButton.addEventListener("click", () => {
    const tab = getActiveTabData();
    if (!tab) {
      setStatus("Open a mod tab first.", "error");
      return;
    }
    elements.modGuidInput.value = generateGuid();
    syncMetaIntoState();
    markTabDirty(tab.id, true);
    renderMetaForm();
  });

  for (const field of [
    elements.modNameInput,
    elements.modDescriptionInput,
    elements.modTargetVersionInput,
    elements.modGuidInput
  ]) {
    field.addEventListener("input", () => {
      const tab = getActiveTabData();
      if (!tab) {
        return;
      }
      syncMetaIntoState();
      markTabDirty(tab.id, true);
      renderWorkspaceTabs();
    });
  }

  elements.saveModButton.addEventListener("click", saveCurrentMod);
  elements.packCurrentModButton.addEventListener("click", packCurrentMod);

  elements.luaEditor.addEventListener("input", () => {
    const tab = getActiveTabData();
    if (!tab) {
      return;
    }
    syncEditorIntoState();
    markTabDirty(tab.id, true);
  });

  elements.addLuaFileButton.addEventListener("click", () => {
    const tab = getActiveTabData();
    if (!tab) {
      return;
    }

    pushTabHistory(tab.id);
    const fileName = getNextLuaFileName(tab.luaFiles);
    tab.luaFiles.push(prepareLuaFile({ fileName, content: "-- New Lua file\n" }));
    state.currentLuaFileName = fileName;
    markTabDirty(tab.id, true);
    renderLuaTabs();
    renderLuaEditor();
    renderItemPrefabList();
    setStatus(`Created "${fileName}".`, "success");
  });

  elements.removeLuaFileButton.addEventListener("click", () => {
    const tab = getActiveTabData();
    if (!tab || !state.currentLuaFileName) {
      return;
    }

    if (tab.luaFiles.length === 1) {
      setStatus("A mod must keep at least one Lua file.", "error");
      return;
    }

    pushTabHistory(tab.id);
    tab.luaFiles = tab.luaFiles.filter((file) => file.fileName !== state.currentLuaFileName);
    state.currentLuaFileName = tab.luaFiles[0]?.fileName || null;
    markTabDirty(tab.id, true);
    renderLuaTabs();
    renderLuaEditor();
    renderItemPrefabList();
  });

  elements.newItemPrefabButton.addEventListener("click", () => {
    const currentFile = getCurrentLuaFile();
    const tab = getActiveTabData();
    if (!currentFile || !tab) {
      setStatus("Open a Lua file first.", "error");
      return;
    }
    currentFile.selectedManagedItemId = null;
    currentFile.itemViewMode = "editor";
    resetManagedItemForm();
    renderItemViewMode();
  });

  elements.backToItemListButton.addEventListener("click", () => {
    const currentFile = getCurrentLuaFile();
    if (!currentFile) {
      return;
    }
    currentFile.itemViewMode = "list";
    renderItemPrefabList();
  });

  elements.saveItemPrefabButton.addEventListener("click", () => {
    const tab = getActiveTabData();
    const currentFile = getCurrentLuaFile();
    if (!tab || !currentFile) {
      setStatus("Open a Lua file first.", "error");
      return;
    }

    const selectedItem = getSelectedManagedItem();
    const nextItem = collectManagedItemFromForm(selectedItem?.id || null);
    if (!nextItem.name) {
      setStatus("Item name is required.", "error");
      return;
    }

    pushTabHistory(tab.id);
    if (selectedItem) {
      const itemIndex = currentFile.managedItems.findIndex((item) => item.id === selectedItem.id);
      currentFile.managedItems[itemIndex] = nextItem;
    } else {
      currentFile.managedItems.push(nextItem);
    }

    currentFile.selectedManagedItemId = nextItem.id;
    currentFile.itemViewMode = "editor";
    rebuildLuaFromManagedItems(currentFile);
    markTabDirty(tab.id, true);
    renderLuaEditor();
    renderItemPrefabList();
    setStatus(`Saved item "${nextItem.name}".`, "success");
  });

  elements.deleteItemPrefabButton.addEventListener("click", () => {
    const tab = getActiveTabData();
    const currentFile = getCurrentLuaFile();
    const selectedItem = getSelectedManagedItem();
    if (!tab || !currentFile || !selectedItem) {
      setStatus("Select an item first.", "error");
      return;
    }

    pushTabHistory(tab.id);
    currentFile.managedItems = currentFile.managedItems.filter((item) => item.id !== selectedItem.id);
    currentFile.selectedManagedItemId = currentFile.managedItems[0]?.id || null;
    currentFile.itemViewMode = "list";
    rebuildLuaFromManagedItems(currentFile);
    markTabDirty(tab.id, true);
    renderLuaEditor();
    renderItemPrefabList();
    setStatus(`Deleted item "${selectedItem.name}".`, "success");
  });

  elements.addTextureButton.addEventListener("click", () => {
    const currentTextures = Array.from(elements.texturesContainer.querySelectorAll(".texture-row")).map((row) => ({
      path: row.querySelector(".texture-path").value.trim(),
      targets: splitCsv(row.querySelector(".texture-targets").value)
    }));
    currentTextures.push({ path: "", targets: [] });
    renderTextureRows(currentTextures);
  });

  elements.addColorSlotButton.addEventListener("click", () => {
    const currentColorSlots = Array.from(elements.colorSlotsContainer.querySelectorAll(".texture-row")).map((row) => ({
      slotName: row.querySelector(".color-slot-name").value.trim(),
      paletteName: row.querySelector(".color-slot-palette").value.trim()
    })).filter(cs => cs.slotName);
    currentColorSlots.push({ slotName: "", paletteName: "partpalette" });
    renderColorSlotRows(currentColorSlots);
  });

  elements.createModForm.addEventListener("submit", handleCreateMod);
  elements.closeCreateModalButton.addEventListener("click", closeCreateModal);
  elements.closeCreateModalButton2.addEventListener("click", closeCreateModal);
  elements.settingsForm.addEventListener("submit", saveSettingsFromModal);
  elements.closeSettingsModalButton.addEventListener("click", closeSettingsModal);
  elements.cancelSettingsButton.addEventListener("click", closeSettingsModal);

  elements.contextMenuOpen.addEventListener("click", async () => {
    hideContextMenu();
    if (state.contextMenuModId) {
      await openModInTab(state.contextMenuModId);
    }
  });
  elements.contextMenuPack.addEventListener("click", async () => {
    const modId = state.contextMenuModId;
    hideContextMenu();
    if (!modId) {
      return;
    }
    const packedMod = await window.modTool.packMod(modId);
    await refreshMods();
    setStatus(`Packed "${packedMod.summary.name}".`, "success");
  });
  elements.contextMenuDuplicate.addEventListener("click", async () => {
    const modId = state.contextMenuModId;
    hideContextMenu();
    if (modId) {
      await duplicateMod(modId);
    }
  });
  elements.contextMenuDelete.addEventListener("click", async () => {
    const modId = state.contextMenuModId;
    hideContextMenu();
    if (modId) {
      await deleteMod(modId);
    }
  });
  elements.itemContextMenuDuplicate.addEventListener("click", () => {
    hideContextMenu();
    duplicateSelectedItem();
  });
  elements.itemContextMenuDelete.addEventListener("click", () => {
    hideContextMenu();
    deleteSelectedItemFromContext();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".menu-bar") && !event.target.closest(".menu-dropdown")) {
      hideAllMenus();
    }
    if (!event.target.closest(".context-menu")) {
      hideContextMenu();
    }
  });

  window.modTool.onCloseRequested(async () => {
    const dirtyTabs = state.openTabs.filter((tab) => state.dirtyTabs.has(tab.id));
    if (dirtyTabs.length === 0) {
      await window.modTool.finishCloseRequest(true);
      return;
    }

    const decision = await window.modTool.confirmUnsavedChanges({
      title: "Close June Mod Tool",
      message: "There are unsaved mods.",
      detail: `Unsaved tabs: ${dirtyTabs.map((tab) => tab.summary.name).join(", ")}`,
      saveLabel: "Save all",
      cancelLabel: "Cancel",
      discardLabel: "Close without saving"
    });

    if (decision === "cancel") {
      await window.modTool.finishCloseRequest(false);
      return;
    }

    if (decision === "save") {
      try {
        await saveDirtyTabsBeforeClose();
      } catch (error) {
        setStatus(error.message, "error");
        await window.modTool.finishCloseRequest(false);
        return;
      }
    }

    await window.modTool.finishCloseRequest(true);
  });

  window.modTool.onModsChanged(() => {
    scheduleRefreshMods();
  });

  window.addEventListener("keydown", async (event) => {
    const activeElement = document.activeElement;
    const isTextField = activeElement
      && (
        activeElement.tagName === "INPUT"
        || activeElement.tagName === "TEXTAREA"
        || activeElement.tagName === "SELECT"
        || activeElement.isContentEditable
      );

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      await saveCurrentMod();
      return;
    }

    const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z";
    const isRedo = ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y")
      || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z");

    if (isTextField) {
      return;
    }

    if (isUndo) {
      if (undoActiveTab()) {
        event.preventDefault();
      }
      return;
    }

    if (isRedo && redoActiveTab()) {
      event.preventDefault();
    }
  });

  // Window control buttons
  elements.minimizeBtn.addEventListener("click", async () => {
    await window.electron.minimize();
  });

  elements.maximizeBtn.addEventListener("click", async () => {
    await window.electron.maximize();
  });

  elements.closeBtn.addEventListener("click", async () => {
    await window.electron.close();
  });
}

async function boot() {
  populateStaticOptions();
  bindEvents();
  setupKeyboardShortcuts();
  state.paths = await window.modTool.getPaths();
  await loadSettings();
  await loadLanguageSettings();
  await refreshMods();
  renderAll();
  updateDocumentTitle();
  startAutoSave();
  
  setStatus("Workspace loaded.");
}

boot().catch((error) => {
  console.error(error);
  setStatus(error.message, "error");
});
