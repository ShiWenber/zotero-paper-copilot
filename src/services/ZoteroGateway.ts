/**
 * Zotero Gateway Service
 * Unified gateway for Zotero operations - item access, metadata, collections
 */

import { ItemMetadata } from "./types";

/**
 * ZoteroGateway provides a unified interface for Zotero operations.
 * It wraps the Zotero API with proper error handling and type conversions.
 */
export class ZoteroGateway {
  private selectionListeners: Set<(items: any[]) => void> = new Set();
  private lastSelectedItems: any[] = [];

  constructor() {
    this.setupSelectionWatcher();
  }

  /**
   * Get currently selected items in Zotero UI
   */
  getSelectedItems(): any[] {
    try {
      const pane = this.getActivePane();
      if (!pane) {
        return [];
      }

      const items = pane.getSelectedItems?.();
      if (!items || items.length === 0) {
        return [];
      }

      // Filter out non-library items ( separators, etc. )
      return items.filter((item: any) => item?.id);
    } catch (e) {
      this.log("getSelectedItems error:", e);
      return [];
    }
  }

  /**
   * Get item by its ID
   */
  getItem(itemID: number): any | null {
    try {
      if (!itemID || typeof itemID !== "number") {
        return null;
      }
      const item = Zotero.Items.get(itemID);
      return item || null;
    } catch (e) {
      this.log("getItem error:", e);
      return null;
    }
  }

  /**
   * Get item metadata in a structured format
   */
  getItemMetadata(item: any): ItemMetadata {
    if (!item) {
      return {
        title: "",
        authors: [],
        tags: [],
        collections: [],
      };
    }

    try {
      const creators = item.getCreators?.() || [];
      const authors = creators
        .filter(
          (c: any) =>
            c.creatorType === "author" || c.creatorType === "contributor",
        )
        .map((c: any) => {
          const firstName = c.firstName || "";
          const lastName = c.lastName || "";
          return `${firstName} ${lastName}`.trim();
        })
        .filter((name: string) => name.length > 0);

      const tags = (item.getTags?.() || [])
        .map((t: any) => (typeof t === "string" ? t : t.tag))
        .filter((t: string) => t);

      const collections = item.getCollections?.() || [];

      let year: number | undefined;
      const date = item.getField?.("date");
      if (date) {
        const yearMatch = String(date).match(/\d{4}/);
        if (yearMatch) {
          year = parseInt(yearMatch[0], 10);
        }
      }

      return {
        title: item.getField?.("title") || "",
        authors,
        year,
        abstract: item.getField?.("abstractNote") || undefined,
        doi: item.getField?.("DOI") || undefined,
        tags,
        collections,
      };
    } catch (e) {
      this.log("getItemMetadata error:", e);
      // Try to get title safely, but don't fail on error
      let title = "";
      try {
        title = item.getField?.("title") || "";
      } catch {
        // Ignore
      }
      return {
        title,
        authors: [],
        tags: [],
        collections: [],
      };
    }
  }

  /**
   * Get all items in a specific collection
   */
  getCollectionItems(collectionID: number): any[] {
    try {
      if (!collectionID || typeof collectionID !== "number") {
        return [];
      }

      const collection = Zotero.Collections.get(collectionID);
      if (!collection) {
        return [];
      }

      // Use getChildItems() which returns Item[] in Zotero 7
      const items: any[] = (collection as any).getChildItems
        ? collection.getChildItems(false)
        : [];
      if (!items || items.length === 0) {
        return [];
      }

      // Filter items to exclude imported attachments
      return items.filter(
        (item: any) =>
          item && item.isImportedAttachment && !item.isImportedAttachment(),
      );
    } catch (e) {
      this.log("getCollectionItems error:", e);
      return [];
    }
  }

  /**
   * Get the currently active collection (from UI context)
   */
  getCurrentCollection(): any | null {
    try {
      const pane = this.getActivePane();
      if (!pane) {
        return null;
      }

      const collection = pane.getCurrentCollection?.();
      return collection || null;
    } catch (e) {
      this.log("getCurrentCollection error:", e);
      return null;
    }
  }

  /**
   * Register a callback for selection changes
   */
  onSelectionChange(callback: (items: any[]) => void): () => void {
    this.selectionListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.selectionListeners.delete(callback);
    };
  }

  /**
   * Get PDF attachment for an item
   * Returns the first PDF attachment found, or null if none
   */
  getPDF(item: any): any | null {
    try {
      if (!item) {
        return null;
      }

      // Check if item itself is an attachment
      if (item.isImportedAttachment && item.isImportedAttachment()) {
        // Check if it's a PDF
        const mimeType =
          item.attachmentMIMEType || item.getField?.("contentType");
        if (mimeType === "application/pdf") {
          return item;
        }
        return null;
      }

      // Get attachments via top-level items
      const attachments = item.getAttachments?.();
      if (!attachments || attachments.length === 0) {
        // Try child items
        const children = item.getChildren?.();
        if (children) {
          for (const child of children) {
            if (child.isImportedAttachment && child.isImportedAttachment()) {
              const mimeType =
                child.attachmentMIMEType || child.getField?.("contentType");
              if (mimeType === "application/pdf") {
                return child;
              }
            }
          }
        }
        return null;
      }

      // Find first PDF in attachments
      for (const attachmentID of attachments) {
        const attachment = Zotero.Items.get(attachmentID);
        if (attachment) {
          // In Zotero 7, attachmentMIMEType is a property on attachment items
          const mimeType =
            (attachment as any).attachmentMIMEType ||
            attachment.getField?.("contentType");
          if (mimeType === "application/pdf") {
            return attachment;
          }
        }
      }

      return null;
    } catch (e) {
      this.log("getPDF error:", e);
      return null;
    }
  }

  /**
   * Add a note to an item
   * @returns The note item ID, or -1 on error
   */
  async addNote(item: any, noteContent: string): Promise<number> {
    try {
      if (!item || !noteContent) {
        return -1;
      }

      const note = new Zotero.Item("note");
      note.setNote(noteContent);

      // Parent the note to the item
      note.parentID = item.id;

      const saved = await note.save();
      return saved ? note.id : -1;
    } catch (e) {
      this.log("addNote error:", e);
      return -1;
    }
  }

  /**
   * Update item metadata fields
   */
  updateItem(item: any, updates: Partial<ItemMetadata>): boolean {
    try {
      if (!item || !updates) {
        return false;
      }

      // Title
      if (updates.title !== undefined) {
        item.setField("title", updates.title);
      }

      // Year (stored as date field)
      if (updates.year !== undefined) {
        item.setField("date", String(updates.year));
      }

      // Abstract
      if (updates.abstract !== undefined) {
        item.setField("abstractNote", updates.abstract);
      }

      // DOI
      if (updates.doi !== undefined) {
        item.setField("DOI", updates.doi);
      }

      // Tags - replace all tags
      if (updates.tags !== undefined) {
        item.setTags(updates.tags);
      }

      // Note: Collections and authors are complex and require special handling
      // Authors need to be set via setCreators()

      return item.save();
    } catch (e) {
      this.log("updateItem error:", e);
      return false;
    }
  }

  /**
   * Get item by key (for reader context)
   */
  getItemByKey(key: string): any | null {
    try {
      if (!key) {
        return null;
      }
      const item = Zotero.Items.getByKey(key);
      return item || null;
    } catch (e) {
      this.log("getItemByKey error:", e);
      return null;
    }
  }

  /**
   * Refresh the current view (useful after updates)
   */
  refreshView(): void {
    try {
      const pane = this.getActivePane();
      if (pane && pane.refreshAndRevert) {
        pane.refreshAndRevert();
      }
    } catch (e) {
      this.log("refreshView error:", e);
    }
  }

  // Private helpers

  private getActivePane(): any {
    try {
      return Zotero.getActiveZoteroPane?.();
    } catch (e) {
      return null;
    }
  }

  private setupSelectionWatcher(): void {
    try {
      // Watch for selection changes via notifier
      const handler = (
        event: string,
        type: string,
        ids: Array<string | number>,
        extraData: { [key: string]: any },
      ) => {
        if (event === "select" && type === "tab") {
          this.notifySelectionChange();
        }
      };

      // Register with Zotero notifier (if available)
      if (typeof Zotero !== "undefined" && Zotero.Notifier) {
        Zotero.Notifier.registerObserver(
          { notify: handler },
          ["tab"],
          "ZoteroGateway",
        );
      }
    } catch (e) {
      this.log("setupSelectionWatcher error:", e);
    }
  }

  private notifySelectionChange(): void {
    try {
      const items = this.getSelectedItems();

      // Only notify if items actually changed
      const itemIds = items.map((i) => i?.id).join(",");
      const lastIds = this.lastSelectedItems.map((i) => i?.id).join(",");

      if (itemIds !== lastIds) {
        this.lastSelectedItems = items;
        for (const listener of this.selectionListeners) {
          try {
            listener(items);
          } catch (e) {
            this.log("selection listener error:", e);
          }
        }
      }
    } catch (e) {
      this.log("notifySelectionChange error:", e);
    }
  }

  private log(...args: any[]): void {
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("[ZoteroGateway]", ...args);
    } else if (typeof console !== "undefined") {
      console.log("[ZoteroGateway]", ...args);
    }
  }
}

export default ZoteroGateway;
