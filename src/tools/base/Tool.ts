/**
 * Tool Registry System - Base Tool Interface
 * Base classes and interfaces for all tools
 */

import { ToolResult } from "../agent/types";
import { ZoteroGateway } from "../services/ZoteroGateway";
import { PdfService } from "../services/PdfService";
import { Agent } from "../agent/Agent";

/**
 * Parameter definition for tool inputs
 */
export interface ParameterDefinition {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  default?: any;
}

/**
 * Context passed to tools during execution
 */
export interface ToolContext {
  window: Window;
  agent: Agent;
  services: {
    zotero: ZoteroGateway;
    pdf: PdfService;
  };
}

/**
 * Base Tool interface that all tools must implement
 */
export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly parameters?: ParameterDefinition[];

  execute(args: Record<string, any>, context: ToolContext): Promise<ToolResult>;
}

/**
 * Abstract base class for tools with common functionality
 */
export abstract class BaseTool implements Tool {
  abstract name: string;
  abstract description: string;
  abstract category: string;
  abstract parameters?: ParameterDefinition[];

  /**
   * Core execution logic - must be implemented by subclasses
   */
  abstract doExecute(
    args: Record<string, any>,
    context: ToolContext,
  ): Promise<ToolResult>;

  /**
   * Execute the tool with common pre/post processing
   */
  async execute(
    args: Record<string, any>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const toolId = `${this.name}-${Date.now()}`;

    try {
      // Validate required parameters
      if (this.parameters) {
        for (const param of this.parameters) {
          if (
            param.required &&
            (args[param.name] === undefined || args[param.name] === null)
          ) {
            return {
              id: toolId,
              result: null,
              error: `Missing required parameter: ${param.name}`,
            };
          }
        }
      }

      // Execute the tool
      const result = await this.doExecute(args, context);
      return {
        id: toolId,
        result: result.result,
        error: result.error,
      };
    } catch (err: any) {
      return {
        id: toolId,
        result: null,
        error: err?.message ?? String(err),
      };
    }
  }

  /**
   * Log helper for debugging
   */
  protected log(...args: any[]): void {
    if (typeof ztoolkit !== "undefined") {
      ztoolkit.log(`[Tool:${this.name}]`, ...args);
    } else if (typeof console !== "undefined") {
      console.log(`[Tool:${this.name}]`, ...args);
    }
  }
}
