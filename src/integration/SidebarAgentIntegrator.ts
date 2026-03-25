/**
 * Sidebar Agent Integrator
 * Connects the Sidebar UI to the Agent Runtime
 */

import { Agent } from "../agent";
import { ZoteroGateway, PdfService } from "../services";
import { ToolDefinition, AgentMessage } from "../agent/types";
import { SidebarUI } from "../modules/sidebar";
import { loadAllTools, getAllTools } from "../tools";

/**
 * MockAgent extends Agent with a placeholder LLM implementation
 * that returns mock responses for testing the integration flow.
 */
class MockAgent extends Agent {
  protected async callLLM(
    messages: AgentMessage[],
    tools: ToolDefinition[],
    context?: Record<string, any>,
  ): Promise<{ content: string; toolCalls?: any[]; error?: string }> {
    const lastMessage = messages[messages.length - 1];
    const userContent = lastMessage?.content || "";

    // Mock response based on the user's question
    if (userContent.toLowerCase().includes("summarize")) {
      return {
        content:
          "📝 **Paper Summary**\n\nThis feature requires LLM API integration. Configure your API key in preferences to enable AI-powered summarization.",
      };
    }

    if (userContent.toLowerCase().includes("translate")) {
      return {
        content:
          "🌐 **Translation**\n\nTranslation requires LLM API integration. Please configure your API key in preferences to enable translations.",
      };
    }

    // Default response
    return {
      content:
        "🤖 **Agent is ready!**\n\nLLM integration is pending. This is a placeholder response to confirm the integration flow works.\n\nConfigure your LLM API to enable full AI capabilities.",
    };
  }
}

/**
 * Sidebar Agent Integrator
 * Bridges the SidebarUI with the Agent runtime.
 * Handles user actions and displays responses in the sidebar.
 */
export class SidebarAgentIntegrator {
  private agent: Agent;
  private zoteroGateway: ZoteroGateway;
  private pdfService: PdfService;
  private win: Window;
  private chatHistory: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: number;
  }> = [];

  constructor(win: Window) {
    this.win = win;
    this.zoteroGateway = new ZoteroGateway();
    this.pdfService = new PdfService(this.zoteroGateway);
    this.agent = new MockAgent({
      systemPrompt:
        "You are a helpful AI assistant for Zotero Paper Copilot. You help users understand, summarize, and translate academic papers.",
    });
  }

  /**
   * Initialize the integrator - load all tools and register them with the agent
   */
  initialize(): void {
    // Load all tools from the registry
    loadAllTools();

    // Get all loaded tools and register with agent
    const tools = getAllTools();

    for (const tool of tools) {
      if (!this.agent.hasTool(tool.name)) {
        this.agent.registerTool({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters || {},
          handler: async (
            args: Record<string, any>,
            context?: Record<string, any>,
          ) => {
            const toolContext = {
              window: this.win,
              agent: this.agent,
              services: {
                zotero: this.zoteroGateway,
                pdf: this.pdfService,
              },
            };
            return tool.execute(args, toolContext);
          },
        });
      }
    }

    this.log("SidebarAgentIntegrator initialized with", tools.length, "tools");
  }

  /**
   * Get chat history for sync_notes tool
   */
  getChatHistory(): Array<{
    role: "user" | "assistant";
    content: string;
    timestamp?: number;
  }> {
    return this.chatHistory;
  }

  /**
   * Sync current chat conversation as a note to the selected Zotero item
   */
  async syncNotes(): Promise<void> {
    if (this.chatHistory.length === 0) {
      SidebarUI.showMessage(
        this.win,
        `<div style="text-align: center; color: #dc3545;">
          <div style="font-size: 20px; margin-bottom: 8px;">⚠️</div>
          <div>No conversation to sync. Start chatting first!</div>
        </div>`,
      );
      return;
    }

    SidebarUI.showMessage(this.win, "Syncing conversation as note...");

    try {
      // Get selected item
      const items = this.zoteroGateway.getSelectedItems();
      const item = items.length > 0 ? items[0] : null;

      if (!item) {
        SidebarUI.showMessage(
          this.win,
          `<div style="text-align: center; color: #dc3545;">
            <div style="font-size: 20px; margin-bottom: 8px;">⚠️</div>
            <div>No Zotero item selected. Please select an item first.</div>
          </div>`,
        );
        return;
      }

      // Format chat history as HTML note
      const timestamp = new Date().toLocaleString();
      let noteHtml = `<h3>Chat Note - ${timestamp}</h3>`;
      noteHtml += `<p><em>Synced from Paper Copilot</em></p><hr>`;
      noteHtml += `<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif;">`;

      for (const msg of this.chatHistory) {
        const roleLabel = msg.role === "user" ? "You" : "Paper Copilot";
        const roleColor = msg.role === "user" ? "#0066cc" : "#28a745";
        const bgColor = msg.role === "user" ? "#e3f2fd" : "#f5f5f5";

        noteHtml += `<div style="margin-bottom: 12px; padding: 8px 12px; background: ${bgColor}; border-radius: 6px;">`;
        noteHtml += `<strong style="color: ${roleColor};">${roleLabel}</strong>`;
        if (msg.timestamp) {
          const time = new Date(msg.timestamp).toLocaleTimeString();
          noteHtml += ` <span style="color: #999; font-size: 11px;">${time}</span>`;
        }
        noteHtml += `<br><span style="font-size: 14px; line-height: 1.5;">${msg.content}</span>`;
        noteHtml += `</div>`;
      }

      noteHtml += `</div>`;

      // Add note via Zotero gateway
      const noteId = await this.zoteroGateway.addNote(item, noteHtml);

      if (noteId === -1) {
        SidebarUI.showMessage(
          this.win,
          `<div style="text-align: center; color: #dc3545;">
            <div style="font-size: 20px; margin-bottom: 8px;">⚠️</div>
            <div>Failed to create note. Please try again.</div>
          </div>`,
        );
        return;
      }

      this.zoteroGateway.refreshView();

      SidebarUI.showMessage(
        this.win,
        `<div style="text-align: center; color: #28a745;">
          <div style="font-size: 20px; margin-bottom: 8px;">✅</div>
          <div>Conversation saved as note!</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">${this.chatHistory.length} messages synced</div>
        </div>`,
      );
    } catch (err: any) {
      SidebarUI.showMessage(
        this.win,
        `<div style="text-align: center; color: #dc3545;">
          <div style="font-size: 20px; margin-bottom: 8px;">⚠️</div>
          <div>Error: ${err?.message ?? "Unknown error"}</div>
        </div>`,
      );
    }
  }

  /**
   * Handle "Ask AI" button click
   */
  async handleAskAI(question: string): Promise<void> {
    this.showLoading("🤖 Thinking...");

    try {
      // Add user message to chat history
      this.chatHistory.push({
        role: "user",
        content: question,
        timestamp: Date.now(),
      });

      // Display user message in chat
      SidebarUI.addChatMessage(this.win, "user", question);

      const response = await this.agent.process({
        messages: this.chatHistory.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        context: this.getContext(),
      });

      if (response.error) {
        this.showError(`Error: ${response.error}`);
      } else {
        // Add assistant response to chat history
        this.chatHistory.push({
          role: "assistant",
          content: response.content,
          timestamp: Date.now(),
        });
        this.displayResponse(response.content);
      }
    } catch (err: any) {
      this.showError(`Request failed: ${err?.message ?? "Unknown error"}`);
    }
  }

  /**
   * Handle "Summarize" button click
   */
  async handleSummarize(): Promise<void> {
    this.showLoading("📝 Summarizing paper...");

    try {
      // Get current item context
      const items = this.zoteroGateway.getSelectedItems();
      const item = items.length > 0 ? items[0] : null;

      let contextText = "";
      if (item) {
        const metadata = this.zoteroGateway.getItemMetadata(item);
        contextText = `Paper: ${metadata.title}\nAuthors: ${metadata.authors.join(", ")}\nYear: ${metadata.year ?? "Unknown"}\n\n`;
      }

      // Get PDF text if available
      let pdfText = "";
      if (item) {
        const pdf = this.zoteroGateway.getPDF(item);
        if (pdf) {
          pdfText = (await this.pdfService.getPdfText(pdf)).substring(0, 5000);
        }
      }

      const userMessage =
        contextText +
        (pdfText
          ? `Please summarize the following paper content:\n\n${pdfText}`
          : "Please summarize this paper.");

      // Add to chat history
      this.chatHistory.push({
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
      });

      const response = await this.agent.process({
        messages: this.chatHistory.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        context: this.getContext(),
      });

      if (response.error) {
        this.showError(`Summarization error: ${response.error}`);
      } else {
        this.chatHistory.push({
          role: "assistant",
          content: response.content,
          timestamp: Date.now(),
        });
        this.displayResponse(response.content);
      }
    } catch (err: any) {
      this.showError(
        `Summarization failed: ${err?.message ?? "Unknown error"}`,
      );
    }
  }

  /**
   * Handle "Translate" button click
   */
  async handleTranslate(text: string): Promise<void> {
    if (!text || text.trim().length === 0) {
      this.showError("No text selected to translate.");
      return;
    }

    this.showLoading("🌐 Translating...");

    try {
      const translateMsg = `Translate the following text to English (or the user's preferred language):\n\n"${text}"`;
      this.chatHistory.push({
        role: "user",
        content: translateMsg,
        timestamp: Date.now(),
      });

      const response = await this.agent.process({
        messages: this.chatHistory.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        context: this.getContext(),
      });

      if (response.error) {
        this.showError(`Translation error: ${response.error}`);
      } else {
        this.chatHistory.push({
          role: "assistant",
          content: response.content,
          timestamp: Date.now(),
        });
        this.displayResponse(response.content);
      }
    } catch (err: any) {
      this.showError(`Translation failed: ${err?.message ?? "Unknown error"}`);
    }
  }

  /**
   * Handle selected text action (Ask or Translate)
   */
  async handleSelectedText(
    text: string,
    action: "ask" | "translate",
  ): Promise<void> {
    if (action === "ask") {
      // For "ask", use the text as context for a follow-up question
      SidebarUI.showMessage(
        this.win,
        `<div style="text-align: left;">
          <div style="font-size: 12px; color: #999; margin-bottom: 8px;">Selected Text:</div>
          <div style="background: #f5f7ff; padding: 12px; border-radius: 6px; font-size: 13px; line-height: 1.5; margin-bottom: 12px; max-height: 150px; overflow-y: auto;">
            ${text.substring(0, 300)}${text.length > 300 ? "..." : ""}
          </div>
          <div style="font-size: 13px; color: #555;">Ask a follow-up question about this text.</div>
        </div>`,
      );

      await this.handleAskAI(
        `Please explain or elaborate on the following text from this paper:\n\n"${text}"`,
      );
    } else {
      await this.handleTranslate(text);
    }
  }

  /**
   * Display response in sidebar using chat UI
   */
  private displayResponse(content: string): void {
    // Use SidebarUI's addChatMessage for assistant response
    SidebarUI.addChatMessage(this.win, "assistant", content);
  }

  /**
   * Display loading state in sidebar
   */
  private showLoading(message: string): void {
    SidebarUI.showMessage(this.win, message);
  }

  /**
   * Display error in sidebar
   */
  private showError(message: string): void {
    SidebarUI.showMessage(
      this.win,
      `<div style="color: #dc3545; text-align: center;">
        <div style="font-size: 20px; margin-bottom: 8px;">⚠️</div>
        <div>${message}</div>
      </div>`,
    );
  }

  /**
   * Get context for agent requests
   */
  private getContext(): Record<string, any> {
    const items = this.zoteroGateway.getSelectedItems();
    return {
      window: this.win,
      services: {
        zotero: this.zoteroGateway,
        pdf: this.pdfService,
      },
      selectedItems: items,
    };
  }

  private log(...args: any[]): void {
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("[SidebarAgentIntegrator]", ...args);
    } else if (typeof console !== "undefined") {
      console.log("[SidebarAgentIntegrator]", ...args);
    }
  }
}
