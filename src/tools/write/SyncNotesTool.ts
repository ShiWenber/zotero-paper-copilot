/**
 * Tool Registry System - Sync Notes Tool
 * Sync chat conversation as notes in Zotero
 */

import { BaseTool, ToolContext } from "../base/Tool";
import { ToolResult } from "../../agent/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

export class SyncNotesTool extends BaseTool {
  name = "sync_notes";
  description =
    "Sync the current chat conversation as a note to the selected Zotero item";
  category = "write";

  parameters = [
    {
      name: "itemID",
      description:
        "The Zotero item ID to attach the note to. If not provided, uses the currently selected item.",
      type: "number",
      required: false,
    },
    {
      name: "title",
      description:
        "Optional title for the note. Defaults to 'Chat Note - [timestamp]'.",
      type: "string",
      required: false,
    },
    {
      name: "includeTimestamp",
      description: "Whether to include timestamps in the note. Default: true",
      type: "boolean",
      required: false,
    },
  ];

  async doExecute(
    args: { itemID?: number; title?: string; includeTimestamp?: boolean },
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      const { itemID, title, includeTimestamp = true } = args;
      const { services, window: win } = context;

      // Get the item to attach note to
      let targetItem: any = null;

      if (itemID) {
        targetItem = services.zotero.getItem(itemID);
        if (!targetItem) {
          return {
            result: null,
            error: `Item with ID ${itemID} not found`,
          };
        }
      } else {
        // Use currently selected items
        const selectedItems = services.zotero.getSelectedItems();
        if (selectedItems.length === 0) {
          return {
            result: null,
            error: "No item selected. Please select a Zotero item first.",
          };
        }
        targetItem = selectedItems[0];
      }

      // Get chat history from the sidebar
      const chatMessages = this.getChatHistory(win);

      if (!chatMessages || chatMessages.length === 0) {
        return {
          result: null,
          error: "No chat messages to sync. Start a conversation first.",
        };
      }

      // Format chat as a note
      const noteContent = this.formatChatAsNote(
        chatMessages,
        title,
        includeTimestamp,
      );

      // Add the note
      const noteId = await services.zotero.addNote(targetItem, noteContent);

      if (noteId === -1) {
        return {
          result: null,
          error: "Failed to create note",
        };
      }

      // Refresh the view
      services.zotero.refreshView();

      return {
        result: {
          success: true,
          noteID: noteId,
          itemID: targetItem.id,
          message: `Chat synced as note to item ${targetItem.id}`,
          messageCount: chatMessages.length,
        },
      };
    } catch (err: any) {
      this.log("execute error:", err);
      return {
        result: null,
        error: err?.message ?? String(err),
      };
    }
  }

  /**
   * Get chat history from the sidebar UI
   */
  private getChatHistory(win: Window): ChatMessage[] {
    try {
      // Try to get from the integrator's chat store
      const integrator = (win as any)["sidebarAgentIntegrator"];
      if (integrator && typeof integrator.getChatHistory === "function") {
        return integrator.getChatHistory();
      }

      // Try to get from sidebar UI's chat messages element
      const messagesEl = win.document.getElementById("chat-messages");
      if (!messagesEl) {
        return [];
      }

      const messages: ChatMessage[] = [];
      const msgDivs = messagesEl.querySelectorAll(":scope > div");

      for (const div of msgDivs) {
        // Determine role from styling
        const style = div.style.cssText || "";
        const isUser =
          style.includes("margin-left: auto") || style.includes("e3f2fd");
        const role: "user" | "assistant" = isUser ? "user" : "assistant";

        // Get text content (strip HTML)
        const content = div.innerHTML
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();

        if (content) {
          messages.push({ role, content });
        }
      }

      return messages;
    } catch (e) {
      this.log("getChatHistory error:", e);
      return [];
    }
  }

  /**
   * Format chat messages as a Zotero note
   */
  private formatChatAsNote(
    messages: ChatMessage[],
    title?: string,
    includeTimestamp = true,
  ): string {
    const timestamp = new Date().toLocaleString();
    const noteTitle = title || `Chat Note - ${timestamp}`;

    let html = `<h3>${noteTitle}</h3>`;
    html += `<p><em>Synced from Paper Copilot on ${timestamp}</em></p>`;
    html += `<hr>`;
    html += `<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif;">`;

    for (const msg of messages) {
      const roleLabel = msg.role === "user" ? "You" : "Paper Copilot";
      const roleColor = msg.role === "user" ? "#0066cc" : "#28a745";

      html += `<div style="margin-bottom: 12px;">`;
      html += `<strong style="color: ${roleColor};">${roleLabel}</strong>`;

      if (includeTimestamp && msg.timestamp) {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        html += ` <span style="color: #999; font-size: 11px;">${time}</span>`;
      }

      html += `<br>`;
      html += `<span style="font-size: 14px; line-height: 1.5;">${msg.content}</span>`;
      html += `</div>`;
    }

    html += `</div>`;

    return html;
  }
}
