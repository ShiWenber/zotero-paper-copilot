/**
 * Action Registry System - Main Registry
 * Singleton registry for managing all available actions
 */

import { BaseAction } from "./base/Action";

/**
 * Action registry singleton class
 * Manages registration, lookup, and listing of actions
 */
class ActionRegistry {
  private actions: Map<string, BaseAction> = new Map();

  /**
   * Register an action with the registry
   */
  register(action: BaseAction): void {
    if (!action || !action.name) {
      throw new Error("Cannot register action: invalid action or missing name");
    }

    if (this.actions.has(action.name)) {
      throw new Error(`Action "${action.name}" is already registered`);
    }

    this.actions.set(action.name, action);
  }

  /**
   * Get an action by name
   */
  get(name: string): BaseAction | undefined {
    return this.actions.get(name);
  }

  /**
   * List all registered actions
   */
  list(): BaseAction[] {
    return Array.from(this.actions.values());
  }

  /**
   * Get actions filtered by category (based on name prefix)
   */
  listByCategory(): Map<string, BaseAction[]> {
    const categories = new Map<string, BaseAction[]>();

    for (const action of this.actions.values()) {
      // Derive category from action name prefix (e.g., "audit_items" -> "audit")
      const parts = action.name.split("_");
      const category = parts.length > 1 ? parts[0] : "misc";

      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(action);
    }

    return categories;
  }

  /**
   * Check if an action exists
   */
  has(name: string): boolean {
    return this.actions.has(name);
  }

  /**
   * Unregister an action by name
   * Returns true if the action was found and removed, false otherwise
   */
  unregister(name: string): boolean {
    return this.actions.delete(name);
  }

  /**
   * Clear all registered actions
   */
  clear(): void {
    this.actions.clear();
  }

  /**
   * Get the number of registered actions
   */
  size(): number {
    return this.actions.size;
  }
}

// Singleton export
export const actionRegistry = new ActionRegistry();
