/**
 * Tool Registry System - Main Registry
 * Singleton registry for managing all available tools
 */

import { Tool } from "./base/Tool";

/**
 * Tool registry singleton class
 * Manages registration, lookup, and listing of tools
 */
class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool with the registry
   */
  register(tool: Tool): void {
    if (!tool || !tool.name) {
      throw new Error("Cannot register tool: invalid tool or missing name");
    }

    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }

    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools filtered by category
   */
  listByCategory(category: string): Tool[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.category === category,
    );
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Unregister a tool by name
   * Returns true if the tool was found and removed, false otherwise
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get the number of registered tools
   */
  size(): number {
    return this.tools.size;
  }
}

// Singleton export
export const toolRegistry = new ToolRegistry();

// Re-export types and classes
export * from "./base/Tool";

// Re-export tool loader
export { loadAllTools, getAllTools, getToolsByCategory } from "./ToolLoader";

// Re-export tools for convenience
export {
  GetItemTool,
  GetSelectedItemsTool,
  GetPdfTextTool,
  SearchItemsTool,
  ScreenshotTool,
} from "./read";
export {
  AddNoteTool,
  UpdateTagsTool,
  CreateHighlightTool,
  SyncNotesTool,
} from "./write";
