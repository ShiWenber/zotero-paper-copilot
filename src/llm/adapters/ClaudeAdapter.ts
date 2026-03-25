/**
 * Claude (Anthropic) LLM Adapter
 * Stub implementation for Claude API integration
 *
 * TODO: Implement full Claude API support
 * - Claude uses a different API endpoint: https://api.anthropic.com/v1/messages
 * - Claude uses a different tool calling format (stop reason + tool_use block)
 * - Claude's messages API is synchronous only (no streaming in public API)
 */

import { BaseLLMAdapter, LLMResponse } from "./base/BaseLLMAdapter";
import { AgentMessage, ToolCall, ToolDefinition } from "../../../agent/types";

export interface ClaudeAdapterConfig {
  apiKey: string;
  model?: string;
}

/**
 * Claude adapter using Anthropic's Messages API.
 *
 * Note: Claude's API is structurally different from OpenAI:
 * - Endpoint: POST https://api.anthropic.com/v1/messages
 * - Headers require x-api-key and anthropic-version
 * - Messages are sent as an array, not chat-format
 * - Tool use is indicated by stop_reason === "tool_use"
 */
export class ClaudeAdapter extends BaseLLMAdapter {
  model = "claude-3-5-sonnet-20241022";
  apiKey: string;
  apiVersion = "2023-06-01";

  constructor(config: ClaudeAdapterConfig) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model ?? this.model;
  }

  supportsStreaming(): boolean {
    // Claude's public API does not support streaming as of 2024
    // TODO: Check if Claude SDK supports streaming
    return false;
  }

  /**
   * Send a completion request to Claude's Messages API.
   *
   * TODO: Implement full Claude API integration
   */
  async complete(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
    _streaming?: (chunk: string) => void,
  ): Promise<LLMResponse> {
    if (!this.validateConfig()) {
      return {
        content: "",
        finishReason: "error",
        error:
          "Claude adapter is not properly configured. Please provide an API key.",
      };
    }

    // TODO: Implement Claude API call
    console.warn(
      "[ClaudeAdapter] Claude adapter is not yet fully implemented. " +
        "This is a stub that returns an error message.",
    );

    return {
      content: "",
      finishReason: "error",
      error:
        "Claude adapter is not yet implemented. Please use the OpenAI adapter instead.",
    };

    /*
     * TODO: Full implementation outline:
     *
     * const url = "https://api.anthropic.com/v1/messages";
     * const body = this.buildClaudeRequest(messages, tools);
     *
     * const response = await fetch(url, {
     *   method: "POST",
     *   headers: {
     *     "Content-Type": "application/json",
     *     "x-api-key": this.apiKey,
     *     "anthropic-version": this.apiVersion,
     *   },
     *   body: JSON.stringify(body),
     * });
     *
     * const json = await response.json();
     * return this.fromClaudeResponse(json);
     */
  }

  /**
   * Convert our message format to Claude's message format.
   *
   * Claude expects messages in this format:
   * {
   *   role: "user" | "assistant",
   *   content: string | { type: "text" } | { type: "tool_use", id: string, name: string, input: object }
   * }
   *
   * TODO: Implement message conversion
   */
  private toClaudeMessages(messages: AgentMessage[]): object[] {
    const claudeMessages = messages.map((msg) => {
      // TODO: Handle role conversion (system becomes user message with @core)
      // TODO: Handle tool results (assistant messages with tool_use blocks)
      return {
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      };
    });

    return claudeMessages;
  }

  /**
   * Convert Claude's response format to our LLMResponse format.
   *
   * Claude's response:
   * {
   *   id: string,
   *   type: "message",
   *   role: "assistant",
   *   content: Array<{ type: "text", text: string } | { type: "tool_use", id: string, name: string, input: object }>,
   *   stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use",
   *   usage: { input_tokens: number, output_tokens: number }
   * }
   *
   * TODO: Implement response conversion
   */
  private fromClaudeResponse(response: any): LLMResponse {
    // TODO: Implement full response parsing
    const textContent = response.content?.find(
      (block: any) => block.type === "text",
    );
    const toolUses = response.content?.filter(
      (block: any) => block.type === "tool_use",
    );

    const toolCalls: ToolCall[] = (toolUses ?? []).map(
      (toolUse: any): ToolCall => ({
        id: toolUse.id,
        name: toolUse.name,
        arguments: toolUse.input ?? {},
      }),
    );

    return {
      content: textContent?.text ?? "",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: response.stop_reason === "tool_use" ? "tool_calls" : "stop",
      usage: response.usage
        ? {
            promptTokens: response.usage.input_tokens ?? 0,
            completionTokens: response.usage.output_tokens ?? 0,
            totalTokens:
              (response.usage.input_tokens ?? 0) +
              (response.usage.output_tokens ?? 0),
          }
        : undefined,
    };
  }
}
