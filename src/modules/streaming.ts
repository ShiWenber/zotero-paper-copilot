/**
 * Zotero Paper Copilot - Streaming UI Module
 * 
 * Provides streaming response UI similar to ChatGPT
 * Integrates with sidebar for real-time text display
 */

import { LLMAPI, ChatMessage } from "./llm-api";

export interface ChatMessageUI {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  timestamp: Date;
}

export class StreamingUI {
  private static messageQueue: Map<string, ChatMessageUI> = new Map();
  private static currentStreamId: string | null = null;
  
  /**
   * Initialize streaming UI
   */
  public static init(win: Window): void {
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Streaming UI initialized");
    }
  }
  
  /**
   * Send a message and get streaming response
   */
  public static async sendMessage(
    win: Window,
    messages: ChatMessage[],
    options?: { 
      onChunk?: (chunk: string) => void;
      onComplete?: (fullContent: string) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<string> {
    const messageId = this.generateId();
    this.currentStreamId = messageId;
    
    // Create placeholder message
    const assistantMessage: ChatMessageUI = {
      id: messageId,
      role: "assistant",
      content: "",
      isStreaming: true,
      timestamp: new Date(),
    };
    
    this.messageQueue.set(messageId, assistantMessage);
    
    // Display placeholder in UI
    this.displayStreamingMessage(win, assistantMessage);
    
    try {
      const response = await LLMAPI.streamChat(
        messages,
        (chunk) => {
          // Update message content
          const msg = this.messageQueue.get(messageId);
          if (msg) {
            msg.content += chunk;
            this.updateStreamingContent(win, messageId, msg.content);
            options?.onChunk?.(chunk);
          }
        },
        {
          onComplete: (fullContent) => {
            const msg = this.messageQueue.get(messageId);
            if (msg) {
              msg.isStreaming = false;
              msg.content = fullContent;
              this.finishStreaming(win, messageId);
              options?.onComplete?.(fullContent);
            }
            this.currentStreamId = null;
          },
          onError: (error) => {
            const msg = this.messageQueue.get(messageId);
            if (msg) {
              msg.isStreaming = false;
              msg.content = `Error: ${error.message}`;
              this.showError(win, messageId, error.message);
              options?.onError?.(error);
            }
            this.currentStreamId = null;
          },
        }
      );
      
      return response.content;
    } catch (error) {
      this.showError(win, messageId, (error as Error).message);
      this.currentStreamId = null;
      throw error;
    }
  }
  
  /**
   * Display streaming message placeholder
   */
  private static displayStreamingMessage(win: Window, message: ChatMessageUI): void {
    const chatArea = win.document.getElementById("paper-copilot-chat-messages");
    if (!chatArea) return;
    
    const messageEl = win.document.createElement("div");
    messageEl.id = `message-${message.id}`;
    messageEl.className = "paper-copilot-message paper-copilot-message-assistant";
    messageEl.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="message-text streaming">
          <span class="typing-indicator">
            <span></span><span></span><span></span>
          </span>
        </div>
      </div>
    `;
    
    chatArea.appendChild(messageEl);
    chatArea.scrollTop = chatArea.scrollHeight;
  }
  
  /**
   * Update streaming content
   */
  private static updateStreamingContent(win: Window, messageId: string, content: string): void {
    const messageEl = win.document.getElementById(`message-${messageId}`);
    if (!messageEl) return;
    
    const textEl = messageEl.querySelector(".message-text");
    if (textEl) {
      // Escape HTML
      const escaped = this.escapeHtml(content);
      textEl.innerHTML = escaped;
    }
    
    // Scroll to bottom
    const chatArea = win.document.getElementById("paper-copilot-chat-messages");
    if (chatArea) {
      chatArea.scrollTop = chatArea.scrollHeight;
    }
  }
  
  /**
   * Finish streaming
   */
  private static finishStreaming(win: Window, messageId: string): void {
    const messageEl = win.document.getElementById(`message-${messageId}`);
    if (!messageEl) return;
    
    const textEl = messageEl.querySelector(".message-text");
    if (textEl) {
      textEl.classList.remove("streaming");
    }
    
    const indicator = messageEl.querySelector(".typing-indicator");
    if (indicator) {
      indicator.remove();
    }
  }
  
  /**
   * Show error
   */
  private static showError(win: Window, messageId: string, error: string): void {
    const messageEl = win.document.getElementById(`message-${messageId}`);
    if (!messageEl) return;
    
    const textEl = messageEl.querySelector(".message-text");
    if (textEl) {
      textEl.classList.remove("streaming");
      textEl.innerHTML = `<span class="error">${this.escapeHtml(error)}</span>`;
    }
  }
  
  /**
   * Add user message to chat
   */
  public static addUserMessage(win: Window, content: string): string {
    const messageId = this.generateId();
    
    const chatArea = win.document.getElementById("paper-copilot-chat-messages");
    if (!chatArea) return messageId;
    
    const messageEl = win.document.createElement("div");
    messageEl.id = `message-${messageId}`;
    messageEl.className = "paper-copilot-message paper-copilot-message-user";
    messageEl.innerHTML = `
      <div class="message-avatar">👤</div>
      <div class="message-content">
        <div class="message-text">${this.escapeHtml(content)}</div>
      </div>
    `;
    
    chatArea.appendChild(messageEl);
    chatArea.scrollTop = chatArea.scrollHeight;
    
    return messageId;
  }
  
  /**
   * Clear all messages
   */
  public static clearMessages(win: Window): void {
    const chatArea = win.document.getElementById("paper-copilot-chat-messages");
    if (chatArea) {
      chatArea.innerHTML = "";
    }
    this.messageQueue.clear();
    this.currentStreamId = null;
  }
  
  /**
   * Check if currently streaming
   */
  public static isStreaming(): boolean {
    return this.currentStreamId !== null;
  }
  
  /**
   * Stop current stream (not implemented for HTTP streaming)
   */
  public static stopStream(): void {
    // Note: HTTP streaming doesn't support easy cancellation
    // This is a placeholder for future implementation
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Stop stream requested (not implemented for HTTP)");
    }
  }
  
  /**
   * Generate unique ID
   */
  private static generateId(): string {
    return "msg_" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
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
 * Add streaming styles to sidebar
 */
export function getStreamingStyles(): string {
  return `
    .paper-copilot-message {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      animation: fadeIn 0.3s ease;
    }
    
    .paper-copilot-message-user {
      flex-direction: row-reverse;
    }
    
    .message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    
    .paper-copilot-message-assistant .message-avatar {
      background: #0066cc;
      color: white;
    }
    
    .paper-copilot-message-user .message-avatar {
      background: #28a745;
      color: white;
    }
    
    .message-content {
      flex: 1;
      max-width: 85%;
    }
    
    .message-text {
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    
    .paper-copilot-message-assistant .message-text {
      background: #f5f5f5;
      border-top-left-radius: 4px;
    }
    
    .paper-copilot-message-user .message-text {
      background: #0066cc;
      color: white;
      border-top-right-radius: 4px;
    }
    
    .message-text.streaming {
      min-height: 24px;
    }
    
    .message-text .error {
      color: #dc3545;
    }
    
    .typing-indicator {
      display: inline-flex;
      gap: 3px;
    }
    
    .typing-indicator span {
      width: 6px;
      height: 6px;
      background: #666;
      border-radius: 50%;
      animation: typing 1.4s infinite ease-in-out;
    }
    
    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.4;
      }
      30% {
        transform: translateY(-4px);
        opacity: 1;
      }
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
}

/**
 * Initialize streaming UI
 */
export function initStreamingUI(win: Window): void {
  StreamingUI.init(win);
  
  // Add styles
  const styleId = "paper-copilot-streaming-styles";
  if (!win.document.getElementById(styleId)) {
    const style = win.document.createElement("style");
    style.id = styleId;
    style.textContent = getStreamingStyles();
    win.document.head.appendChild(style);
  }
}
