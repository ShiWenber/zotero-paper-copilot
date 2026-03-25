/**
 * Tool Registry System - Update Tags Tool
 * Add or remove tags from a Zotero item
 */

import { BaseTool, ToolContext } from "../base/Tool";
import { ToolResult } from "../../agent/types";

export class UpdateTagsTool extends BaseTool {
  name = "update_tags";
  description = "Add or remove tags from an item";
  category = "write";

  parameters = [
    {
      name: "itemID",
      description: "The Zotero item ID",
      type: "number",
      required: true,
    },
    {
      name: "addTags",
      description: "Array of tag names to add",
      type: "array",
      required: false,
    },
    {
      name: "removeTags",
      description: "Array of tag names to remove",
      type: "array",
      required: false,
    },
  ];

  async doExecute(
    args: { itemID: number; addTags?: string[]; removeTags?: string[] },
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      const { itemID, addTags = [], removeTags = [] } = args;
      const { services } = context;

      if (!itemID || typeof itemID !== "number") {
        return {
          result: null,
          error: "Invalid itemID: must be a number",
        };
      }

      if (!Array.isArray(addTags) || !Array.isArray(removeTags)) {
        return {
          result: null,
          error: "addTags and removeTags must be arrays",
        };
      }

      const item = services.zotero.getItem(itemID);
      if (!item) {
        return {
          result: null,
          error: `Item with ID ${itemID} not found`,
        };
      }

      // Get current tags
      const currentTags = (item.getTags?.() || [])
        .map((t: any) => (typeof t === "string" ? t : t.tag))
        .filter((t: string) => t);

      // Calculate new tags
      let newTags = [...currentTags];

      // Add new tags
      if (addTags.length > 0) {
        for (const tag of addTags) {
          if (!newTags.includes(tag)) {
            newTags.push(tag);
          }
        }
      }

      // Remove tags
      if (removeTags.length > 0) {
        newTags = newTags.filter((tag) => !removeTags.includes(tag));
      }

      // Update the item with new tags
      const success = services.zotero.updateItem(item, { tags: newTags });

      if (!success) {
        return {
          result: null,
          error: "Failed to update tags",
        };
      }

      // Refresh view
      services.zotero.refreshView();

      return {
        result: {
          success: true,
          itemID,
          tags: newTags,
          added: addTags,
          removed: removeTags,
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
