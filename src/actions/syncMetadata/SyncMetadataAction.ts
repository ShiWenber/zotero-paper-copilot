/**
 * Action System - Sync Metadata Action
 * Sync item metadata from external sources (DOI, arXiv, ISBN)
 */

import { BaseAction, ActionContext, ActionResult } from "../base/Action";
import { ItemMetadata } from "../../services/types";

/**
 * Sync result for a single item
 */
interface ItemSyncResult {
  itemID: number;
  title: string;
  source: string;
  found: boolean;
  matched: boolean;
  updatedFields: string[];
  metadata?: Partial<ItemMetadata>;
  error?: string;
}

type SyncSource = "doi" | "arxiv" | "isbn" | "auto";

/**
 * CrossRef API response types
 */
interface CrossRefWork {
  message: {
    title?: string[];
    author?: Array<{ given?: string; family?: string }>;
    published?: { "date-parts"?: number[][] };
    abstract?: string;
    DOI?: string;
  };
}

/**
 * arXiv API response types
 */
interface ArXivEntry {
  entry: {
    title?: string;
    author?: Array<{ name: string }>;
    published?: { value: () => string };
    summary?: { value: () => string };
    id?: string;
  };
}

/**
 * Open Library API response type
 */
interface OpenLibraryBook {
  [key: string]: {
    title?: string;
    authors?: Array<{ name: string }>;
    publish_date?: string;
    publishers?: string[];
    number_of_pages?: number;
  };
}

/**
 * Sync Metadata action - look up and update item metadata from external sources
 */
export class SyncMetadataAction extends BaseAction {
  name = "sync_metadata";
  description = "Sync item metadata from external sources (DOI, arXiv, ISBN)";

  parameters = [
    {
      name: "items",
      description: "Item IDs to sync",
      type: "array",
      required: true,
    },
    {
      name: "source",
      description: "Source: doi, arxiv, isbn, or auto (auto-detect)",
      type: "string",
      required: false,
      default: "auto",
    },
    {
      name: "overwrite",
      description: "Overwrite existing fields with fetched values",
      type: "boolean",
      required: false,
      default: false,
    },
  ];

  canApply(items: any[], _context: ActionContext): boolean {
    return items.length > 0;
  }

  async doExecute(
    args: { items: number[]; source?: string; overwrite?: boolean },
    context: ActionContext,
  ): Promise<ActionResult> {
    const { items: itemIDs, source = "auto", overwrite = false } = args;
    const { services } = context;

    const syncResults: ItemSyncResult[] = [];
    const errors: string[] = [];

    for (const itemID of itemIDs) {
      try {
        const item = services.zotero.getItem(itemID);
        if (!item) {
          errors.push(`Item ${itemID}: Not found`);
          continue;
        }

        const metadata = services.zotero.getItemMetadata(item);
        const syncResult = await this.syncItem(
          itemID,
          item,
          metadata,
          source as SyncSource,
          overwrite,
          context,
        );
        syncResults.push(syncResult);

        if (syncResult.error) {
          errors.push(`Item ${itemID}: ${syncResult.error}`);
        }
      } catch (err: any) {
        const errorMsg = err?.message ?? String(err);
        errors.push(`Item ${itemID}: ${errorMsg}`);
        syncResults.push({
          itemID,
          title: "(Unknown)",
          source,
          found: false,
          matched: false,
          updatedFields: [],
          error: errorMsg,
        });
      }
    }

    const successfulSyncs = syncResults.filter(
      (r) => r.found && r.matched,
    ).length;

    return {
      success: errors.length === 0 && successfulSyncs > 0,
      message: `Metadata sync complete: ${successfulSyncs}/${itemIDs.length} items updated`,
      data: {
        summary: {
          totalItems: itemIDs.length,
          found: syncResults.filter((r) => r.found).length,
          matched: successfulSyncs,
          failed: itemIDs.length - syncResults.filter((r) => r.found).length,
          source,
          overwrite,
        },
        items: syncResults,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Sync a single item's metadata
   */
  private async syncItem(
    itemID: number,
    item: any,
    metadata: ItemMetadata,
    source: SyncSource,
    overwrite: boolean,
    context: ActionContext,
  ): Promise<ItemSyncResult> {
    const { services } = context;

    // Determine the source to use
    let sourceToUse = source;
    if (source === "auto") {
      sourceToUse = this.detectSource(metadata);
    }

    if (sourceToUse === "auto") {
      return {
        itemID,
        title: metadata.title || "(Untitled)",
        source: "auto",
        found: false,
        matched: false,
        updatedFields: [],
        error: "Could not detect metadata source (need DOI, arXiv ID, or ISBN)",
      };
    }

    // Look up metadata from the source
    let externalMetadata: Partial<ItemMetadata> | null = null;
    let externalSource = sourceToUse;

    try {
      if (sourceToUse === "doi") {
        externalMetadata = await this.fetchFromDOI(metadata.doi || "", itemID);
        externalSource = "CrossRef (DOI)";
      } else if (sourceToUse === "arxiv") {
        externalMetadata = await this.fetchFromArXiv(
          metadata.title || "",
          itemID,
        );
        externalSource = "arXiv";
      } else if (sourceToUse === "isbn") {
        externalMetadata = await this.fetchFromISBN(
          metadata.title || "",
          itemID,
        );
        externalSource = "Open Library (ISBN)";
      }
    } catch (err: any) {
      return {
        itemID,
        title: metadata.title || "(Untitled)",
        source: externalSource,
        found: false,
        matched: false,
        updatedFields: [],
        error: `Fetch failed: ${err?.message ?? String(err)}`,
      };
    }

    if (!externalMetadata) {
      return {
        itemID,
        title: metadata.title || "(Untitled)",
        source: externalSource,
        found: false,
        matched: false,
        updatedFields: [],
        error: "No metadata found from external source",
      };
    }

    // Update the item with external metadata
    const updatedFields = this.updateItemFields(
      item,
      externalMetadata,
      overwrite,
      services,
    );

    return {
      itemID,
      title: metadata.title || "(Untitled)",
      source: externalSource,
      found: true,
      matched: true,
      updatedFields,
      metadata: externalMetadata,
    };
  }

  /**
   * Detect the source type based on existing metadata
   */
  private detectSource(metadata: ItemMetadata): SyncSource {
    // Check DOI first
    if (metadata.doi && this.isValidDOI(metadata.doi)) {
      return "doi";
    }

    // Check for arXiv ID in title or DOI
    if (metadata.title && this.containsArXivID(metadata.title)) {
      return "arxiv";
    }
    if (metadata.doi && metadata.doi.includes("arxiv")) {
      return "arxiv";
    }

    // Check for ISBN (basic check)
    if (metadata.title && this.looksLikeISBN(metadata.title)) {
      return "isbn";
    }

    return "auto";
  }

  /**
   * Fetch metadata from CrossRef using DOI
   */
  private async fetchFromDOI(
    doi: string,
    _itemID: number,
  ): Promise<Partial<ItemMetadata> | null> {
    if (!doi) return null;

    try {
      // Clean DOI
      const cleanDOI = doi.replace(/^https?:\/\/doi\.org\//, "");

      const response = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(cleanDOI)}`,
        {
          headers: {
            "User-Agent": "ZoteroPaperCopilot/1.0 (mailto:support@example.com)",
          },
        },
      );

      if (!response.ok) {
        this.log(`CrossRef API returned ${response.status}`);
        return null;
      }

      const data: CrossRefWork = await response.json();
      const work = data.message;

      if (!work) return null;

      // Parse authors
      const authors: string[] = [];
      if (work.author) {
        for (const a of work.author) {
          if (a.family) {
            authors.push(a.given ? `${a.given} ${a.family}` : a.family);
          }
        }
      }

      // Parse year
      let year: number | undefined;
      if (work.published?.["date-parts"]?.[0]?.[0]) {
        year = work.published["date-parts"][0][0];
      }

      // Clean abstract (CrossRef often wraps in JATS XML)
      let abstractText = work.abstract || "";
      if (abstractText) {
        abstractText = abstractText.replace(/<[^>]+>/g, "").trim();
      }

      return {
        title: work.title?.[0] || undefined,
        authors: authors.length > 0 ? authors : undefined,
        year,
        abstract: abstractText || undefined,
        doi: work.DOI || undefined,
      };
    } catch (err: any) {
      this.log("fetchFromDOI error:", err);
      return null;
    }
  }

  /**
   * Fetch metadata from arXiv API
   */
  private async fetchFromArXiv(
    titleOrID: string,
    _itemID: number,
  ): Promise<Partial<ItemMetadata> | null> {
    try {
      // Extract arXiv ID from title if it looks like an ID
      let arxivID = "";

      // Try to extract from title
      const arxivMatch = titleOrID.match(/(\d{4}\.\d{4,5}(v\d+)?|\w+\/\d{7})/);
      if (arxivMatch) {
        arxivID = arxivMatch[1];
      }

      if (!arxivID) {
        // Search by title
        const query = encodeURIComponent(
          titleOrID.split(" ")[0] +
            " " +
            titleOrID.split(" ").slice(1, 3).join(" "),
        );
        const searchUrl = `https://export.arxiv.org/api/query?search_query=ti:${query}&max_results=1`;

        const response = await fetch(searchUrl);
        if (!response.ok) return null;

        const text = await response.text();
        const entryMatch = text.match(/<entry>([\s\S]*?)<\/entry>/);
        if (entryMatch) {
          const entry = entryMatch[1];
          const idMatch = entry.match(
            /<id>https?:\/\/arxiv\.org\/abs\/([^\s<]+)<\/id>/,
          );
          if (idMatch) {
            arxivID = idMatch[1];
          }
        }
      }

      if (!arxivID) return null;

      // Fetch the actual entry
      const response = await fetch(
        `https://export.arxiv.org/api/query?id_list=${arxivID}`,
      );
      if (!response.ok) return null;

      const text = await response.text();
      const entryMatch = text.match(/<entry>([\s\S]*?)<\/entry>/);
      if (!entryMatch) return null;

      const entry = entryMatch[1];

      // Parse fields
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

      const authors: string[] = [];
      let authorMatch;
      const authorRegex =
        /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g;
      while ((authorMatch = authorRegex.exec(entry)) !== null) {
        authors.push(authorMatch[1].trim());
      }

      const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
      const year = publishedMatch
        ? parseInt(publishedMatch[1].substring(0, 4), 10)
        : undefined;

      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
      const abstractText = summaryMatch
        ? summaryMatch[1].replace(/\s+/g, " ").trim()
        : "";

      return {
        title,
        authors: authors.length > 0 ? authors : undefined,
        year,
        abstract: abstractText || undefined,
      };
    } catch (err: any) {
      this.log("fetchFromArXiv error:", err);
      return null;
    }
  }

  /**
   * Fetch metadata from Open Library using ISBN
   */
  private async fetchFromISBN(
    titleOrISBN: string,
    _itemID: number,
  ): Promise<Partial<ItemMetadata> | null> {
    try {
      // Try to extract ISBN from title
      let isbn = "";

      // Look for ISBN pattern
      const isbnMatch = titleOrISBN.match(
        /((?:ISBN(?:-1[03])?:?\s*)?97[89]\d{10}|\d{9}[\dXx])/,
      );
      if (isbnMatch) {
        isbn = isbnMatch[1].replace(/[^0-9Xx]/g, "");
      }

      if (!isbn) return null;

      const response = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
      );
      if (!response.ok) return null;

      const data: OpenLibraryBook = await response.json();
      const bookData = data[`ISBN:${isbn}`];

      if (!bookData) return null;

      return {
        title: bookData.title,
        authors: bookData.authors?.map((a) => a.name),
        year: bookData.publish_date
          ? parseInt(bookData.publish_date.match(/\d{4}/)?.[0] ?? "", 10) ||
            undefined
          : undefined,
      };
    } catch (err: any) {
      this.log("fetchFromISBN error:", err);
      return null;
    }
  }

  /**
   * Update item fields with external metadata
   */
  private updateItemFields(
    item: any,
    externalMetadata: Partial<ItemMetadata>,
    overwrite: boolean,
    services: { zotero: any },
  ): string[] {
    const updatedFields: string[] = [];
    const updates: Partial<ItemMetadata> = {};

    // Title
    if (externalMetadata.title) {
      const currentTitle = item.getField?.("title") || "";
      if (overwrite || !currentTitle) {
        updates.title = externalMetadata.title;
        updatedFields.push("title");
      }
    }

    // Authors (skip for now - Creator handling is complex)
    // Year
    if (externalMetadata.year) {
      const currentYear = item.getField?.("date") || "";
      if (overwrite || !currentYear) {
        updates.year = externalMetadata.year;
        updatedFields.push("year");
      }
    }

    // Abstract
    if (externalMetadata.abstract) {
      const currentAbstract = item.getField?.("abstractNote") || "";
      if (overwrite || !currentAbstract) {
        updates.abstract = externalMetadata.abstract;
        updatedFields.push("abstract");
      }
    }

    // DOI
    if (externalMetadata.doi) {
      const currentDOI = item.getField?.("DOI") || "";
      if (overwrite || !currentDOI) {
        updates.doi = externalMetadata.doi;
        updatedFields.push("doi");
      }
    }

    if (updatedFields.length > 0) {
      services.zotero.updateItem(item, updates);
      services.zotero.refreshView();
    }

    return updatedFields;
  }

  /**
   * Check if a string is a valid DOI
   */
  private isValidDOI(doi: string): boolean {
    if (!doi) return false;
    const doiRegex = /^10\.\d{4,}\/[^\s]+$/;
    return doiRegex.test(doi);
  }

  /**
   * Check if a string contains an arXiv ID
   */
  private containsArXivID(text: string): boolean {
    return /\d{4}\.\d{4,5}(v\d+)?|\w+\/\d{7}/.test(text);
  }

  /**
   * Check if a string looks like it might contain an ISBN
   */
  private looksLikeISBN(text: string): boolean {
    return /97[89]\d{10}|\d{9}[\dXx]/.test(text);
  }
}
