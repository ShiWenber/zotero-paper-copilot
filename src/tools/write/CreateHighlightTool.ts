/**
 * Tool Registry System - Create Highlight Tool
 * Create a highlight annotation in a PDF
 */

import { BaseTool, ToolContext } from "../base/Tool";
import { ToolResult } from "../../agent/types";
import { Rect } from "../../services/types";

export class CreateHighlightTool extends BaseTool {
  name = "create_highlight";
  description = "Create a highlight annotation in a PDF";
  category = "write";

  parameters = [
    {
      name: "itemID",
      description: "The Zotero item ID of the PDF attachment",
      type: "number",
      required: true,
    },
    {
      name: "page",
      description: "Page number (1-indexed)",
      type: "number",
      required: true,
    },
    {
      name: "text",
      description: "The text to highlight",
      type: "string",
      required: true,
    },
    {
      name: "position",
      description: "Position object with x, y, width, height",
      type: "object",
      required: true,
    },
  ];

  async doExecute(
    args: { itemID: number; page: number; text: string; position: Rect },
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      const { itemID, page, text, position } = args;
      const { services } = context;

      if (!itemID || typeof itemID !== "number") {
        return {
          result: null,
          error: "Invalid itemID: must be a number",
        };
      }

      if (!page || page < 1) {
        return {
          result: null,
          error: "Invalid page: must be a positive integer",
        };
      }

      if (!text || typeof text !== "string") {
        return {
          result: null,
          error: "Invalid text: must be a non-empty string",
        };
      }

      if (!position || typeof position !== "object") {
        return {
          result: null,
          error: "Invalid position: must be an object with x, y, width, height",
        };
      }

      const { x, y, width, height } = position;
      if (
        typeof x !== "number" ||
        typeof y !== "number" ||
        typeof width !== "number" ||
        typeof height !== "number"
      ) {
        return {
          result: null,
          error: "Invalid position: x, y, width, height must all be numbers",
        };
      }

      const item = services.zotero.getItem(itemID);
      if (!item) {
        return {
          result: null,
          error: `Item with ID ${itemID} not found`,
        };
      }

      // Get PDF attachment
      const pdf = services.zotero.getPDF(item);
      if (!pdf) {
        return {
          result: null,
          error: "No PDF attachment found for this item",
        };
      }

      // Create the highlight
      const annotation = services.pdf.createHighlight(
        pdf,
        page,
        text,
        position,
      );

      if (!annotation) {
        return {
          result: null,
          error: "Failed to create highlight annotation",
        };
      }

      return {
        result: {
          success: true,
          annotation,
          message: `Highlight created on page ${page}`,
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
