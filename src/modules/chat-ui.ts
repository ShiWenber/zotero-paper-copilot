/**
 * Zotero Paper Copilot - Chat UI Module
 *
 * Provides interactive Q&A functionality for selected blocks
 * Integrates with LLM API and streaming UI
 */

import { LLMAPI, ChatMessage } from "./llm-api";
import { StreamingUI } from "./streaming";
import { PDFParsing, PDFBlock } from "./pdf-parsing";
import { FigureDetection, FigureBlock } from "./figure-detection";

export interface ChatContext {
  selectedText?: string;
  selectedBlock?: PDFBlock | FigureBlock;
  pageNumber?: number;
  paperTitle?: string;
  paperAuthors?: string[];
}

export class ChatUI {
  private static chatHistory: ChatMessage[] = [];
  private static maxHistory = 20;

  /**
   * Initialize chat UI
   */
  public static init(win: Window): void {
    // Add system message
    this.chatHistory = [
      {
        role: "system",
        content:
          "You are a helpful academic research assistant. Answer questions about the selected text from scientific papers.",
      },
    ];

    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Chat UI initialized");
    }
  }

  /**
   * Handle selected text and start Q&A
   */
  public static async handleSelectedText(
    win: Window,
    text: string,
    context?: ChatContext,
  ): Promise<void> {
    // Add user message
    StreamingUI.addUserMessage(win, text);

    // Build messages with context
    const messages = this.buildMessages(text, context);

    // Send to LLM with streaming
    try {
      await StreamingUI.sendMessage(win, messages, {
        onChunk: (chunk) => {
          // Could add audio feedback here
        },
        onComplete: (fullContent) => {
          // Add to history
          this.addToHistory({ role: "user", content: text });
          this.addToHistory({ role: "assistant", content: fullContent });
        },
        onError: (error) => {
          if (typeof ztoolkit !== "undefined") {
            ztoolkit.log("Paper Copilot: Chat error:", error);
          }
        },
      });
    } catch (error) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Chat error:", error);
      }
    }
  }

  /**
   * Handle figure/block click Q&A
   */
  public static async handleBlockClick(
    win: Window,
    block: PDFBlock | FigureBlock,
    context?: ChatContext,
  ): Promise<void> {
    let prompt: string;

    if ("type" in block && block.type === "figure") {
      prompt = `Please explain this figure: ${block.label}`;
      if (block.caption) {
        prompt += `\n\nFigure caption: ${block.caption}`;
      }
    } else if ("type" in block && block.type === "table") {
      prompt = `Please explain this table: ${block.label}`;
      if (block.caption) {
        prompt += `\n\nTable caption: ${block.caption}`;
      }
    } else {
      prompt = block.text.substring(0, 1000);
    }

    await this.handleSelectedText(win, prompt, {
      ...context,
      selectedBlock: block,
    });
  }

  /**
   * Send free-form question about selected content
   */
  public static async sendQuestion(
    win: Window,
    question: string,
    context?: ChatContext,
  ): Promise<void> {
    // Add user question
    StreamingUI.addUserMessage(win, question);

    // Build context-aware messages
    let userContent = question;

    if (context?.selectedText) {
      userContent = `Question: ${question}\n\nSelected text from paper:\n${context.selectedText}`;
    }

    if (context?.paperTitle) {
      userContent += `\n\nPaper: ${context.paperTitle}`;
    }
    if (context?.paperAuthors) {
      userContent += `\nAuthors: ${context.paperAuthors.join(", ")}`;
    }

    const messages = [
      ...this.chatHistory,
      { role: "user", content: userContent },
    ];

    try {
      await StreamingUI.sendMessage(win, messages, {
        onComplete: (fullContent) => {
          this.addToHistory({ role: "user", content: userContent });
          this.addToHistory({ role: "assistant", content: fullContent });
        },
      });
    } catch (error) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Question error:", error);
      }
    }
  }

  /**
   * Build messages with context
   */
  private static buildMessages(
    text: string,
    context?: ChatContext,
  ): ChatMessage[] {
    const messages: ChatMessage[] = [...this.chatHistory];

    let userContent = "";

    // Add context info
    if (context?.paperTitle) {
      userContent += `Paper: ${context.paperTitle}\n`;
    }
    if (context?.paperAuthors && context.paperAuthors.length > 0) {
      userContent += `Authors: ${context.paperAuthors.join(", ")}\n`;
    }
    if (context?.pageNumber) {
      userContent += `Current page: ${context.pageNumber}\n`;
    }

    userContent += `\nSelected text:\n${text}\n\nPlease answer any questions about this content.`;

    messages.push({ role: "user", content: userContent });

    return messages;
  }

  /**
   * Add message to history
   */
  private static addToHistory(message: ChatMessage): void {
    this.chatHistory.push(message);

    // Trim history if too long
    if (this.chatHistory.length > this.maxHistory + 1) {
      // Keep system message
      const system = this.chatHistory[0];
      const rest = this.chatHistory.slice(1);
      this.chatHistory = [system, ...rest.slice(-this.maxHistory)];
    }
  }

  /**
   * Clear chat history
   */
  public static clearHistory(): void {
    this.chatHistory = [
      {
        role: "system",
        content:
          "You are a helpful academic research assistant. Answer questions about the selected text from scientific papers.",
      },
    ];
  }

  /**
   * Get chat history
   */
  public static getHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }

  /**
   * Generate quick action questions for selected text
   */
  public static getQuickActions(text: string): string[] {
    const actions: string[] = [];

    // Analyze text length and type
    const isShort = text.length < 200;
    const isLong = text.length > 500;

    // Always available
    actions.push("Explain this text");
    actions.push("Summarize this");

    if (
      text.toLowerCase().includes("figure") ||
      text.toLowerCase().includes("fig.")
    ) {
      actions.push("Describe this figure");
    }

    if (text.toLowerCase().includes("table")) {
      actions.push("Explain this table");
    }

    if (isLong) {
      actions.push("What are the key points?");
    }

    actions.push("Translate to Chinese");
    actions.push("Tell me more");

    return actions;
  }

  /**
   * Create chat input UI
   */
  public static createChatInput(win: Window, container: HTMLElement): void {
    const inputContainer = win.document.createElement("div");
    inputContainer.className = "paper-copilot-input-container";
    inputContainer.innerHTML = `
      <div class="quick-actions"></div>
      <div class="input-wrapper">
        <textarea 
          class="paper-copilot-input" 
          placeholder="Ask a question about the selected text..."
          rows="2"
        ></textarea>
        <button class="paper-copilot-send-btn" title="Send">
          <span>➤</span>
        </button>
      </div>
    `;

    // Add event listeners
    const textarea = inputContainer.querySelector(
      ".paper-copilot-input",
    ) as HTMLTextAreaElement;
    const sendBtn = inputContainer.querySelector(
      ".paper-copilot-send-btn",
    ) as HTMLButtonElement;

    const sendMessage = () => {
      const question = textarea.value.trim();
      if (question) {
        ChatUI.sendQuestion(win, question);
        textarea.value = "";
      }
    };

    sendBtn?.addEventListener("click", sendMessage);
    textarea?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    container.appendChild(inputContainer);
  }

  /**
   * Update quick actions
   */
  public static updateQuickActions(win: Window, text: string): void {
    const quickActions = win.document.querySelector(".quick-actions");
    if (!quickActions) return;

    const actions = this.getQuickActions(text);
    quickActions.innerHTML = actions
      .map(
        (action) =>
          `<button class="quick-action-btn" data-action="${this.escapeHtml(action)}">${this.escapeHtml(action)}</button>`,
      )
      .join("");

    // Add click handlers
    quickActions.querySelectorAll(".quick-action-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        if (action) {
          this.sendQuestion(win, action);
        }
      });
    });
  }

  /**
   * Escape HTML
   */
  private static escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Get chat UI styles
 */
export function getChatUIStyles(): string {
  return `
    .paper-copilot-input-container {
      border-top: 1px solid #e0e0e0;
      padding: 12px;
      background: white;
    }
    
    .quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }
    
    .quick-action-btn {
      padding: 4px 10px;
      font-size: 12px;
      background: #f0f0f0;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .quick-action-btn:hover {
      background: #0066cc;
      color: white;
    }
    
    .input-wrapper {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }
    
    .paper-copilot-input {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: none;
      outline: none;
      transition: border-color 0.2s;
    }
    
    .paper-copilot-input:focus {
      border-color: #0066cc;
    }
    
    .paper-copilot-send-btn {
      width: 40px;
      height: 40px;
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    
    .paper-copilot-send-btn:hover {
      background: #0052a3;
    }
    
    .paper-copilot-send-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
  `;
}

/**
 * Initialize chat UI
 */
export function initChatUI(win: Window): void {
  ChatUI.init(win);

  // Add styles
  const styleId = "paper-copilot-chat-ui-styles";
  if (!win.document.getElementById(styleId)) {
    const style = win.document.createElement("style");
    style.id = styleId;
    style.textContent = getChatUIStyles();
    win.document.head.appendChild(style);
  }
}
