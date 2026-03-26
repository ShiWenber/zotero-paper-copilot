/**
 * Action System - Audit Action
 * Analyze items and provide an audit report for metadata completeness
 */

import {
  BaseAction,
  ActionContext,
  ActionResult,
  ZoteroItem,
} from "../base/Action";
import { ItemMetadata } from "../../services/types";

/**
 * Audit result for a single item
 */
interface ItemAuditResult {
  itemID: number;
  title: string;
  isComplete: boolean;
  missingFields: string[];
  incompleteFields: string[];
  suggestions: string[];
  metadata: {
    title?: string;
    authors?: string[];
    year?: number;
    abstract?: string;
    doi?: string;
    tags?: string[];
    collections?: string[];
  };
}

/**
 * Audit action - checks item metadata completeness and quality
 */
export class AuditAction extends BaseAction {
  name = "audit_items";
  description = "Audit selected items for metadata completeness and quality";

  parameters = [
    {
      name: "items",
      description: "Item IDs to audit",
      type: "array",
      required: true,
    },
    {
      name: "checkFields",
      description: "Fields to check (default: all core fields)",
      type: "array",
      required: false,
    },
  ];

  canApply(items: ZoteroItem[], _context: ActionContext): boolean {
    return items.length > 0;
  }

  async doExecute(
    args: { items: number[]; checkFields?: string[] },
    context: ActionContext,
  ): Promise<ActionResult> {
    const { items: itemIDs, checkFields } = args;
    const { services } = context;

    // Default fields to check if not specified
    const fieldsToCheck = checkFields ?? [
      "title",
      "authors",
      "year",
      "abstract",
      "doi",
      "tags",
    ];

    const auditResults: ItemAuditResult[] = [];
    const errors: string[] = [];

    for (const itemID of itemIDs) {
      try {
        const item = services.zotero.getItem(itemID);
        if (!item) {
          errors.push(`Item ${itemID}: Not found`);
          continue;
        }

        const metadata = services.zotero.getItemMetadata(item);
        const itemResult = this.auditItem(itemID, metadata, fieldsToCheck);
        auditResults.push(itemResult);
      } catch (err: any) {
        errors.push(`Item ${itemID}: ${err?.message ?? String(err)}`);
      }
    }

    // Calculate summary
    const totalItems = auditResults.length;
    const completeItems = auditResults.filter((r) => r.isComplete).length;
    const incompleteItems = totalItems - completeItems;

    // Field coverage statistics
    const fieldCoverage: Record<string, { present: number; missing: number }> =
      {};
    for (const field of fieldsToCheck) {
      fieldCoverage[field] = { present: 0, missing: 0 };
      for (const result of auditResults) {
        if (result.missingFields.includes(field)) {
          fieldCoverage[field].missing++;
        } else {
          fieldCoverage[field].present++;
        }
      }
    }

    return {
      success: errors.length === 0,
      message: `Audit complete: ${completeItems}/${totalItems} items have complete metadata`,
      data: {
        summary: {
          totalItems,
          completeItems,
          incompleteItems,
          fieldCoverage,
          fieldsChecked: fieldsToCheck,
        },
        items: auditResults,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Audit a single item's metadata
   */
  private auditItem(
    itemID: number,
    metadata: ItemMetadata,
    fieldsToCheck: string[],
  ): ItemAuditResult {
    const missingFields: string[] = [];
    const incompleteFields: string[] = [];
    const suggestions: string[] = [];

    // Check title
    if (fieldsToCheck.includes("title")) {
      if (!metadata.title || metadata.title.trim() === "") {
        missingFields.push("title");
        suggestions.push("Add a title to the item");
      }
    }

    // Check authors
    if (fieldsToCheck.includes("authors")) {
      if (!metadata.authors || metadata.authors.length === 0) {
        missingFields.push("authors");
        suggestions.push("Add at least one author to the item");
      }
    }

    // Check year
    if (fieldsToCheck.includes("year")) {
      if (!metadata.year) {
        missingFields.push("year");
        suggestions.push("Add a publication year to the item");
      } else if (typeof metadata.year !== "number" || metadata.year < 1000) {
        incompleteFields.push("year");
        suggestions.push("Year appears to be invalid");
      }
    }

    // Check abstract
    if (fieldsToCheck.includes("abstract")) {
      if (!metadata.abstract || metadata.abstract.trim() === "") {
        missingFields.push("abstract");
        suggestions.push(
          "Consider adding an abstract for better discoverability",
        );
      }
    }

    // Check DOI
    if (fieldsToCheck.includes("doi")) {
      if (!metadata.doi) {
        missingFields.push("doi");
        suggestions.push("Add DOI for easier citation and metadata sync");
      } else if (!this.isValidDOI(metadata.doi)) {
        incompleteFields.push("doi");
        suggestions.push("DOI format appears to be invalid");
      }
    }

    // Check tags
    if (fieldsToCheck.includes("tags")) {
      if (!metadata.tags || metadata.tags.length === 0) {
        missingFields.push("tags");
        suggestions.push("Add tags to improve organization and searchability");
      }
    }

    const isComplete =
      missingFields.length === 0 && incompleteFields.length === 0;

    return {
      itemID,
      title: metadata.title || "(Untitled)",
      isComplete,
      missingFields,
      incompleteFields,
      suggestions,
      metadata,
    };
  }

  /**
   * Basic DOI validation
   */
  private isValidDOI(doi: string): boolean {
    // DOI format: 10.xxxx/xxxxx
    const doiRegex = /^10\.\d{4,}\/[^\s]+$/;
    return doiRegex.test(doi);
  }
}
