/**
 * Zotero Paper Copilot - Sidebar UI Module
 *
 * Using native HTML + zotero-plugin-toolkit
 * Reference: zotero-gpt, zotero-pdf-translate
 */

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
      "</ul></div>";

    // Footer with buttons
    const footer = doc.createElement("div");
    footer.style.cssText =
      "padding: 12px 16px; border-top: 1px solid #e0e0e0; background: #f9f9f9;";
    footer.innerHTML =
      '<div style="display: flex; gap: 8px;">' +
      '<button id="btn-summarize" style="flex: 1; padding: 10px 16px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">📝 Summarize</button>' +
      '<button id="btn-translate" style="flex: 1; padding: 10px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🌐 Translate</button>' +
      "</div>";

    // Chat area (for future AI conversation)
    const chatArea = doc.createElement("div");
    chatArea.id = "paper-copilot-chat-area";
    chatArea.style.cssText =
      "flex: 1; overflow-y: auto; padding: 16px; display: none;";
    chatArea.innerHTML =
      '<div id="chat-messages" style="display: flex; flex-direction: column; gap: 12px;"></div>';

    // Assemble
    sidebar.appendChild(header);
    sidebar.appendChild(content);
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
  private static showMessage(win: Window, html: string): void {
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

    // Hide chat area
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
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
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    const contentArea = win.document.querySelector(
      "#" + this.sidebarId + " > div:nth-child(2)",
    );

    if (chatArea && contentArea) {
      // Hide welcome content, show chat
      (contentArea as HTMLElement).style.display = "none";
      chatArea.style.display = "block";

      const messages = win.document.getElementById("chat-messages");
      if (messages) {
        const msgDiv = win.document.createElement("div");
        msgDiv.style.cssText =
          "padding: 12px; border-radius: 8px; max-width: 90%; font-size: 14px; line-height: 1.5;";

        if (role === "user") {
          msgDiv.style.cssText += "background: #e3f2fd; margin-left: auto;";
        } else {
          msgDiv.style.cssText += "background: #f5f5f5; margin-right: auto;";
        }

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

    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
    }
  }
}
