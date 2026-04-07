/**
 * Zotero Paper Copilot - PDF Selection Module
 *
 * Handles PDF text selection in Zotero's internal reader
 * Reference: zotero-gpt, zotero-pdf-translate
 */

import { SidebarUI } from "./sidebar";

export class PDFSelection {
  private static initialized = false;
  
  // Event listener tracking for cleanup
  private static registeredListeners: Map<EventTarget, Map<string, EventListenerOrEventListenerObject[]>> = new Map();
  private static listenerCount = 0;

  /**
   * Initialize PDF selection listener
   */
  public static init(win: Window): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    // Wait for Zotero reader to be ready
    this.setupPDFListener(win);

    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: PDF selection listener initialized");
    }
  }

  /**
   * Add event listener with tracking for cleanup
   */
  private static addTrackedListener(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    
    // Track the listener
    if (!this.registeredListeners.has(target)) {
      this.registeredListeners.set(target, new Map());
    }
    const targetListeners = this.registeredListeners.get(target)!;
    const key = `${type}_${this.listenerCount++}`;
    targetListeners.set(key, [handler]);
  }

  /**
   * Remove tracked event listener
   */
  private static removeTrackedListener(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: EventListenerOptions,
  ): void {
    target.removeEventListener(type, handler, options);
    
    // Remove from tracking
    const targetListeners = this.registeredListeners.get(target);
    if (targetListeners) {
      for (const [key, handlers] of targetListeners.entries()) {
        if (handlers.includes(handler)) {
          targetListeners.delete(key);
          break;
        }
      }
    }
  }

  /**
   * Clean up all tracked event listeners
   */
  public static cleanup(): void {
    for (const [target, listeners] of this.registeredListeners.entries()) {
      for (const [key, handlers] of listeners.entries()) {
        for (const handler of handlers) {
          // Extract event type from key (format: "type_number")
          const eventType = key.split('_')[0];
          target.removeEventListener(eventType, handler);
        }
      }
    }
    this.registeredListeners.clear();
    this.initialized = false;
    
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: PDF selection event listeners cleaned up");
    }
  }

  /**
   * Set up PDF text selection listener
   */
  private static setupPDFListener(win: Window): void {
    // Method 1: Listen for mouseup events in the document
    // This catches text selection in most contexts
    const mouseupHandler = (event: MouseEvent) => {
      // Delay to ensure selection is complete
      setTimeout(() => {
        this.handleTextSelection(win);
      }, 100);
    };
    this.addTrackedListener(win.document, "mouseup", mouseupHandler);

    // Method 2: Listen for Zotero reader events
    this.setupReaderListener(win);
  }

  /**
   * Set up Zotero reader-specific listener
   */
  private static setupReaderListener(win: Window): void {
    // Listen for Zotero's reader iframe load
    const loadHandler = () => {
      this.setupIframeListener(win);
    };
    this.addTrackedListener(win, "load", loadHandler);

    // Try immediately in case iframe is already loaded
    setTimeout(() => {
      this.setupIframeListener(win);
    }, 2000);
  }

  /**
   * Set up listener inside PDF reader iframe
   */
  private static setupIframeListener(win: Window): void {
    // Find the PDF viewer iframe
    const iframe = win.document.querySelector(
      "iframe[name='reader']",
    ) as HTMLIFrameElement;
    if (!iframe || !iframe.contentWindow) {
      return;
    }

    try {
      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        // Listen for mouseup inside iframe
        const iframeMouseupHandler = () => {
          setTimeout(() => {
            this.handleTextSelection(win);
          }, 100);
        };
        this.addTrackedListener(iframeDoc, "mouseup", iframeMouseupHandler);

        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log("Paper Copilot: PDF iframe listener set up");
        }
      }
    } catch (e) {
      // Cross-origin restrictions may prevent access
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Cannot access iframe (cross-origin):", e);
      }
    }
  }

  /**
   * Handle text selection
   */
  private static handleTextSelection(win: Window): void {
    const selection = win.getSelection();
    if (!selection) {
      return;
    }

    const selectedText = selection.toString().trim();

    // Only process if there's meaningful text selected
    if (selectedText.length < 2) {
      return;
    }

    // Limit text length for API calls
    const truncatedText =
      selectedText.length > 2000
        ? selectedText.substring(0, 2000) + "..."
        : selectedText;

    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log(
        "Paper Copilot: Text selected:",
        truncatedText.substring(0, 50) + "...",
      );
    }

    // Show selected text in sidebar
    this.showInSidebar(win, truncatedText);
  }

  /**
   * Show selected text in sidebar
   */
  private static showInSidebar(win: Window, text: string): void {
    // Check if sidebar exists
    const sidebar = win.document.getElementById("zotero-paper-copilot-sidebar");
    if (!sidebar) {
      // Sidebar not open, could auto-open or show notification
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log(
          "Paper Copilot: Sidebar not open, text selected but not shown",
        );
      }
      return;
    }

    // Use sidebar's message method
    SidebarUI.showSelectedText(win, text);
  }

  /**
   * Get current PDF item information
   */
  public static async getCurrentItem(win: Window): Promise<any> {
    try {
      // Zotero API to get current item
      const pane = win.Zotero.getActiveZoteroPane?.();
      if (pane) {
        const items = pane.getSelectedItems?.();
        if (items && items.length > 0) {
          return items[0];
        }
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error getting current item:", e);
      }
    }
    return null;
  }

  /**
   * Extract more context from PDF (page number, etc.)
   */
  public static async getSelectionContext(win: Window): Promise<any> {
    const context: any = {
      timestamp: new Date().toISOString(),
    };

    try {
      // Try to get page number from Zotero reader
      const reader = win.document.querySelector("[id*='pdf-viewer']");
      if (reader) {
        // Zotero 7+ PDF viewer
        context.viewerType = "pdf-viewer";
      }
    } catch (e) {
      // Ignore
    }

    return context;
  }
}

/**
 * Initialize PDF selection when Zotero is ready
 */
export function initPDFSelection(win: Window): void {
  // Wait a bit for Zotero UI to fully load
  setTimeout(() => {
    PDFSelection.init(win);
  }, 3000);
}
