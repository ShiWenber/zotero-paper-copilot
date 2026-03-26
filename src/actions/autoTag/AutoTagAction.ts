/**
 * Action System - Auto Tag Action
 * Automatically generate and apply tags to items based on content analysis
 */

import { BaseAction, ActionContext, ActionResult } from "../base/Action";
import { AgentMessage } from "../../agent/types";

/**
 * Tag suggestion result for a single item
 */
interface ItemTagResult {
  itemID: number;
  title: string;
  suggestedTags: string[];
  appliedTags: string[];
  errors?: string[];
}

type TagStyle = "general" | "specific" | "field-specific";

/**
 * Auto Tag action - uses LLM to suggest and apply tags to items
 */
export class AutoTagAction extends BaseAction {
  name = "auto_tag_items";
  description =
    "Automatically generate and apply tags to items based on content analysis";

  parameters = [
    {
      name: "items",
      description: "Item IDs to tag",
      type: "array",
      required: true,
    },
    {
      name: "numTags",
      description: "Maximum number of tags per item",
      type: "number",
      required: false,
      default: 5,
    },
    {
      name: "tagStyle",
      description:
        "Tag style: general (broad topics), specific (narrow topics), field-specific (research field)",
      type: "string",
      required: false,
      default: "general",
    },
  ];

  canApply(items: any[], _context: ActionContext): boolean {
    return items.length > 0;
  }

  async doExecute(
    args: { items: number[]; numTags?: number; tagStyle?: string },
    context: ActionContext,
  ): Promise<ActionResult> {
    const { items: itemIDs, numTags = 5, tagStyle = "general" } = args;
    const { services, llmManager } = context;

    const tagResults: ItemTagResult[] = [];
    const errors: string[] = [];

    for (const itemID of itemIDs) {
      try {
        const item = services.zotero.getItem(itemID);
        if (!item) {
          errors.push(`Item ${itemID}: Not found`);
          continue;
        }

        const metadata = services.zotero.getItemMetadata(item);
        const tagResult = await this.generateAndApplyTags(
          itemID,
          metadata,
          numTags,
          tagStyle as TagStyle,
          context,
        );
        tagResults.push(tagResult);

        if (tagResult.errors && tagResult.errors.length > 0) {
          errors.push(...tagResult.errors.map((e) => `Item ${itemID}: ${e}`));
        }
      } catch (err: any) {
        const errorMsg = err?.message ?? String(err);
        errors.push(`Item ${itemID}: ${errorMsg}`);
        tagResults.push({
          itemID,
          title: "(Unknown)",
          suggestedTags: [],
          appliedTags: [],
          errors: [errorMsg],
        });
      }
    }

    const successfulTags = tagResults.filter(
      (r) => r.errors === undefined || r.errors.length === 0,
    ).length;

    return {
      success: errors.length === 0,
      message: `Auto-tagging complete: ${successfulTags}/${itemIDs.length} items processed`,
      data: {
        summary: {
          totalItems: itemIDs.length,
          successfulItems: successfulTags,
          failedItems: itemIDs.length - successfulTags,
          numTagsRequested: numTags,
          tagStyle,
        },
        items: tagResults,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate tags using LLM and apply them to an item
   */
  private async generateAndApplyTags(
    itemID: number,
    metadata: {
      title: string;
      authors?: string[];
      abstract?: string;
      year?: number;
    },
    numTags: number,
    tagStyle: TagStyle,
    context: ActionContext,
  ): Promise<ItemTagResult> {
    const { services, toolRegistry, llmManager } = context;

    // Build prompt for tag suggestion
    const prompt = this.buildTagPrompt(metadata, numTags, tagStyle);

    // Call LLM to get tag suggestions
    let suggestedTags: string[];
    try {
      const messages: AgentMessage[] = [{ role: "user", content: prompt }];

      const response = await llmManager.complete(messages);

      // Parse tags from response
      suggestedTags = this.parseTagsFromResponse(response.content);

      // Limit to requested number
      suggestedTags = suggestedTags.slice(0, numTags);
    } catch (err: any) {
      this.log("LLM tag generation failed:", err);
      return {
        itemID,
        title: metadata.title || "(Untitled)",
        suggestedTags: [],
        appliedTags: [],
        errors: [`Tag generation failed: ${err?.message ?? String(err)}`],
      };
    }

    if (suggestedTags.length === 0) {
      return {
        itemID,
        title: metadata.title || "(Untitled)",
        suggestedTags: [],
        appliedTags: [],
        errors: ["No tags suggested by LLM"],
      };
    }

    // Apply tags using update_tags tool
    try {
      const updateTagsTool = toolRegistry.get("update_tags");
      if (!updateTagsTool) {
        return {
          itemID,
          title: metadata.title || "(Untitled)",
          suggestedTags,
          appliedTags: [],
          errors: ["update_tags tool not available"],
        };
      }

      const result = await updateTagsTool.execute(
        { itemID, addTags: suggestedTags },
        {
          window: context.window,
          agent: context.agent,
          services: context.services,
        },
      );

      if (result.error) {
        return {
          itemID,
          title: metadata.title || "(Untitled)",
          suggestedTags,
          appliedTags: [],
          errors: [`Failed to apply tags: ${result.error}`],
        };
      }

      return {
        itemID,
        title: metadata.title || "(Untitled)",
        suggestedTags,
        appliedTags: suggestedTags,
      };
    } catch (err: any) {
      return {
        itemID,
        title: metadata.title || "(Untitled)",
        suggestedTags,
        appliedTags: [],
        errors: [`Failed to apply tags: ${err?.message ?? String(err)}`],
      };
    }
  }

  /**
   * Build prompt for tag suggestion based on item metadata
   */
  private buildTagPrompt(
    metadata: {
      title: string;
      authors?: string[];
      abstract?: string;
      year?: number;
    },
    numTags: number,
    tagStyle: TagStyle,
  ): string {
    const styleInstructions: Record<TagStyle, string> = {
      general:
        "Use broad, general topic tags that describe the main subject areas (e.g., 'machine learning', 'climate change', 'neuroscience').",
      specific:
        "Use specific, narrow tags that describe particular methods, findings, or concepts (e.g., 'transformer attention', 'carbon sequestration', 'default mode network').",
      "field-specific":
        "Use research field and subfield tags (e.g., 'computer vision', 'marine biology', 'quantum computing').",
    };

    let prompt = `Based on the following academic paper metadata, suggest ${numTags} relevant tags for organizing this paper.\n\n`;
    prompt += `Style: ${styleInstructions[tagStyle]}\n\n`;
    prompt += `Title: ${metadata.title || "N/A"}\n`;
    if (metadata.authors && metadata.authors.length > 0) {
      prompt += `Authors: ${metadata.authors.join(", ")}\n`;
    }
    if (metadata.year) {
      prompt += `Year: ${metadata.year}\n`;
    }
    if (metadata.abstract) {
      prompt += `Abstract: ${metadata.abstract.substring(0, 1000)}${metadata.abstract.length > 1000 ? "..." : ""}\n`;
    }
    prompt += `\nRespond with a JSON array of tag strings only, like: ["tag1", "tag2", "tag3"]`;

    return prompt;
  }

  /**
   * Parse tags from LLM response
   */
  private parseTagsFromResponse(content: string): string[] {
    try {
      // Try to find JSON array in response
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed
            .map((tag) => {
              if (typeof tag === "string") {
                // Clean up tag
                return tag
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9\-_\s]/g, "");
              }
              return null;
            })
            .filter((tag): tag is string => tag !== null && tag.length > 0);
        }
      }
    } catch {
      // Fall through to line-by-line parsing
    }

    // Fallback: try to extract tags from lines
    const lines = content.split("\n");
    const tags: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("//")) {
        // Remove common prefixes like "- ", "* ", "• "
        const cleaned = trimmed.replace(/^[-*•]\s*/, "").trim();
        if (cleaned) {
          tags.push(cleaned.toLowerCase().replace(/[^a-z0-9\-_\s]/g, ""));
        }
      }
    }

    return tags;
  }
}
