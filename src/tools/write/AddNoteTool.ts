/**
 * Tool Registry System - Add Note Tool
 * Add a note to a Zotero item
 */

import { BaseTool, ToolContext } from "../base/Tool";
import { ToolResult } from "../../agent/types";

export class AddNoteTool extends BaseTool {
  name = "add_note";
  description = "Add a note to a Zotero item";
  category = "write";

  parameters = [
    {
      name: "itemID",
      description: "The Zotero item ID to attach the note to",
      type: "number",
      required: true,
    },
    {
      name: "content",
      description: "The note content (supports HTML)",
      type: "string",
      required: true,
    },
  ];

  async doExecute(
    args: { itemID: number; content: string },
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      const { itemID, content } = args;
      const { services } = context;

      if (!itemID || typeof itemID !== "number") {
        return {
          result: null,
          error: "Invalid itemID: must be a number",
        };
      }

      if (!content || typeof content !== "string") {
        return {
          result: null,
          error: "Invalid content: must be a non-empty string",
        };
      }

      const item = services.zotero.getItem(itemID);
      if (!item) {
        return {
          result: null,
          error: `Item with ID ${itemID} not found`,
        };
      }

      const noteId = await services.zotero.addNote(item, content);

      if (noteId === -1) {
        return {
          result: null,
          error: "Failed to create note",
        };
      }

      // Refresh the view to show the new note
      services.zotero.refreshView();

      return {
        result: {
          success: true,
          noteID: noteId,
          message: `Note added successfully to item ${itemID}`,
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
}
