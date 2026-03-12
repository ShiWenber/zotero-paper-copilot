/**
 * Zotero Paper Copilot - Sidebar UI Module
 */

// ztoolkit is a global variable defined in src/index.ts

export class SidebarUI {
  private static sidebarId = "zotero-paper-copilot-sidebar";
  private static sidebarWidth = 400;
  
  public static create(win: Window): void {
    this.remove();
    
    const sidebar = win.document.createElement("div");
    sidebar.id = this.sidebarId;
    sidebar.setAttribute("style", 
      "position: fixed; right: 0; top: 0; width: " + this.sidebarWidth + 
      "px; height: 100vh; background: #ffffff; box-shadow: -2px 0 10px rgba(0,0,0,0.15); z-index: 9999; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, sans-serif;"
    );
    
    // Header
    const header = win.document.createElement("div");
    header.setAttribute("style", "padding: 16px; border-bottom: 1px solid #e0e0e0; background: #f5f5f5; display: flex; align-items: center; justify-content: space-between;");
    header.innerHTML = 
      '<div style="font-size: 16px; font-weight: 600; color: #333;">📄 Paper Copilot</div>' +
      '<button id="sidebar-close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; padding: 4px 8px; color: #666;">×</button>';
    
    // Content area
    const content = win.document.createElement("div");
    content.setAttribute("style", "flex: 1; overflow-y: auto; padding: 16px;");
    content.innerHTML = 
      '<div style="text-align: center; padding: 40px 20px; color: #666;">' +
      '<div style="font-size: 48px; margin-bottom: 16px;">🤖</div>' +
      '<div style="font-size: 16px; margin-bottom: 8px;">Welcome to Paper Copilot</div>' +
      '<div style="font-size: 14px; color: #999;">Select text in a PDF to ask questions<br>or get translations.</div>' +
      '</div>' +
      '<div style="margin-top: 20px; padding: 16px; background: #f0f7ff; border-radius: 8px;">' +
      '<div style="font-size: 14px; font-weight: 600; color: #0066cc; margin-bottom: 8px;">💡 Quick Tips</div>' +
      '<ul style="font-size: 13px; color: #555; padding-left: 20px; margin: 0;">' +
      '<li>Select any text in the PDF to get AI explanations</li>' +
      '<li>Click the summarize button to get paper summary</li>' +
      '<li>Use translate for instant translations</li>' +
      '</ul></div>';
    
    // Footer
    const footer = win.document.createElement("div");
    footer.setAttribute("style", "padding: 12px 16px; border-top: 1px solid #e0e0e0; background: #f9f9f9;");
    footer.innerHTML = 
      '<div style="display: flex; gap: 8px;">' +
      '<button id="btn-summarize" style="flex: 1; padding: 10px 16px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">📝 Summarize</button>' +
      '<button id="btn-translate" style="flex: 1; padding: 10px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🌐 Translate</button>' +
      '</div>';
    
    sidebar.appendChild(header);
    sidebar.appendChild(content);
    sidebar.appendChild(footer);
    win.document.body.appendChild(sidebar);
    
    // Event listeners
    win.document.getElementById("sidebar-close-btn")?.addEventListener("click", () => this.remove());
    win.document.getElementById("btn-summarize")?.addEventListener("click", () => this.showMessage(win, "📝 Generating summary..."));
    win.document.getElementById("btn-translate")?.addEventListener("click", () => this.showMessage(win, "🌐 Translation feature coming soon!"));
    
    ztoolkit.log("Paper Copilot sidebar created");
  }
  
  public static remove(): void {
    const sidebar = document.getElementById(this.sidebarId);
    if (sidebar) {
      sidebar.remove();
      ztoolkit.log("Paper Copilot sidebar removed");
    }
  }
  
  public static toggle(win: Window): void {
    const sidebar = document.getElementById(this.sidebarId);
    if (sidebar) {
      this.remove();
    } else {
      this.create(win);
    }
  }
  
  private static showMessage(win: Window, message: string): void {
    const content = win.document.querySelector("#" + this.sidebarId + " > div:nth-child(2)");
    if (content) {
      content.innerHTML = '<div style="padding: 20px; text-align: center; color: #333; font-size: 14px;">' + message + '</div>';
    }
  }
}
