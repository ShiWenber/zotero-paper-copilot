/**
 * Agent Runtime Framework - Tool Utilities
 * Helpers for creating and managing tools
 */

import { ToolDefinition, ToolHandler } from "./types";

export interface ToolOptions {
  name: string;
  description: string;
  parameters?: any;
}

/**
 * Create a tool definition with metadata.
 * The handler is provided separately to allow proper typing.
 */
export function createToolDefinition(
  options: ToolOptions,
  handler: ToolHandler,
): ToolDefinition {
  // If parameters is not provided (undefined), use empty object as default
  // This matches the original behavior
  return {
    name: options.name,
    description: options.description,
    parameters: options.parameters ?? {},
    handler,
  };
}

/**
 * Base Tool interface for structured tool definitions.
 * Can be extended for more specific tool types.
 */
export interface BaseTool {
  name: string;
  description: string;
  execute(
    args: Record<string, any>,
    context?: Record<string, any>,
  ): Promise<any>;
}

/**
 * Abstract base class for tools with a structured interface.
 * Alternative to using createToolDefinition for class-based tools.
 */
export abstract class BaseToolClass implements BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters?: any;

  abstract execute(
    args: Record<string, any>,
    context?: Record<string, any>,
  ): Promise<any>;

  toDefinition(): ToolDefinition {
    // If parameters is undefined or empty object, omit it from the definition
    // This allows BaseToolClass subclasses to signal "no parameters" by
    // either not defining parameters or setting it to {}
    const params = this.parameters;
    const hasParameters =
      params !== undefined && Object.keys(params).length > 0;

    const def: ToolDefinition = {
      name: this.name,
      description: this.description,
      handler: (args, context) => this.execute(args, context),
    };

    if (hasParameters) {
      def.parameters = params;
    }

    return def;
  }
}
