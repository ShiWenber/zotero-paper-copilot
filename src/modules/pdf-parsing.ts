/**
 * Zotero Paper Copilot - PDF Parsing Module
 *
 * PDF page structure parsing: identifies page numbers, chapter titles, paragraph structure
 * Uses Zotero Reader API and PDF.js text layer
 */

import { PDFSelection } from "./pdf-selection";

export interface PDFBlock {
  id: string;
  type:
    | "title"
    | "heading"
    | "subheading"
    | "paragraph"
    | "figure"
    | "table"
    | "page-number"
    | "other";
  level: number; // 0 for body text, 1-6 for headings
  text: string;
  page: number;
  bbox?: { x: number; y: number; width: number; height: number };
  fontSize?: number;
  fontWeight?: number;
  indent?: number;
}

export interface PDFStructure {
  blocks: PDFBlock[];
  toc: TOCItem[];
  metadata: PDFMetadata;
}

export interface TOCItem {
  title: string;
  page: number;
  level: number;
  children?: TOCItem[];
}

export interface PDFMetadata {
  title?: string;
  authors?: string[];
  totalPages: number;
  parseTime: string;
}

export class PDFParsing {
  private static initialized = false;

  /**
   * Initialize PDF parsing
   */
  public static init(win: Window): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: PDF parsing module initialized");
    }
  }

  /**
   * Get current PDF reader instance
   */
  public static getReader(win: Window): any {
    try {
      // Zotero 7 uses Zotero.Reader
      if (win.Zotero?.Reader) {
        const readers = win.Zotero.Reader.getAll();
        if (readers && readers.length > 0) {
          return readers[readers.length - 1]; // Get most recent reader
        }
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error getting reader:", e);
      }
    }
    return null;
  }

  /**
   * Get current item from reader
   */
  public static async getCurrentItem(win: Window): Promise<any> {
    const reader = this.getReader(win);
    if (reader) {
      try {
        return await reader._item;
      } catch (e) {
        // Ignore
      }
    }

    // Fallback to ZoteroPane
    try {
      const pane = win.Zotero.getActiveZoteroPane?.();
      if (pane) {
        const items = pane.getSelectedItems?.();
        if (items && items.length > 0) {
          return items[0];
        }
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error getting current item:", e);
      }
    }
    return null;
  }

  /**
   * Parse PDF structure from current document
   */
  public static async parseDocument(win: Window): Promise<PDFStructure> {
    const structure: PDFStructure = {
      blocks: [],
      toc: [],
      metadata: {
        totalPages: 0,
        parseTime: new Date().toISOString(),
      },
    };

    try {
      const reader = this.getReader(win);
      if (!reader) {
        if (typeof ztoolkit !== "undefined") {
          ztoolkit.log("Paper Copilot: No reader found");
        }
        return structure;
      }

      // Get total pages
      const numPages = await reader._numPages;
      structure.metadata.totalPages = numPages;

      // Get item metadata
      const item = await this.getCurrentItem(win);
      if (item) {
        structure.metadata.title = item.getField?.("title");
        structure.metadata.authors = item
          .getField?.("creators")
          ?.map?.((c: any) => c.firstName + " " + c.lastName);
      }

      // Get TOC from reader
      structure.toc = await this.extractTOC(reader);

      // Parse pages (limit to first 50 pages for performance)
      const pagesToParse = Math.min(numPages, 50);
      for (let i = 1; i <= pagesToParse; i++) {
        const pageBlocks = await this.parsePage(win, reader, i);
        structure.blocks.push(...pageBlocks);
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error parsing document:", e);
      }
    }

    return structure;
  }

  /**
   * Extract Table of Contents from reader
   */
  private static async extractTOC(reader: any): Promise<TOCItem[]> {
    const toc: TOCItem[] = [];

    try {
      if (reader._toc) {
        const tocData = await reader._toc;
        tocData.forEach((item: any) => {
          toc.push({
            title: item.title || "Untitled",
            page: item.pageIndex + 1 || 1,
            level: item.level || 1,
          });
        });
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error extracting TOC:", e);
      }
    }

    return toc;
  }

  /**
   * Parse a single page to extract blocks
   */
  private static async parsePage(
    win: Window,
    reader: any,
    pageNum: number,
  ): Promise<PDFBlock[]> {
    const blocks: PDFBlock[] = [];

    try {
      // Get page text content via PDF.js
      const page = await this.getPageText(win, pageNum);
      if (!page) {
        return blocks;
      }

      // Analyze text items to identify structure
      const items = page.items || [];
      let currentParagraph = "";
      let lastFontSize = 0;
      let lastIndent = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.str) continue;

        const fontSize = item.height || 10;
        const indent = item.transform?.[4] || 0; // x position

        // Detect page number (small text at bottom)
        if (this.isPageNumber(item.str, fontSize, i, items.length)) {
          blocks.push({
            id: `p${pageNum}-pageNum`,
            type: "page-number",
            level: 0,
            text: item.str.trim(),
            page: pageNum,
            fontSize,
          });
          continue;
        }

        // Detect headings (larger font or all caps)
        if (
          this.isHeading(item.str, fontSize, lastFontSize, indent, lastIndent)
        ) {
          // Save previous paragraph
          if (currentParagraph) {
            blocks.push(this.createParagraphBlock(currentParagraph, pageNum));
            currentParagraph = "";
          }

          const headingLevel = this.getHeadingLevel(fontSize, lastFontSize);
          blocks.push({
            id: `p${pageNum}-h${blocks.length}`,
            type:
              headingLevel === 1
                ? "title"
                : headingLevel <= 3
                  ? "heading"
                  : "subheading",
            level: headingLevel,
            text: item.str.trim(),
            page: pageNum,
            fontSize,
            indent,
          });
        } else {
          // Add to paragraph
          currentParagraph += item.str;
        }

        lastFontSize = fontSize;
        lastIndent = indent;
      }

      // Save remaining paragraph
      if (currentParagraph) {
        blocks.push(this.createParagraphBlock(currentParagraph, pageNum));
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error parsing page " + pageNum + ":", e);
      }
    }

    return blocks;
  }

  /**
   * Get page text content via PDF.js
   */
  private static async getPageText(win: Window, pageNum: number): Promise<any> {
    try {
      const reader = this.getReader(win);
      if (!reader?._pdfDocument) {
        return null;
      }

      const page = await reader._pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      return textContent;
    } catch (e) {
      return null;
    }
  }

  /**
   * Detect if text is a page number
   */
  private static isPageNumber(
    text: string,
    fontSize: number,
    index: number,
    total: number,
  ): boolean {
    const trimmed = text.trim();
    // Page numbers are usually short and numeric
    if (!/^\d+[\da-z]?$/.test(trimmed)) {
      return false;
    }
    // Usually at the bottom of the page
    if (index > total * 0.7) {
      return true;
    }
    // Very small font
    if (fontSize < 8) {
      return true;
    }
    return false;
  }

  /**
   * Detect if text is a heading
   */
  private static isHeading(
    text: string,
    fontSize: number,
    lastFontSize: number,
    indent: number,
    lastIndent: number,
  ): boolean {
    const trimmed = text.trim();

    // All caps or Title Case often indicates heading
    if (
      trimmed.length < 50 &&
      (trimmed === trimmed.toUpperCase() || /^[A-Z]/.test(trimmed))
    ) {
      // Significantly larger than previous text
      if (fontSize > lastFontSize * 1.2 && lastFontSize > 0) {
        return true;
      }
      // Or much smaller indent (title/heading often left-aligned)
      if (indent < lastIndent - 20) {
        return true;
      }
    }

    // Common heading patterns
    const headingPatterns = [
      /^Abstract$/i,
      /^Introduction$/i,
      /^Related Work$/i,
      /^Methodology$/i,
      /^Methods$/i,
      /^Experiment/i,
      /^Results$/i,
      /^Discussion$/i,
      /^Conclusion$/i,
      /^References$/i,
      /^Acknowledgments$/i,
      /^Figure \d+/i,
      /^Table \d+/i,
    ];

    for (const pattern of headingPatterns) {
      if (pattern.test(trimmed)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get heading level based on font size
   */
  private static getHeadingLevel(
    fontSize: number,
    lastFontSize: number,
  ): number {
    if (lastFontSize === 0) {
      return 1; // First text is likely title
    }

    const ratio = fontSize / lastFontSize;

    if (ratio > 1.5) return 1;
    if (ratio > 1.3) return 2;
    if (ratio > 1.1) return 3;
    return 4;
  }

  /**
   * Create a paragraph block
   */
  private static createParagraphBlock(text: string, pageNum: number): PDFBlock {
    return {
      id: `p${pageNum}-para${Math.random().toString(36).substr(2, 9)}`,
      type: "paragraph",
      level: 0,
      text: text.replace(/\s+/g, " ").trim(),
      page: pageNum,
    };
  }

  /**
   * Get blocks by type
   */
  public static filterBlocks(
    blocks: PDFBlock[],
    type: PDFBlock["type"],
  ): PDFBlock[] {
    return blocks.filter((b) => b.type === type);
  }

  /**
   * Get all headings
   */
  public static getHeadings(blocks: PDFBlock[]): PDFBlock[] {
    return blocks.filter(
      (b) =>
        b.type === "title" || b.type === "heading" || b.type === "subheading",
    );
  }

  /**
   * Search blocks by keyword
   */
  public static searchBlocks(blocks: PDFBlock[], keyword: string): PDFBlock[] {
    const lower = keyword.toLowerCase();
    return blocks.filter((b) => b.text.toLowerCase().includes(lower));
  }
}

/**
 * Initialize PDF parsing when Zotero is ready
 */
export function initPDFParsing(win: Window): void {
  setTimeout(() => {
    PDFParsing.init(win);
  }, 3000);
}
