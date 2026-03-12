/**
 * Zotero Paper Copilot - Sidebar UI Module
 * 
 * Using native HTML + zotero-plugin-toolkit
 * Reference: zotero-gpt, zotero-pdf-translate
 */

import { ThemeManager } from "./theme";
import { OnboardingManager, ErrorFormatter } from "./onboarding";

export class SidebarUI {
  private static sidebarId = "zotero-paper-copilot-sidebar";
  private static sidebarWidth = 400;
  private static isAnimating = false;
  
  /**
   * Create sidebar using ztoolkit.UI
   */
  public static create(win: Window): void {
    this.remove();
    
    const doc = win.document;
    
    // Get current theme
    const actualTheme = ThemeManager.getActualTheme();
    
    // Create main container with animation class
    const sidebar = doc.createElement("div");
    sidebar.id = this.sidebarId;
    sidebar.className = "pc-sidebar pc-theme-transition";
    sidebar.style.cssText = 
      "position: fixed; right: 0; top: 0; width: " + this.sidebarWidth + 
      "px; height: 100vh; background: var(--pc-sidebar-bg, #ffffff); box-shadow: -2px 0 10px var(--pc-sidebar-shadow, rgba(0,0,0,0.15)); " +
      "z-index: 9999; display: flex; flex-direction: column; font-family: var(--pc-font-family, -apple-system, BlinkMacSystemFont, sans-serif);";
    
    // Header with theme toggle
    const header = doc.createElement("div");
    header.className = "pc-sidebar-header pc-theme-transition";
    header.style.cssText = 
      "padding: 16px; border-bottom: 1px solid var(--pc-border, #e0e0e0); background: var(--pc-sidebar-header-bg, #f5f5f5); " +
      "display: flex; align-items: center; justify-content: space-between;";
    header.innerHTML = 
      '<div style="font-size: 16px; font-weight: 600; color: var(--pc-text-primary, #333);">📄 Paper Copilot</div>' +
      '<div style="display: flex; gap: 8px; align-items: center;">' +
        ThemeManager.createThemeToggleHTML() +
        '<button id="sidebar-close-btn" class="pc-button pc-button-ghost pc-button-icon" style="padding: 4px 8px; font-size: 18px;" aria-label="Close sidebar">×</button>' +
      '</div>';
    
    // Content area
    const content = doc.createElement("div");
    content.className = "pc-sidebar-content pc-scrollbar pc-theme-transition";
    content.style.cssText = "flex: 1; overflow-y: auto; padding: 16px;";
    
    // Show onboarding for new users
    if (!OnboardingManager.hasCompletedOnboarding()) {
      content.innerHTML = OnboardingManager.getWelcomeScreenHTML();
    } else {
      content.innerHTML = OnboardingManager.getDefaultContentHTML();
    }
    
    // Footer with buttons
    const footer = doc.createElement("div");
    footer.className = "pc-sidebar-footer pc-theme-transition";
    footer.style.cssText = "padding: 12px 16px; border-top: 1px solid var(--pc-border, #e0e0e0); background: var(--pc-sidebar-footer-bg, #f9f9f9);";
    footer.innerHTML = 
      '<div style="display: flex; gap: 8px;">' +
      '<button id="btn-summarize" class="pc-button pc-button-primary" style="flex: 1;">📝 Summarize</button>' +
      '<button id="btn-translate" class="pc-button pc-button-secondary" style="flex: 1;">🌐 Translate</button>' +
      '</div>';
    
    // Chat area (for future AI conversation)
    const chatArea = doc.createElement("div");
    chatArea.id = "paper-copilot-chat-area";
    chatArea.className = "pc-sidebar-content pc-scrollbar";
    chatArea.style.cssText = "flex: 1; overflow-y: auto; padding: 16px; display: none;";
    chatArea.innerHTML = '<div id="chat-messages" style="display: flex; flex-direction: column; gap: 12px;"></div>';
    
    // Assemble
    sidebar.appendChild(header);
    sidebar.appendChild(content);
    sidebar.appendChild(chatArea);
    sidebar.appendChild(footer);
    doc.body.appendChild(sidebar);
    
    // Event listeners
    doc.getElementById("sidebar-close-btn")?.addEventListener("click", () => this.remove());
    doc.getElementById("btn-summarize")?.addEventListener("click", () => this.showSummarize(win));
    doc.getElementById("btn-translate")?.addEventListener("click", () => this.showTranslate(win));
    
    // Theme toggle
    ThemeManager.attachThemeToggleListener(win);
    
    // Onboarding event listeners
    if (!OnboardingManager.hasCompletedOnboarding()) {
      OnboardingManager.attachWelcomeScreenListeners(win);
    } else {
      // Attach help/tour/setting button listeners for existing users
      this.attachHelpListeners(win);
    }
    
    // Log
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot sidebar created with theme:", actualTheme);
    }
  }
  
  /**
   * Attach help-related event listeners
   */
  private static attachHelpListeners(win: Window): void {
    const helpBtn = win.document.getElementById("pc-btn-help");
    if (helpBtn) {
      helpBtn.addEventListener("click", () => {
        this.showHelp(win);
      });
    }
    
    const tourBtn = win.document.getElementById("pc-btn-onboarding");
    if (tourBtn) {
      tourBtn.addEventListener("click", () => {
        OnboardingManager.startTour(win);
      });
    }
    
    const settingsBtn = win.document.getElementById("pc-btn-settings");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        this.showSettings(win);
      });
    }
  }
  
  /**
   * Show help panel
   */
  public static showHelp(win: Window): void {
    const content = win.document.querySelector("#" + this.sidebarId + " > div:nth-child(2)");
    if (content) {
      (content as HTMLElement).style.display = "block";
      content.innerHTML = OnboardingManager.getHelpPanelHTML();
      this.attachHelpPanelListeners(win);
    }
    
    // Hide chat area
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
    }
  }
  
  /**
   * Attach listeners for help panel topics
   */
  private static attachHelpPanelListeners(win: Window): void {
    const topics = win.document.querySelectorAll(".pc-help-topic");
    const helpTopics = (OnboardingManager as any).helpTopics;
    
    topics.forEach((topic, index) => {
      topic.addEventListener("click", () => {
        const contentArea = win.document.getElementById("pc-help-content-area");
        if (contentArea && helpTopics[index]) {
          const t = helpTopics[index];
          contentArea.innerHTML = `
            <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 20px;">
              ${t.icon} ${t.title}
            </h2>
            ${t.content}
          `;
        }
      });
    });
  }
  
  /**
   * Show settings panel
   */
  public static showSettings(win: Window): void {
    const content = win.document.querySelector("#" + this.sidebarId + " > div:nth-child(2)");
    if (content) {
      (content as HTMLElement).style.display = "block";
      content.innerHTML = `
        <div class="pc-settings-panel pc-animate-fadeIn" style="padding: 8px;">
          <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; color: var(--pc-text-primary, #333);">⚙️ Settings</h2>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 500; margin-bottom: 8px; color: var(--pc-text-primary, #333);">
              Theme
            </label>
            <div style="display: flex; gap: 8px;">
              <button id="pc-theme-light" class="pc-button ${ThemeManager.getActualTheme() === 'light' ? 'pc-button-primary' : 'pc-button-ghost'}">
                ☀️ Light
              </button>
              <button id="pc-theme-dark" class="pc-button ${ThemeManager.getActualTheme() === 'dark' ? 'pc-button-primary' : 'pc-button-ghost'}">
                🌙 Dark
              </button>
              <button id="pc-theme-system" class="pc-button ${ThemeManager.getTheme() === 'system' ? 'pc-button-primary' : 'pc-button-ghost'}">
                💻 System
              </button>
            </div>
          </div>
          
          <div class="pc-divider"></div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 500; margin-bottom: 8px; color: var(--pc-text-primary, #333);">
              Keyboard Shortcuts
            </label>
            <div style="background: var(--pc-bg-secondary, #f5f5f5); padding: 12px; border-radius: 6px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Toggle Sidebar</span>
                <span class="pc-kbd">Alt+L</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Ask About Selection</span>
                <span class="pc-kbd">Ctrl+Enter</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Close Sidebar</span>
                <span class="pc-kbd">Esc</span>
              </div>
            </div>
          </div>
          
          <div class="pc-divider"></div>
          
          <div>
            <button id="pc-btn-restart-tour" class="pc-button pc-button-ghost" style="width: 100%;">
              🔄 Restart Onboarding Tour
            </button>
          </div>
        </div>
      `;
      
      // Theme button listeners
      win.document.getElementById("pc-theme-light")?.addEventListener("click", () => {
        ThemeManager.setTheme("light");
        this.showSettings(win); // Refresh
      });
      
      win.document.getElementById("pc-theme-dark")?.addEventListener("click", () => {
        ThemeManager.setTheme("dark");
        this.showSettings(win); // Refresh
      });
      
      win.document.getElementById("pc-theme-system")?.addEventListener("click", () => {
        ThemeManager.setTheme("system");
        this.showSettings(win); // Refresh
      });
      
      // Restart tour button
      win.document.getElementById("pc-btn-restart-tour")?.addEventListener("click", () => {
        OnboardingManager.resetOnboarding();
        this.create(win); // Recreate sidebar with onboarding
      });
    }
    
    // Hide chat area
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
    }
  }
  
  /**
   * Remove sidebar
   */
  public static remove(): void {
    const sidebar = document.getElementById(this.sidebarId);
    if (sidebar) {
      // Add closing animation
      if (!this.isAnimating) {
        this.isAnimating = true;
        sidebar.classList.add("closing");
        setTimeout(() => {
          sidebar.remove();
          this.isAnimating = false;
          if (typeof ztoolkit !== "undefined") {
            ztoolkit.log("Paper Copilot sidebar removed");
          }
        }, 250);
      }
    }
  }
  
  /**
   * Toggle sidebar
   */
  public static toggle(win: Window): void {
    const sidebar = document.getElementById(this.sidebarId);
    if (sidebar) {
      this.remove();
    } else {
      this.create(win);
    }
  }
  
  /**
   * Show summarize action with loading state
   */
  private static showSummarize(win: Window): void {
    this.showLoading(win, "📝 Generating paper summary...");
    
    // Simulate API call (replace with actual implementation)
    setTimeout(() => {
      this.showMessage(win, `
        <div class="pc-animate-fadeIn">
          <h3 style="margin-top: 0; margin-bottom: 12px; color: var(--pc-text-primary, #333);">📝 Paper Summary</h3>
          <p style="color: var(--pc-text-secondary, #666); line-height: 1.6;">
            This feature requires LLM API integration. 
            You can configure your API key in the plugin preferences.
          </p>
          <button class="pc-button pc-button-ghost" onclick="window.PaperCopilot.showSettings()" style="margin-top: 8px;">
            ⚙️ Open Settings
          </button>
        </div>
      `);
    }, 1500);
  }
  
  /**
   * Show translate action with loading state
   */
  private static showTranslate(win: Window): void {
    this.showLoading(win, "🌐 Preparing translation...");
    
    setTimeout(() => {
      this.showMessage(win, `
        <div class="pc-animate-fadeIn">
          <h3 style="margin-top: 0; margin-bottom: 12px; color: var(--pc-text-primary, #333);">🌐 Translation</h3>
          <p style="color: var(--pc-text-secondary, #666); line-height: 1.6;">
            Translation feature requires LLM API integration.
            Select text in a PDF to translate specific passages.
          </p>
        </div>
      `);
    }, 1000);
  }
  
  /**
   * Show loading state
   */
  private static showLoading(win: Window, message: string): void {
    const content = win.document.querySelector("#" + this.sidebarId + " > div:nth-child(2)");
    if (content) {
      (content as HTMLElement).style.display = "block";
      content.innerHTML = ErrorFormatter.getLoadingHTML(message);
    }
    
    // Hide chat area
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
    }
  }
  
  /**
   * Show message in content area
   */
  public static showMessage(win: Window, html: string): void {
    const content = win.document.querySelector("#" + this.sidebarId + " > div:nth-child(2)");
    if (content) {
      (content as HTMLElement).style.display = "block";
      content.innerHTML = '<div style="padding: 20px;">' + html + '</div>';
      
      // Scroll to top
      (content as HTMLElement).scrollTop = 0;
    }
    
    // Hide chat area
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
    }
  }
  
  /**
   * Show error message
   */
  public static showError(win: Window, error: Error | string, recoverySuggestions?: string[]): void {
    this.showMessage(win, ErrorFormatter.formatError(error, recoverySuggestions));
  }
  
  /**
   * Add a message to chat (for future AI conversation)
   */
  public static addChatMessage(win: Window, role: "user" | "assistant", content: string): void {
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    const contentArea = win.document.querySelector("#" + this.sidebarId + " > div:nth-child(2)");
    
    if (chatArea && contentArea) {
      // Hide welcome content, show chat
      (contentArea as HTMLElement).style.display = "none";
      chatArea.style.display = "block";
      
      const messages = win.document.getElementById("chat-messages");
      if (messages) {
        const msgDiv = win.document.createElement("div");
        msgDiv.className = `pc-chat-message pc-chat-message-${role} pc-theme-transition`;
        
        msgDiv.innerHTML = content;
        messages.appendChild(msgDiv);
        
        // Scroll to bottom
        chatArea.scrollTop = chatArea.scrollHeight;
      }
    }
  }
  
  /**
   * Show selected text in sidebar (called from PDF selection)
   */
  public static showSelectedText(win: Window, text: string): void {
    const content = win.document.querySelector("#" + this.sidebarId + " > div:nth-child(2)");
    if (content) {
      (content as HTMLElement).style.display = "block";
      
      const displayText = text.length > 500 ? text.substring(0, 500) + "..." : text;
      const escapedText = displayText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      
      content.innerHTML = 
        '<div style="padding: 16px;" class="pc-animate-fadeIn">' +
        '<div style="font-size: 12px; color: var(--pc-text-tertiary, #999); margin-bottom: 8px;">Selected Text:</div>' +
        '<div style="background: var(--pc-bg-secondary, #f5f5f5); padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.6; margin-bottom: 16px; max-height: 200px; overflow-y: auto; color: var(--pc-text-primary, #333);">' +
        escapedText +
        '</div>' +
        '<div style="display: flex; gap: 8px;">' +
        '<button id="btn-ask-about-selection" class="pc-button pc-button-primary" style="flex: 1;">💬 Ask AI</button>' +
        '<button id="btn-translate-selection" class="pc-button pc-button-secondary" style="flex: 1;">🌐 Translate</button>' +
        '</div>' +
        '</div>';
      
      win.document.getElementById("btn-ask-about-selection")?.addEventListener("click", () => {
        this.showLoading(win, "🤖 Thinking...");
        setTimeout(() => {
          this.showMessage(win, `
            <div class="pc-animate-fadeIn">
              <p style="color: var(--pc-text-secondary, #666);">
                🤖 AI Question feature requires API integration. This would analyze the selected text and provide insights.
              </p>
            </div>
          `);
        }, 1200);
      });
      
      win.document.getElementById("btn-translate-selection")?.addEventListener("click", () => {
        this.showLoading(win, "🌐 Translating...");
        setTimeout(() => {
          this.showMessage(win, `
            <div class="pc-animate-fadeIn">
              <p style="color: var(--pc-text-secondary, #666);">
                🌐 Translation feature requires API integration. This would translate the selected text to your preferred language.
              </p>
            </div>
          `);
        }, 1000);
      });
    }
    
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
    }
  }
}
