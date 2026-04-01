/**
 * LLM Manager - Factory and Manager for LLM Adapters
 * Provides a unified interface for switching between LLM providers
 */

import {
  BaseLLMAdapter,
  LLMResponse,
  StreamingCallback,
} from "./adapters/base/BaseLLMAdapter";
import { OpenAIAdapter } from "./adapters/OpenAIAdapter";
import { AgentMessage, ToolDefinition } from "../agent/types";

export type LLMProvider = "openai" | "claude" | "gemini";

/**
 * LLM Manager singleton for managing LLM adapters.
 * Provides a unified interface for making LLM requests regardless of provider.
 */
export class LLMManager {
  private static _instance: LLMManager;
  private adapters: Map<LLMProvider, BaseLLMAdapter> = new Map();
  private apiKeys: Map<LLMProvider, string> = new Map();
  private _currentProvider: LLMProvider = "openai";

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of LLMManager.
   */
  static getInstance(): LLMManager {
    if (!LLMManager._instance) {
      LLMManager._instance = new LLMManager();
    }
    return LLMManager._instance;
  }

  /**
   * Register an adapter for a specific provider.
   * If an adapter already exists for the provider, it will be replaced.
   */
  registerAdapter(provider: LLMProvider, adapter: BaseLLMAdapter): void {
    this.adapters.set(provider, adapter);
  }

  /**
   * Set the current LLM provider.
   * @throws Error if no adapter is registered for the provider
   */
  setProvider(provider: LLMProvider): void {
    if (!this.adapters.has(provider)) {
      throw new Error(
        `No adapter registered for provider "${provider}". ` +
          `Please register an adapter first using registerAdapter().`,
      );
    }
    this._currentProvider = provider;
  }

  /**
   * Get the current provider.
   */
  get currentProvider(): LLMProvider {
    return this._currentProvider;
  }

  /**
   * Get the adapter for a specific provider.
   * @throws Error if no adapter is registered
   */
  getAdapter(provider?: LLMProvider): BaseLLMAdapter {
    const p = provider ?? this._currentProvider;
    const adapter = this.adapters.get(p);
    if (!adapter) {
      throw new Error(
        `No adapter registered for provider "${p}". ` +
          `Please register an adapter first.`,
      );
    }
    return adapter;
  }

  /**
   * Convenience method to make an LLM request using the current provider.
   */
  async complete(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    streaming?: StreamingCallback,
  ): Promise<LLMResponse> {
    const adapter = this.getAdapter();
    return adapter.complete(messages, tools, streaming);
  }

  /**
   * Set the API key for a provider.
   * If an adapter is already registered, updates its apiKey.
   * Otherwise, stores it for later use when an adapter is created.
   */
  setApiKey(provider: LLMProvider, apiKey: string): void {
    this.apiKeys.set(provider, apiKey);
    const adapter = this.adapters.get(provider);
    if (adapter) {
      adapter.apiKey = apiKey;
    }
  }

  /**
   * Get the API key for a provider.
   */
  getApiKey(provider: LLMProvider): string | undefined {
    return this.apiKeys.get(provider);
  }

  /**
   * Check if a provider has an API key configured.
   */
  hasApiKey(provider: LLMProvider): boolean {
    return this.apiKeys.has(provider) && Boolean(this.apiKeys.get(provider));
  }

  /**
   * Initialize the default OpenAI adapter with API key from preferences.
   * This is the typical initialization path for the Zotero plugin.
   *
   * @param apiKey - The OpenAI API key (e.g., from Zotero preferences)
   * @param model - Optional model override (default: gpt-4)
   * @param baseUrl - Optional base URL for OpenAI-compatible APIs
   */
  initializeOpenAI(
    apiKey: string,
    model?: string,
    baseUrl?: string,
  ): OpenAIAdapter {
    const adapter = new OpenAIAdapter({ apiKey, model, baseUrl });
    this.registerAdapter("openai", adapter);
    this.apiKeys.set("openai", apiKey);
    return adapter;
  }

  /**
   * Check if streaming is supported by the current provider.
   */
  supportsStreaming(): boolean {
    try {
      const adapter = this.getAdapter();
      return adapter.supportsStreaming();
    } catch {
      return false;
    }
  }

  /**
   * Validate the current adapter configuration.
   */
  validateConfig(): boolean {
    try {
      const adapter = this.getAdapter();
      return adapter.validateConfig();
    } catch {
      return false;
    }
  }

  /**
   * Reset the singleton instance. FOR TESTING PURPOSES ONLY.
   * This allows tests to start with a fresh LLMManager state.
   */
  static resetInstance(): void {
    LLMManager._instance = undefined as unknown as LLMManager;
  }
}
