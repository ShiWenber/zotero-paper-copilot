/**
 * Action System - Base Action Interface
 * Base classes and interfaces for all actions
 */

import { Agent } from "../../agent/Agent";
import { LLMManager } from "../../llm";
import { ZoteroGateway } from "../../services/ZoteroGateway";
import { PdfService } from "../../services/PdfService";
import { ToolRegistry, ParameterDefinition } from "../../tools";

/**
 * Context passed to actions during execution
 */
export interface ActionContext {
  window: Window;
  agent: Agent;
  llmManager: LLMManager;
  services: {
    zotero: ZoteroGateway;
    pdf: PdfService;
  };
  toolRegistry: typeof toolRegistry;
}

/**
 * Result returned by an action execution
 */
export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
}

/**
 * Zotero item type alias (items are Zotero.Item instances)
 */
export type ZoteroItem = any;

/**
 * Abstract base class for actions with common functionality
 */
export abstract class BaseAction {
  abstract name: string;
  abstract description: string;
  abstract parameters: ParameterDefinition[];

  /**
   * Check if this action can be applied to the given items
   */
  abstract canApply(
    items: ZoteroItem[],
    context: ActionContext,
  ): boolean | Promise<boolean>;

  /**
   * Execute the action
   */
  abstract doExecute(
    args: Record<string, any>,
    context: ActionContext,
  ): ActionResult | Promise<ActionResult>;

  /**
   * Execute the action with common pre/post processing
   */
  async execute(
    args: Record<string, any>,
    context: ActionContext,
  ): Promise<ActionResult> {
    try {
      // Validate required parameters
      if (this.parameters) {
        for (const param of this.parameters) {
          if (
            param.required &&
            (args[param.name] === undefined || args[param.name] === null)
          ) {
            return {
              success: false,
              message: `Missing required parameter: ${param.name}`,
              errors: [`Missing required parameter: ${param.name}`],
            };
          }
        }
      }

      // Execute the action
      const result = await Promise.resolve(this.doExecute(args, context));
      return result;
    } catch (err: any) {
      const errorMsg = err?.message ?? String(err);
      return {
        success: false,
        message: `Action "${this.name}" failed: ${errorMsg}`,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Log helper for debugging
   */
  protected log(...args: any[]): void {
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log(`[Action:${this.name}]`, ...args);
    } else if (typeof console !== "undefined") {
      console.log(`[Action:${this.name}]`, ...args);
    }
  }
}
