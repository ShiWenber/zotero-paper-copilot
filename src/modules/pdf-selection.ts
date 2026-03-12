/**
 * Zotero Paper Copilot - PDF Selection Module
 * 
 * Handles PDF text selection in Zotero's internal reader
 * Reference: zotero-gpt, zotero-pdf-translate
 */

import { SidebarUI } from "./sidebar";

export class PDFSelection {
  private static initialized = false;
  
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
   * Set up PDF text selection listener
   */
  private static setupPDFListener(win: Window): void {
    // Method 1: Listen for mouseup events in the document
    // This catches text selection in most contexts
    win.document.addEventListener("mouseup", (event: MouseEvent) => {
      // Delay to ensure selection is complete
      setTimeout(() => {
        this.handleTextSelection(win);
      }, 100);
    });
    
    // Method 2: Listen for Zotero reader events
    this.setupReaderListener(win);
  }
  
  /**
   * Set up Zotero reader-specific listener
   */
  private static setupReaderListener(win: Window): void {
    // Listen for Zotero's reader iframe load
    win.addEventListener("load", () => {
      this.setupIframeListener(win);
    });
    
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
    const iframe = win.document.querySelector("iframe[name='reader']") as HTMLIFrameElement;
    if (!iframe || !iframe.contentWindow) {
      return;
    }
    
    try {
      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        // Listen for mouseup inside iframe
        iframeDoc.addEventListener("mouseup", () => {
          setTimeout(() => {
            this.handleTextSelection(win);
          }, 100);
        });
        
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
    const truncatedText = selectedText.length > 2000 
      ? selectedText.substring(0, 2000) + "..." 
      : selectedText;
    
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Text selected:", truncatedText.substring(0, 50) + "...");
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
        ztoolkit.log("Paper Copilot: Sidebar not open, text selected but not shown");
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
