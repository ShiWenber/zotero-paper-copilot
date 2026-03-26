/**
 * Tool Registry System - Get Item Tool
 * Get metadata for a specific Zotero item
 */

import { BaseTool, ToolContext } from "../base/Tool";
import { ToolResult } from "../../agent/types";

export class GetItemTool extends BaseTool {
  name = "get_item";
  description = "Get metadata for a specific Zotero item";
  category = "read";

  parameters = [
    {
      name: "itemID",
      description: "The Zotero item ID",
      type: "number",
      required: true,
    },
  ];

  async doExecute(
    args: { itemID: number },
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      const { itemID } = args;
      const { services } = context;

      if (!itemID || typeof itemID !== "number") {
        return {
          result: null,
          error: "Invalid itemID: must be a number",
        };
      }

      const item = services.zotero.getItem(itemID);
      if (!item) {
        return {
          result: null,
          error: `Item with ID ${itemID} not found`,
        };
      }

      const metadata = services.zotero.getItemMetadata(item);

      return {
        result: {
          id: item.id,
          key: item.key,
          ...metadata,
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
