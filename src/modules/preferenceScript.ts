import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";

export async function registerPrefsScripts(_window: Window) {
  // This function is called when the prefs window is opened
  // See addon/content/preferences.xhtml onpaneload
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
      columns: [
        {
          dataKey: "title",
          label: getString("prefs-table-title"),
          fixedWidth: true,
          width: 100,
        },
        {
          dataKey: "detail",
          label: getString("prefs-table-detail"),
        },
      ],
      rows: [
        {
          title: "Orange",
          detail: "It's juicy",
        },
        {
          title: "Banana",
          detail: "It's sweet",
        },
        {
          title: "Apple",
          detail: "I mean the fruit APPLE",
        },
      ],
    };
  } else {
    addon.data.prefs.window = _window;
  }
  updatePrefsUI();
  bindPrefEvents();
  setupEnhancedPrefsUI();
}

async function updatePrefsUI() {
  // You can initialize some UI elements on prefs window
  // with addon.data.prefs.window.document
  // Or bind some events to the elements
  const renderLock = ztoolkit.getGlobal("Zotero").Promise.defer();
  if (addon.data.prefs?.window == undefined) return;
  const tableHelper = new ztoolkit.VirtualizedTable(addon.data.prefs?.window)
    .setContainerId(`${config.addonRef}-table-container`)
    .setProp({
      id: `${config.addonRef}-prefs-table`,
      // Do not use setLocale, as it modifies the Zotero.Intl.strings
      // Set locales directly to columns
      columns: addon.data.prefs?.columns,
      showHeader: true,
      multiSelect: true,
      staticColumns: true,
      disableFontSizeScaling: true,
    })
    .setProp("getRowCount", () => addon.data.prefs?.rows.length || 0)
    .setProp(
      "getRowData",
      (index) =>
        addon.data.prefs?.rows[index] || {
          title: "no data",
          detail: "no data",
        },
    )
    // Show a progress window when selection changes
    .setProp("onSelectionChange", (selection) => {
      new ztoolkit.ProgressWindow(config.addonName)
        .createLine({
          text: `Selected line: ${addon.data.prefs?.rows
            .filter((v, i) => selection.isSelected(i))
            .map((row) => row.title)
            .join(",")}`,
          progress: 100,
        })
        .show();
    })
    // When pressing delete, delete selected line and refresh table.
    // Returning false to prevent default event.
    .setProp("onKeyDown", (event: KeyboardEvent) => {
      if (event.key == "Delete" || (Zotero.isMac && event.key == "Backspace")) {
        addon.data.prefs!.rows =
          addon.data.prefs?.rows.filter(
            (v, i) => !tableHelper.treeInstance.selection.isSelected(i),
          ) || [];
        tableHelper.render();
        return false;
      }
      return true;
    })
    // For find-as-you-type
    .setProp(
      "getRowString",
      (index) => addon.data.prefs?.rows[index].title || "",
    )
    // Render the table.
    .render(-1, () => {
      renderLock.resolve();
    });
  await renderLock.promise;
  ztoolkit.log("Preference table rendered!");
}

function bindPrefEvents() {
  addon.data
    .prefs!.window.document?.querySelector(
      `#zotero-prefpane-${config.addonRef}-enable`,
    )
    ?.addEventListener("command", (e: Event) => {
      ztoolkit.log(e);
      addon.data.prefs!.window.alert(
        `Successfully changed to ${(e.target as XUL.Checkbox).checked}!`,
      );
    });

  addon.data
    .prefs!.window.document?.querySelector(
      `#zotero-prefpane-${config.addonRef}-input`,
    )
    ?.addEventListener("change", (e: Event) => {
      ztoolkit.log(e);
      addon.data.prefs!.window.alert(
        `Successfully changed to ${(e.target as HTMLInputElement).value}!`,
      );
    });
}

/**
 * Set up enhanced preferences UI with theme and other options
 */
function setupEnhancedPrefsUI() {
  const doc = addon.data.prefs?.window.document;
  if (!doc) return;

  // Add enhanced settings section
  const prefsContainer = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-table-container`,
  )?.parentElement;

  if (prefsContainer) {
    // Create enhanced settings section
    const enhancedSection = doc.createElement("div");
    enhancedSection.id = `${config.addonRef}-enhanced-settings`;
    enhancedSection.style.cssText = `
      padding: 16px;
      margin-top: 16px;
      background: var(--pc-bg-secondary, #f5f5f5);
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;

    // Theme settings
    const themeLabel = doc.createElement("div");
    themeLabel.style.cssText = `
      font-weight: 600;
      margin-bottom: 12px;
      font-size: 14px;
      color: var(--pc-text-primary, #333);
    `;
    themeLabel.textContent = "🎨 Theme Settings";

    const themeOptions = doc.createElement("div");
    themeOptions.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    `;

    const currentTheme = getPref("theme") || "system";

    // Light theme option
    const lightBtn = doc.createElement("button");
    lightBtn.textContent = "☀️ Light";
    lightBtn.className = `pc-button ${currentTheme === "light" ? "pc-button-primary" : "pc-button-ghost"}`;
    lightBtn.style.cssText = "flex: 1;";
    lightBtn.addEventListener("click", () => {
      setPref("theme", "light");
      updateThemeButtons(themeOptions, "light");
    });

    // Dark theme option
    const darkBtn = doc.createElement("button");
    darkBtn.textContent = "🌙 Dark";
    darkBtn.className = `pc-button ${currentTheme === "dark" ? "pc-button-primary" : "pc-button-ghost"}`;
    darkBtn.style.cssText = "flex: 1;";
    darkBtn.addEventListener("click", () => {
      setPref("theme", "dark");
      updateThemeButtons(themeOptions, "dark");
    });

    // System theme option
    const systemBtn = doc.createElement("button");
    systemBtn.textContent = "💻 System";
    systemBtn.className = `pc-button ${currentTheme === "system" ? "pc-button-primary" : "pc-button-ghost"}`;
    systemBtn.style.cssText = "flex: 1;";
    systemBtn.addEventListener("click", () => {
      setPref("theme", "system");
      updateThemeButtons(themeOptions, "system");
    });

    themeOptions.appendChild(lightBtn);
    themeOptions.appendChild(darkBtn);
    themeOptions.appendChild(systemBtn);

    // Keyboard shortcuts section
    const shortcutsLabel = doc.createElement("div");
    shortcutsLabel.style.cssText = `
      font-weight: 600;
      margin-bottom: 12px;
      font-size: 14px;
      color: var(--pc-text-primary, #333);
    `;
    shortcutsLabel.textContent = "⌨️ Keyboard Shortcuts";

    const shortcutsList = doc.createElement("div");
    shortcutsList.style.cssText = `
      background: white;
      padding: 12px;
      border-radius: 6px;
      font-size: 13px;
    `;
    shortcutsList.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>Toggle Sidebar</span>
        <span style="background: #eee; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Alt+L</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>Ask About Selection</span>
        <span style="background: #eee; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Ctrl+Enter</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Close Sidebar</span>
        <span style="background: #eee; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Escape</span>
      </div>
    `;

    // Reset onboarding button
    const resetLabel = doc.createElement("div");
    resetLabel.style.cssText = `
      font-weight: 600;
      margin: 16px 0 12px 0;
      font-size: 14px;
      color: var(--pc-text-primary, #333);
    `;
    resetLabel.textContent = "🔄 Onboarding";

    const resetBtn = doc.createElement("button");
    resetBtn.textContent = "Restart Onboarding Tour";
    resetBtn.className = "pc-button pc-button-ghost";
    resetBtn.style.cssText = "width: 100%;";
    resetBtn.addEventListener("click", () => {
      setPref("onboardingComplete", false);
      new ztoolkit.ProgressWindow(config.addonName)
        .createLine({
          text: "Onboarding has been reset. Reopen the sidebar to start the tour.",
          type: "success",
          progress: 100,
        })
        .show();
    });

    // Assemble
    enhancedSection.appendChild(themeLabel);
    enhancedSection.appendChild(themeOptions);
    enhancedSection.appendChild(shortcutsLabel);
    enhancedSection.appendChild(shortcutsList);
    enhancedSection.appendChild(resetLabel);
    enhancedSection.appendChild(resetBtn);

    // Insert after the existing content
    const groupbox = doc.querySelector("groupbox");
    if (groupbox) {
      groupbox.appendChild(enhancedSection);
    }
  }

  ztoolkit.log("Enhanced preferences UI initialized");
}

/**
 * Update theme button styles
 */
function updateThemeButtons(container: HTMLElement, selected: string) {
  const buttons = container.querySelectorAll("button");
  buttons.forEach((btn) => {
    const text = btn.textContent?.toLowerCase() || "";
    if (text.includes(selected)) {
      btn.className = "pc-button pc-button-primary";
      btn.style.flex = "1";
    } else {
      btn.className = "pc-button pc-button-ghost";
      btn.style.flex = "1";
    }
  });
}
