/**
 * Tool Registry System - Get PDF Text Tool
 * Extract text content from a PDF attachment
 */

import { BaseTool, ToolContext } from "../base/Tool";
import { ToolResult } from "../../agent/types";

export class GetPdfTextTool extends BaseTool {
  name = "get_pdf_text";
  description = "Extract text content from a PDF attachment";
  category = "read";

  parameters = [
    {
      name: "itemID",
      description: "The Zotero item ID of the PDF attachment",
      type: "number",
      required: true,
    },
    {
      name: "pageStart",
      description: "Start page number (1-indexed, inclusive)",
      type: "number",
      required: false,
    },
    {
      name: "pageEnd",
      description: "End page number (1-indexed, inclusive)",
      type: "number",
      required: false,
    },
  ];

  async doExecute(
    args: { itemID: number; pageStart?: number; pageEnd?: number },
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      const { itemID, pageStart, pageEnd } = args;
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

      // Get PDF attachment
      const pdf = services.zotero.getPDF(item);
      if (!pdf) {
        return {
          result: null,
          error: "No PDF attachment found for this item",
        };
      }

      let text: string;

      if (pageStart !== undefined && pageEnd !== undefined) {
        // Extract text for specific page range
        const pages: string[] = [];
        const startPage = pageStart;
        const endPage = pageEnd;

        for (let page = startPage; page <= endPage; page++) {
          const pageText = await services.pdf.getPageText(pdf, page);
          pages.push(pageText);
        }

        text = pages.join(`\n\n--- Page Break ---\n\n`);
      } else if (pageStart !== undefined) {
        // Extract single page
        text = await services.pdf.getPageText(pdf, pageStart);
      } else {
        // Extract all text
        text = await services.pdf.getPdfText(pdf);
      }

      return {
        result: {
          itemID,
          text,
          pageStart,
          pageEnd,
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
