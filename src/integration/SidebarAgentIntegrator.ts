/**
 * Sidebar Agent Integrator
 * Connects the Sidebar UI to the Agent Runtime
 */

import { Agent } from "../agent";
import { ZoteroGateway, PdfService } from "../services";
import { ToolDefinition, AgentMessage } from "../agent/types";
import { SidebarUI } from "../modules/sidebar";
import { loadAllTools } from "../tools";

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
 * SidebarAgentIntegrator
 * Bridges the SidebarUI with the Agent runtime.
 * Handles user actions and displays responses in the sidebar.
 */
export class SidebarAgentIntegrator {
  private agent: Agent;
  private zoteroGateway: ZoteroGateway;
  private pdfService: PdfService;
  private win: Window;

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
    const { getAllTools } = require("../tools");
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
   * Handle "Ask AI" button click
   */
  async handleAskAI(question: string): Promise<void> {
    this.showLoading("🤖 Thinking...");

    try {
      const response = await this.agent.process({
        messages: [{ role: "user", content: question, timestamp: Date.now() }],
        context: this.getContext(),
      });

      if (response.error) {
        this.showError(`Error: ${response.error}`);
      } else {
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

      const response = await this.agent.process({
        messages: [
          { role: "user", content: userMessage, timestamp: Date.now() },
        ],
        context: this.getContext(),
      });

      if (response.error) {
        this.showError(`Summarization error: ${response.error}`);
      } else {
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
      const response = await this.agent.process({
        messages: [
          {
            role: "user",
            content: `Translate the following text to English (or the user's preferred language):\n\n"${text}"`,
            timestamp: Date.now(),
          },
        ],
        context: this.getContext(),
      });

      if (response.error) {
        this.showError(`Translation error: ${response.error}`);
      } else {
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
      // The user will need to type a follow-up in the chat
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

      // Actually, let's just call handleAskAI with a default question
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
  private displayResponse(html: string): void {
    // Use SidebarUI's addChatMessage for assistant response
    SidebarUI.addChatMessage(this.win, "assistant", html);
  }

  /**
   * Display loading state in sidebar
   */
  private showLoading(message: string): void {
    // Show loading message in content area
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
