/**
 * PDF Service
 * Unified service for PDF operations - text extraction, annotations, navigation
 */

import { ZoteroGateway } from "./ZoteroGateway";
import { Annotation, PdfInfo, Rect, SelectionContext } from "./types";

/**
 * PdfService provides PDF-specific operations using Zotero's reader API.
 * Requires a ZoteroGateway instance for dependency injection.
 */
export class PdfService {
  private gateway: ZoteroGateway;

  constructor(gateway: ZoteroGateway) {
    this.gateway = gateway;
  }

  /**
   * Get the current reader instance (Zotero PDF reader)
   */
  getCurrentReader(): any {
    try {
      // Zotero 7 uses Readers
      if (Zotero.Reader?.getByInstance) {
        const readers = Zotero.Reader.getAll();
        if (readers && readers.length > 0) {
          // Return the most recent/active reader
          return readers[readers.length - 1];
        }
      }
      return null;
    } catch (e) {
      this.log("getCurrentReader error:", e);
      return null;
    }
  }

  /**
   * Get PDF text content from attachment item
   * Uses Zotero's Reader API to extract text
   */
  async getPdfText(attachment: any): Promise<string> {
    try {
      if (!attachment) {
        return "";
      }

      const reader = this.findReaderForAttachment(attachment);
      if (!reader) {
        this.log("No reader found for attachment");
        return "";
      }

      // Get text from all pages via reader API
      const pageCount = await this.getPageCount(reader);
      const textParts: string[] = [];

      for (let i = 1; i <= pageCount; i++) {
        const pageText = await this.getPageTextByReader(reader, i);
        if (pageText) {
          textParts.push(pageText);
        }
      }

      return textParts.join("\n\n");
    } catch (e) {
      this.log("getPdfText error:", e);
      return "";
    }
  }

  /**
   * Get text for a specific page
   */
  async getPageText(attachment: any, page: number): Promise<string> {
    try {
      if (!attachment || !page || page < 1) {
        return "";
      }

      const reader = this.findReaderForAttachment(attachment);
      if (!reader) {
        return "";
      }

      return await this.getPageTextByReader(reader, page);
    } catch (e) {
      this.log("getPageText error:", e);
      return "";
    }
  }

  /**
   * Get selected text from PDF viewer window
   */
  getSelectedText(win: Window): string {
    try {
      if (!win) {
        return "";
      }

      const selection = win.getSelection();
      if (!selection) {
        return "";
      }

      const text = selection.toString().trim();
      return text;
    } catch (e) {
      this.log("getSelectedText error:", e);
      return "";
    }
  }

  /**
   * Get current selection context including page number
   */
  async getSelectionContext(win: Window): Promise<SelectionContext> {
    const context: SelectionContext = {
      page: 1,
      text: this.getSelectedText(win),
    };

    try {
      const reader = this.getCurrentReader();
      if (reader) {
        const pageInfo = await this.getCurrentPageInfo(reader);
        if (pageInfo) {
          context.page = pageInfo.page;
        }
        context.item = reader.item;
      }
    } catch (e) {
      this.log("getSelectionContext error:", e);
    }

    return context;
  }

  /**
   * Get PDF metadata (page count, info dict, etc.)
   */
  async getPdfInfo(attachment: any): Promise<PdfInfo> {
    const defaultInfo: PdfInfo = {
      pageCount: 0,
      keywords: [],
    };

    try {
      if (!attachment) {
        return defaultInfo;
      }

      // Try to get from attachment metadata
      const title = attachment.getField?.("title");
      const doi = attachment.getField?.("DOI");

      // Get page count from reader or attachment
      const reader = this.findReaderForAttachment(attachment);
      if (reader) {
        const pageCount = await this.getPageCount(reader);
        return {
          pageCount,
          title: title || undefined,
          author: undefined,
          subject: undefined,
          keywords: [],
        };
      }

      // Fallback: try to get from attachment file
      const numPages = attachment.numPages;
      if (typeof numPages === "number" && numPages > 0) {
        return {
          pageCount: numPages,
          title: title || undefined,
          keywords: [],
        };
      }

      return defaultInfo;
    } catch (e) {
      this.log("getPdfInfo error:", e);
      return defaultInfo;
    }
  }

  /**
   * Navigate to a specific page in the PDF reader
   */
  goToPage(win: Window, page: number): boolean {
    try {
      if (!win || !page || page < 1) {
        return false;
      }

      const reader = this.getCurrentReader();
      if (!reader) {
        this.log("No reader available");
        return false;
      }

      // Use reader's navigateToPage or goToPage method
      if (typeof reader.navigateToPage === "function") {
        reader.navigateToPage(page);
        return true;
      }

      if (typeof reader.goToPage === "function") {
        reader.goToPage(page);
        return true;
      }

      // Try triggering the page change event
      const event = new win.CustomEvent("pdf-go-to-page", {
        detail: { page },
      });
      win.document.dispatchEvent(event);

      return true;
    } catch (e) {
      this.log("goToPage error:", e);
      return false;
    }
  }

  /**
   * Get all annotations for a PDF attachment
   */
  getAnnotations(attachment: any): Annotation[] {
    try {
      if (!attachment) {
        return [];
      }

      const annotations: Annotation[] = [];

      // Get annotations from item
      const itemAnnotations = attachment.getAnnotations?.();
      if (itemAnnotations && itemAnnotations.length > 0) {
        for (const annot of itemAnnotations) {
          const annotation = this.convertAnnotation(annot);
          if (annotation) {
            annotations.push(annotation);
          }
        }
      }

      return annotations;
    } catch (e) {
      this.log("getAnnotations error:", e);
      return [];
    }
  }

  /**
   * Create a highlight annotation on a PDF
   */
  createHighlight(
    attachment: any,
    page: number,
    text: string,
    position: Rect,
  ): Annotation | null {
    try {
      if (!attachment || !page || !text || !position) {
        this.log("createHighlight: missing required parameters");
        return null;
      }

      // Create annotation via Zotero API
      const annotation = new Zotero.Item("annotation");
      annotation.setField("itemType", "annotation");
      annotation.setField("annotationType", "highlight");
      annotation.setField("annotationText", text);
      annotation.setField("annotationPageNumber", String(page));
      annotation.parentID = attachment.id;

      // Set position (varies by Zotero version)
      // In Zotero 7, annotations use specific fields for position
      // This is a best-effort implementation
      try {
        annotation.setField("annotationPosition", JSON.stringify(position));
      } catch {
        // Position field may not exist in all versions
      }

      const saved = annotation.save();
      if (!saved) {
        return null;
      }

      return {
        id: String(annotation.id),
        type: "highlight",
        page,
        text,
        position,
      };
    } catch (e) {
      this.log("createHighlight error:", e);
      return null;
    }
  }

  /**
   * Add a note annotation to PDF
   */
  createNoteAnnotation(
    attachment: any,
    page: number,
    text: string,
    position: Rect,
  ): Annotation | null {
    try {
      if (!attachment || !page || !text || !position) {
        return null;
      }

      const annotation = new Zotero.Item("annotation");
      annotation.setField("annotationType", "note");
      annotation.setField("annotationText", text);
      annotation.setField("annotationPageNumber", String(page));
      annotation.parentID = attachment.id;

      try {
        annotation.setField("annotationPosition", JSON.stringify(position));
      } catch {
        // Ignore
      }

      const saved = annotation.save();
      if (!saved) {
        return null;
      }

      return {
        id: String(annotation.id),
        type: "note",
        page,
        text,
        position,
      };
    } catch (e) {
      this.log("createNoteAnnotation error:", e);
      return null;
    }
  }

  /**
   * Delete an annotation
   */
  async deleteAnnotation(annotationId: number): Promise<boolean> {
    try {
      if (!annotationId) {
        return false;
      }

      const annotation = Zotero.Items.get(annotationId);
      if (!annotation) {
        return false;
      }

      return await annotation.erase();
    } catch (e) {
      this.log("deleteAnnotation error:", e);
      return false;
    }
  }

  // Private helper methods

  /**
   * Find the reader instance for a given attachment
   */
  private findReaderForAttachment(attachment: any): any | null {
    try {
      if (!attachment) {
        return null;
      }

      const attachmentKey = attachment.key || attachment.itemKey;
      if (!attachmentKey) {
        return null;
      }

      // Get all readers and find one with matching item
      const readers = Zotero.Reader?.getAll?.();
      if (!readers) {
        return null;
      }

      for (const reader of readers) {
        const readerItem = reader.item;
        if (readerItem) {
          const readerKey = readerItem.key || readerItem.itemKey;
          if (readerKey === attachmentKey) {
            return reader;
          }
        }
      }

      return null;
    } catch (e) {
      this.log("findReaderForAttachment error:", e);
      return null;
    }
  }

  /**
   * Get page count from reader
   */
  private async getPageCount(reader: any): Promise<number> {
    try {
      if (!reader) {
        return 0;
      }

      // Zotero 7 Reader API
      if (typeof reader.getPageInfo === "function") {
        // Some versions use getPageCount
        if (typeof reader.getPageCount === "function") {
          return reader.getPageCount();
        }
        // Or via numPages property
        if (typeof reader.numPages === "number") {
          return reader.numPages;
        }
      }

      // Try getting page count from PDF
      const pdf = await this.getPdfDocument(reader);
      if (pdf && typeof pdf.numPages === "number") {
        return pdf.numPages;
      }

      return 0;
    } catch (e) {
      this.log("getPageCount error:", e);
      return 0;
    }
  }

  /**
   * Get current page information from reader
   */
  private async getCurrentPageInfo(
    reader: any,
  ): Promise<{ page: number; total: number } | null> {
    try {
      if (!reader) {
        return null;
      }

      // Zotero 7 uses currentPage property
      const currentPage = reader.currentPage;
      const total = await this.getPageCount(reader);

      if (typeof currentPage === "number" && total > 0) {
        return { page: currentPage + 1, total }; // 0-indexed internally
      }

      return null;
    } catch (e) {
      this.log("getCurrentPageInfo error:", e);
      return null;
    }
  }

  /**
   * Get page text from reader
   */
  private async getPageTextByReader(
    reader: any,
    page: number,
  ): Promise<string> {
    try {
      if (!reader || !page || page < 1) {
        return "";
      }

      // Use reader's internal text extraction
      // Zotero 7 Reader has getPageText or similar
      if (typeof reader.getPageText === "function") {
        return await reader.getPageText(page - 1); // 0-indexed
      }

      // Try getting from PDF document
      const pdf = await this.getPdfDocument(reader);
      if (pdf && typeof pdf.getPage === "function") {
        const pdfPage = await pdf.getPage(page);
        const textContent = await pdfPage.getTextContent();
        if (textContent && textContent.items) {
          return textContent.items
            .map((item: any) => item.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        }
      }

      return "";
    } catch (e) {
      this.log("getPageTextByReader error:", e);
      return "";
    }
  }

  /**
   * Get the PDF.js document from reader
   */
  private async getPdfDocument(reader: any): Promise<any> {
    try {
      if (!reader) {
        return null;
      }

      // Reader should have an internal PDF document
      if (reader.pdfDocument) {
        return reader.pdfDocument;
      }

      if (reader._pdfDocument) {
        return reader._pdfDocument;
      }

      // Try calling getPDF if available
      if (typeof reader.getPDF === "function") {
        return await reader.getPDF();
      }

      return null;
    } catch (e) {
      this.log("getPdfDocument error:", e);
      return null;
    }
  }

  /**
   * Convert Zotero annotation to our Annotation type
   */
  private convertAnnotation(annot: any): Annotation | null {
    try {
      if (!annot) {
        return null;
      }

      const type = annot.annotationType;
      if (!type || type === "file" || type === "image") {
        return null;
      }

      const validTypes = ["highlight", "note", "underline", "text"];
      if (!validTypes.includes(type)) {
        return null;
      }

      const page = parseInt(annot.annotationPageNumber, 10) || 1;
      const text = annot.annotationText || "";
      const id = String(annot.id || "");

      let position: Rect = { x: 0, y: 0, width: 0, height: 0 };
      try {
        const posField = annot.annotationPosition;
        if (typeof posField === "string") {
          position = JSON.parse(posField);
        } else if (typeof posField === "object") {
          position = posField;
        }
      } catch {
        // Use default position
      }

      return {
        id,
        type: type as "highlight" | "note" | "underline",
        page,
        text,
        position,
        color: annot.annotationColor || undefined,
      };
    } catch (e) {
      this.log("convertAnnotation error:", e);
      return null;
    }
  }

  private log(...args: any[]): void {
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("[PdfService]", ...args);
    } else if (typeof console !== "undefined") {
      console.log("[PdfService]", ...args);
    }
  }
}

export default PdfService;
