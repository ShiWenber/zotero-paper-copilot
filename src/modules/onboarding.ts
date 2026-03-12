/**
 * Zotero Paper Copilot - Onboarding & Help System
 * 
 * Provides onboarding for new users, tooltips, and help content
 */

import { getPref, setPref } from "../utils/prefs";

export interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  highlight?: string; // CSS selector to highlight
  position?: "top" | "bottom" | "left" | "right";
}

export interface HelpTopic {
  id: string;
  title: string;
  icon: string;
  content: string;
  shortcut?: string;
}

export class OnboardingManager {
  private static currentStep = 0;
  private static isComplete = false;
  private static tourActive = false;
  
  // Default onboarding steps
  private static defaultSteps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to Paper Copilot! 🎉",
      content: "Your AI assistant for research papers. Let's take a quick tour to get you started.",
      position: "right"
    },
    {
      id: "select-text",
      title: "Select Text in PDFs",
      content: "Simply select any text in a PDF to get AI explanations, translations, or ask questions about the selected content.",
      highlight: "#zotero-paper-copilot-sidebar",
      position: "left"
    },
    {
      id: "sidebar-actions",
      title: "Quick Actions",
      content: "Use the sidebar buttons for quick actions: Summarize papers, translate content, or start a conversation with AI.",
      position: "bottom"
    },
    {
      id: "keyboard-shortcuts",
      title: "Keyboard Shortcuts",
      content: "Press Alt+L to open the sidebar. Use Ctrl+Enter to quickly ask about selected text.",
      position: "top"
    },
    {
      id: "complete",
      title: "You're All Set! 🚀",
      content: "Enjoy using Paper Copilot! You can always access help from the sidebar menu or preferences.",
      position: "right"
    }
  ];
  
  // Help topics
  private static helpTopics: HelpTopic[] = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: "📖",
      content: `
        <h3>Quick Start Guide</h3>
        <ol>
          <li>Open any PDF in Zotero's reader</li>
          <li>Select text to see AI options</li>
          <li>Click buttons in sidebar for actions</li>
          <li>Use keyboard shortcuts for speed</li>
        </ol>
      `
    },
    {
      id: "keyboard-shortcuts",
      title: "Keyboard Shortcuts",
      icon: "⌨️",
      content: `
        <h3>Available Shortcuts</h3>
        <ul>
          <li><span class="pc-kbd">Alt+L</span> - Toggle sidebar</li>
          <li><span class="pc-kbd">Ctrl+Enter</span> - Ask about selection</li>
          <li><span class="pc-kbd">Escape</span> - Close sidebar</li>
        </ul>
      `,
      shortcut: "Alt+L"
    },
    {
      id: "theme-settings",
      title: "Theme & Appearance",
      icon: "🎨",
      content: `
        <h3>Customize Appearance</h3>
        <p>Toggle between light and dark mode using the theme button in the sidebar header.</p>
        <p>Your preference will be saved automatically.</p>
      `
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting",
      icon: "🔧",
      content: `
        <h3>Common Issues</h3>
        <ul>
          <li><strong>Sidebar not appearing:</strong> Try Alt+L or check Zotero add-on settings</li>
          <li><strong>PDF selection not working:</strong> Ensure you're in the PDF reader view</li>
          <li><strong>Theme not changing:</strong> Refresh Zotero after changing preferences</li>
        </ul>
      `
    },
    {
      id: "about",
      title: "About",
      icon: "ℹ️",
      content: `
        <h3>Paper Copilot</h3>
        <p>Version: 0.1.0</p>
        <p>An AI assistant plugin for Zotero that helps you read and understand research papers more efficiently.</p>
        <p>Features: Text selection AI, Summarization, Translation, and more!</p>
      `
    }
  ];
  
  /**
   * Check if onboarding has been completed
   */
  public static hasCompletedOnboarding(): boolean {
    return getPref("onboardingComplete") === true;
  }
  
  /**
   * Mark onboarding as complete
   */
  public static completeOnboarding(): void {
    setPref("onboardingComplete", true);
    this.isComplete = true;
  }
  
  /**
   * Reset onboarding (for testing or user request)
   */
  public static resetOnboarding(): void {
    setPref("onboardingComplete", false);
    this.isComplete = false;
    this.currentStep = 0;
  }
  
  /**
   * Start onboarding tour
   */
  public static startTour(win: Window): void {
    if (this.tourActive) return;
    
    this.tourActive = true;
    this.currentStep = 0;
    this.showStep(win);
  }
  
  /**
   * Show current onboarding step
   */
  private static showStep(win: Window): void {
    if (!this.tourActive || this.currentStep >= this.defaultSteps.length) {
      this.endTour(win);
      return;
    }
    
    const step = this.defaultSteps[this.currentStep];
    this.showTooltip(win, step);
  }
  
  /**
   * Display tooltip for current step
   */
  private static showTooltip(win: Window, step: OnboardingStep): void {
    // Remove existing tour tooltip
    this.removeTourElements(win);
    
    // Create tooltip container
    const tooltip = win.document.createElement("div");
    tooltip.id = "pc-onboarding-tooltip";
    tooltip.className = "pc-onboarding-tooltip pc-animate-scaleIn";
    tooltip.style.cssText = `
      position: fixed;
      z-index: 10010;
      max-width: 320px;
      padding: 16px;
      background: var(--pc-bg-primary, #fff);
      border: 1px solid var(--pc-border, #e0e0e0);
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      font-family: var(--pc-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
    `;
    
    // Title
    const title = win.document.createElement("div");
    title.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--pc-text-primary, #333);
    `;
    title.textContent = step.title;
    
    // Content
    const content = win.document.createElement("div");
    content.style.cssText = `
      font-size: 14px;
      line-height: 1.5;
      color: var(--pc-text-secondary, #666);
      margin-bottom: 16px;
    `;
    content.textContent = step.content;
    
    // Progress indicator
    const progress = win.document.createElement("div");
    progress.style.cssText = `
      font-size: 12px;
      color: var(--pc-text-tertiary, #999);
      margin-bottom: 12px;
    `;
    progress.textContent = `Step ${this.currentStep + 1} of ${this.defaultSteps.length}`;
    
    // Buttons
    const buttons = win.document.createElement("div");
    buttons.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    `;
    
    // Skip button
    const skipBtn = win.document.createElement("button");
    skipBtn.textContent = "Skip";
    skipBtn.style.cssText = `
      padding: 6px 12px;
      font-size: 13px;
      background: transparent;
      border: 1px solid var(--pc-border, #ccc);
      border-radius: 4px;
      cursor: pointer;
      color: var(--pc-text-secondary, #666);
    `;
    skipBtn.addEventListener("click", () => {
      this.endTour(win);
    });
    
    // Next/Finish button
    const nextBtn = win.document.createElement("button");
    const isLastStep = this.currentStep === this.defaultSteps.length - 1;
    nextBtn.textContent = isLastStep ? "Finish" : "Next";
    nextBtn.style.cssText = `
      padding: 6px 16px;
      font-size: 13px;
      font-weight: 500;
      background: var(--pc-primary, #0066cc);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    nextBtn.addEventListener("click", () => {
      this.currentStep++;
      if (isLastStep) {
        this.completeOnboarding();
        this.endTour(win);
      } else {
        this.showStep(win);
      }
    });
    
    buttons.appendChild(skipBtn);
    buttons.appendChild(nextBtn);
    
    tooltip.appendChild(title);
    tooltip.appendChild(progress);
    tooltip.appendChild(content);
    tooltip.appendChild(buttons);
    
    // Position tooltip
    const sidebar = win.document.getElementById("zotero-paper-copilot-sidebar");
    if (sidebar) {
      const rect = sidebar.getBoundingClientRect();
      tooltip.style.left = `${rect.left - 340}px`;
      tooltip.style.top = `${rect.top + 100}px`;
    } else {
      tooltip.style.right = "420px";
      tooltip.style.top = "100px";
    }
    
    win.document.body.appendChild(tooltip);
    
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Showing onboarding step:", step.id);
    }
  }
  
  /**
   * End onboarding tour
   */
  private static endTour(win: Window): void {
    this.tourActive = false;
    this.removeTourElements(win);
    
    if (this.currentStep >= this.defaultSteps.length - 1) {
      this.completeOnboarding();
    }
    
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Onboarding tour ended");
    }
  }
  
  /**
   * Remove tour elements from DOM
   */
  private static removeTourElements(win: Window): void {
    const tooltip = win.document.getElementById("pc-onboarding-tooltip");
    if (tooltip) {
      tooltip.remove();
    }
  }
  
  /**
   * Get help panel HTML
   */
  public static getHelpPanelHTML(): string {
    let topicsHTML = this.helpTopics.map(topic => `
      <div class="pc-help-topic" data-topic-id="${topic.id}" style="
        padding: 12px;
        border-bottom: 1px solid var(--pc-border, #e0e0e0);
        cursor: pointer;
        transition: background var(--pc-transition-fast);
      " onmouseover="this.style.background='var(--pc-bg-hover, #f8f9fa)'" onmouseout="this.style.background='transparent'">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">${topic.icon}</span>
          <span style="font-weight: 500; color: var(--pc-text-primary, #333);">${topic.title}</span>
          ${topic.shortcut ? `<span class="pc-kbd">${topic.shortcut}</span>` : ''}
        </div>
      </div>
    `).join("");
    
    return `
      <div class="pc-help-panel pc-animate-fadeIn" style="
        display: flex;
        height: 100%;
        font-family: var(--pc-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      ">
        <div class="pc-help-sidebar" style="
          width: 180px;
          border-right: 1px solid var(--pc-border, #e0e0e0);
          background: var(--pc-bg-secondary, #f5f5f5);
          overflow-y: auto;
        ">
          <div style="
            padding: 16px;
            font-weight: 600;
            color: var(--pc-text-primary, #333);
            border-bottom: 1px solid var(--pc-border, #e0e0e0);
          ">Help Topics</div>
          ${topicsHTML}
        </div>
        <div class="pc-help-content" style="
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          color: var(--pc-text-primary, #333);
        ">
          <div id="pc-help-content-area">
            <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 20px;">
              ${this.helpTopics[0].icon} ${this.helpTopics[0].title}
            </h2>
            ${this.helpTopics[0].content}
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Get welcome screen HTML (shown when sidebar first opens)
   */
  public static getWelcomeScreenHTML(): string {
    return `
      <div class="pc-onboarding-card pc-animate-fadeIn">
        <div class="pc-onboarding-icon">🤖</div>
        <div class="pc-onboarding-title">Welcome to Paper Copilot</div>
        <div class="pc-onboarding-description">
          Your AI assistant for research papers.<br>
          Select text in a PDF to get explanations or translations.
        </div>
        <div style="display: flex; gap: 12px; justify-content: center; margin-bottom: 20px;">
          <button id="pc-btn-start-tour" class="pc-button pc-button-primary">
            Take Quick Tour
          </button>
          <button id="pc-btn-skip-tour" class="pc-button pc-button-ghost">
            Skip
          </button>
        </div>
        <div class="pc-onboarding-tips">
          <div class="pc-onboarding-tips-title">💡 Quick Tips</div>
          <ul>
            <li>Select any text in the PDF to get AI explanations</li>
            <li>Click the sidebar buttons to summarize or translate</li>
            <li>Press <span class="pc-kbd">Alt+L</span> to toggle the sidebar</li>
            <li>Click the theme button to switch light/dark mode</li>
          </ul>
        </div>
      </div>
    `;
  }
  
  /**
   * Attach event listeners for onboarding buttons
   */
  public static attachWelcomeScreenListeners(win: Window): void {
    const startTourBtn = win.document.getElementById("pc-btn-start-tour");
    if (startTourBtn) {
      startTourBtn.addEventListener("click", () => {
        this.startTour(win);
      });
    }
    
    const skipTourBtn = win.document.getElementById("pc-btn-skip-tour");
    if (skipTourBtn) {
      skipTourBtn.addEventListener("click", () => {
        this.completeOnboarding();
        // Show default content
        const sidebar = win.document.getElementById("zotero-paper-copilot-sidebar");
        if (sidebar) {
          const content = sidebar.querySelector("div:nth-child(2)");
          if (content) {
            (content as HTMLElement).innerHTML = this.getDefaultContentHTML();
          }
        }
      });
    }
  }
  
  /**
   * Get default sidebar content HTML
   */
  public static getDefaultContentHTML(): string {
    return `
      <div style="text-align: center; padding: 40px 20px; color: var(--pc-text-secondary, #666);" class="pc-animate-fadeIn">
        <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
        <div style="font-size: 16px; margin-bottom: 8px; color: var(--pc-text-primary, #333);">Ready to Help</div>
        <div style="font-size: 14px; color: var(--pc-text-tertiary, #999);">
          Select text in a PDF to ask questions<br>or get translations.
        </div>
      </div>
      <div style="margin-top: 20px; padding: 16px; background: var(--pc-primary-light, #f0f7ff); border-radius: 8px;">
        <div style="font-size: 14px; font-weight: 600; color: var(--pc-primary, #0066cc); margin-bottom: 8px;">💡 Quick Tips</div>
        <ul style="font-size: 13px; color: var(--pc-text-secondary, #555); padding-left: 20px; margin: 0;">
          <li>Select any text in the PDF to get AI explanations</li>
          <li>Click the summarize button to get paper summary</li>
          <li>Use translate for instant translations</li>
          <li>Press <span class="pc-kbd">Alt+L</span> to toggle sidebar</li>
        </ul>
      </div>
      <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="pc-btn-help" class="pc-quick-action" style="flex: 1; min-width: 120px;">
          <span class="pc-quick-action-icon">❓</span>
          <span>Help</span>
        </button>
        <button id="pc-btn-onboarding" class="pc-quick-action" style="flex: 1; min-width: 120px;">
          <span class="pc-quick-action-icon">🎬</span>
          <span>Tour</span>
        </button>
        <button id="pc-btn-settings" class="pc-quick-action" style="flex: 1; min-width: 120px;">
          <span class="pc-quick-action-icon">⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    `;
  }
}

/**
 * Error message formatter with recovery suggestions
 */
export class ErrorFormatter {
  /**
   * Format error for display with recovery options
   */
  public static formatError(
    error: Error | string,
    recoverySuggestions?: Array<{ label: string; action: string }>
  ): string {
    const errorMessage = typeof error === "string" ? error : error.message;
    const suggestions = recoverySuggestions || this.getDefaultSuggestions(errorMessage);
    
    return `
      <div class="pc-error-container pc-animate-fadeIn">
        <div class="pc-error-title">
          <span>⚠️</span>
          <span>Something went wrong</span>
        </div>
        <div class="pc-error-message">
          ${this.sanitize(errorMessage)}
        </div>
        ${suggestions.length > 0 ? `
          <div class="pc-error-recovery">
            ${suggestions.map(s => `<button class="pc-button pc-button-ghost pc-button-icon" onclick="${s.action}">${s.label}</button>`).join("")}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  /**
   * Get default recovery suggestions based on error type
   */
  private static getDefaultSuggestions(errorMessage: string): Array<{ label: string; action: string }> {
    const lowerError = errorMessage.toLowerCase();
    const suggestions: Array<{ label: string; action: string }> = [];
    
    if (lowerError.includes("network") || lowerError.includes("connection")) {
      suggestions.push(
        { label: "🔄 Retry", action: "window.PaperCopilot.retry()" },
        { label: "📡 Check Connection", action: "alert('Please check your internet connection and try again.')" }
      );
    }
    
    if (lowerError.includes("api") || lowerError.includes("key")) {
      suggestions.push(
        { label: "⚙️ API Settings", action: "window.PaperCopilot.openSettings()" },
        { label: "📖 View Docs", action: "window.PaperCopilot.showHelp()" }
      );
    }
    
    if (lowerError.includes("pdf") || lowerError.includes("document")) {
      suggestions.push(
        { label: "📄 Reload PDF", action: "window.PaperCopilot.reloadPDF()" },
        { label: "🔍 Try Different PDF", action: "alert('Try selecting text from a different PDF document.')" }
      );
    }
    
    // Always offer help
    suggestions.push(
      { label: "❓ Get Help", action: "window.PaperCopilot.showHelp()" }
    );
    
    return suggestions;
  }
  
  /**
   * Sanitize HTML to prevent XSS
   */
  private static sanitize(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
  
  /**
   * Create loading indicator HTML
   */
  public static getLoadingHTML(message: string = "Loading..."): string {
    return `
      <div class="pc-loading-container pc-animate-fadeIn" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        gap: 16px;
      ">
        <div class="pc-spinner pc-spinner-lg"></div>
        <div style="color: var(--pc-text-secondary, #666); font-size: 14px;">${message}</div>
      </div>
    `;
  }
  
  /**
   * Create progress indicator HTML
   */
  public static getProgressHTML(progress: number, message: string): string {
    const clampedProgress = Math.min(100, Math.max(0, progress));
    return `
      <div class="pc-progress-container pc-animate-fadeIn" style="
        padding: 20px;
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
          color: var(--pc-text-primary, #333);
        ">
          <span>${message}</span>
          <span>${Math.round(clampedProgress)}%</span>
        </div>
        <div class="pc-progress">
          <div class="pc-progress-bar pc-progress-striped" style="width: ${clampedProgress}%"></div>
        </div>
      </div>
    `;
  }
}
