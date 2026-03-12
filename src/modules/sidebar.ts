/**
 * Zotero Paper Copilot - Sidebar UI Module
 * 
 * Using native HTML + zotero-plugin-toolkit
 * Reference: zotero-gpt, zotero-pdf-translate
 */

import { KnowledgeBase, CollectionDocument } from "./knowledge-base";
import { LLMAPI } from "./llm-api";

export class SidebarUI {
  private static sidebarId = "zotero-paper-copilot-sidebar";
  private static sidebarWidth = 400;
  
  /**
   * Create sidebar using ztoolkit.UI
   */
  public static create(win: Window): void {
    this.remove();
    
    const doc = win.document;
    
    // Create main container
    const sidebar = doc.createElement("div");
    sidebar.id = this.sidebarId;
    sidebar.style.cssText = 
      "position: fixed; right: 0; top: 0; width: " + this.sidebarWidth + 
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
      '</div>' +
      '<div style="margin-top: 20px; padding: 16px; background: #f0f7ff; border-radius: 8px;">' +
      '<div style="font-size: 14px; font-weight: 600; color: #0066cc; margin-bottom: 8px;">💡 Quick Tips</div>' +
      '<ul style="font-size: 13px; color: #555; padding-left: 20px; margin: 0;">' +
      '<li>Select any text in the PDF to get AI explanations</li>' +
      '<li>Click the summarize button to get paper summary</li>' +
      '<li>Use translate for instant translations</li>' +
      '</ul></div>';
    
    // Footer with buttons
    const footer = doc.createElement("div");
    footer.style.cssText = "padding: 12px 16px; border-top: 1px solid #e0e0e0; background: #f9f9f9;";
    footer.innerHTML = 
      '<div style="display: flex; gap: 8px;">' +
      '<button id="btn-summarize" style="flex: 1; padding: 10px 16px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">📝 Summarize</button>' +
      '<button id="btn-translate" style="flex: 1; padding: 10px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🌐 Translate</button>' +
      '<button id="btn-knowledge-base" style="flex: 1; padding: 10px 16px; background: #6f42c1; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">💡 Q&A</button>' +
      '</div>';
    
    // Chat area (for future AI conversation)
    const chatArea = doc.createElement("div");
    chatArea.id = "paper-copilot-chat-area";
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
    doc.getElementById("btn-knowledge-base")?.addEventListener("click", () => this.showKnowledgeBaseQA(win));
    
    // Log
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot sidebar created with native HTML");
    }
  }
  
  /**
   * Remove sidebar
   */
  public static remove(): void {
    const sidebar = document.getElementById(this.sidebarId);
    if (sidebar) {
      sidebar.remove();
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot sidebar removed");
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
   * Show summarize action
   */
  private static showSummarize(win: Window): void {
    this.showMessage(win, "📝 Generating paper summary...<br><br>This feature requires LLM API integration.");
  }
  
  /**
   * Show translate action
   */
  private static showTranslate(win: Window): void {
    this.showMessage(win, "🌐 Translation feature<br><br>Select text in PDF to translate.");
  }
  
  /**
   * Show message in content area
   */
  private static showMessage(win: Window, html: string): void {
    const content = win.document.querySelector("#" + this.sidebarId + " > div:nth-child(2)");
    if (content) {
      (content as HTMLElement).style.display = "block";
      content.innerHTML = '<div style="padding: 20px; text-align: center; color: #333; font-size: 14px;">' + html + '</div>';
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
    const content = win.document.querySelector("#" + this.sidebarId + " > div:nth-child(2)");
    if (content) {
      (content as HTMLElement).style.display = "block";
      
      const displayText = text.length > 500 ? text.substring(0, 500) + "..." : text;
      const escapedText = displayText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      
      content.innerHTML = 
        '<div style="padding: 16px;">' +
        '<div style="font-size: 12px; color: #999; margin-bottom: 8px;">Selected Text:</div>' +
        '<div style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.6; margin-bottom: 16px; max-height: 200px; overflow-y: auto;">' +
        escapedText +
        '</div>' +
        '<div style="display: flex; gap: 8px;">' +
        '<button id="btn-ask-about-selection" style="flex: 1; padding: 10px 16px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">💬 Ask AI</button>' +
        '<button id="btn-translate-selection" style="flex: 1; padding: 10px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🌐 Translate</button>' +
        '</div>' +
        '</div>';
      
      win.document.getElementById("btn-ask-about-selection")?.addEventListener("click", () => {
        this.showMessage(win, "🤖 AI Question feature coming soon!");
      });
      
      win.document.getElementById("btn-translate-selection")?.addEventListener("click", () => {
        this.showMessage(win, "🌐 Translation feature coming soon!");
      });
    }
    
    const chatArea = win.document.getElementById("paper-copilot-chat-area");
    if (chatArea) {
      chatArea.style.display = "none";
    }
  }
  
  /**
   * Show Knowledge Base Q&A interface
   */
  public static async showKnowledgeBaseQA(win: Window): Promise<void> {
    const content = win.document.querySelector("#" + this.sidebarId + " > div:nth-child(2)");
    if (!content) return;
    
    // Check if LLM is configured
    if (!LLMAPI.isConfigured()) {
      this.showMessage(win, 
        '<div style="text-align: center; padding: 20px;">' +
        '<div style="font-size: 24px; margin-bottom: 16px;">⚠️</div>' +
        '<div style="font-size: 16px; margin-bottom: 8px; color: #d32f2f;">LLM API Not Configured</div>' +
        '<div style="font-size: 14px; color: #666;">Please configure your API key in Paper Copilot preferences to use the Knowledge Base Q&A feature.</div>' +
        '</div>'
      );
      return;
    }
    
    // Show loading first
    (content as HTMLElement).style.display = "block";
    content.innerHTML = '<div style="padding: 40px 20px; text-align: center;"><div style="font-size: 16px;">Loading knowledge base...</div></div>';
    
    try {
      // Get library stats
      const stats = await KnowledgeBase.getCollectionStats();
      
      // Hide chat area
      const chatArea = win.document.getElementById("paper-copilot-chat-area");
      if (chatArea) {
        chatArea.style.display = "none";
      }
      
      // Build stats display
      const yearStats = Object.entries(stats.byYear)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .slice(0, 5)
        .map(([year, count]) => `<span style="background: #e3f2fd; padding: 2px 8px; border-radius: 4px; margin: 2px; font-size: 12px;">${year}: ${count}</span>`)
        .join(" ");
      
      const typeStats = Object.entries(stats.byType)
        .map(([type, count]) => `<span style="background: #f5f5f5; padding: 2px 8px; border-radius: 4px; margin: 2px; font-size: 12px;">${type}: ${count}</span>`)
        .join(" ");
      
      const tagStats = stats.topTags
        .slice(0, 8)
        .map(t => `<span style="background: #fff3e0; padding: 2px 8px; border-radius: 4px; margin: 2px; font-size: 12px;">${t.tag} (${t.count})</span>`)
        .join(" ");
      
      content.innerHTML = 
        '<div style="padding: 16px;">' +
        '<div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #333;">💡 Ask about your library</div>' +
        
        // Stats summary
        '<div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 16px;">' +
        `<div style="font-size: 14px; margin-bottom: 8px;"><strong>📚 ${stats.totalPapers} papers</strong> in your library</div>` +
        (yearStats ? `<div style="font-size: 12px; margin-bottom: 8px; color: #666;">Years: ${yearStats}</div>` : "") +
        (typeStats ? `<div style="font-size: 12px; margin-bottom: 8px; color: #666;">Types: ${typeStats}</div>` : "") +
        (tagStats ? `<div style="font-size: 12px; color: #666;">Tags: ${tagStats}</div>` : "") +
        '</div>' +
        
        // Question input
        '<div style="margin-bottom: 12px;">' +
        '<textarea id="kb-question" rows="3" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; font-family: inherit; resize: vertical; box-sizing: border-box;" placeholder="Ask a question about your papers... (e.g., What are the main topics in my library?)"></textarea>' +
        '</div>' +
        
        '<div style="display: flex; gap: 8px; margin-bottom: 16px;">' +
        '<button id="btn-ask-kb" style="flex: 1; padding: 12px 16px; background: #6f42c1; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">🔍 Ask</button>' +
        '<button id="btn-clear-kb-chat" style="padding: 12px 16px; background: #f5f5f5; color: #666; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 14px;">🗑️ Clear</button>' +
        '</div>' +
        
        // Chat container
        '<div id="kb-chat-container" style="max-height: 400px; overflow-y: auto; border: 1px solid #eee; border-radius: 8px; padding: 12px; background: #fafafa;"></div>' +
        '</div>';
      
      // Event listeners
      win.document.getElementById("btn-ask-kb")?.addEventListener("click", async () => {
        const questionInput = win.document.getElementById("kb-question") as HTMLTextAreaElement;
        const question = questionInput?.value.trim();
        
        if (!question) {
          return;
        }
        
        await this.handleKBQuestion(win, question);
      });
      
      win.document.getElementById("btn-clear-kb-chat")?.addEventListener("click", () => {
        const container = win.document.getElementById("kb-chat-container");
        if (container) {
          container.innerHTML = "";
        }
      });
      
      // Allow Enter to submit (Shift+Enter for newline)
      const questionTextarea = win.document.getElementById("kb-question") as HTMLTextAreaElement;
      questionTextarea?.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          win.document.getElementById("btn-ask-kb")?.click();
        }
      });
      
    } catch (e: any) {
      this.showMessage(win, `Error loading knowledge base: ${e.message}`);
    }
  }
  
  /**
   * Handle knowledge base question submission
   */
  private static async handleKBQuestion(win: Window, question: string): Promise<void> {
    const container = win.document.getElementById("kb-chat-container");
    if (!container) return;
    
    // Add user question
    const userMsg = win.document.createElement("div");
    userMsg.style.cssText = "padding: 12px; background: #e3f2fd; border-radius: 8px; margin-bottom: 12px; font-size: 14px;";
    userMsg.textContent = question;
    container.appendChild(userMsg);
    
    // Add loading indicator
    const loadingMsg = win.document.createElement("div");
    loadingMsg.id = "kb-loading";
    loadingMsg.style.cssText = "padding: 12px; background: #f5f5f5; border-radius: 8px; margin-bottom: 12px; font-size: 14px; color: #666;";
    loadingMsg.textContent = "🤔 Searching and thinking...";
    container.appendChild(loadingMsg);
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
    
    try {
      let fullAnswer = "";
      
      // Stream the answer
      const result = await KnowledgeBase.askQuestion(question, undefined, {
        maxDocuments: 5,
        stream: (chunk: string) => {
          fullAnswer += chunk;
          loadingMsg.textContent = "🤔 " + fullAnswer.substring(0, 100) + (fullAnswer.length > 100 ? "..." : "");
        },
      });
      
      // Remove loading indicator
      loadingMsg.remove();
      
      // Add answer
      const answerMsg = win.document.createElement("div");
      answerMsg.style.cssText = "padding: 12px; background: #f5f5f5; border-radius: 8px; margin-bottom: 12px; font-size: 14px; line-height: 1.6;";
      
      // Format the answer with line breaks
      const formattedAnswer = result.answer
        .replace(/\n\n/g, "</p><p>")
        .replace(/\n/g, "<br>");
      
      answerMsg.innerHTML = `<p>${formattedAnswer}</p>`;
      
      // Add sources if available
      if (result.sources.length > 0) {
        const sourcesDiv = win.document.createElement("div");
        sourcesDiv.style.cssText = "margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 12px; color: #666;";
        sourcesDiv.innerHTML = "<strong>📚 Sources:</strong><br>" + 
          result.sources.slice(0, 3).map(s => `• ${s.title.substring(0, 60)}${s.title.length > 60 ? "..." : ""}`).join("<br>");
        answerMsg.appendChild(sourcesDiv);
      }
      
      container.appendChild(answerMsg);
      
    } catch (e: any) {
      loadingMsg.remove();
      
      const errorMsg = win.document.createElement("div");
      errorMsg.style.cssText = "padding: 12px; background: #ffebee; border-radius: 8px; margin-bottom: 12px; font-size: 14px; color: #c62828;";
      errorMsg.textContent = `Error: ${e.message}`;
      container.appendChild(errorMsg);
    }
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
    
    // Clear input
    const questionInput = win.document.getElementById("kb-question") as HTMLTextAreaElement;
    if (questionInput) {
      questionInput.value = "";
    }
  }
}
