/**
 * Tool Registry System - Search Items Tool
 * Search Zotero items by title, author, or tag
 */

import { BaseTool, ToolContext } from "../base/Tool";
import { ToolResult } from "../../agent/types";

export class SearchItemsTool extends BaseTool {
  name = "search_items";
  description = "Search items by title, author, or tag";
  category = "read";

  parameters = [
    {
      name: "query",
      description: "Search query string",
      type: "string",
      required: true,
    },
    {
      name: "limit",
      description: "Maximum number of results to return",
      type: "number",
      required: false,
      default: 20,
    },
  ];

  async doExecute(
    args: { query: string; limit?: number },
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      const { query, limit = 20 } = args;
      const { services } = context;

      if (!query || typeof query !== "string") {
        return {
          result: null,
          error: "Invalid query: must be a non-empty string",
        };
      }

      // Use Zotero's search API
      const searchResults = await this.searchZotero(
        query,
        limit,
        services.zotero,
      );

      return {
        result: searchResults,
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
   * Search Zotero library using the Zotero API
   */
  private async searchZotero(
    query: string,
    limit: number,
    zotero: any,
  ): Promise<any[]> {
    try {
      // Create a Zotero search object
      const s = new Zotero.Search();

      // Search in title, creator, and tag fields
      // Use OR condition for multiple search modes
      s.addCondition("title", "contains", query);
      s.addCondition("creator", "contains", query);
      s.addCondition("tag", "contains", query);

      // Get the search results
      const itemIDs = await s.search();

      if (!itemIDs || itemIDs.length === 0) {
        return [];
      }

      // Limit results
      const limitedIDs = itemIDs.slice(0, limit);

      // Fetch full items with metadata
      const items = [];
      for (const itemID of limitedIDs) {
        const item = zotero.getItem(itemID);
        if (item) {
          const metadata = zotero.getItemMetadata(item);
          items.push({
            id: item.id,
            key: item.key,
            ...metadata,
          });
        }
      }

      return items;
    } catch (e) {
      this.log("searchZotero error:", e);
      return [];
    }
  }
}
