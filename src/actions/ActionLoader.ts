/**
 * Action System - Action Loader
 * Loads and registers all available actions
 */

import { actionRegistry } from "./index";
import { AuditAction, AutoTagAction, SyncMetadataAction } from "./index";

/**
 * Load and register all built-in actions
 */
export function loadAllActions(): void {
  actionRegistry.register(new AuditAction());
  actionRegistry.register(new AutoTagAction());
  actionRegistry.register(new SyncMetadataAction());
}

/**
 * Get all loaded actions
 */
export function getAllActions() {
  return actionRegistry.list();
}

/**
 * Get actions by category
 */
export function getActionsByCategory() {
  return actionRegistry.listByCategory();
}
