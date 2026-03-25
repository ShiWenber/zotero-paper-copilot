/**
 * Zotero Paper Copilot - Sidebar UI Module
 *
 * Using native HTML + zotero-plugin-toolkit
 * Reference: zotero-gpt, zotero-pdf-translate
 */

import { formatChatMessage } from "../utils/formatting";

export class SidebarUI {
  private static sidebarId = "zotero-paper-copilot-sidebar";
  private static sidebarWidth = 400;

  /**
   * Create sidebar using ztoolkit.UI
   */
  public static create(win: Window): void {
    this.remove(win);

    const doc = win.document;

    // Create main container
    const sidebar = doc.createElement("div");
    sidebar.id = this.sidebarId;
    sidebar.style.cssText =
      "position: fixed; right: 0; top: 0; width: " +
      this.sidebarWidth +
      "px; height: 100vh; background: #ffffff; box-shadow: -2px 0 10px rgba(0,0,0,0.15); " +
      "z-index: 9999; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, sans-serif;";

    // Header
    const header = doc.createElement("div");
    header.style.cssText =
      "padding: 16px; border-bottom: 1px solid #e0e0e0; background: #f5f5f5; " +
      "display: flex; align-items: center; justify-content: space-between;";
    header.innerHTML =
      '<div style="font-size: 16px; font-weight: 600; color: #333;">📄 Paper Copilot</div>' +
      '<button id="sidebar-close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; padding: 4px 8px; color: #666;">×</button>';

    // Content
    const content = doc.createElement("div");
    content.style.cssText = "flex: 1; overflow-y: auto; padding: 16px;";
    content.innerHTML =
      '<div style="text-align: center; padding: 40px 20px; color: #666;">' +
      '<div style="font-size: 48px; margin-bottom: 16px;">🤖</div>' +
      '<div style="font-size: 16px; margin-bottom: 8px;">Welcome to Paper Copilot</div>' +
      '<div style="font-size: 14px; color: #999;">Select text in a PDF to ask questions<br>or get translations.</div>' +
      "</div>" +
      '<div style="margin-top: 20px; padding: 16px; background: #f0f7ff; border-radius: 8px;">' +
      '<div style="font-size: 14px; font-weight: 600; color: #0066cc; margin-bottom: 8px;">💡 Quick Tips</div>' +
      '<ul style="font-size: 13px; color: #555; padding-left: 20px; margin: 0;">' +
      "<li>Select any text in the PDF to get AI explanations</li>" +
      "<li>Click the summarize button to get paper summary</li>" +
      "<li>Use translate for instant translations</li>" +
      "<li>Click page references to jump to that page</li>" +
      "<li>Use 📸 Screenshot to OCR a PDF region</li>" +
      "<li>Use 💾 Save as Note to sync conversations</li>" +
      "</ul></div>";

    // Chat area header with Save as Note button
    const chatHeader = doc.createElement("div");
    chatHeader.id = "paper-copilot-chat-header";
    chatHeader.style.cssText =
      "padding: 8px 16px; border-bottom: 1px solid #e0e0e0; background: #fafafa; " +
      "display: none; align-items: center; justify-content: space-between;";
    chatHeader.innerHTML =
      '<span style="font-size: 13px; color: #666;">Conversation</span>' +
      '<button id="btn-save-note" style="padding: 6px 12px; background: #f0a500; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">💾 Save as Note</button>';

    // Chat area (for future AI conversation)
    const chatArea = doc.createElement("div");
    chatArea.id = "paper-copilot-chat-area";
    chatArea.style.cssText =
      "flex: 1; overflow-y: auto; padding: 16px; display: none;";
    chatArea.innerHTML =
      '<div id="chat-messages" style="display: flex; flex-direction: column; gap: 12px;"></div>';

    // Footer with action buttons
    const footer = doc.createElement("div");
    footer.style.cssText =
      "padding: 12px 16px; border-top: 1px solid #e0e0e0; background: #f9f9f9;";
    footer.innerHTML =
      '<div style="display: flex; gap: 8px;">' +
      '<button id="btn-summarize" style="flex: 1; padding: 10px 16px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">📝 Summarize</button>' +
      '<button id="btn-translate" style="flex: 1; padding: 10px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🌐 Translate</button>' +
      '<button id="btn-screenshot" title="Screenshot OCR" style="padding: 10px 12px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">📸</button>' +
      "</div>";

    // Assemble
    sidebar.appendChild(header);
    sidebar.appendChild(content);
    sidebar.appendChild(chatHeader);
    sidebar.appendChild(chatArea);
    sidebar.appendChild(footer);
    if (!doc.body) return;
    doc.body.appendChild(sidebar);

    // Event listeners
    doc
      .getElementById("sidebar-close-btn")
      ?.addEventListener("click", () => this.remove(win));
    doc
      .getElementById("btn-summarize")
      ?.addEventListener("click", () => this.showSummarize(win));
    doc
      .getElementById("btn-translate")
      ?.addEventListener("click", () => this.showTranslate(win));
    doc
      .getElementById("btn-screenshot")
      ?.addEventListener("click", () => this.startScreenshotMode(win));
    doc
      .getElementById("btn-save-note")
      ?.addEventListener("click", () => this.saveChatAsNote(win));

    // Delegate click handler for page-jump links (using event delegation)
    chatArea.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("page-jump")) {
        const page = target.getAttribute("data-page");
        if (page) {
          this.handlePageJump(win, parseInt(page, 10));
        }
      }
    });

    // Log
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot sidebar created with native HTML");
    }
  }

  /**
   * Remove sidebar from a specific window
   */
  public static remove(win: Window): void {
    const sidebar = win.document.getElementById(this.sidebarId);
    if (sidebar) {
      sidebar.remove();
      if (typeof ztoolkit !== "undefined" && ztoolkit) {
        ztoolkit.log("Paper Copilot sidebar removed");
      }
    }
  }

  /**
   * Toggle sidebar
   */
  public static toggle(win: Window): void {
    const sidebar = win.document.getElementById(this.sidebarId);
    if (sidebar) {
      this.remove(win);
    } else {
      this.create(win);
    }
  }

  /**
   * Show summarize action
   */
  private static showSummarize(win: Window): void {
    const integrator = (win as any)["sidebarAgentIntegrator"];
    if (integrator) {
      integrator.handleSummarize();
    } else {
      this.showMessage(win, "Agent not initialized. Please reload the plugin.");
    }
  }

  /**
   * Show translate action
   */
  private static showTranslate(win: Window): void {
    // For translate without selection, show instructions
    this.showMessage(
      win,
      `<div style="text-align: left;">
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">🌐 Translate Text</div>
        <div style="font-size: 13px; color: #555; line-height: 1.6;">
          <p>To translate text:</p>
          <ol style="padding-left: 20px; margin: 8px 0;">
            <li>Select text in the PDF</li>
            <li>Click "Translate" button</li>
          </ol>
        </div>
      </div>`,
    );
  }

  /**
   * Show message in content area
   */
  public static showMessage(win: Window, html: string): void {
    const content = win.document.querySelector(
      "#" + this.sidebarId + " > div:nth-child(2)",
    );
    if (content) {
      (content as HTMLElement).style.display = "block";
      content.innerHTML =
        '<div style="padding: 20px; text-align: center; color: #333; font-size: 14px;">' +
        html +
        "</div>";
    }

    // Hide chat area and header
    const chatArea = win.document.getElementById(
      "paper-copilot-chat-area",
    ) as HTMLElement | null;
    const chatHeader = win.document.getElementById(
      "paper-copilot-chat-header",
    ) as HTMLElement | null;
    if (chatArea) {
      chatArea.style.display = "none";
    }
    if (chatHeader) {
      chatHeader.style.display = "none";
    }
  }

  /**
   * Log helper for static methods
   */
  private static log(...args: any[]): void {
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("[SidebarUI]", ...args);
    } else if (typeof console !== "undefined") {
      console.log("[SidebarUI]", ...args);
    }
  }

  /**
   * Add a message to chat (for future AI conversation)
   */
  public static addChatMessage(
    win: Window,
    role: "user" | "assistant",
    content: string,
  ): void {
    const chatArea = win.document.getElementById(
      "paper-copilot-chat-area",
    ) as HTMLElement | null;
    const chatHeader = win.document.getElementById(
      "paper-copilot-chat-header",
    ) as HTMLElement | null;
    const contentArea = win.document.querySelector(
      "#" + this.sidebarId + " > div:nth-child(2)",
    );

    if (chatArea && contentArea) {
      // Hide welcome content, show chat and header
      (contentArea as HTMLElement).style.display = "none";
      chatArea.style.display = "block";
      if (chatHeader) {
        chatHeader.style.display = "flex";
      }

      const messages = win.document.getElementById("chat-messages");
      if (messages) {
        const msgDiv = win.document.createElement("div");
        msgDiv.style.cssText =
          "padding: 12px; border-radius: 8px; max-width: 90%; font-size: 14px; line-height: 1.5; word-wrap: break-word;";

        if (role === "user") {
          msgDiv.style.cssText += "background: #e3f2fd; margin-left: auto;";
        } else {
          msgDiv.style.cssText += "background: #f5f5f5; margin-right: auto;";
        }

        // Format content with markdown and page references
        msgDiv.innerHTML = formatChatMessage(content, role);

        // Add page-jump click handler via event delegation
        msgDiv.addEventListener("click", (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains("page-jump")) {
            const page = target.getAttribute("data-page");
            if (page) {
              this.handlePageJump(win, parseInt(page, 10));
            }
          }
        });

        messages.appendChild(msgDiv);

        // Scroll to bottom
        chatArea.scrollTop = chatArea.scrollHeight;
      }
    }
  }

  /**
   * Handle page jump - navigate to a specific page in PDF
   */
  private static handlePageJump(win: Window, pageNumber: number): void {
    try {
      const integrator = (win as any)["sidebarAgentIntegrator"];
      if (integrator && integrator.pdfService) {
        const success = integrator.pdfService.goToPage(win, pageNumber);
        if (success) {
          this.showMessage(
            win,
            `<div style="text-align: center; color: #28a745;">
              <div style="font-size: 20px; margin-bottom: 8px;">✅</div>
              <div>Jumped to page ${pageNumber}</div>
            </div>`,
          );
        } else {
          this.showMessage(
            win,
            `<div style="text-align: center; color: #dc3545;">
              <div style="font-size: 20px; margin-bottom: 8px;">⚠️</div>
              <div>Could not navigate to page ${pageNumber}.<br>Make sure the PDF reader is open.</div>
            </div>`,
          );
        }
      }
    } catch (err) {
      this.log("handlePageJump error:", err);
    }
  }

  /**
   * Start screenshot mode - enter region selection for OCR
   */
  private static startScreenshotMode(win: Window): void {
    const integrator = (win as any)["sidebarAgentIntegrator"];
    if (!integrator) {
      this.showMessage(win, "Agent not initialized. Please reload the plugin.");
      return;
    }

    // Show instruction message
    this.showMessage(
      win,
      `<div style="text-align: left;">
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">📸 Screenshot OCR</div>
        <div style="font-size: 13px; color: #555; line-height: 1.6;">
          <p>Screenshot OCR lets you capture a region of the PDF and extract text.</p>
          <p><strong>To use:</strong></p>
          <ol style="padding-left: 20px; margin: 8px 0;">
            <li>Make sure the PDF reader is visible</li>
            <li>The feature captures the current PDF view</li>
            <li>OCR requires tesseract.js to be installed</li>
          </ol>
          <p style="color: #999; font-size: 12px;">Note: Full OCR requires tesseract.js integration.<br>Run: npm install tesseract.js</p>
        </div>
      </div>`,
    );

    // Log for debugging
    this.log("Screenshot mode requested - requires tesseract.js for OCR");
  }

  /**
   * Save current chat conversation as a Zotero note
   */
  private static saveChatAsNote(win: Window): void {
    const integrator = (win as any)["sidebarAgentIntegrator"];
    if (!integrator) {
      this.showMessage(win, "Agent not initialized. Please reload the plugin.");
      return;
    }

    // Check if there's a chat history
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    const messages = chatArea?.querySelector(":scope > div");

    if (!messages || messages.childElementCount === 0) {
      this.showMessage(
        win,
        `<div style="text-align: center; color: #dc3545;">
          <div style="font-size: 20px; margin-bottom: 8px;">⚠️</div>
          <div>No conversation to save. Start chatting first!</div>
        </div>`,
      );
      return;
    }

    // Call the sync_notes tool via the agent/integrator
    if (typeof integrator.syncNotes === "function") {
      integrator.syncNotes();
    } else {
      // Fallback: use the tool directly
      this.showMessage(win, "Syncing conversation as note...");
      this.log("saveChatAsNote: syncNotes method not available on integrator");
    }
  }

  /**
   * Show selected text in sidebar (called from PDF selection)
   */
  public static showSelectedText(win: Window, text: string): void {
    const content = win.document.querySelector(
      "#" + this.sidebarId + " > div:nth-child(2)",
    );
    if (content) {
      (content as HTMLElement).style.display = "block";

      const displayText =
        text.length > 500 ? text.substring(0, 500) + "..." : text;
      const escapedText = displayText
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      content.innerHTML =
        '<div style="padding: 16px;">' +
        '<div style="font-size: 12px; color: #999; margin-bottom: 8px;">Selected Text:</div>' +
        '<div style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.6; margin-bottom: 16px; max-height: 200px; overflow-y: auto;">' +
        escapedText +
        "</div>" +
        '<div style="display: flex; gap: 8px;">' +
        '<button id="btn-ask-about-selection" style="flex: 1; padding: 10px 16px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">💬 Ask AI</button>' +
        '<button id="btn-translate-selection" style="flex: 1; padding: 10px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🌐 Translate</button>' +
        "</div>" +
        "</div>";

      win.document
        .getElementById("btn-ask-about-selection")
        ?.addEventListener("click", () => {
          const integrator = (win as any)["sidebarAgentIntegrator"];
          if (integrator) {
            integrator.handleSelectedText(text, "ask");
          } else {
            this.showMessage(
              win,
              "Agent not initialized. Please reload the plugin.",
            );
          }
        });

      win.document
        .getElementById("btn-translate-selection")
        ?.addEventListener("click", () => {
          const integrator = (win as any)["sidebarAgentIntegrator"];
          if (integrator) {
            integrator.handleSelectedText(text, "translate");
          } else {
            this.showMessage(
              win,
              "Agent not initialized. Please reload the plugin.",
            );
          }
        });
    }

    const chatArea = win.document.getElementById(
      "paper-copilot-chat-area",
    ) as HTMLElement | null;
    const chatHeader = win.document.getElementById(
      "paper-copilot-chat-header",
    ) as HTMLElement | null;
    if (chatArea) {
      chatArea.style.display = "none";
    }
    if (chatHeader) {
      chatHeader.style.display = "none";
    }
  }
}
