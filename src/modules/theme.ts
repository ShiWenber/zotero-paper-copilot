/**
 * Zotero Paper Copilot - Theme Manager
 *
 * Handles theme switching, persistence, and system preference detection
 */

import { getPref, setPref } from "../utils/prefs";

export type ThemeMode = "light" | "dark" | "system";

export class ThemeManager {
  private static currentTheme: ThemeMode = "system";
  private static listeners: Set<(theme: ThemeMode) => void> = new Set();
  private static initialized = false;

  /**
   * Initialize theme based on saved preference or system preference
   */
  public static init(win?: Window): void {
    // Avoid re-initializing
    if (this.initialized) return;
    this.initialized = true;

    // Get saved theme preference
    const savedTheme = getPref("theme") as ThemeMode | undefined;
    this.currentTheme = savedTheme || "system";

    // Apply theme immediately
    this.applyTheme(this.currentTheme, win);

    // Listen for system theme changes
    this.setupSystemThemeListener(win);

    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log(
        "Paper Copilot: Theme initialized with mode:",
        this.currentTheme,
      );
    }
  }

  /**
   * Get current theme mode
   */
  public static getTheme(): ThemeMode {
    return this.currentTheme;
  }

  /**
   * Set theme mode and persist
   */
  public static setTheme(mode: ThemeMode, win?: Window): void {
    this.currentTheme = mode;
    this.applyTheme(mode, win);
    setPref("theme", mode);
    this.notifyListeners(mode);

    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Theme changed to:", mode);
    }
  }

  /**
   * Toggle between light and dark (ignoring system)
   */
  public static toggleTheme(win?: Window): void {
    const actualTheme = this.getActualTheme();
    const newTheme = actualTheme === "dark" ? "light" : "dark";
    this.setTheme(newTheme, win);
  }

  /**
   * Get actual applied theme (resolves "system" to actual value)
   */
  public static getActualTheme(): "light" | "dark" {
    if (this.currentTheme === "system") {
      return this.getSystemTheme();
    }
    return this.currentTheme;
  }

  /**
   * Apply theme to document
   */
  private static applyTheme(mode: ThemeMode, win?: Window): void {
    const actualTheme = mode === "system" ? this.getSystemTheme() : mode;
    const targetDoc =
      win?.document || (typeof document !== "undefined" ? document : null);

    if (!targetDoc) return;

    // Find or create style element
    let styleEl = targetDoc.getElementById("pc-theme-styles");
    if (!styleEl) {
      styleEl = targetDoc.createElement("style");
      styleEl.id = "pc-theme-styles";
      targetDoc.head.appendChild(styleEl);
    }

    // Inject theme attribute
    targetDoc.documentElement.setAttribute("data-theme", actualTheme);

    // Add theme-specific class to body
    targetDoc.body?.classList.add(`pc-theme-${actualTheme}`);
    targetDoc.body?.classList.remove(`pc-theme-light`, `pc-theme-dark`);
  }

  /**
   * Get system theme preference
   */
  private static getSystemTheme(): "light" | "dark" {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  }

  /**
   * Listen for system theme changes
   */
  private static setupSystemThemeListener(win?: Window): void {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", () => {
        if (this.currentTheme === "system") {
          this.applyTheme("system", win);
        }
      });
    }
  }

  /**
   * Register theme change listener
   */
  public static onThemeChange(
    callback: (theme: ThemeMode) => void,
  ): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of theme change
   */
  private static notifyListeners(theme: ThemeMode): void {
    this.listeners.forEach((callback) => callback(theme));
  }

  /**
   * Create theme toggle button HTML
   */
  public static createThemeToggleHTML(): string {
    const actualTheme = this.getActualTheme();
    const icon = actualTheme === "dark" ? "☀️" : "🌙";
    const label = actualTheme === "dark" ? "Light Mode" : "Dark Mode";

    return `
      <button 
        id="pc-theme-toggle" 
        class="pc-tooltip pc-button pc-button-ghost pc-button-icon" 
        data-tooltip="Toggle ${label}"
        aria-label="Toggle theme"
        style="padding: 6px 8px; font-size: 16px;"
      >
        ${icon}
      </button>
    `;
  }

  /**
   * Attach theme toggle event listener
   */
  public static attachThemeToggleListener(win: Window): void {
    const toggleBtn = win.document.getElementById("pc-theme-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.toggleTheme(win);
        // Update button appearance
        const actualTheme = this.getActualTheme();
        toggleBtn.innerHTML = actualTheme === "dark" ? "☀️" : "🌙";
        toggleBtn.setAttribute(
          "data-tooltip",
          `Toggle ${actualTheme === "dark" ? "Light" : "Dark"} Mode`,
        );
      });
    }
  }
}
