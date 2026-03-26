/**
 * Google Gemini LLM Adapter
 * Stub implementation for Gemini API integration
 *
 * TODO: Implement full Gemini API support
 * - Gemini uses a different API endpoint format
 * - Gemini has its own function calling format (FunctionDeclaration, etc.)
 * - Gemini supports streaming via SSE
 */

import { BaseLLMAdapter, LLMResponse } from "./base/BaseLLMAdapter";
import { AgentMessage, ToolCall, ToolDefinition } from "../../agent/types";

export interface GeminiAdapterConfig {
  apiKey: string;
  model?: string;
}

/**
 * Google Gemini adapter using the Generative Language API.
 *
 * Note: Gemini's API is structurally different from OpenAI:
 * - Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * - Authentication via api_key query parameter
 * - Different content/parts structure
 * - Different function calling format
 */
export class GeminiAdapter extends BaseLLMAdapter {
  model = "gemini-1.5-pro";
  apiKey: string;
  apiVersion = "v1beta";

  constructor(config: GeminiAdapterConfig) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model ?? this.model;
  }

  supportsStreaming(): boolean {
    // Gemini supports streaming via generateContent with stream: true
    return true;
  }

  /**
   * Send a completion request to Gemini's generateContent API.
   *
   * TODO: Implement full Gemini API integration
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
          "Gemini adapter is not properly configured. Please provide an API key.",
      };
    }

    // TODO: Implement Gemini API call
    console.warn(
      "[GeminiAdapter] Gemini adapter is not yet fully implemented. " +
        "This is a stub that returns an error message.",
    );

    return {
      content: "",
      finishReason: "error",
      error:
        "Gemini adapter is not yet implemented. Please use the OpenAI adapter instead.",
    };

    /*
     * TODO: Full implementation outline:
     *
     * const url = `https://generativelanguage.googleapis.com/${this.apiVersion}/models/${this.model}:generateContent?key=${this.apiKey}`;
     * const body = this.toGeminiRequest(messages, tools);
     *
     * const response = await fetch(url, {
     *   method: "POST",
     *   headers: { "Content-Type": "application/json" },
     *   body: JSON.stringify(body),
     * });
     *
     * const json = await response.json();
     * return this.fromGeminiResponse(json);
     */
  }

  /**
   * Convert our message format to Gemini's content/parts format.
   *
   * Gemini content structure:
   * {
   *   role: "user" | "model",
   *   parts: Array<{ text: string } | { functionCall: ... } | { functionResponse: ... }>
   * }
   *
   * TODO: Implement message conversion
   */
  private toGeminiMessages(messages: AgentMessage[]): object {
    // Gemini combines all messages into a single contents array
    // with role differentiation between "user" and "model"
    const contents = messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

    return { contents };
  }

  /**
   * Convert tool definitions to Gemini's function declarations format.
   *
   * Gemini function declarations:
   * {
   *   name: string,
   *   description: string,
   *   parameters: { type: "object", properties: {...}, required: [...] }
   * }
   *
   * TODO: Implement tool conversion
   */
  private toGeminiTools(tools: ToolDefinition[]): object {
    return {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    };
  }

  /**
   * Build the full Gemini generateContent request body.
   *
   * TODO: Implement request building
   */
  private toGeminiRequest(
    messages: AgentMessage[],
    tools?: ToolDefinition[],
  ): object {
    const content = this.toGeminiMessages(messages);
    const request: Record<string, any> = {
      contents: (content as any).contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      },
    };

    if (tools && tools.length > 0) {
      request.tools = this.toGeminiTools(tools);
    }

    return request;
  }

  /**
   * Convert Gemini's response to our LLMResponse format.
   *
   * Gemini response structure:
   * {
   *   candidates: [{
   *     content: {
   *       parts: Array<{ text: string } | { functionCall: { name: string, args: {...} } }>,
   *       role: string
   *     },
   *     finishReason: "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER",
   *     safetyRatings: [...]
   *   }],
   *   usageMetadata: { promptTokenCount: number, candidatesTokenCount: number, totalTokenCount: number }
   * }
   *
   * TODO: Implement response conversion
   */
  private fromGeminiResponse(response: any): LLMResponse {
    const candidate = response.candidates?.[0];
    if (!candidate) {
      return {
        content: "",
        finishReason: "error",
        error: "Invalid Gemini response: no candidates",
      };
    }

    const parts = candidate.content?.parts ?? [];
    const textParts = parts.filter((p: any) => p.text);
    const functionCalls = parts.filter((p: any) => p.functionCall);

    const content = textParts.map((p: any) => p.text).join("");

    const toolCalls: ToolCall[] = functionCalls.map(
      (fc: any, index: number): ToolCall => ({
        id: `gc_${index}`,
        name: fc.functionCall.name,
        arguments: fc.functionCall.args ?? {},
      }),
    );

    const finishReasonMap: Record<string, LLMResponse["finishReason"]> = {
      STOP: "stop",
      MAX_TOKENS: "length",
      SAFETY: "content_filter",
      RECITATION: "content_filter",
    };

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: finishReasonMap[candidate.finishReason] ?? "stop",
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount ?? 0,
            completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: response.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }
}
