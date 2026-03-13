import {
  BasicExampleFactory,
  HelperExampleFactory,
  KeyExampleFactory,
  PromptExampleFactory,
  UIExampleFactory,
} from "./modules/examples";
import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import { SidebarUI } from "./modules/sidebar";
import { initPDFSelection } from "./modules/pdf-selection";
import { initPDFParsing } from "./modules/pdf-parsing";
import { initTranslationAPI } from "./modules/translation";
import { initSemanticScholarAPI } from "./modules/semantic-scholar";
import { ThemeManager } from "./modules/theme";
import { config } from "../package.json";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  BasicExampleFactory.registerPrefs();

  BasicExampleFactory.registerNotifier();

  KeyExampleFactory.registerShortcuts();

  await UIExampleFactory.registerExtraColumn();

  await UIExampleFactory.registerExtraColumnWithCustomCell();

  UIExampleFactory.registerItemPaneCustomInfoRow();

  UIExampleFactory.registerItemPaneSection();

  UIExampleFactory.registerReaderItemPaneSection();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  // Show startup progress
  const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: 3000,
  })
    .createLine({
      text: getString("startup-begin"),
      type: "default",
      progress: 50,
    })
    .show();

  UIExampleFactory.registerStyleSheet(win);

  UIExampleFactory.registerRightClickMenuItem();

  UIExampleFactory.registerRightClickMenuPopup(win);

  UIExampleFactory.registerWindowMenuWithSeparator();

  PromptExampleFactory.registerNormalCommandExample();

  PromptExampleFactory.registerAnonymousCommandExample(win);

  PromptExampleFactory.registerConditionalCommandExample();

  popupWin.changeLine({
    progress: 100,
    text: getString("startup-finish"),
  });
  popupWin.startCloseTimer(3000);

  // Register Paper Copilot Sidebar
  SidebarUI.create(win);

  // Initialize theme manager
  ThemeManager.init();

  // Register theme stylesheet
  registerThemeStylesheet(win);

  // Initialize PDF text selection listener
  initPDFSelection(win);

  // Initialize PDF parsing module
  initPDFParsing(win);

  // Initialize Translation API
  initTranslationAPI();

  // Initialize Semantic Scholar API
  initSemanticScholarAPI();

  // Add menu item to toggle sidebar
  const menuItem = win.document.createElement("menuitem");
  menuItem.setAttribute("label", "Toggle Paper Copilot");
  menuItem.setAttribute("id", "paper-copilot-menu-item");
  menuItem.addEventListener("command", () => {
    SidebarUI.toggle(win);
  });

  // Add to tools menu
  const toolsMenu = win.document.querySelector("#menu_ToolsPopup");
  if (toolsMenu) {
    toolsMenu.appendChild(menuItem);
  }

  addon.hooks.onDialogEvents("dialogExample");
}

/**
 * Register theme stylesheet
 */
function registerThemeStylesheet(win: _ZoteroTypes.MainWindow): void {
  const doc = win.document;
  const styleId = "pc-theme-css";

  // Check if already loaded
  if (doc.getElementById(styleId)) {
    return;
  }

  // Create link element for theme CSS
  const styles = ztoolkit.UI.createElement(doc, "link", {
    id: styleId,
    properties: {
      type: "text/css",
      rel: "stylesheet",
      href: `chrome://${config.addonRef}/content/styles/theme.css`,
    },
  });
  doc.documentElement?.appendChild(styles);

  if (typeof ztoolkit !== "undefined") {
    ztoolkit.log("Paper Copilot: Theme stylesheet registered");
  }
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
  SidebarUI.remove();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  SidebarUI.remove();
  addon.data.dialog?.window?.close();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * This function is just an example of dispatcher for Notify events.
 * Any operations should be placed in a function to keep this funcion clear.
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  // You can add your code to the corresponding notify type
  ztoolkit.log("notify", event, type, ids, extraData);
  if (
    event == "select" &&
    type == "tab" &&
    extraData[ids[0]].type == "reader"
  ) {
    BasicExampleFactory.exampleNotifierCallback();
  } else {
    return;
  }
}

/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

function onShortcuts(type: string) {
  switch (type) {
    case "larger":
      KeyExampleFactory.exampleShortcutLargerCallback();
      break;
    case "smaller":
      KeyExampleFactory.exampleShortcutSmallerCallback();
      break;
    default:
      break;
  }
}

function onDialogEvents(type: string) {
  switch (type) {
    case "dialogExample":
      HelperExampleFactory.dialogExample();
      break;
    case "clipboardExample":
      HelperExampleFactory.clipboardExample();
      break;
    case "filePickerExample":
      HelperExampleFactory.filePickerExample();
      break;
    case "progressWindowExample":
      HelperExampleFactory.progressWindowExample();
      break;
    case "vtableExample":
      HelperExampleFactory.vtableExample();
      break;
    default:
      break;
  }
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};
