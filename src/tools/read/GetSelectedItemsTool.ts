/**
 * Tool Registry System - Get Selected Items Tool
 * Get items currently selected in Zotero
 */

import { BaseTool, ToolContext } from "../base/Tool";
import { ToolResult } from "../../agent/types";

export class GetSelectedItemsTool extends BaseTool {
  name = "get_selected_items";
  description = "Get items currently selected in Zotero";
  category = "read";

  parameters = [];

  async doExecute(
    _args: Record<string, any>,
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      const { services } = context;

      const items = services.zotero.getSelectedItems();
      const itemsWithMetadata = items.map((item: any) => {
        const metadata = services.zotero.getItemMetadata(item);
        return {
          id: item.id,
          key: item.key,
          ...metadata,
        };
      });

      return {
        result: itemsWithMetadata,
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
