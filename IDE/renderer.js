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
  "Hairfront2B",
  "Hairfront2Btd",
  "Hairfrontaetly",
  "Hairfrontfs",
  "Lips",
  "Eyes",
  "chargehole",
  "hairband",
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
  homeSelectedModId: null,
  openTabs: [],
  activeTab: "home",
  currentLuaFileName: null,
  dirtyTabs: new Set(),
  tabUndoHistory: new Map(),
  tabRedoHistory: new Map()
};

const elements = {
  workspaceTabs: document.getElementById("workspaceTabs"),
  homeView: document.getElementById("homeView"),
  editorView: document.getElementById("editorView"),
  modsList: document.getElementById("modsList"),
  modCountBadge: document.getElementById("modCountBadge"),
  homeDetails: document.getElementById("homeDetails"),
  openSelectedModButton: document.getElementById("openSelectedModButton"),
  homeReloadButton: document.getElementById("homeReloadButton"),
  homeOpenFolderButton: document.getElementById("homeOpenFolderButton"),
  showCreateModalButton: document.getElementById("showCreateModalButton"),
  closeCreateModalButton: document.getElementById("closeCreateModalButton"),
  createModal: document.getElementById("createModal"),
  createModForm: document.getElementById("createModForm"),
  refreshModsButton: document.getElementById("refreshModsButton"),
  saveModButton: document.getElementById("saveModButton"),
  packCurrentModButton: document.getElementById("packCurrentModButton"),
  reloadCurrentModButton: document.getElementById("reloadCurrentModButton"),
  selectedModTitle: document.getElementById("selectedModTitle"),
  selectedModMeta: document.getElementById("selectedModMeta"),
  modNameInput: document.getElementById("modNameInput"),
  modDescriptionInput: document.getElementById("modDescriptionInput"),
  modTargetVersionInput: document.getElementById("modTargetVersionInput"),
  modFolderInput: document.getElementById("modFolderInput"),
  modStorageStatusInput: document.getElementById("modStorageStatusInput"),
  modGuidInput: document.getElementById("modGuidInput"),
  generateGuidButton: document.getElementById("generateGuidButton"),
  addLuaFileButton: document.getElementById("addLuaFileButton"),
  removeLuaFileButton: document.getElementById("removeLuaFileButton"),
  luaTabs: document.getElementById("luaTabs"),
  luaEditor: document.getElementById("luaEditor"),
  generatorForm: document.getElementById("generatorForm"),
  newItemPrefabButton: document.getElementById("newItemPrefabButton"),
  saveItemPrefabButton: document.getElementById("saveItemPrefabButton"),
  deleteItemPrefabButton: document.getElementById("deleteItemPrefabButton"),
  backToItemListButton: document.getElementById("backToItemListButton"),
  itemPrefabList: document.getElementById("itemPrefabList"),
  itemListView: document.getElementById("itemListView"),
  itemEditorView: document.getElementById("itemEditorView"),
  addTextureButton: document.getElementById("addTextureButton"),
  texturesContainer: document.getElementById("texturesContainer"),
  pathsInfo: document.getElementById("pathsInfo"),
  statusBox: document.getElementById("statusBox"),
  categorySelect: document.getElementById("categorySelect"),
  shopIdSelect: document.getElementById("shopIdSelect"),
  scratchTypeSelect: document.getElementById("scratchTypeSelect"),
  sourceModeSelect: document.getElementById("sourceModeSelect"),
  useSlotDataSelect: document.getElementById("useSlotDataSelect"),
  equipmentSlots: document.getElementById("equipmentSlots")
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
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseLuaStringArray(source) {
  const matches = source.match(/'([^']*)'/g) || [];
  return matches.map((part) => part.slice(1, -1));
}

function createDefaultManagedItem() {
  return {
    id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    sourceMode: "create",
    baseVanillaId: 8,
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
    colorSlots: [],
    colorPalette: "partpalette",
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
  return match
    ? match[1].split(",").map((part) => part.trim()).filter(Boolean)
    : [];
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
  const blockRegex = /local itemprefab(\d+)\s*=\s*([\s\S]*?)local itemgameid\1\s*=\s*ModUtilities\.CreateNewItemAutoAssignId\(CurrentModGuid,\s*itemprefab\1\)([\s\S]*?)(?=\n\s*local itemprefab\d+\s*=|\n\s*itemsetprefab\s*=|\nend\b|$)/g;
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
    item.category = extractSingleQuoted(body.replace(/ItemCategory\./g, "'"), new RegExp(`itemprefab${index}\\.Category\\s*=\\s*'([^']*)'`)) || "Clothing";
    item.scratchType = extractSingleQuoted(body.replace(/ScratchTextureType\./g, "'"), new RegExp(`itemprefab${index}\\.ScratchType\\s*=\\s*'([^']*)'`)) || "Universal";
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
    item.colorSlots = colorSlotMatches.map((entry) => entry[1]);
    if (colorSlotMatches[0]) {
      item.colorPalette = colorSlotMatches[0][2];
    }

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
  const managedItems = parseManagedItemsFromLua(file.content);
  return {
    ...file,
    managedItems,
    selectedManagedItemId: managedItems[0]?.id || null,
    itemViewMode: "list"
  };
}

function populateStaticOptions() {
  for (const category of CATEGORY_OPTIONS) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.categorySelect.append(option);
  }

  for (const shop of SHOP_OPTIONS) {
    const option = document.createElement("option");
    option.value = shop;
    option.textContent = shop || "No direct shop";
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

function getSummaryById(modId) {
  return state.mods.find((mod) => mod.id === modId) || null;
}

function getActiveTabData() {
  if (state.activeTab === "home") {
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

function getPatchStatus(summary) {
  const target = summary?.targetVersion || "";
  const current = "0.90.16";
  if (!target) {
    return "Unknown target version";
  }

  if (target === current) {
    return "Active and compatible";
  }

  const targetPatch = Number(target.split(".").at(-1) || 0);
  const currentPatch = Number(current.split(".").at(-1) || 0);
  const diff = Math.max(0, currentPatch - targetPatch);
  return `Active, but behind by ${diff} patches`;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getStorageStatusLabel(storageStatus) {
  switch (storageStatus) {
    case "packed":
      return "Packed only";
    case "packed+unpacked":
      return "Packed and unpacked";
    default:
      return "Unpacked";
  }
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
    currentLuaFileName: tabId === state.activeTab ? state.currentLuaFileName : null
  });

  if (undoStack.length > 50) {
    undoStack.shift();
  }

  state.tabUndoHistory.set(tabId, undoStack);
  state.tabRedoHistory.set(tabId, []);
}

function restoreTabFromSnapshot(tabId, snapshot) {
  const tabIndex = state.openTabs.findIndex((entry) => entry.id === tabId);
  if (tabIndex === -1 || !snapshot) {
    return;
  }

  state.openTabs[tabIndex] = {
    id: tabId,
    summary: deepClone(snapshot.summary),
    modJson: deepClone(snapshot.modJson),
    luaFiles: deepClone(snapshot.luaFiles)
  };

  if (state.activeTab === tabId) {
    state.currentLuaFileName = snapshot.currentLuaFileName
      || state.openTabs[tabIndex].luaFiles[0]?.fileName
      || null;
  }

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
    currentLuaFileName: state.currentLuaFileName
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
    currentLuaFileName: state.currentLuaFileName
  });
  state.tabUndoHistory.set(tab.id, undoStack);

  const snapshot = redoStack.pop();
  state.tabRedoHistory.set(tab.id, redoStack);
  restoreTabFromSnapshot(tab.id, snapshot);
  setStatus(`Redo applied for "${tab.summary.name}".`);
  return true;
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

function updateDocumentTitle() {
  const hasDirty = state.dirtyTabs.size > 0;
  document.title = `${hasDirty ? "* " : ""}Juns Mod Tool`;
}

function renderWorkspaceTabs() {
  const homeClass = state.activeTab === "home" ? " workspace-tab--active" : "";
  const tabMarkup = [
    `<button class="workspace-tab workspace-tab--home${homeClass}" data-tab-id="home"><span class="workspace-tab__label">Home</span></button>`
  ];

  for (const tab of state.openTabs) {
    const activeClass = tab.id === state.activeTab ? " workspace-tab--active" : "";
    const dirtyMark = state.dirtyTabs.has(tab.id) ? "* " : "";
    tabMarkup.push(`
      <button class="workspace-tab${activeClass}" data-tab-id="${escapeHtml(tab.id)}">
        <span class="workspace-tab__label">${escapeHtml(dirtyMark + tab.summary.name)}</span>
        <span class="workspace-tab__close" data-close-tab="${escapeHtml(tab.id)}">x</span>
      </button>
    `);
  }

  elements.workspaceTabs.innerHTML = tabMarkup.join("");

  for (const button of elements.workspaceTabs.querySelectorAll("[data-tab-id]")) {
    button.addEventListener("click", (event) => {
      const closeTarget = event.target.closest("[data-close-tab]");
      if (closeTarget) {
        event.stopPropagation();
        closeTab(closeTarget.dataset.closeTab);
        return;
      }

      activateTab(button.dataset.tabId);
    });
  }
}

function renderHomeDetails() {
  const summary = getSummaryById(state.homeSelectedModId);

  if (!summary) {
    elements.homeDetails.innerHTML = `<div class="empty-state">Select a mod from the list.</div>`;
    return;
  }

  elements.homeDetails.innerHTML = `
    <div class="home-details__name">${escapeHtml(summary.name)}</div>
    <div class="home-details__line">Status: ${escapeHtml(getStorageStatusLabel(summary.storageStatus))}</div>
    <div class="home-details__line">Lua files: ${summary.luaFileCount}</div>
    <div class="home-details__line">Packed texture json: ${summary.textureJsonCount}</div>
    <div class="home-details__line">PNG files: ${summary.pngCount}</div>
    <div class="home-details__line">Approx patch status: <span class="home-details__warning">${escapeHtml(getPatchStatus(summary))}</span></div>
    <div class="home-details__line">Target game version: ${escapeHtml(summary.targetVersion || "Unknown")}</div>
    <div class="home-details__line">Folder: ${escapeHtml(summary.directoryName)}</div>
    <div class="home-details__line">Description:</div>
    <div>${escapeHtml(summary.description || "No description")}</div>
  `;
}

function renderModsList() {
  elements.modCountBadge.textContent = String(state.mods.length);

  if (state.mods.length === 0) {
    elements.modsList.innerHTML = `<div class="empty-state">No mods found in mods/pack or mods/unpack.</div>`;
    return;
  }

  elements.modsList.innerHTML = state.mods
    .map((mod) => {
      const selectedClass = mod.id === state.homeSelectedModId ? " mod-card--selected" : "";
      return `
        <button class="mod-card${selectedClass}" data-mod-id="${escapeHtml(mod.id)}">
          <span class="mod-card__flag"></span>
          <span class="mod-card__main">
            <strong>${escapeHtml(mod.name)}</strong>
            <span class="mod-card__meta">${escapeHtml(getStorageStatusLabel(mod.storageStatus))} | ${escapeHtml(mod.targetVersion || "Unknown")} | ${mod.luaFileCount} lua</span>
          </span>
          <span class="mod-card__open">></span>
        </button>
      `;
    })
    .join("");

  for (const button of elements.modsList.querySelectorAll("[data-mod-id]")) {
    button.addEventListener("click", () => {
      state.homeSelectedModId = button.dataset.modId;
      renderModsList();
      renderHomeDetails();
    });

    button.addEventListener("dblclick", async () => {
      await openModInTab(button.dataset.modId);
    });
  }
}

function renderPaths() {
  if (!state.paths) {
    return;
  }

  elements.pathsInfo.innerHTML = `
    <div><dt>Workspace</dt><dd>${escapeHtml(state.paths.workspaceRoot)}</dd></div>
    <div><dt>Mods Root</dt><dd>${escapeHtml(state.paths.modsRoot)}</dd></div>
    <div><dt>Unpack</dt><dd>${escapeHtml(state.paths.unpackRoot)}</dd></div>
    <div><dt>Pack</dt><dd>${escapeHtml(state.paths.packRoot)}</dd></div>
  `;
}

function renderLuaTabs() {
  const tab = getActiveTabData();
  if (!tab) {
    elements.luaTabs.innerHTML = "";
    elements.luaEditor.value = "";
    elements.luaEditor.disabled = true;
    return;
  }

  elements.luaTabs.innerHTML = tab.luaFiles
    .map((file) => {
      const activeClass = file.fileName === state.currentLuaFileName ? " lua-tab--active" : "";
      return `<button class="lua-tab${activeClass}" data-lua-file="${escapeHtml(file.fileName)}">${escapeHtml(file.fileName)}</button>`;
    })
    .join("");

  for (const button of elements.luaTabs.querySelectorAll("[data-lua-file]")) {
    button.addEventListener("click", () => {
      syncEditorIntoState();
      state.currentLuaFileName = button.dataset.luaFile;
      renderLuaTabs();
      renderEditor();
      renderItemPrefabList();
    });
  }
}

function renderEditor() {
  const currentFile = getCurrentLuaFile();
  elements.luaEditor.value = currentFile ? currentFile.content : "";
  elements.luaEditor.disabled = !currentFile;
}

function renderTextureRows(textures) {
  elements.texturesContainer.innerHTML = "";
  for (const texture of textures) {
    const row = document.createElement("div");
    row.className = "texture-row";
    row.innerHTML = `
      <label class="field">
        <span>Texture json path</span>
        <input class="texture-path" value="${escapeHtml(texture.path || "")}" />
      </label>
      <label class="field">
        <span>Targets</span>
        <input class="texture-targets" value="${escapeHtml((texture.targets || []).join(", "))}" />
      </label>
      <button type="button" class="game-button game-button--red" data-remove-texture>Remove</button>
    `;
    elements.texturesContainer.append(row);
  }

  for (const removeButton of elements.texturesContainer.querySelectorAll("[data-remove-texture]")) {
    removeButton.onclick = () => removeButton.closest(".texture-row")?.remove();
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
  form.elements.colorSlots.value = (item.colorSlots || []).join(", ");
  form.elements.colorPalette.value = item.colorPalette || "partpalette";
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

function renderItemViewMode() {
  const currentFile = getCurrentLuaFile();
  const isEditor = Boolean(currentFile && currentFile.itemViewMode === "editor");
  elements.itemListView.classList.toggle("hidden", isEditor);
  elements.itemEditorView.classList.toggle("hidden", !isEditor);
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
    colorSlots: splitCsv(formData.get("colorSlots")),
    colorPalette: String(formData.get("colorPalette") || "partpalette").trim(),
    susModifiers: splitCsv(formData.get("susModifiers")).map((entry) => {
      const [area, value] = entry.split(":").map((part) => part.trim());
      return { area, value: Number(value || 0) };
    }).filter((entry) => entry.area && !Number.isNaN(entry.value)),
    textures: Array.from(elements.texturesContainer.querySelectorAll(".texture-row")).map((row) => ({
      path: row.querySelector(".texture-path").value.trim(),
      targets: splitCsv(row.querySelector(".texture-targets").value)
    })).filter((row) => row.path),
    isIllegal: formData.get("isIllegal") === "on",
    hasQuality: formData.get("hasQuality") === "on",
    isStackable: formData.get("isStackable") === "on",
    canChangeColor: formData.get("canChangeColor") === "on"
  };
}

function renderItemPrefabList() {
  const currentFile = getCurrentLuaFile();
  if (!currentFile) {
    elements.itemPrefabList.innerHTML = `<div class="empty-state">Open a Lua file.</div>`;
    renderItemViewMode();
    resetManagedItemForm();
    return;
  }

  if (!currentFile.selectedManagedItemId && currentFile.managedItems[0]) {
    currentFile.selectedManagedItemId = currentFile.managedItems[0].id;
  }

  if (currentFile.managedItems.length === 0) {
    elements.itemPrefabList.innerHTML = `<div class="empty-state">No parsed items yet. Create a new one.</div>`;
    renderItemViewMode();
    resetManagedItemForm();
    return;
  }

  elements.itemPrefabList.innerHTML = currentFile.managedItems.map((item) => {
    const activeClass = item.id === currentFile.selectedManagedItemId ? " item-prefab-card--active" : "";
    const modeLabel = item.sourceMode === "clone_vanilla" ? `clone vanilla ${item.baseVanillaId}` : "new prefab";
    return `
      <button class="item-prefab-card${activeClass}" data-item-id="${escapeHtml(item.id)}">
        <strong>${escapeHtml(item.name || "Unnamed item")}</strong>
        <span>${escapeHtml(modeLabel)} | ${escapeHtml(item.shopId)} | ${escapeHtml(item.category)}</span>
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
    });
  }

  const selectedItem = getSelectedManagedItem();
  if (selectedItem && currentFile.itemViewMode === "editor") {
    loadManagedItemIntoForm(selectedItem);
  }
  renderItemViewMode();
}

function renderMetaForm() {
  const tab = getActiveTabData();
  if (!tab) {
    elements.selectedModTitle.textContent = "No Tab";
    elements.selectedModMeta.textContent = "Open a mod from Home.";
    elements.packCurrentModButton.disabled = true;
    elements.modNameInput.value = "";
    elements.modDescriptionInput.value = "";
    elements.modTargetVersionInput.value = "";
    elements.modFolderInput.value = "";
    elements.modStorageStatusInput.value = "";
    elements.modGuidInput.value = "";
    return;
  }

  elements.packCurrentModButton.disabled = false;
  elements.selectedModTitle.textContent = tab.summary.name;
  elements.selectedModMeta.textContent = `${tab.summary.directoryName} | ${getStorageStatusLabel(tab.summary.storageStatus)} | ${tab.luaFiles.length} lua | target ${tab.modJson.targetVersion || "unknown"}`;
  elements.modNameInput.value = tab.modJson.name || "";
  elements.modDescriptionInput.value = tab.modJson.description || "";
  elements.modTargetVersionInput.value = tab.modJson.targetVersion || "";
  elements.modFolderInput.value = tab.summary.directoryName;
  elements.modStorageStatusInput.value = getStorageStatusLabel(tab.summary.storageStatus);
  elements.modGuidInput.value = tab.modJson?.doNotChangeVariablesBelowThis?.guid?.serializedGuid || "";
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

function renderScreen() {
  const onHome = state.activeTab === "home";
  elements.homeView.classList.toggle("screen--active", onHome);
  elements.editorView.classList.toggle("screen--active", !onHome);
  if (!onHome) {
    renderMetaForm();
    renderLuaTabs();
    renderEditor();
    renderItemPrefabList();
  }
}

function renderAll() {
  renderWorkspaceTabs();
  renderModsList();
  renderHomeDetails();
  renderScreen();
  renderPaths();
}

async function refreshMods() {
  state.mods = await window.modTool.listMods();
  if (state.homeSelectedModId && !state.mods.some((mod) => mod.id === state.homeSelectedModId)) {
    state.homeSelectedModId = null;
  }
  if (!state.homeSelectedModId && state.mods.length > 0) {
    state.homeSelectedModId = state.mods[0].id;
  }
  renderModsList();
  renderHomeDetails();
}

async function openModInTab(modId) {
  if (!modId) {
    return;
  }

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
  renderAll();
  setStatus(
    loadedMod.unpackedFromArchive
      ? `Unpacked and opened "${loadedMod.summary.name}".`
      : `Opened mod "${loadedMod.summary.name}" in a tab.`
  );
}

function activateTab(tabId) {
  syncEditorIntoState();
  state.activeTab = tabId;
  if (tabId === "home") {
    state.currentLuaFileName = null;
  } else {
    const tab = getActiveTabData();
    state.currentLuaFileName = tab?.luaFiles[0]?.fileName || null;
  }
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
    try {
      await saveTabById(tabId);
    } catch (error) {
      setStatus(error.message, "error");
      return;
    }
  }

  state.openTabs = state.openTabs.filter((tab) => tab.id !== tabId);
  state.dirtyTabs.delete(tabId);
  state.tabUndoHistory.delete(tabId);
  state.tabRedoHistory.delete(tabId);
  if (state.activeTab === tabId) {
    state.activeTab = "home";
    state.currentLuaFileName = null;
  }
  updateDocumentTitle();
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

  const savedMod = await window.modTool.saveMod({
    directoryName: tab.summary.directoryName,
    modJson: tab.modJson,
    luaFiles: tab.luaFiles.map(({ fileName, content }) => ({ fileName, content }))
  });

  const index = state.openTabs.findIndex((openTab) => openTab.id === tab.id);
  state.openTabs[index] = {
    id: tab.id,
    summary: savedMod.summary,
    modJson: savedMod.modJson,
    luaFiles: savedMod.luaFiles.map(prepareLuaFile)
  };
  if (state.activeTab === tab.id) {
    state.currentLuaFileName = savedMod.luaFiles[0]?.fileName || null;
  }
  state.tabUndoHistory.set(tab.id, []);
  state.tabRedoHistory.set(tab.id, []);
  markTabDirty(tab.id, false);
  await refreshMods();
  renderAll();
  setStatus(`Saved mod "${savedMod.summary.name}".`, "success");
}

async function saveCurrentMod() {
  await saveTabById(state.activeTab);
}

async function saveDirtyTabsBeforeClose() {
  const dirtyTabIds = [...state.dirtyTabs];
  for (const tabId of dirtyTabIds) {
    await saveTabById(tabId);
  }
}

function normalizeLuaIdentifier(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "texture";
}

function formatLuaStringArray(values) {
  return values.length ? `{${values.map((value) => `'${value}'`).join(", ")}}` : "{}";
}

function formatColorSlots(colorSlots, colorPalette) {
  return colorSlots.length
    ? `{${colorSlots.map((slot) => `ColorSlot.CreateInstance('${slot}', ColorPaletteManager.GetColorPaletteByName('${colorPalette}'))`).join(", ")}}`
    : "{}";
}

function formatSusModifiers(items) {
  return items.length
    ? `{${items.map(({ area, value }) => `SusModifier.CreateInstance(SusArea.${area}, ${value})`).join(", ")}}`
    : "{}";
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

function renderItemPrefabLua(item, index) {
  const lines = [];
  const itemVar = `itemprefab${index}`;
  const gameVar = `itemgameid${index}`;

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
    lines.push(`\tlocal sd = SlotEquipData.CreateInstance()`);
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
    lines.push(`\treturn sd end)()`);
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
    "-- This script is managed by Juns Mod Tool item list.",
    "-- Edit items in the prefab list to rebuild this file.",
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

function openCreateModal() {
  elements.createModal.classList.remove("hidden");
}

function closeCreateModal() {
  elements.createModal.classList.add("hidden");
}

function generateGuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : ((random & 0x3) | 0x8);
    return value.toString(16);
  });
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

async function boot() {
  populateStaticOptions();
  state.paths = await window.modTool.getPaths();
  renderPaths();
  await refreshMods();
  renderAll();
  setStatus("Workspace loaded.");
}

elements.refreshModsButton.addEventListener("click", async () => {
  await refreshMods();
  renderAll();
  setStatus("Mods list refreshed.");
});

elements.homeReloadButton.addEventListener("click", async () => {
  if (!state.homeSelectedModId) {
    return;
  }
  await refreshMods();
  setStatus("Selected mod summary refreshed.");
});

elements.openSelectedModButton.addEventListener("click", async () => {
  if (!state.homeSelectedModId) {
    setStatus("Select a mod first.", "error");
    return;
  }
  await openModInTab(state.homeSelectedModId);
});

elements.homeOpenFolderButton.addEventListener("click", () => {
  if (!state.paths) {
    return;
  }
  window.modTool.openFolder(state.paths.modsRoot)
    .then(() => setStatus("Opened mods folder."))
    .catch((error) => setStatus(error.message, "error"));
});

elements.packCurrentModButton.addEventListener("click", async () => {
  const tab = getActiveTabData();
  if (!tab) {
    setStatus("Open a mod tab first.", "error");
    return;
  }

  try {
    if (state.dirtyTabs.has(tab.id)) {
      await saveTabById(tab.id);
    }

    const packedMod = await window.modTool.packMod(tab.summary.directoryName);
    const tabIndex = state.openTabs.findIndex((entry) => entry.id === tab.id);
    if (tabIndex !== -1) {
      state.openTabs[tabIndex] = {
        id: tab.id,
        summary: packedMod.summary,
        modJson: packedMod.modJson,
        luaFiles: packedMod.luaFiles.map(prepareLuaFile)
      };
      state.tabUndoHistory.set(tab.id, []);
      state.tabRedoHistory.set(tab.id, []);
    }
    state.currentLuaFileName = packedMod.luaFiles[0]?.fileName || null;
    await refreshMods();
    renderAll();
    setStatus(`Packed mod "${packedMod.summary.name}" into mods/pack.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

elements.showCreateModalButton.addEventListener("click", openCreateModal);
elements.closeCreateModalButton.addEventListener("click", closeCreateModal);
elements.createModal.addEventListener("click", (event) => {
  if (event.target === elements.createModal) {
    closeCreateModal();
  }
});

elements.createModForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.createModForm);

  try {
    const createdMod = await window.modTool.createMod({
      folderName: String(formData.get("folderName") || ""),
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      targetVersion: String(formData.get("targetVersion") || ""),
      mainLuaFile: String(formData.get("mainLuaFile") || "script.lua")
    });

    elements.createModForm.reset();
    elements.createModForm.querySelector('[name="mainLuaFile"]').value = "script.lua";
    closeCreateModal();
    await refreshMods();
    state.homeSelectedModId = createdMod.summary.directoryName;
    await openModInTab(createdMod.summary.directoryName);
    setStatus(`Created mod "${createdMod.summary.name}".`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

elements.saveModButton.addEventListener("click", async () => {
  try {
    await saveCurrentMod();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

elements.reloadCurrentModButton.addEventListener("click", async () => {
  const tab = getActiveTabData();
  if (!tab) {
    return;
  }

  if (state.dirtyTabs.has(tab.id)) {
    const decision = await window.modTool.confirmUnsavedChanges({
      title: "Reload current tab",
      message: `Reload "${tab.summary.name}"?`,
      detail: "Unsaved changes will be lost unless you save them first.",
      saveLabel: "Save and reload",
      cancelLabel: "Cancel",
      discardLabel: "Reload without saving"
    });

    if (decision === "cancel") {
      return;
    }

    if (decision === "save") {
      await saveTabById(tab.id);
    }
  }

  const loadedMod = await window.modTool.loadMod(tab.id);
  const index = state.openTabs.findIndex((openTab) => openTab.id === tab.id);
  state.openTabs[index] = {
    id: tab.id,
    summary: loadedMod.summary,
    modJson: loadedMod.modJson,
    luaFiles: loadedMod.luaFiles.map(prepareLuaFile)
  };
  state.tabUndoHistory.set(tab.id, []);
  state.tabRedoHistory.set(tab.id, []);
  state.currentLuaFileName = loadedMod.luaFiles[0]?.fileName || null;
  markTabDirty(tab.id, false);
  await refreshMods();
  renderAll();
  setStatus(
    loadedMod.unpackedFromArchive
      ? `Unpacked and reloaded "${loadedMod.summary.name}".`
      : `Reloaded mod "${loadedMod.summary.name}".`
  );
});

elements.generateGuidButton.addEventListener("click", () => {
  const tab = getActiveTabData();
  if (!tab) {
    setStatus("Open a mod tab first.", "error");
    return;
  }

  const nextGuid = generateGuid();
  elements.modGuidInput.value = nextGuid;
  syncMetaIntoState();
  renderMetaForm();
  markTabDirty(tab.id, true);
  setStatus("Generated a new mod GUID.", "success");
});

for (const element of [
  elements.modNameInput,
  elements.modDescriptionInput,
  elements.modTargetVersionInput,
  elements.modGuidInput
]) {
  element.addEventListener("input", () => {
    const tab = getActiveTabData();
    if (!tab) {
      return;
    }
    syncMetaIntoState();
    renderMetaForm();
    markTabDirty(tab.id, true);
  });
}

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
    setStatus("Open a mod tab first.", "error");
    return;
  }

  const suggestedName = getNextLuaFileName(tab.luaFiles);
  const fileName = suggestedName;

  if (tab.luaFiles.some((file) => file.fileName === fileName)) {
    setStatus("A Lua file with that name already exists.", "error");
    return;
  }

  pushTabHistory(tab.id);
  tab.luaFiles.push(prepareLuaFile({ fileName, content: "-- New Lua file\n" }));
  state.currentLuaFileName = fileName;
  markTabDirty(tab.id, true);
  renderLuaTabs();
  renderEditor();
  renderItemPrefabList();
  setStatus(`Created Lua file "${fileName}".`, "success");
});

elements.removeLuaFileButton.addEventListener("click", () => {
  const tab = getActiveTabData();
  if (!tab || !state.currentLuaFileName) {
    return;
  }
  if (tab.luaFiles.length === 1) {
    setStatus("A mod should keep at least one Lua file.", "error");
    return;
  }

  pushTabHistory(tab.id);
  tab.luaFiles = tab.luaFiles.filter((file) => file.fileName !== state.currentLuaFileName);
  state.currentLuaFileName = tab.luaFiles[0]?.fileName || null;
  markTabDirty(tab.id, true);
  renderLuaTabs();
  renderEditor();
  renderItemPrefabList();
});

elements.newItemPrefabButton.addEventListener("click", () => {
  const currentFile = getCurrentLuaFile();
  if (!currentFile) {
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
  renderEditor();
  renderItemPrefabList();
  markTabDirty(tab.id, true);
  setStatus(`Saved item "${nextItem.name}" into ${state.currentLuaFileName}.`, "success");
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
  renderEditor();
  renderItemPrefabList();
  markTabDirty(tab.id, true);
  setStatus(`Deleted item "${selectedItem.name}".`, "success");
});

elements.addTextureButton.addEventListener("click", () => {
  const textures = Array.from(elements.texturesContainer.querySelectorAll(".texture-row")).map((row) => ({
    path: row.querySelector(".texture-path").value.trim(),
    targets: splitCsv(row.querySelector(".texture-targets").value)
  }));
  textures.push({ path: "", targets: [] });
  renderTextureRows(textures);
});

window.modTool.onCloseRequested(async () => {
  const dirtyTabs = state.openTabs.filter((tab) => state.dirtyTabs.has(tab.id));
  if (dirtyTabs.length === 0) {
    await window.modTool.finishCloseRequest(true);
    return;
  }

  const decision = await window.modTool.confirmUnsavedChanges({
    title: "Close Juns Mod Tool",
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

window.addEventListener("keydown", (event) => {
  const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z";
  const isRedo = (
    ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y")
    || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z")
  );
  const activeElement = document.activeElement;
  const isTextField = activeElement
    && (
      activeElement.tagName === "INPUT"
      || activeElement.tagName === "TEXTAREA"
      || activeElement.tagName === "SELECT"
      || activeElement.isContentEditable
    );

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

renderTextureRows([
  {
    path: "/Example Folder/tex 1 - doggy.json",
    targets: ["doggy"]
  }
]);

boot().catch((error) => {
  setStatus(error.message, "error");
});
