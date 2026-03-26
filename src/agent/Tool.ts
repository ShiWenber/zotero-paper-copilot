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
    return createToolDefinition(
      {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
      (args, context) => this.execute(args, context),
    );
  }
}
