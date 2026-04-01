/**
 * Base LLM Adapter Interface
 * Defines the contract for all LLM provider adapters
 */

import { AgentMessage, ToolCall, ToolDefinition } from "../../../agent/types";

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: "stop" | "length" | "content_filter" | "tool_calls" | "error";
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export interface StreamingCallback {
  (chunk: string): void;
}

/**
 * Abstract base class for LLM adapters.
 * All LLM providers (OpenAI, Claude, Gemini, etc.) should extend this class.
 */
export abstract class BaseLLMAdapter {
  /** The model identifier for this adapter */
  abstract model: string;

  /** The API key used for authentication */
  abstract apiKey: string;

  /**
   * Send a completion request to the LLM.
   * @param messages The conversation messages
   * @param tools Optional tool definitions for function calling
   * @param streaming Optional callback for streaming responses
   * @returns The LLM response
   */
  abstract complete(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    streaming?: StreamingCallback,
  ): Promise<LLMResponse>;

  /**
   * Check if this adapter supports streaming.
   * @returns true if streaming is supported
   */
  supportsStreaming(): boolean {
    return false;
  }

  /**
   * Validate that the adapter is properly configured.
   * @returns true if the API key is set and configuration is valid
   */
  validateConfig(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }
}
