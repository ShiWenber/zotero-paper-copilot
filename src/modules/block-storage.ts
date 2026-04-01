/**
 * Zotero Paper Copilot - Block Storage Module
 *
 * Stores PDF block metadata using Zotero's notes and preferences
 * Provides CRUD operations for block data
 */

import { PDFBlock } from "./pdf-parsing";
import { FigureBlock } from "./figure-detection";

export interface BlockStorage {
  itemKey: string;
  blocks: StoredBlock[];
  lastUpdated: string;
}

export interface StoredBlock {
  id: string;
  type: string;
  page: number;
  text: string;
  label?: string;
  bbox?: string; // JSON stringified
  metadata?: string; // JSON stringified
}

export class BlockStorageManager {
  private static readonly STORAGE_PREFIX = "paper-copilot.blocks.";

  /**
   * Initialize storage manager
   */
  public static init(): void {
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log("Paper Copilot: Block storage initialized");
    }
  }

  /**
   * Save blocks for a specific item
   */
  public static async saveBlocks(
    itemKey: string,
    blocks: (PDFBlock | FigureBlock)[],
  ): Promise<void> {
    try {
      const storedBlocks: StoredBlock[] = blocks.map((block) => ({
        id: block.id,
        type: block.type,
        page: block.page,
        text: block.text.substring(0, 5000), // Limit text length
        label: "label" in block ? block.label : undefined,
        bbox: block.bbox ? JSON.stringify(block.bbox) : undefined,
      }));

      const storage: BlockStorage = {
        itemKey,
        blocks: storedBlocks,
        lastUpdated: new Date().toISOString(),
      };

      const key = this.STORAGE_PREFIX + itemKey;
      Zotero.Prefs.set(key, JSON.stringify(storage));

      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log(
          `Paper Copilot: Saved ${blocks.length} blocks for item ${itemKey}`,
        );
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error saving blocks:", e);
      }
    }
  }

  /**
   * Load blocks for a specific item
   */
  public static loadBlocks(itemKey: string): BlockStorage | null {
    try {
      const key = this.STORAGE_PREFIX + itemKey;
      const data = Zotero.Prefs.get(key) as string;

      if (data) {
        return JSON.parse(data) as BlockStorage;
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error loading blocks:", e);
      }
    }
    return null;
  }

  /**
   * Delete blocks for a specific item
   */
  public static deleteBlocks(itemKey: string): void {
    try {
      const key = this.STORAGE_PREFIX + itemKey;
      Zotero.Prefs.set(key, "");

      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log(`Paper Copilot: Deleted blocks for item ${itemKey}`);
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error deleting blocks:", e);
      }
    }
  }

  /**
   * Get blocks by type
   */
  public static getBlocksByType(itemKey: string, type: string): StoredBlock[] {
    const storage = this.loadBlocks(itemKey);
    if (!storage) return [];

    return storage.blocks.filter((b) => b.type === type);
  }

  /**
   * Get blocks by page
   */
  public static getBlocksByPage(itemKey: string, page: number): StoredBlock[] {
    const storage = this.loadBlocks(itemKey);
    if (!storage) return [];

    return storage.blocks.filter((b) => b.page === page);
  }

  /**
   * Search blocks by text
   */
  public static searchBlocks(itemKey: string, keyword: string): StoredBlock[] {
    const storage = this.loadBlocks(itemKey);
    if (!storage) return [];

    const lower = keyword.toLowerCase();
    return storage.blocks.filter((b) => b.text.toLowerCase().includes(lower));
  }

  /**
   * Get all item keys with stored blocks
   */
  public static getAllStoredItemKeys(): string[] {
    try {
      const allPrefs = Zotero.Prefs.getAll();
      const keys: string[] = [];

      for (const key of Object.keys(allPrefs)) {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          const itemKey = key.slice(this.STORAGE_PREFIX.length);
          keys.push(itemKey);
        }
      }

      return keys;
    } catch (e) {
      return [];
    }
  }

  /**
   * Save to item note
   */
  public static async saveToItemNote(
    itemKey: string,
    blocks: (PDFBlock | FigureBlock)[],
  ): Promise<void> {
    try {
      const item = await Zotero.Items.getByKeyAsync(itemKey);
      if (!item) return;

      // Create or update note
      const noteContent = this.generateNoteContent(blocks);

      // Check if note already exists
      const existingNote = item.getNotes?.();
      if (existingNote && existingNote.length > 0) {
        // Update existing note
        const note = await Zotero.Items.getByKeyAsync(existingNote[0]);
        if (note) {
          note.setNote?.(noteContent);
          await note.save?.();
        }
      } else {
        // Create new note
        const note = new Zotero.Item("note");
        note.setNote?.(noteContent);
        note.setParentID?.(item.id);
        await note.save?.();
      }

      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Saved blocks to item note");
      }
    } catch (e) {
      if (typeof ztoolkit !== "undefined") {
        ztoolkit.log("Paper Copilot: Error saving to note:", e);
      }
    }
  }

  /**
   * Generate note content from blocks
   */
  private static generateNoteContent(
    blocks: (PDFBlock | FigureBlock)[],
  ): string {
    let html = "<h1>Paper Copilot - Document Structure</h1>";

    // Group by page
    const byPage: { [page: number]: (PDFBlock | FigureBlock)[] } = {};
    for (const block of blocks) {
      if (!byPage[block.page]) {
        byPage[block.page] = [];
      }
      byPage[block.page].push(block);
    }

    for (const page of Object.keys(byPage).sort(
      (a, b) => Number(a) - Number(b),
    )) {
      html += `<h2>Page ${page}</h2>`;

      for (const block of byPage[Number(page)]) {
        if (block.type === "heading" || block.type === "title") {
          html += `<h3>${this.escapeHtml(block.text)}</h3>`;
        } else if (block.type === "figure" || block.type === "table") {
          html += `<p><strong>${this.escapeHtml(block.label || block.type)}:</strong> ${this.escapeHtml(block.text.substring(0, 200))}</p>`;
        } else {
          html += `<p>${this.escapeHtml(block.text.substring(0, 300))}</p>`;
        }
      }
    }

    return html;
  }

  /**
   * Escape HTML
   */
  private static escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Initialize block storage
 */
export function initBlockStorage(): void {
  BlockStorageManager.init();

  if (typeof ztoolkit !== "undefined") {
    ztoolkit.log("Paper Copilot: Block storage module initialized");
  }
}
