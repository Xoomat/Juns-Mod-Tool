// Internationalization (i18n) Module
const translations = {
  en: {
    // Top bar
    topbar_title: "Jun's Mod Tool",
    topbar_refresh: "Refresh List",
    topbar_save: "Save Current Tab",
    topbar_back: "Back",
    
    // Sidebar
    mod_explorer: "MOD EXPLORER",
    explorer: "EXPLORER",
    
    // Home view
    home_title: "Mods",
    home_open: "Open Mod",
    home_create: "Create Mod",
    home_description: "Mod Description",
    home_reload: "Reload Mod",
    home_folder: "Mods Folder",
    home_list_title: "Mods List",
    
    // Editor tabs
    tab_info: "Information",
    tab_lua: "Lua",
    tab_items: "Items",
    tab_workspace: "Workspace",
    tab_status: "Status",
    tab_settings: "Settings",
    
    // Editor view
    editor_no_tab: "No Tab",
    editor_no_mod: "Open a mod from Home.",
    editor_pack: "Pack Current",
    editor_reload: "Reload Tab",
    
    // Mod form
    form_name: "Name",
    form_desc: "Description",
    form_version: "Target version",
    form_folder: "Folder",
    form_status: "Status",
    form_guid: "GUID",
    form_new_guid: "New GUID",
    
    // Item editor
    item_new: "New Item",
    item_save: "Save Item",
    item_delete: "Delete Item",
    item_back: "Back to List",
    item_title: "Item List",
    
    // Lua editor
    lua_add_file: "Add Lua File",
    lua_remove_file: "Remove Lua File",
    
    // Settings
    settings_title: "Settings",
    settings_language: "Language",
    settings_autosave: "Auto-save",
    settings_autosave_hint: "(Saves every 5 minutes)",
    settings_save: "Save",
    settings_close: "Close",
    settings_language_en: "English",
    settings_language_ru: "Русский",
    
    // Status messages
    status_success: "Operation completed successfully",
    status_error: "An error occurred",
    status_loading: "Loading...",
    status_saved: "Changes saved",
    
    // Context menu
    context_edit: "Edit",
    context_duplicate: "Duplicate",
    context_delete: "Delete",
    
    // Validation
    validate_required: "This field is required",
    validate_invalid: "Invalid value",
  },
  
  ru: {
    // Топ-бар
    topbar_title: "Инструмент модов Июня",
    topbar_refresh: "Обновить список",
    topbar_save: "Сохранить текущую вкладку",
    topbar_back: "Назад",
    
    // Боковая панель
    mod_explorer: "РЕДАКТОР МОД",
    explorer: "ОБОЗРЕВАТЕЛЬ",
    
    // Главный вид
    home_title: "Моды",
    home_open: "Открыть мод",
    home_create: "Создать мод",
    home_description: "Описание мода",
    home_reload: "Перезагрузить мод",
    home_folder: "Папка модов",
    home_list_title: "Список модов",
    
    // Вкладки редактора
    tab_info: "Информация",
    tab_lua: "Lua",
    tab_items: "Предметы",
    tab_workspace: "Рабочее пространство",
    tab_status: "Статус",    tab_settings: "Настройки",    
    // Вид редактора
    editor_no_tab: "Нет вкладки",
    editor_no_mod: "Откройте мод с главной страницы.",
    editor_pack: "Упаковать текущий",
    editor_reload: "Перезагрузить вкладку",
    
    // Форма мода
    form_name: "Название",
    form_desc: "Описание",
    form_version: "Целевая версия",
    form_folder: "Папка",
    form_status: "Статус",
    form_guid: "GUID",
    form_new_guid: "Новый GUID",
    
    // Редактор предметов
    item_new: "Новый предмет",
    item_save: "Сохранить предмет",
    item_delete: "Удалить предмет",
    item_back: "Вернуться к списку",
    item_title: "Список предметов",
    
    // Редактор Lua
    lua_add_file: "Добавить файл Lua",
    lua_remove_file: "Удалить файл Lua",
    
    // Настройки
    settings_title: "Настройки",
    settings_language: "Язык",
    settings_autosave: "Автосохранение",
    settings_autosave_hint: "(Сохраняет каждые 5 минут)",
    settings_save: "Сохранить",
    settings_close: "Закрыть",
    settings_language_en: "English",
    settings_language_ru: "Русский",
    
    // Сообщения статуса
    status_success: "Операция выполнена успешно",
    status_error: "Произошла ошибка",
    status_loading: "Загрузка...",
    status_saved: "Изменения сохранены",
    
    // Контекстное меню
    context_edit: "Редактировать",
    context_duplicate: "Дублировать",
    context_delete: "Удалить",
    
    // Валидация
    validate_required: "Это поле обязательно",
    validate_invalid: "Неверное значение",
  }
};

let currentLanguage = 'en';

// Load language from settings
async function initializeLanguage() {
  try {
    const settings = await window.electronAPI?.readSettings?.();
    if (settings?.language) {
      currentLanguage = settings.language;
    }
  } catch (e) {
    console.log('Could not load settings, using default language');
  }
}

function t(key) {
  const lang = translations[currentLanguage] || translations['en'];
  return lang[key] || key;
}

function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    return true;
  }
  return false;
}

function getLanguage() {
  return currentLanguage;
}

function translateElement(element) {
  if (element.dataset.i18n) {
    element.textContent = t(element.dataset.i18n);
  }
  
  if (element.dataset.i18nTitle) {
    element.title = t(element.dataset.i18nTitle);
  }
  
  if (element.dataset.i18nPlaceholder) {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  }
}

function translatePage() {
  document.querySelectorAll('[data-i18n], [data-i18n-title], [data-i18n-placeholder]').forEach(translateElement);
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initializeLanguage, t, setLanguage, getLanguage, translatePage, translateElement };
}
