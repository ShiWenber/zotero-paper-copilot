/**
 * Tool Registry System - Tool Loader
 * Loads and registers all available tools
 */

import { toolRegistry } from "./index";
import {
  GetItemTool,
  GetSelectedItemsTool,
  GetPdfTextTool,
  SearchItemsTool,
  ScreenshotTool,
} from "./read";
import {
  AddNoteTool,
  UpdateTagsTool,
  CreateHighlightTool,
  SyncNotesTool,
} from "./write";

/**
 * Load and register all available tools with the registry
 */
export function loadAllTools(): void {
  // Register read tools
  toolRegistry.register(new GetItemTool());
  toolRegistry.register(new GetSelectedItemsTool());
  toolRegistry.register(new GetPdfTextTool());
  toolRegistry.register(new SearchItemsTool());
  toolRegistry.register(new ScreenshotTool());

  // Register write tools
  toolRegistry.register(new AddNoteTool());
  toolRegistry.register(new UpdateTagsTool());
  toolRegistry.register(new CreateHighlightTool());
  toolRegistry.register(new SyncNotesTool());
}

/**
 * Get all registered tools from the registry
 */
export function getAllTools() {
  return toolRegistry.list();
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string) {
  return toolRegistry.listByCategory(category);
}
