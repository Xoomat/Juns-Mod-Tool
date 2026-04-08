const API = window.translatorAPI;

let currentMod = null;
let currentFile = null;
let currentTranslationData = null;
let hasUnsavedChanges = false;

const modListEl = document.getElementById("modList");
const editorContainerEl = document.getElementById("editorContainer");
const fileTitleEl = document.getElementById("fileTitle");
const saveBtnEl = document.getElementById("saveBtn");
const newModBtnEl = document.getElementById("newModBtn");
const newModDialogEl = document.getElementById("newModDialog");
const successMessageEl = document.getElementById("successMessage");

newModBtnEl.addEventListener("click", showNewModDialog);
document.getElementById("newModCancel").addEventListener("click", hideNewModDialog);
document.getElementById("newModCreate").addEventListener("click", createNewMod);
document.getElementById("newModInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") createNewMod();
});

saveBtnEl.addEventListener("click", saveTranslation);

loadModList();

async function loadModList() {
  try {
    const mods = await API.listModTranslations();

    modListEl.innerHTML = "";

    if (mods.length === 0) {
      modListEl.innerHTML = '<p class="placeholder">No translations yet</p>';
      return;
    }

    for (const mod of mods) {
      const modItemEl = document.createElement("div");
      modItemEl.className = "mod-item";
      modItemEl.dataset.modName = mod.modName;

      const modNameEl = document.createElement("div");
      modNameEl.className = "mod-name";
      modNameEl.textContent = `[MOD] ${mod.modName}`;
      modNameEl.addEventListener("click", () => toggleModExpanded(modItemEl));

      const filesContainerEl = document.createElement("div");
      filesContainerEl.className = "translation-files";

      for (const file of mod.translationFiles) {
        const fileItemEl = document.createElement("div");
        fileItemEl.className = "file-item";
        fileItemEl.dataset.fileName = file;
        fileItemEl.textContent = `[FILE] ${file}`;
        fileItemEl.addEventListener("click", () =>
          selectTranslationFile(mod.modName, file)
        );

        filesContainerEl.appendChild(fileItemEl);
      }

      modItemEl.appendChild(modNameEl);
      modItemEl.appendChild(filesContainerEl);
      modListEl.appendChild(modItemEl);
    }
  } catch (error) {
    console.error("Failed to load mod list:", error);
    modListEl.innerHTML =
      '<p class="placeholder">Error loading translations</p>';
  }
}

function toggleModExpanded(modItemEl) {
  modItemEl.classList.toggle("expanded");
}

async function selectTranslationFile(modName, fileName) {
  if (hasUnsavedChanges) {
    const confirmed = confirm(
      "You have unsaved changes. Do you want to discard them?"
    );
    if (!confirmed) return;
  }

  try {
    currentMod = modName;
    currentFile = fileName;
    currentTranslationData = await API.loadTranslation(modName, fileName);

    updateModFileSelection();
    renderTranslationEditor();
    hasUnsavedChanges = false;
    saveBtnEl.disabled = true;
  } catch (error) {
    alert(`Failed to load translation: ${error.message}`);
  }
}

function updateModFileSelection() {
  document
    .querySelectorAll(".mod-item")
    .forEach((item) => item.classList.remove("active"));
  document
    .querySelectorAll(".file-item")
    .forEach((item) => item.classList.remove("active"));

  const modItemEl = document.querySelector(
    `.mod-item[data-mod-name="${currentMod}"]`
  );
  if (modItemEl) {
    modItemEl.classList.add("active", "expanded");
    const fileItemEl = modItemEl.querySelector(
      `.file-item[data-file-name="${currentFile}"]`
    );
    if (fileItemEl) {
      fileItemEl.classList.add("active");
    }
  }

  fileTitleEl.textContent = `${currentMod} / ${currentFile}`;
}

function renderTranslationEditor() {
  const rows = currentTranslationData.TranslationRows || [];

  editorContainerEl.innerHTML = "";

  if (rows.length === 0) {
    editorContainerEl.innerHTML =
      '<p class="placeholder">No translation rows found</p>';
    return;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const blockEl = createTranslationBlock(i, row);
    editorContainerEl.appendChild(blockEl);
  }
}

function createTranslationBlock(index, row) {
  const blockEl = document.createElement("div");
  blockEl.className = "translation-block";

  const headerEl = document.createElement("div");
  headerEl.className = "block-header";

  const keyEl = document.createElement("div");
  keyEl.className = "block-key";
  keyEl.textContent = row.Key;

  headerEl.appendChild(keyEl);
  blockEl.appendChild(headerEl);

  const contentEl = document.createElement("div");
  contentEl.className = "block-content";

  if (row.DefaultString) {
    const originalLabelEl = document.createElement("div");
    originalLabelEl.className = "content-label";
    originalLabelEl.textContent = "Original:";

    const originalTextEl = document.createElement("div");
    originalTextEl.className = "content-text";
    originalTextEl.textContent = row.DefaultString;

    contentEl.appendChild(originalLabelEl);
    contentEl.appendChild(originalTextEl);
  }

  const translationLabelEl = document.createElement("div");
  translationLabelEl.className = "content-label";
  translationLabelEl.textContent = "Translation:";

  const translationInputEl = document.createElement("textarea");
  translationInputEl.className = "translation-input";
  translationInputEl.value = row.TranslatedString || "";
  translationInputEl.placeholder =
    "Enter translation here...";

  translationInputEl.addEventListener("input", () => {
    row.TranslatedString = translationInputEl.value;
    markAsUnsaved();
  });

  contentEl.appendChild(translationLabelEl);
  contentEl.appendChild(translationInputEl);

  blockEl.appendChild(contentEl);

  return blockEl;
}

function markAsUnsaved() {
  hasUnsavedChanges = true;
  saveBtnEl.disabled = false;
}

async function saveTranslation() {
  try {
    saveBtnEl.disabled = true;

    await API.saveTranslation(
      currentMod,
      currentFile,
      currentTranslationData
    );

    hasUnsavedChanges = false;
    showSuccessMessage();
  } catch (error) {
    alert(`Failed to save translation: ${error.message}`);
    saveBtnEl.disabled = false;
  }
}

function showSuccessMessage() {
  successMessageEl.classList.remove("hidden");
  setTimeout(() => {
    successMessageEl.classList.add("hidden");
  }, 3000);
}

function showNewModDialog() {
  document.getElementById("newModInput").value = "";
  newModDialogEl.classList.remove("hidden");
  document.getElementById("newModInput").focus();
}

function hideNewModDialog() {
  newModDialogEl.classList.add("hidden");
}

async function createNewMod() {
  const modName = document.getElementById("newModInput").value.trim();

  if (!modName) {
    alert("Please enter a mod name");
    return;
  }

  try {
    await API.createModFolder(modName);
    hideNewModDialog();
    await loadModList();
    showSuccessMessage();
  } catch (error) {
    alert(`Failed to create mod folder: ${error.message}`);
  }
}
