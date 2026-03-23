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

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  // Initialize ztoolkit BEFORE calling any example factories
  // because they use ztoolkit internally
  addon.data.ztoolkit = createZToolkit();

  try {
    initLocale();
  } catch (e) {
    ztoolkit.log("Failed to init locale:", e);
  }

  try {
    BasicExampleFactory.registerPrefs();
  } catch (e) {
    ztoolkit.log("Failed to register prefs:", e);
  }

  try {
    BasicExampleFactory.registerNotifier();
  } catch (e) {
    ztoolkit.log("Failed to register notifier:", e);
  }

  try {
    KeyExampleFactory.registerShortcuts();
  } catch (e) {
    ztoolkit.log("Failed to register shortcuts:", e);
  }

  try {
    await UIExampleFactory.registerExtraColumn();
  } catch (e) {
    ztoolkit.log("Failed to register extra column:", e);
  }

  try {
    await UIExampleFactory.registerExtraColumnWithCustomCell();
  } catch (e) {
    ztoolkit.log("Failed to register extra column with custom cell:", e);
  }

  try {
    UIExampleFactory.registerItemPaneCustomInfoRow();
  } catch (e) {
    ztoolkit.log("Failed to register item pane custom info row:", e);
  }

  try {
    UIExampleFactory.registerItemPaneSection();
  } catch (e) {
    ztoolkit.log("Failed to register item pane section:", e);
  }

  try {
    UIExampleFactory.registerReaderItemPaneSection();
  } catch (e) {
    ztoolkit.log("Failed to register reader item pane section:", e);
  }

  try {
    await Promise.all(
      Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
    );
  } catch (e) {
    ztoolkit.log("Failed in onMainWindowLoad:", e);
  }

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

  const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: -1,
  })
    .createLine({
      text: getString("startup-begin"),
      type: "default",
      progress: 0,
    })
    .show();

  await Zotero.Promise.delay(1000);
  popupWin.changeLine({
    progress: 30,
    text: `[30%] ${getString("startup-begin")}`,
  });

  // Register UI examples - wrap in try-catch to not block startup
  try {
    UIExampleFactory.registerStyleSheet(win);
  } catch (e) {
    console.error("Failed to register stylesheet:", e);
  }

  try {
    UIExampleFactory.registerRightClickMenuItem(win);
  } catch (e) {
    console.error("Failed to register right click menu item:", e);
  }

  try {
    UIExampleFactory.registerRightClickMenuPopup(win);
  } catch (e) {
    console.error("Failed to register right click menu popup:", e);
  }

  try {
    UIExampleFactory.registerWindowMenuWithSeparator(win);
  } catch (e) {
    console.error("Failed to register window menu:", e);
  }

  try {
    PromptExampleFactory.registerNormalCommandExample();
  } catch (e) {
    console.error("Failed to register normal command:", e);
  }

  try {
    PromptExampleFactory.registerAnonymousCommandExample(win);
  } catch (e) {
    console.error("Failed to register anonymous command:", e);
  }

  try {
    PromptExampleFactory.registerConditionalCommandExample();
  } catch (e) {
    console.error("Failed to register conditional command:", e);
  }

  await Zotero.Promise.delay(1000);

  popupWin.changeLine({
    progress: 100,
    text: `[100%] ${getString("startup-finish")}`,
  });
  popupWin.startCloseTimer(5000);

  // Register Paper Copilot Sidebar and menu item - wrap in try-catch to ensure menu is added
  try {
    SidebarUI.create(win);
  } catch (e) {
    console.error("Failed to create sidebar:", e);
  }

  try {
    initPDFSelection(win);
  } catch (e) {
    console.error("Failed to init PDF selection:", e);
  }

  // Add menu item to toggle sidebar - this must not fail
  try {
    const menuItem = win.document.createElement("menuitem");
    menuItem.setAttribute("label", "Toggle Paper Copilot");
    menuItem.setAttribute("id", "paper-copilot-menu-item");
    menuItem.addEventListener("command", () => {
      SidebarUI.toggle(win);
    });

    const toolsMenu = win.document.querySelector("#menu_ToolsPopup");
    if (toolsMenu) {
      toolsMenu.appendChild(menuItem);
      console.log("Paper Copilot menu item added to Tools menu");
    } else {
      console.error("Tools menu not found!");
    }
  } catch (e) {
    console.error("Failed to add menu item:", e);
  }

  try {
    addon.hooks.onDialogEvents("dialogExample");
  } catch (e) {
    console.error("Failed to trigger dialog events:", e);
  }
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
  SidebarUI.remove(win);
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  // Get the first main window to remove sidebar
  const win = Zotero.getMainWindows()[0];
  if (win) {
    SidebarUI.remove(win);
  }
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
